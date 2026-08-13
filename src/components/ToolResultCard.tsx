import React from 'react'
import type { SessionEvent, ToolEventView } from '../../shared/types'
import { getToolResultText } from '../format'
import { EventHeader } from './EventRow'
import { CodeBlock, JsonBlock } from './JsonBlock'

export function ToolResultCard({
  event, view, expanded, onToggleExpand,
}: {
  event: SessionEvent<'tool/result'>
  view?: ToolEventView
  expanded: boolean
  onToggleExpand: (seq: number) => void
}) {
  const data = event.data as {
    turn: number
    step: number
    message: { role: string; content: unknown[] } | string
    error?: { name: string; code: string }
    meta?: unknown
  }
  const text = getToolResultText(data.message)
  const hasError = !!data.error
  const viewTitle = view?.view?.title as string | undefined

  return (
    <div className={'event-card card-tool-result' + (hasError ? ' has-error' : '')}>
      <EventHeader
        event={event}
        label={hasError ? '结果错误 [' + (data.error?.code ?? data.error?.name ?? 'error') + ']' : '工具结果'}
        icon={hasError ? '⛔' : '✅'}
        color={hasError ? '#ff7b72' : '#7ee787'}
      />
      <div className="tool-result-body">
        <div className="tool-call-meta">
          <span className="tool-call-step">第 {data.turn} 轮 / 第 {data.step} 步</span>
        </div>
        {viewTitle && <div className="tool-view-title">{viewTitle}</div>}
        {text.trim() !== '' && (
          <div className="tool-result-text">
            <CodeBlock text={text} maxHeight={320} />
          </div>
        )}
        {data.meta !== undefined && (
          <button className="toggle-args" onClick={() => onToggleExpand(event.seq)}>
            {expanded ? '▾ 收起 meta' : '▸ 查看 meta'}
          </button>
        )}
        {expanded && data.meta !== undefined && (
          <div className="tool-args"><JsonBlock value={data.meta} /></div>
        )}
      </div>
    </div>
  )
}
