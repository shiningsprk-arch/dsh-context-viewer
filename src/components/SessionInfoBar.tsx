import React from 'react'
import { useStore } from '../store'
import { fmtDateTime, fmtDuration, fmtTokens } from '../format'

export function SessionInfoBar() {
  const { state } = useStore()
  const session = state.sessions.find(s => s.sessionId === state.selectedSessionId)
  const p = state.projections

  const title = (p['title'] as string) || session?.sessionId || ''
  const stats = p['sessionStats'] as { turns?: number; steps?: number; llmMs?: number; toolMs?: number; decodeTokens?: number } | undefined
  const usage = p['tokenUsage'] as { uncachedInputTokens?: number; outputTokens?: number; cacheReadTokens?: number } | undefined
  const pressure = p['contextPressure'] as { pressureTokens?: number; projectedTokens?: number; contextWindow?: number } | undefined
  const breakdown = p['contextBreakdown'] as { systemTokens?: number; toolsTokens?: number; messageTokens?: number } | undefined
  const permissions = p['permissions'] as { preset?: string; sandbox?: string; approval?: string; currentValue?: string } | undefined

  return (
    <div className="session-info-bar">
      <div className="session-info-title">
        <span className="session-info-name">{title}</span>
        {session?.running && <span className="running-badge">● 运行中</span>}
        {state.connected && <span className="live-badge">实时</span>}
      </div>
      <div className="session-info-meta">
        <span className="info-chip">ID: {state.selectedSessionId}</span>
        {session?.cwd && <span className="info-chip" title={session.cwd}>{session.cwd}</span>}
        {session?.agentPreset && <span className="info-chip">预设: {session.agentPreset}</span>}
        {session?.updatedAt && <span className="info-chip">更新: {fmtDateTime(session.updatedAt)}</span>}
        {stats && <span className="info-chip">{stats.turns ?? '-'} 轮 / {stats.steps ?? '-'} 步</span>}
        {stats?.llmMs !== undefined && <span className="info-chip">LLM {fmtDuration(stats.llmMs)}</span>}
        {stats?.toolMs !== undefined && <span className="info-chip">工具 {fmtDuration(stats.toolMs)}</span>}
        {usage && (
          <span className="info-chip">
            输出 {fmtTokens(usage.outputTokens)} · 输入 {fmtTokens(usage.uncachedInputTokens)} · 缓存 {fmtTokens(usage.cacheReadTokens)}
          </span>
        )}
        {pressure?.pressureTokens !== undefined && (
          <span className="info-chip">上下文 {fmtTokens(pressure.pressureTokens)}{pressure.contextWindow ? ' / ' + fmtTokens(pressure.contextWindow) : ''}</span>
        )}
        {permissions && (
          <span className="info-chip">权限: {permissions.preset ?? permissions.currentValue ?? '-'}{permissions.approval ? ' / 审批 ' + permissions.approval : ''}</span>
        )}
      </div>
      {breakdown && (
        <div className="breakdown-bar">
          <span className="breakdown-label">上下文构成</span>
          <span className="breakdown-seg seg-system" style={{ flexGrow: breakdown.systemTokens ?? 0 }} title={'系统提示 ' + fmtTokens(breakdown.systemTokens)}>
            {fmtTokens(breakdown.systemTokens)}
          </span>
          <span className="breakdown-seg seg-tools" style={{ flexGrow: breakdown.toolsTokens ?? 0 }} title={'工具 ' + fmtTokens(breakdown.toolsTokens)}>
            {fmtTokens(breakdown.toolsTokens)}
          </span>
          <span className="breakdown-seg seg-messages" style={{ flexGrow: breakdown.messageTokens ?? 0 }} title={'消息 ' + fmtTokens(breakdown.messageTokens)}>
            {fmtTokens(breakdown.messageTokens)}
          </span>
        </div>
      )}
    </div>
  )
}
