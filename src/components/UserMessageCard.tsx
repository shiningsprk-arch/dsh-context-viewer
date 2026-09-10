import React from 'react'
import type { SessionEvent } from '../../shared/types'
import { contentToText, sourceLabel } from '../format'
import { EventHeader } from './EventRow'

export function UserMessageCard({ event }: { event: SessionEvent<'user/message'> }) {
  const data = event.data as { source?: string | Record<string, unknown>; content: unknown; turn?: number }
  const text = contentToText(data.content)
  const source = sourceLabel(data.source as never)
  return (
    <div className="event-card card-user">
      <EventHeader event={event} label="用户消息" icon="👤" color="#7ee787" />
      {source && <div className="user-source">来源: {source}</div>}
      <div className="user-content">{text}</div>
    </div>
  )
}
