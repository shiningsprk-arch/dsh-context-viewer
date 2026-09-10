/**
 * DSH API 客户端（适配 dsh 0.1.5+ Typert 协议）：
 * - 认证：从 dsh web 启动日志读取本次 token，兑换浏览器认证 cookie
 * - HTTP unary RPC：POST /api/<endpoint>，payload 为 { args }
 * - 实时流：WebSocket /api/remote.mux（open / item / end / error 逻辑流）
 *   - workspace/follow 工作区基线 + 增量
 *   - session/follow 会话快照 + 实时事件 + 助手流
 */
import WebSocket from 'ws'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type {
  ContentBlock, HistoryResult, SearchResult, SessionEvent, SessionSummary, StreamChunk, WorkspaceView,
} from '../shared/types'

export interface SessionFollowSnapshot {
  cursor: number
  records: { type: 'event'; event: SessionEvent }[]
  hasMore: boolean
  projections: { asOfSeq: number; values: Record<string, unknown> }
}

export interface DshClientEvents {
  onConnectionChange(connected: boolean, baseUrl: string): void
  onWorkspaceList(workspaces: WorkspaceView[], archivedSessionIds: string[]): void
  onSessionEvent(sessionId: string, event: SessionEvent): void
  onLiveStream(sessionId: string, attemptId: string, revision: number, blocks: ContentBlock[]): void
  onLiveEnd(sessionId: string, attemptId: string): void
}

const TOKEN_RE = /(https?:\/\/[^\s?]+)\/?\?token=([A-Za-z0-9_-]+)/

/** 从 dsh web 启动日志中读取最近一次启动的地址与 token。 */
function readLatestLaunch(): { baseUrl: string; token: string } | null {
  const candidates: string[] = []
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, 'dsh', 'dsh-web.out.log'))
  candidates.push(join(homedir(), 'Desktop', 'dsh', 'dsh-service.out.log'))
  for (const p of candidates) {
    let text = ''
    try {
      text = readFileSync(p, 'utf8')
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/).filter(Boolean)
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = TOKEN_RE.exec(lines[i])
      if (m) return { baseUrl: m[1].replace(/\/$/, ''), token: m[2] }
    }
  }
  return null
}

interface RpcOk<T> { ok: true; value: T }
interface RpcErr { ok: false; error: { code: string; message: string; details: unknown } }
type RpcResult<T> = RpcOk<T> | RpcErr

interface StreamSpec {
  endpoint: string
  args: unknown
  sentOn: WebSocket | null
  onItem(value: unknown): void
  onEnd?(): void
  onError?(error: unknown): void
}

interface LiveState {
  attemptId: string
  revision: number
  assembler: LiveAttempt
}

interface FollowState {
  sessionId: string
  streamId: string | null
  settled: boolean
  timer: NodeJS.Timeout | null
  live: LiveState | null
  emitTimer: NodeJS.Timeout | null
}

type FollowFrame =
  | { type: 'snapshot'; cursor: number; records: { type: 'event'; event: SessionEvent }[]; hasMore: boolean; projections: { asOfSeq: number; values: Record<string, unknown> } }
  | { type: 'event'; event: SessionEvent }
  | { type: 'assistant-stream'; frame: unknown }

/** 把助手流式 chunk 增量组装成内容块（对应 dsh-llm 的 BlockAssembler）。 */
class LiveAttempt {
  private partials = new Map<number, {
    blockType?: string
    text?: string
    toolCallId?: string
    toolCallName?: string
    args?: string
    block?: ContentBlock
  }>()

  private get(index: number) {
    let p = this.partials.get(index)
    if (!p) {
      p = {}
      this.partials.set(index, p)
    }
    return p
  }

  push(chunk: StreamChunk): void {
    switch (chunk.type) {
      case 'block-start':
        this.get(chunk.index).blockType = chunk.blockType
        break
      case 'text-delta': {
        const p = this.get(chunk.index)
        p.blockType ??= 'text'
        p.text = (p.text ?? '') + chunk.text
        break
      }
      case 'reasoning-delta': {
        const p = this.get(chunk.index)
        p.blockType ??= 'reasoning'
        p.text = (p.text ?? '') + chunk.text
        break
      }
      case 'tool-call-delta': {
        const p = this.get(chunk.index)
        p.blockType ??= 'tool-call'
        p.toolCallId = chunk.id
        if (chunk.name) p.toolCallName = chunk.name
        p.args = (p.args ?? '') + chunk.argumentsDelta
        break
      }
      case 'block-end':
        this.get(chunk.index).block = chunk.block
        break
      default:
        break
    }
  }

  assemble(): ContentBlock[] {
    const blocks: ContentBlock[] = []
    const indexes = [...this.partials.keys()].sort((a, b) => a - b)
    for (const i of indexes) {
      const p = this.partials.get(i)
      if (!p) continue
      if (p.block) {
        blocks.push(p.block)
        continue
      }
      if (p.blockType === 'text' || (p.text !== undefined && p.blockType !== 'reasoning' && p.blockType !== 'tool-call')) {
        if (p.text) blocks.push({ type: 'text', text: p.text })
      } else if (p.blockType === 'reasoning') {
        if (p.text) blocks.push({ type: 'reasoning', text: p.text })
      } else if (p.blockType === 'tool-call') {
        blocks.push({ type: 'tool-call', id: p.toolCallId ?? 'call-' + i, name: p.toolCallName ?? '', arguments: p.args ?? '' })
      }
    }
    return blocks
  }
}

export class DshClient {
  private baseUrl: string
  private cookie = ''
  private mux: WebSocket | null = null
  private muxReady = false
  private destroyed = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private streams = new Map<string, StreamSpec>()
  private streamSeq = 0
  private workspaceStreamId: string | null = null
  private workspaces: WorkspaceView[] = []
  private archivedSessionIds: string[] = []
  private follow: FollowState | null = null
  private cursors = new Map<string, number>()

  connected = false

  constructor(private readonly events: DshClientEvents) {
    const launch = readLatestLaunch()
    this.baseUrl = (process.env.DSH_CV_BASE_URL || launch?.baseUrl || 'http://127.0.0.1:3080').replace(/\/$/, '')
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  getWorkspaces(): WorkspaceView[] {
    return this.workspaces
  }

  getArchivedSessionIds(): string[] {
    return this.archivedSessionIds
  }

  async connect(): Promise<void> {
    if (this.destroyed) return
    try {
      await this.ensureCookie()
      await this.unary<{ items: SessionSummary[] }>('session/list', { _request: {} })
      this.setConnected(true)
      this.openMux()
    } catch (err) {
      this.setConnected(false)
      this.scheduleReconnect()
      throw err
    }
  }

  private setConnected(connected: boolean): void {
    if (this.connected !== connected) {
      this.connected = connected
      this.events.onConnectionChange(connected, this.baseUrl)
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect().catch(() => {})
    }, 3000)
  }

  /** 读取启动日志中的 token 并兑换认证 cookie；force 时强制重新兑换。 */
  private async ensureCookie(force = false): Promise<void> {
    if (this.cookie && !force) return
    this.cookie = ''
    const launch = readLatestLaunch()
    if (launch && !process.env.DSH_CV_BASE_URL) this.baseUrl = launch.baseUrl
    if (!launch) return
    try {
      const res = await fetch(this.baseUrl + '/?token=' + launch.token, { redirect: 'manual' })
      const headers = res.headers as unknown as { getSetCookie?: () => string[] }
      const setCookies = typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie') as string] : [])
      for (const sc of setCookies) {
        const pair = sc.split(';')[0]
        if (pair.startsWith('dsh-auth-')) this.cookie = pair
      }
    } catch {
      // 网络错误：保持无 cookie，后续请求会触发重试
    }
  }

  /** HTTP unary RPC。 */
  private async unary<T>(endpoint: string, args: unknown): Promise<T> {
    let lastErr: Error = new Error('RPC 失败')
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0 || !this.cookie) await this.ensureCookie(attempt > 0)
      try {
        const res = await fetch(this.baseUrl + '/api/' + endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(this.cookie ? { cookie: this.cookie } : {}),
          },
          body: JSON.stringify({
            type: 'client-request',
            rpcId: 'cv-' + Math.random().toString(36).slice(2, 12),
            method: endpoint,
            payload: { args },
          }),
        })
        if (res.status === 401) {
          lastErr = new Error('认证失败（401）')
          this.cookie = ''
          continue
        }
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const msg = (await res.json()) as { type?: string; result?: RpcResult<T> } | null
        if (!msg || msg.type !== 'server-response' || !msg.result) throw new Error('非 server-response')
        if (!msg.result.ok) throw new Error(msg.result.error.message)
        return msg.result.value
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err))
        await new Promise(r => setTimeout(r, 400))
      }
    }
    throw lastErr
  }

  async listSessions(): Promise<SessionSummary[]> {
    const value = await this.unary<{ items: SessionSummary[] }>('session/list', { _request: {} })
    return value.items
  }

  async searchSessions(query: string): Promise<SearchResult[]> {
    const value = await this.unary<{ items: SearchResult[]; hasMore: boolean }>('session/search', { request: { query } })
    return value.items
  }

  /** 历史分页：beforeSeq 向前翻页（需先通过 followSession 获取 cursor）。 */
  async sessionPage(sessionId: string, beforeSeq?: number, maxMessages?: number): Promise<HistoryResult> {
    const throughSeq = this.cursors.get(sessionId)
    if (throughSeq === undefined) throw new Error('缺少会话游标，请先打开该会话')
    const value = await this.unary<{ records: { type: 'event'; event: SessionEvent }[]; hasMore: boolean }>(
      'session/page',
      {
        request: {
          address: { kind: 'session', sessionId },
          throughSeq,
          ...(beforeSeq !== undefined ? { beforeSeq } : {}),
          ...(maxMessages !== undefined ? { maxMessages } : {}),
        },
      },
    )
    return { events: value.records.map(r => ({ event: r.event })), hasMore: value.hasMore }
  }

  /** 打开会话实时流并等待基线快照；替换上一次的订阅。 */
  followSession(sessionId: string, maxMessages = 400): Promise<SessionFollowSnapshot> {
    this.stopFollow()
    return new Promise<SessionFollowSnapshot>((resolve, reject) => {
      const state: FollowState = { sessionId, streamId: null, settled: false, timer: null, live: null, emitTimer: null }
      this.follow = state
      state.timer = setTimeout(() => {
        if (state.settled) return
        state.settled = true
        reject(new Error('等待会话快照超时'))
      }, 20000)
      state.streamId = this.openStream(
        'session/follow',
        { request: { address: { kind: 'session', sessionId }, maxMessages, assistantStream: true } },
        {
          onItem: value => this.handleFollowItem(value, state, resolve),
          onError: error => {
            if (state.settled) return
            state.settled = true
            if (state.timer) clearTimeout(state.timer)
            const message = error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
              ? String((error as { message?: unknown }).message)
              : '会话流错误'
            reject(new Error(message))
          },
          onEnd: () => {
            if (state.settled) return
            state.settled = true
            if (state.timer) clearTimeout(state.timer)
            reject(new Error('会话流已结束'))
          },
        },
      )
    })
  }

  stopFollow(): void {
    if (!this.follow) return
    if (this.follow.emitTimer) clearTimeout(this.follow.emitTimer)
    if (this.follow.timer) clearTimeout(this.follow.timer)
    this.closeStream(this.follow.streamId)
    this.follow = null
  }

  private handleFollowItem(value: unknown, state: FollowState, resolve: (snapshot: SessionFollowSnapshot) => void): void {
    const frame = value as FollowFrame
    if (frame.type === 'snapshot') {
      this.cursors.set(state.sessionId, frame.cursor)
      if (!state.settled) {
        state.settled = true
        if (state.timer) clearTimeout(state.timer)
        resolve({
          cursor: frame.cursor,
          records: frame.records,
          hasMore: frame.hasMore,
          projections: frame.projections,
        })
      }
      return
    }
    if (frame.type === 'event') {
      this.events.onSessionEvent(state.sessionId, frame.event)
      return
    }
    if (frame.type === 'assistant-stream') {
      this.handleLiveFrame(state, frame.frame)
    }
  }

  private handleLiveFrame(state: FollowState, frame: unknown): void {
    const f = frame as { type?: string; attemptId?: string; revision?: number; chunk?: StreamChunk }
    if (f.type === 'start') {
      state.live = { attemptId: f.attemptId ?? '', revision: f.revision ?? 0, assembler: new LiveAttempt() }
      return
    }
    if (f.type === 'chunk') {
      if (!state.live) state.live = { attemptId: f.attemptId ?? '', revision: f.revision ?? 0, assembler: new LiveAttempt() }
      state.live.revision = f.revision ?? state.live.revision
      if (f.chunk) state.live.assembler.push(f.chunk)
      if (!state.emitTimer) {
        state.emitTimer = setTimeout(() => {
          state.emitTimer = null
          if (state.live) this.events.onLiveStream(state.sessionId, state.live.attemptId, state.live.revision, state.live.assembler.assemble())
        }, 120)
      }
      return
    }
    if (f.type === 'end') {
      const live = state.live
      state.live = null
      if (live) this.events.onLiveStream(state.sessionId, live.attemptId, live.revision, live.assembler.assemble())
      this.events.onLiveEnd(state.sessionId, f.attemptId ?? '')
    }
  }

  private openMux(): void {
    if (this.destroyed) return
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/api/remote.mux'
    try {
      this.mux?.close()
    } catch {
      // ignore
    }
    const socket = new WebSocket(wsUrl, {
      headers: this.cookie ? { Cookie: this.cookie } : {},
    })
    this.mux = socket
    socket.on('open', () => {
      if (this.mux !== socket) return
      this.muxReady = true
      this.ensureWorkspaceFollow()
      for (const [id, spec] of this.streams) this.sendOpen(id, spec)
    })
    socket.on('message', data => {
      if (this.mux === socket) this.handleMuxMessage(String(data))
    })
    socket.on('close', () => {
      if (this.mux !== socket) return
      this.muxReady = false
      this.mux = null
      for (const spec of this.streams.values()) spec.sentOn = null
      this.setConnected(false)
      this.scheduleReconnect()
    })
    socket.on('error', () => {
      // close 事件随后触发
    })
    socket.on('unexpected-response', (_req, res) => {
      if (res.statusCode === 401) this.cookie = ''
    })
  }

  private sendOpen(id: string, spec: StreamSpec): void {
    if (!this.muxReady || !this.mux || this.mux.readyState !== WebSocket.OPEN) return
    try {
      this.mux.send(JSON.stringify({ type: 'open', streamId: id, endpoint: spec.endpoint, payload: { args: spec.args } }))
      spec.sentOn = this.mux
    } catch {
      spec.sentOn = null
    }
  }

  private openStream(endpoint: string, args: unknown, handlers: Pick<StreamSpec, 'onItem' | 'onEnd' | 'onError'>): string {
    const id = 's' + String(++this.streamSeq)
    const spec: StreamSpec = { endpoint, args, sentOn: null, ...handlers }
    this.streams.set(id, spec)
    this.sendOpen(id, spec)
    return id
  }

  private closeStream(id: string | null): void {
    if (!id) return
    const spec = this.streams.get(id)
    if (spec?.sentOn && this.mux && this.mux.readyState === WebSocket.OPEN) {
      try {
        this.mux.send(JSON.stringify({ type: 'cancel', streamId: id }))
      } catch {
        // ignore
      }
    }
    this.streams.delete(id)
  }

  private handleMuxMessage(text: string): void {
    let msg: { type?: string; streamId?: string; value?: unknown; error?: unknown }
    try {
      msg = JSON.parse(text) as typeof msg
    } catch {
      return
    }
    if (!msg.type || typeof msg.streamId !== 'string') return
    const spec = this.streams.get(msg.streamId)
    if (!spec) return
    if (msg.type === 'item') {
      spec.onItem(msg.value)
    } else if (msg.type === 'end') {
      this.streams.delete(msg.streamId)
      spec.onEnd?.()
    } else if (msg.type === 'error') {
      this.streams.delete(msg.streamId)
      spec.onError?.(msg.error)
    }
  }

  private ensureWorkspaceFollow(): void {
    if (this.workspaceStreamId) return
    this.workspaceStreamId = this.openStream('workspace/follow', {}, {
      onItem: value => this.handleWorkspaceFrame(value),
      onEnd: () => {
        this.workspaceStreamId = null
      },
    })
  }

  private handleWorkspaceFrame(value: unknown): void {
    const frame = value as {
      type?: string
      value?: { items?: WorkspaceView[]; archivedSessionIds?: string[] }
      workspace?: WorkspaceView
      workspaceId?: string
      workspaceIds?: string[]
      archivedSessionIds?: string[]
    }
    switch (frame.type) {
      case 'baseline':
        this.workspaces = frame.value?.items ?? []
        this.archivedSessionIds = frame.value?.archivedSessionIds ?? []
        break
      case 'upsert': {
        const ws = frame.workspace
        if (!ws) return
        const exists = this.workspaces.some(w => w.workspaceId === ws.workspaceId)
        this.workspaces = exists
          ? this.workspaces.map(w => (w.workspaceId === ws.workspaceId ? ws : w))
          : [...this.workspaces, ws]
        break
      }
      case 'remove':
        this.workspaces = this.workspaces.filter(w => w.workspaceId !== frame.workspaceId)
        break
      case 'order': {
        const ids = frame.workspaceIds ?? []
        const map = new Map(this.workspaces.map(w => [w.workspaceId, w]))
        this.workspaces = ids.map(id => map.get(id)).filter((w): w is WorkspaceView => !!w)
        break
      }
      case 'archived':
        this.archivedSessionIds = frame.archivedSessionIds ?? []
        break
      default:
        return
    }
    this.events.onWorkspaceList(this.workspaces, this.archivedSessionIds)
  }

  destroy(): void {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.stopFollow()
    try {
      this.mux?.close()
    } catch {
      // ignore
    }
    this.mux = null
    this.streams.clear()
  }
}
