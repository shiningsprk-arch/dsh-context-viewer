/**
 * DSH 数据模型与 IPC 协议共享类型（main/preload/renderer 共用）。
 * 字段以 DSH host-apiproxy 实际 wire 格式为准。
 */

// ---------- DSH HTTP API 响应 ----------

export interface WorkspaceView {
  workspaceId: string
  path: string
  title: string
  sessionIds: string[]
  createdAt: string
  updatedAt: string
}

export interface SessionSummary {
  sessionId: string
  updatedAt: number
  running: boolean
  blank: boolean
  parentSessionId?: string
  origin?: 'subagent'
  cwd?: string
  agentPreset?: string
  projections?: SessionProjectionsBlock
}

export interface SessionProjectionsBlock {
  asOfSeq: number
  values: Record<string, unknown>
}

export interface SessionStatsProjection {
  turns: number
  steps: number
  llmMs: number
  toolMs: number
  ttftMs: number
  ttftSteps: number
  decodeMs: number
  decodeTokens: number
  lastTurn?: number
}

export interface TokenUsageProjection {
  uncachedInputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface ContextPressureProjection {
  pressureTokens?: number
  projectedTokens?: number
  contextWindow?: number
  surfaceTokens?: number
  sampledSurfaceTokens?: number
}

export interface ContextBreakdownProjection {
  systemTokens?: number
  toolsTokens?: number
  messageTokens?: number
}

export interface PermissionPresetProjection {
  preset?: string
  sandbox?: string
  approval?: string
  currentValue?: string
  options?: { value: string; name: string }[]
}

// ---------- 会话事件 ----------

export type StreamChunk =
  | { type: 'block-start'; index: number; blockType: string }
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'reasoning-delta'; index: number; text: string }
  | { type: 'tool-call-delta'; index: number; id: string; name?: string; argumentsDelta: string }
  | { type: 'block-end'; index: number; block: ContentBlock }
  | { type: 'usage'; usage: Record<string, unknown> }
  | { type: 'finish'; reason: unknown; replayState?: unknown }

export type ContentBlock =
  | { type: 'reasoning'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool-call'; id: string; name: string; arguments: string }

export interface SessionEventDataMap {
  'turn/start': { turn: number }
  'turn/end': { turn: number; reason: unknown }
  'step/start': { turn: number; step: number }
  'step/end': { turn: number; step: number }
  'user/message': { source?: string; content: unknown; turn?: number }
  'assistant/chunk': { turn: number; step: number; chunk: StreamChunk }
  'assistant/message': { turn: number; step: number; message: { role: string; content: ContentBlock[] }; usage?: Record<string, unknown> }
  'tool/call': { turn: number; step: number; callId: string; name: string; arguments: string }
  'tool/result': {
    turn: number
    step: number
    message: { role: string; content: unknown[] } | string
    error?: { name: string; code: string }
    meta?: unknown
  }
  'todo/write': { todos: unknown[] }
  'request/header': { header: unknown; reason: unknown }
  'request/context': unknown
  'session/end-seed': Record<string, never>
  'tool/code-dispatch-start': { rootCallId: string; parentCallId: string; subCallId: string; name: string; arguments: unknown }
  'tool/code-dispatch': { rootCallId: string; parentCallId: string; subCallId: string; name: string; arguments: unknown }
}

export type SessionEventType = keyof SessionEventDataMap

export interface SessionEvent<T extends SessionEventType = SessionEventType> {
  type: T
  seq: number
  time: number
  data: SessionEventDataMap[T]
  sourceEventSeqs?: number[]
  surfaceOp?: unknown
  ignorable?: true
}

export interface ToolEventView {
  for: 'call' | 'result'
  view: {
    card?: string
    title?: string
    kind?: string
    rawInput?: string
    [k: string]: unknown
  }
}

export interface HistoryEntry {
  event: SessionEvent
  view?: ToolEventView
}

// ---------- Mux / Host 实时帧 ----------

export type MuxFrame =
  | { type: 'session/event'; sessionId: string; event: SessionEvent; view?: ToolEventView }
  | { type: 'session/subscribed'; sessionId: string; lastSeq: number }
  | { type: 'approval/requested'; sessionId: string; approvalId: string; toolName: string; callId?: string; reason?: string }
  | { type: 'approval/resolved'; sessionId: string; approvalId: string; outcome: unknown }
  | { type: 'question/requested'; sessionId: string; questions: unknown[] }
  | { type: 'question/resolved'; sessionId: string; questionRpcId: string; outcome: unknown }
  | { type: 'session/queue'; sessionId: string; items: unknown[] }
  | { type: 'session/jobs'; sessionId: string; jobs: unknown[] }
  | { type: 'session/projection'; sessionId: string; key: string; value: unknown; seq: number }
  | { type: 'stream/error'; error: unknown }

export type HostFrame =
  | { type: 'host/session-added'; sessionId: string; blank: boolean; parentSessionId?: string; origin?: 'subagent'; cwd?: string; agentPreset?: string }
  | { type: 'host/session-removed'; sessionId: string }
  | { type: 'host/session-status'; sessionId: string; running: boolean }
  | { type: 'host/agent-error'; sessionId: string; message: string }
  | { type: 'host/workspace-changed'; workspace: WorkspaceView }
  | { type: 'host/workspace-removed'; workspaceId: string }
  | { type: 'host/workspace-order-changed'; workspaceIds: string[] }
  | { type: 'host/archived-sessions-changed'; archivedSessionIds: string[] }
  | { type: 'host/remote-event'; event: string; args: unknown[] }
  | { type: 'stream/error'; error: unknown }

// ---------- IPC 协议 ----------

/** renderer → main 请求（invoke）。 */
export interface IpcApi {
  /** 获取连接快照：workspaces + sessions + 连接状态。 */
  getSnapshot(): Promise<Snapshot>
  /** 重新拉取会话列表。 */
  listSessions(): Promise<SessionSummary[]>
  /** 分页拉取会话历史（beforeSeq 向前翻页；不传则从尾部取最新）。 */
  sessionHistory(sessionId: string, beforeSeq?: number, maxMessages?: number): Promise<HistoryResult>
  /** 全局搜索会话。 */
  searchSessions(query: string): Promise<SearchResult[]>
  /** 导出：弹出保存对话框并写入内容。ext: md | jsonl | json */
  saveExport(suggestedName: string, ext: 'md' | 'jsonl' | 'json', content: string): Promise<{ canceled: boolean; path?: string }>
  /** 打开外部链接/路径。 */
  openExternal(url: string): Promise<void>
}

export interface Snapshot {
  connected: boolean
  baseUrl: string
  version?: string
  workspaces: WorkspaceView[]
  sessions: SessionSummary[]
}

export interface HistoryResult {
  events: HistoryEntry[]
  hasMore: boolean
  projections?: SessionProjectionsBlock
}

export interface SearchResult {
  sessionId: string
  snippet: string
}

/** main → renderer 推送（on 事件）。 */
export type PushMessage =
  | { kind: 'connection'; connected: boolean; baseUrl: string }
  | { kind: 'session/event'; sessionId: string; event: SessionEvent; view?: ToolEventView }
  | { kind: 'session/projection'; sessionId: string; key: string; value: unknown; seq: number }
  | { kind: 'session/subscribed'; sessionId: string; lastSeq: number }
  | { kind: 'host/session-status'; sessionId: string; running: boolean }
  | { kind: 'host/session-added'; sessionId: string; blank: boolean; cwd?: string; agentPreset?: string }
  | { kind: 'host/session-removed'; sessionId: string }
  | { kind: 'host/workspace-changed'; workspace: WorkspaceView }
  | { kind: 'host/workspace-removed'; workspaceId: string }
  | { kind: 'host/agent-error'; sessionId: string; message: string }
  | { kind: 'approval/requested'; sessionId: string; approvalId: string; toolName: string; reason?: string }

/** preload 暴露到 window 的桥。 */
export interface DshBridge extends IpcApi {
  onPush(cb: (msg: PushMessage) => void): () => void
}
