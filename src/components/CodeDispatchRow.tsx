import React from 'react'
import type { SessionEvent } from '../../shared/types'
import { EventHeader } from './EventRow'
import { toolColor } from './labels'
import { CodeBlock, JsonBlock } from './JsonBlock'

/** run_code 内部派发的子调用（write/pwsh/bash 等）。 */
export function CodeDispatchRow({
  event, expanded, onToggleExpand,
}: {
  event: SessionEvent
  expanded: boolean
  onToggleExpand: (seq: number) => void
}) {
  const data = event.data as { rootCallId: string; subCallId: string; name: string; arguments: unknown }
  const isShell = data.name === 'pwsh' || data.name === 'bash' || data.name === 'cmd'
  const args = data.arguments as Record<string, unknown> | null
  const command = args && typeof args === 'object' ? (args as Record<string, unknown>).command : undefined
  const isStart = event.type === 'tool/code-dispatch-start'

  return (
    <div className="event-card card-code-dispatch">
      <EventHeader
        event={event}
        label={'派发 ' + data.name + (isStart ? ' ▶' : '')}
        icon={isShell ? '⌨️' : '↳'}
        color={toolColor(data.name)}
      />
      <div className="tool-call-body">
        <div className="tool-call-meta">
          <span className="tool-call-id">subCall: {data.subCallId}</span>
        </div>
        {isShell && command !== undefined && (
          <div className="shell-command">
            <div className="shell-label">shell 命令</div>
            <CodeBlock text={String(command)} lang="powershell" maxHeight={400} />
          </div>
        )}
        <button className="toggle-args" onClick={() => onToggleExpand(event.seq)}>
          {expanded ? '▾ 收起参数' : '▸ 查看完整参数'}
        </button>
        {expanded && (
          <div className="tool-args"><JsonBlock value={data.arguments} /></div>
        )}
      </div>
    </div>
  )
}
