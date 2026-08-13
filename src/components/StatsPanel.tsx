import React, { useMemo } from 'react'
import { useStore } from '../store'
import { fmtDuration, fmtTokens, parseToolArguments } from '../format'
import type { SessionEvent } from '../../shared/types'

interface ToolStat { name: string; calls: number; errors: number; totalMs: number }

export function StatsPanel() {
  const { state } = useStore()
  const p = state.projections

  const stats = useMemo(() => {
    const byType = new Map<string, number>()
    const tools = new Map<string, ToolStat>()
    let reasoningChars = 0
    let shellCommands = 0
    let errors = 0
    const calls = new Map<string, { time: number; turn: number; step: number }>()

    for (const entry of state.events) {
      const ev: SessionEvent = entry.event
      byType.set(ev.type, (byType.get(ev.type) ?? 0) + 1)

      if (ev.type === 'assistant/message') {
        const content = (ev.data as { message?: { content?: { type?: string; text?: string }[] } }).message?.content ?? []
        for (const b of content) {
          if (b.type === 'reasoning' && b.text) reasoningChars += b.text.length
        }
      }
      if (ev.type === 'tool/call') {
        const data = ev.data as { callId: string; name: string; arguments: string }
        const t = tools.get(data.name) ?? { name: data.name, calls: 0, errors: 0, totalMs: 0 }
        t.calls++
        tools.set(data.name, t)
        calls.set(data.callId, { time: ev.time, turn: (ev.data as { turn: number }).turn, step: (ev.data as { step: number }).step })
        const args = parseToolArguments(data.arguments)
        if ((args as { command?: string } | null)?.command !== undefined) shellCommands++
      }
      if (ev.type === 'tool/code-dispatch' || ev.type === 'tool/code-dispatch-start') {
        const data = ev.data as { name: string; arguments: unknown }
        const args = data.arguments as { command?: string } | null
        if ((data.name === 'pwsh' || data.name === 'bash' || data.name === 'cmd') && args?.command !== undefined) {
          shellCommands++
        }
        const t = tools.get(data.name) ?? { name: data.name, calls: 0, errors: 0, totalMs: 0 }
        t.calls++
        tools.set(data.name, t)
      }
      if (ev.type === 'tool/result' && (ev.data as { error?: unknown }).error) {
        errors++
      }
    }

    return { byType, tools: [...tools.values()].sort((a, b) => b.calls - a.calls), reasoningChars, shellCommands, errors }
  }, [state.events])

  const projections = p['sessionStats'] as { turns?: number; steps?: number; llmMs?: number; toolMs?: number; decodeMs?: number; decodeTokens?: number } | undefined
  const usage = p['tokenUsage'] as { uncachedInputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number } | undefined
  const pressure = p['contextPressure'] as { pressureTokens?: number; projectedTokens?: number; contextWindow?: number; surfaceTokens?: number } | undefined

  const totalTokens = (usage?.uncachedInputTokens ?? 0) + (usage?.outputTokens ?? 0) + (usage?.cacheReadTokens ?? 0)

  return (
    <main className="main-pane stats-pane">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">运行统计（投影）</div>
          <div className="stat-rows">
            <StatRow label="轮次" value={String(projections?.turns ?? '-')} />
            <StatRow label="步骤" value={String(projections?.steps ?? '-')} />
            <StatRow label="LLM 耗时" value={projections?.llmMs !== undefined ? fmtDuration(projections.llmMs) : '-'} />
            <StatRow label="工具耗时" value={projections?.toolMs !== undefined ? fmtDuration(projections.toolMs) : '-'} />
            <StatRow label="解码耗时" value={projections?.decodeMs !== undefined ? fmtDuration(projections.decodeMs) : '-'} />
            <StatRow label="解码 Token" value={projections?.decodeTokens !== undefined ? fmtTokens(projections.decodeTokens) : '-'} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Token 用量</div>
          <div className="stat-rows">
            <StatRow label="未缓存输入" value={fmtTokens(usage?.uncachedInputTokens)} />
            <StatRow label="输出" value={fmtTokens(usage?.outputTokens)} />
            <StatRow label="缓存读取" value={fmtTokens(usage?.cacheReadTokens)} />
            <StatRow label="缓存写入" value={fmtTokens(usage?.cacheWriteTokens)} />
            <StatRow label="总计" value={fmtTokens(totalTokens)} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">上下文压力</div>
          <div className="stat-rows">
            <StatRow label="压力 Token" value={fmtTokens(pressure?.pressureTokens)} />
            <StatRow label="预计 Token" value={fmtTokens(pressure?.projectedTokens)} />
            <StatRow label="窗口大小" value={fmtTokens(pressure?.contextWindow)} />
            {pressure?.pressureTokens && pressure.contextWindow ? (
              <div className="pressure-bar">
                <div
                  className="pressure-fill"
                  style={{ width: Math.min(100, (pressure.pressureTokens / pressure.contextWindow) * 100) + '%' }}
                />
              </div>
            ) : null}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">本视图统计（已加载事件）</div>
          <div className="stat-rows">
            <StatRow label="事件总数" value={String(state.events.length)} />
            <StatRow label="思考链字符" value={String(stats.reasoningChars)} />
            <StatRow label="shell 命令" value={String(stats.shellCommands)} />
            <StatRow label="工具错误" value={String(stats.errors)} />
          </div>
        </div>
      </div>

      <div className="stat-card full">
        <div className="stat-title">工具调用分布</div>
        {stats.tools.length === 0 && <div className="empty-hint">（无工具调用）</div>}
        <div className="tool-stats">
          {stats.tools.map(t => (
            <div key={t.name} className="tool-stat-row">
              <span className="tool-stat-name">{t.name}</span>
              <span className="tool-stat-calls">{t.calls} 次</span>
              {t.errors > 0 && <span className="tool-stat-errors">⛔ {t.errors}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="stat-card full">
        <div className="stat-title">事件类型分布</div>
        <div className="type-stats">
          {[...stats.byType.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <span key={type} className="type-stat-chip">{type} × {count}</span>
          ))}
        </div>
      </div>
    </main>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}
