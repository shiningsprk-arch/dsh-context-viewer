import React from 'react'
import type { SessionEvent } from '../../shared/types'
import { contentToText } from '../format'
import { EventHeader } from './EventRow'

export function UserMessageCard({ event }: { event: SessionEvent<'user/message'> }) {
  const data = event.data as { source?: string; content: unknown; turn?: number }
  const text = contentToText(data.content)
  const source = data.source
  return (
    <div className="event-card card-user">
      <EventHeader event={event} label="用户消息" icon="👤" color="#7ee787" />
      {source && source !== 'human' && <div className="user-source">来源: {String(source)}</div>}
      <div className="user-content">{text}</div>
    </div>
  )
}
