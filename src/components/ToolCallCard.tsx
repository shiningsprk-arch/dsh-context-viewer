import React from 'react'
import type { SessionEvent, ToolEventView } from '../../shared/types'
import { isShellTool, parseToolArguments, truncate } from '../format'
import { EventHeader } from './EventRow'
import { toolColor } from './labels'
import { CodeBlock, JsonBlock } from './JsonBlock'

export function ToolCallCard({
  event, view, expanded, onToggleExpand,
}: {
  event: SessionEvent<'tool/call'>
  view?: ToolEventView
  expanded: boolean
  onToggleExpand: (seq: number) => void
}) {
  const data = event.data as { turn: number; step: number; callId: string; name: string; arguments: string }
  const args = parseToolArguments(data.arguments)
  const argsObj = args !== null && typeof args === 'object' ? (args as Record<string, unknown>) : null
  const color = toolColor(data.name)
  const viewTitle = view?.view?.title as string | undefined
  const rawInput = view?.view?.rawInput as string | undefined

  return (
    <div className="event-card card-tool-call">
      <EventHeader event={event} label={'调用 ' + data.name} icon="🔧" color={color} />
      <div className="tool-call-body">
        <div className="tool-call-meta">
          <span className="tool-call-id">callId: {data.callId}</span>
          <span className="tool-call-step">第 {data.turn} 轮 / 第 {data.step} 步</span>
        </div>
        {viewTitle && <div className="tool-view-title">{viewTitle}</div>}
        {isShellTool(data.name) && argsObj?.command !== undefined && (
          <div className="shell-command">
            <div className="shell-label">shell 命令</div>
            <CodeBlock text={String(argsObj.command)} lang="powershell" maxHeight={400} />
            {typeof argsObj.description === 'string' && (
              <div className="shell-desc">{argsObj.description}</div>
            )}
            {argsObj.workdir !== undefined && (
              <div className="shell-workdir">workdir: {String(argsObj.workdir)}</div>
            )}
          </div>
        )}
        <button className="toggle-args" onClick={() => onToggleExpand(event.seq)}>
          {expanded ? '▾ 收起参数' : '▸ 查看完整参数'}{rawInput ? ' · ' + truncate(rawInput, 60) : ''}
        </button>
        {expanded && (
          <div className="tool-args">
            {args !== null ? <JsonBlock value={args} /> : <CodeBlock text={data.arguments} />}
          </div>
        )}
      </div>
    </div>
  )
}
