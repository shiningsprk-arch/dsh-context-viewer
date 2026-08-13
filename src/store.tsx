import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type {
  HistoryEntry, HostFrame, MuxFrame, PushMessage, SessionEvent, SessionSummary, ToolEventView, WorkspaceView,
} from '../shared/types'

export interface FilterState {
  user: boolean
  assistant: boolean
  thinking: boolean
  toolCall: boolean
  toolResult: boolean
  boundary: boolean
  chunks: boolean
  other: boolean
}

export const DEFAULT_FILTER: FilterState = {
  user: true,
  assistant: true,
  thinking: true,
  toolCall: true,
  toolResult: true,
  boundary: false,
  chunks: false,
  other: true,
}

export type ViewMode = 'timeline' | 'raw' | 'stats'

export interface AppState {
  connected: boolean
  baseUrl: string
  workspaces: WorkspaceView[]
  sessions: SessionSummary[]
  selectedSessionId: string | null
  events: HistoryEntry[]
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  loadedTailSeq: number | null
  projections: Record<string, unknown>
  view: ViewMode
  filter: FilterState
  searchQuery: string
  globalSearch: { sessionId: string; snippet: string }[]
  searching: boolean
  expanded: Set<number>
  showChunks: boolean
  toast: string | null
}

type Action =
  | { type: 'connected'; connected: boolean; baseUrl: string }
  | { type: 'snapshot'; workspaces: WorkspaceView[]; sessions: SessionSummary[] }
  | { type: 'sessions'; sessions: SessionSummary[] }
  | { type: 'select'; sessionId: string }
  | { type: 'history'; events: HistoryEntry[]; hasMore: boolean; projections?: Record<string, unknown> }
  | { type: 'more'; events: HistoryEntry[]; hasMore: boolean }
  | { type: 'loading'; loading: boolean }
  | { type: 'loadingMore'; loadingMore: boolean }
  | { type: 'pushEvent'; sessionId: string; event: SessionEvent; view?: ToolEventView }
  | { type: 'pushProjection'; sessionId: string; key: string; value: unknown }
  | { type: 'pushStatus'; sessionId: string; running: boolean }
  | { type: 'pushSessionAdded'; sessionId: string; blank: boolean; cwd?: string; agentPreset?: string }
  | { type: 'pushSessionRemoved'; sessionId: string }
  | { type: 'pushWorkspaceChanged'; workspace: WorkspaceView }
  | { type: 'pushWorkspaceRemoved'; workspaceId: string }
  | { type: 'pushAgentError'; sessionId: string; message: string }
  | { type: 'setView'; view: ViewMode }
  | { type: 'setFilter'; filter: FilterState }
  | { type: 'setSearchQuery'; query: string }
  | { type: 'setGlobalSearch'; items: { sessionId: string; snippet: string }[]; searching: boolean }
  | { type: 'toggleExpand'; seq: number }
  | { type: 'setShowChunks'; show: boolean }
  | { type: 'toast'; message: string | null }

function insertEvent(events: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const idx = events.findIndex(e => e.event.seq === entry.event.seq)
  if (idx >= 0) {
    const next = events.slice()
    next[idx] = entry
    return next
  }
  const next = events.slice()
  next.push(entry)
  next.sort((a, b) => a.event.seq - b.event.seq)
  return next
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'connected':
      return { ...state, connected: action.connected, baseUrl: action.baseUrl }
    case 'snapshot':
      return { ...state, workspaces: action.workspaces, sessions: action.sessions }
    case 'sessions':
      return { ...state, sessions: action.sessions }
    case 'select':
      return {
        ...state,
        selectedSessionId: action.sessionId,
        events: [],
        hasMore: false,
        loadedTailSeq: null,
        projections: {},
        expanded: new Set(),
      }
    case 'history':
      return {
        ...state,
        events: action.events,
        hasMore: action.hasMore,
        loading: false,
        loadedTailSeq: action.events.length > 0 ? action.events[action.events.length - 1].event.seq : null,
        projections: action.projections ?? state.projections,
      }
    case 'more': {
      const merged = [...action.events, ...state.events]
      const bySeq = new Map<number, HistoryEntry>()
      for (const e of merged) bySeq.set(e.event.seq, e)
      const sorted = [...bySeq.values()].sort((a, b) => a.event.seq - b.event.seq)
      return { ...state, events: sorted, hasMore: action.hasMore, loadingMore: false }
    }
    case 'loading':
      return { ...state, loading: action.loading }
    case 'loadingMore':
      return { ...state, loadingMore: action.loadingMore }
    case 'pushEvent': {
      const entry: HistoryEntry = { event: action.event, view: action.view }
      if (action.sessionId === state.selectedSessionId) {
        return { ...state, events: insertEvent(state.events, entry) }
      }
      return state
    }
    case 'pushProjection':
      if (action.sessionId !== state.selectedSessionId) return state
      return { ...state, projections: { ...state.projections, [action.key]: action.value } }
    case 'pushStatus':
      return {
        ...state,
        sessions: state.sessions.map(s => s.sessionId === action.sessionId ? { ...s, running: action.running, updatedAt: Date.now() } : s),
      }
    case 'pushSessionAdded': {
      if (state.sessions.some(s => s.sessionId === action.sessionId)) return state
      const summary: SessionSummary = {
        sessionId: action.sessionId,
        updatedAt: Date.now(),
        running: false,
        blank: action.blank,
        cwd: action.cwd,
        agentPreset: action.agentPreset,
      }
      return { ...state, sessions: [summary, ...state.sessions] }
    }
    case 'pushSessionRemoved':
      return { ...state, sessions: state.sessions.filter(s => s.sessionId !== action.sessionId) }
    case 'pushWorkspaceChanged': {
      const idx = state.workspaces.findIndex(w => w.workspaceId === action.workspace.workspaceId)
      if (idx >= 0) {
        const next = state.workspaces.slice()
        next[idx] = action.workspace
        return { ...state, workspaces: next }
      }
      return { ...state, workspaces: [...state.workspaces, action.workspace] }
    }
    case 'pushWorkspaceRemoved':
      return { ...state, workspaces: state.workspaces.filter(w => w.workspaceId !== action.workspaceId) }
    case 'pushAgentError':
      return { ...state, toast: `[agent 错误] ${action.sessionId.slice(0, 12)}: ${action.message}` }
    case 'setView':
      return { ...state, view: action.view }
    case 'setFilter':
      return { ...state, filter: action.filter }
    case 'setSearchQuery':
      return { ...state, searchQuery: action.query }
    case 'setGlobalSearch':
      return { ...state, globalSearch: action.items, searching: action.searching }
    case 'toggleExpand': {
      const next = new Set(state.expanded)
      if (next.has(action.seq)) next.delete(action.seq)
      else next.add(action.seq)
      return { ...state, expanded: next }
    }
    case 'setShowChunks':
      return { ...state, showChunks: action.show }
    case 'toast':
      return { ...state, toast: action.message }
    default:
      return state
  }
}

const initialState: AppState = {
  connected: false,
  baseUrl: '',
  workspaces: [],
  sessions: [],
  selectedSessionId: null,
  events: [],
  hasMore: false,
  loading: false,
  loadingMore: false,
  loadedTailSeq: null,
  projections: {},
  view: 'timeline',
  filter: DEFAULT_FILTER,
  searchQuery: '',
  globalSearch: [],
  searching: false,
  expanded: new Set(),
  showChunks: false,
  toast: null,
}

interface StoreCtx {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const Ctx = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // 订阅主进程推送
  useEffect(() => {
    const off = window.dsh.onPush((msg: PushMessage) => {
      switch (msg.kind) {
        case 'connection':
          dispatch({ type: 'connected', connected: msg.connected, baseUrl: msg.baseUrl })
          break
        case 'session/event':
          dispatch({ type: 'pushEvent', sessionId: msg.sessionId, event: msg.event, view: msg.view })
          break
        case 'session/projection':
          dispatch({ type: 'pushProjection', sessionId: msg.sessionId, key: msg.key, value: msg.value })
          break
        case 'host/session-status':
          dispatch({ type: 'pushStatus', sessionId: msg.sessionId, running: msg.running })
          break
        case 'host/session-added':
          dispatch({ type: 'pushSessionAdded', sessionId: msg.sessionId, blank: msg.blank, cwd: msg.cwd, agentPreset: msg.agentPreset })
          break
        case 'host/session-removed':
          dispatch({ type: 'pushSessionRemoved', sessionId: msg.sessionId })
          break
        case 'host/workspace-changed':
          dispatch({ type: 'pushWorkspaceChanged', workspace: msg.workspace })
          break
        case 'host/workspace-removed':
          dispatch({ type: 'pushWorkspaceRemoved', workspaceId: msg.workspaceId })
          break
        case 'host/agent-error':
          dispatch({ type: 'pushAgentError', sessionId: msg.sessionId, message: msg.message })
          break
        default:
          break
      }
    })
    return off
  }, [])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用')
  return ctx
}
