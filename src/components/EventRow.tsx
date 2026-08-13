import React from 'react'
import type { HistoryEntry } from '../../shared/types'
import { fmtTime } from '../format'
import { formatEventType } from './labels'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallCard } from './ToolCallCard'
import { ToolResultCard } from './ToolResultCard'
import { UserMessageCard } from './UserMessageCard'
import { AssistantMessageCard } from './AssistantMessageCard'
import { ChunkRow } from './ChunkRow'
import { BoundaryRow } from './BoundaryRow'
import { OtherEventRow } from './OtherEventRow'
import { CodeDispatchRow } from './CodeDispatchRow'

export interface EventRowProps {
  entry: HistoryEntry
  expanded: boolean
  onToggleExpand: (seq: number) => void
}

export function EventRow({ entry, expanded, onToggleExpand }: EventRowProps) {
  const ev = entry.event
  switch (ev.type) {
    case 'user/message':
      return <UserMessageCard event={ev as never} />
    case 'assistant/message':
      return <AssistantMessageCard event={ev as never} expanded={expanded} onToggleExpand={onToggleExpand} />
    case 'assistant/chunk':
      return <ChunkRow event={ev as never} expanded={expanded} onToggleExpand={onToggleExpand} />
    case 'tool/call':
      return <ToolCallCard event={ev as never} view={entry.view} expanded={expanded} onToggleExpand={onToggleExpand} />
    case 'tool/result':
      return <ToolResultCard event={ev as never} view={entry.view} expanded={expanded} onToggleExpand={onToggleExpand} />
    case 'turn/start':
    case 'turn/end':
    case 'step/start':
    case 'step/end':
      return <BoundaryRow event={ev} />
    case 'tool/code-dispatch':
    case 'tool/code-dispatch-start':
      return <CodeDispatchRow event={ev} expanded={expanded} onToggleExpand={onToggleExpand} />
    default:
      return <OtherEventRow event={ev} expanded={expanded} onToggleExpand={onToggleExpand} />
  }
}

/** 事件行通用头部：时间 + 类型标签。 */
export function EventHeader({
  event, label, icon, color,
}: {
  event: { type: string; seq: number; time: number }
  label?: string
  icon?: string
  color?: string
}) {
  return (
    <div className="event-header">
      <span className="event-time">{fmtTime(event.time)}</span>
      <span className="event-seq">#{event.seq}</span>
      <span className="event-type" style={color ? { color } : undefined}>
        {icon ? icon + ' ' : ''}{label ?? formatEventType(event.type)}
      </span>
    </div>
  )
}
