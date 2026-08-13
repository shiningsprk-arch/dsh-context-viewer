import React from 'react'
import type { SessionEvent } from '../../shared/types'
import { EventHeader } from './EventRow'
import { JsonBlock } from './JsonBlock'

export function OtherEventRow({
  event, expanded, onToggleExpand,
}: {
  event: SessionEvent
  expanded: boolean
  onToggleExpand: (seq: number) => void
}) {
  return (
    <div className="event-card card-other">
      <EventHeader event={event} label={event.type} icon="📄" color="#8b949e" />
      <div className="other-body">
        <button className="toggle-args" onClick={() => onToggleExpand(event.seq)}>
          {expanded ? '▾ 收起' : '▸ 查看原始数据'}
        </button>
        {expanded && <div className="tool-args"><JsonBlock value={event.data} /></div>}
      </div>
    </div>
  )
}
