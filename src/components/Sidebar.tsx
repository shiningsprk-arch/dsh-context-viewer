import React from 'react'
import { useStore } from '../store'
import type { SessionSummary, WorkspaceView } from '../../shared/types'
import { fmtDateTime, fmtTokens } from '../format'

function sessionTitle(s: SessionSummary): string {
  const t = s.projections?.values?.['title']
  if (typeof t === 'string' && t.trim()) return t
  return s.sessionId
}

function sessionPreview(s: SessionSummary): string {
  const stats = s.projections?.values?.['sessionStats'] as { turns?: number; steps?: number } | undefined
  const usage = s.projections?.values?.['tokenUsage'] as { outputTokens?: number; uncachedInputTokens?: number } | undefined
  const parts: string[] = []
  if (stats?.turns !== undefined) parts.push(stats.turns + ' 轮')
  if (stats?.steps !== undefined) parts.push(stats.steps + ' 步')
  if (usage?.outputTokens !== undefined) parts.push('输出 ' + fmtTokens(usage.outputTokens))
  return parts.join(' · ')
}

export function Sidebar() {
  const { state, dispatch } = useStore()

  const sortedSessions = (ids: string[]): SessionSummary[] => {
    const map = new Map(state.sessions.map(s => [s.sessionId, s]))
    return ids
      .map(id => map.get(id))
      .filter((s): s is SessionSummary => !!s)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  const orphanSessions = state.sessions.filter(
    s => !state.workspaces.some(w => w.sessionIds.includes(s.sessionId)),
  )

  const selectSession = (id: string) => {
    dispatch({ type: 'select', sessionId: id })
  }

  return (
    <aside className="sidebar">
      {state.globalSearch.length > 0 && (
        <div className="global-search-results">
          <div className="sidebar-section-title">搜索结果（{state.globalSearch.length}）</div>
          {state.globalSearch.map(item => (
            <button
              key={item.sessionId}
              data-session-id={item.sessionId}
              className={'session-item' + (state.selectedSessionId === item.sessionId ? ' selected' : '')}
              onClick={() => selectSession(item.sessionId)}
            >
              <div className="session-item-title">{item.sessionId.slice(0, 30)}</div>
              <div className="session-item-snippet">{item.snippet}</div>
            </button>
          ))}
        </div>
      )}
      {state.globalSearch.length === 0 && state.workspaces.map((w: WorkspaceView) => (
        <div key={w.workspaceId} className="workspace-group">
          <div className="sidebar-section-title" title={w.path}>{w.title || w.path}</div>
          {sortedSessions(w.sessionIds).map(s => (
            <button
              key={s.sessionId}
              data-session-id={s.sessionId}
              className={'session-item' + (state.selectedSessionId === s.sessionId ? ' selected' : '')}
              onClick={() => selectSession(s.sessionId)}
            >
              <div className="session-item-title">
                {sessionTitle(s)}
                {s.running && <span className="running-badge">● 运行中</span>}
              </div>
              <div className="session-item-meta">
                <span>{fmtDateTime(s.updatedAt)}</span>
                <span className="session-preview">{sessionPreview(s)}</span>
              </div>
            </button>
          ))}
          {w.sessionIds.length === 0 && <div className="empty-hint">（无会话）</div>}
        </div>
      ))}
      {orphanSessions.length > 0 && (
        <div className="workspace-group">
          <div className="sidebar-section-title">其他会话</div>
          {orphanSessions.map(s => (
            <button
              key={s.sessionId}
              data-session-id={s.sessionId}
              className={'session-item' + (state.selectedSessionId === s.sessionId ? ' selected' : '')}
              onClick={() => selectSession(s.sessionId)}
            >
              <div className="session-item-title">{sessionTitle(s)}</div>
              <div className="session-item-meta">
                <span>{fmtDateTime(s.updatedAt)}</span>
                <span className="session-preview">{sessionPreview(s)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {state.workspaces.length === 0 && state.sessions.length === 0 && (
        <div className="empty-hint">未发现会话{state.connected ? '' : '（未连接 DSH）'}</div>
      )}
    </aside>
  )
}
