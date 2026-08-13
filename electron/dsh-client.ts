/**
 * DSH API 客户端：HTTP unary RPC（POST /api/<method>）+ WebSocket 实时流
 * （/api/events.mux 与 /api/events.host）。协议参照 dsh-host-apiproxy。
 */
import WebSocket from 'ws'
import type {
  HostFrame, HistoryResult, MuxFrame, SearchResult, SessionEvent, SessionSummary, ToolEventView, WorkspaceView,
} from '../shared/types'

export interface DshClientEvents {
  onConnectionChange(connected: boolean): void
  onMuxFrame(frame: MuxFrame): void
  onHostFrame(frame: HostFrame): void
}

const DEFAULT_BASE = 'http://127.0.0.1:3080'

interface RpcOk<T> { ok: true; value: T }
interface RpcErr { ok: false; error: { code: string; message: string; details: unknown } }
type RpcResult<T> = RpcOk<T> | RpcErr

export class DshClient {
  private baseUrl = DEFAULT_BASE
  private muxSocket: WebSocket | null = null
  private hostSocket: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private destroyed = false
  connected = false
  /** mux 帧队列：连接建立时按序交付，防止先发事件后收基线。 */
  private pendingFrames: MuxFrame[] = []

  constructor(private readonly events: DshClientEvents) {}

  getBaseUrl(): string {
    return this.baseUrl
  }

  async connect(): Promise<void> {
    if (this.destroyed) return
    // 探测服务器可用性
    try {
      const resp = await this.unary<{ version?: string }>('host.describe', {})
      if (!resp.ok) throw new Error('host.describe 失败: ' + resp.error.message)
      this.setConnected(true)
    } catch (err) {
      this.setConnected(false)
      this.scheduleReconnect()
      throw err
    }
    this.openMux()
    this.openHost()
  }

  private setConnected(connected: boolean): void {
    if (this.connected !== connected) {
      this.connected = connected
      this.events.onConnectionChange(connected)
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect().catch(() => {})
    }, 3000)
  }

  private openMux(): void {
    if (this.destroyed) return
    try {
      this.muxSocket?.close()
    } catch { /* ignore */ }
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/api/events.mux'
    const socket = new WebSocket(wsUrl)
    this.muxSocket = socket
    socket.on('open', () => {
      // 打开即推送基线帧；连接期间先缓存，避免乱序
    })
    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(String(data))
        if (msg?.type !== 'server-request' || !msg.payload) return
        this.handleMuxFrame(msg.payload as MuxFrame)
      } catch { /* 丢弃坏帧 */ }
    })
    socket.on('close', () => {
      if (this.muxSocket === socket) {
        this.muxSocket = null
        this.setConnected(false)
        this.scheduleReconnect()
      }
    })
    socket.on('error', () => { /* close 会随后触发 */ })
  }

  private openHost(): void {
    if (this.destroyed) return
    try {
      this.hostSocket?.close()
    } catch { /* ignore */ }
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/api/events.host'
    const socket = new WebSocket(wsUrl)
    this.hostSocket = socket
    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(String(data))
        if (msg?.type !== 'server-request' || !msg.payload) return
        this.events.onHostFrame(msg.payload as HostFrame)
      } catch { /* 丢弃坏帧 */ }
    })
    socket.on('close', () => {
      if (this.hostSocket === socket) {
        this.hostSocket = null
        this.setConnected(false)
        this.scheduleReconnect()
      }
    })
    socket.on('error', () => { /* close 会随后触发 */ })
  }

  private handleMuxFrame(frame: MuxFrame): void {
    // session/subscribed 之前的帧属于基线，直接交付；之后的按序。
    this.pendingFrames.push(frame)
    // 简单起见：一律按到达顺序交付，renderer 端按 seq 归并。
    this.events.onMuxFrame(frame)
    if (frame.type === 'session/subscribed') {
      this.pendingFrames = this.pendingFrames.filter(f => f !== frame)
    }
  }

  /** 通用 unary RPC。 */
  async unary<T>(method: string, payload: unknown): Promise<RpcResult<T>> {
    const body = {
      type: 'client-request',
      rpcId: 'cv-' + Math.random().toString(36).slice(2, 12),
      method,
      payload,
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(this.baseUrl + '/api/' + method, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const msg = (await res.json()) as { type?: string; result?: RpcResult<T> } | null
      if (!msg || msg.type !== 'server-response' || !msg.result) throw new Error('非 server-response')
      return msg.result
    } finally {
      clearTimeout(timer)
    }
  }

  async listWorkspaces(): Promise<WorkspaceView[]> {
    const resp = await this.unary<{ items: WorkspaceView[]; archivedSessionIds: string[] }>('workspace.list', {})
    if (!resp.ok) throw new Error(resp.error.message)
    return resp.value.items
  }

  async listSessions(): Promise<SessionSummary[]> {
    const resp = await this.unary<{ items: SessionSummary[] }>('session.list', {})
    if (!resp.ok) throw new Error(resp.error.message)
    return resp.value.items
  }

  async sessionHistory(sessionId: string, beforeSeq?: number, maxMessages?: number): Promise<HistoryResult> {
    const resp = await this.unary<HistoryResult>('session.history', {
      sessionId,
      ...(beforeSeq !== undefined ? { beforeSeq } : {}),
      ...(maxMessages !== undefined ? { maxMessages } : {}),
    })
    if (!resp.ok) throw new Error(resp.error.message)
    return resp.value
  }

  async searchSessions(query: string): Promise<SearchResult[]> {
    const resp = await this.unary<{ items: SearchResult[]; hasMore: boolean }>('session.search', { query })
    if (!resp.ok) throw new Error(resp.error.message)
    return resp.value.items
  }

  destroy(): void {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    try { this.muxSocket?.close() } catch { /* ignore */ }
    try { this.hostSocket?.close() } catch { /* ignore */ }
    this.muxSocket = null
    this.hostSocket = null
  }
}

// 事件类型标签见 ../shared/labels.ts
