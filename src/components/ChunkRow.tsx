import React from 'react'
import type { SessionEvent } from '../../shared/types'
import { truncate } from '../format'
import { EventHeader } from './EventRow'
import { JsonBlock } from './JsonBlock'

export function ChunkRow({
  event, expanded, onToggleExpand,
}: {
  event: SessionEvent<'assistant/chunk'>
  expanded: boolean
  onToggleExpand: (seq: number) => void
}) {
  const data = event.data as { turn: number; step: number; chunk: { type: string; text?: string; name?: string; argumentsDelta?: string; usage?: unknown; reason?: unknown } }
  const chunk = data.chunk
  let summary = chunk.type
  if (chunk.type === 'reasoning-delta' || chunk.type === 'text-delta') summary += ': ' + truncate(chunk.text ?? '', 80)
  if (chunk.type === 'tool-call-delta') summary += '(' + (chunk.name ?? '?') + '): ' + truncate(chunk.argumentsDelta ?? '', 80)
  if (chunk.type === 'usage') summary += ': ' + JSON.stringify(chunk.usage).slice(0, 120)
  if (chunk.type === 'finish') summary += ': ' + JSON.stringify(chunk.reason).slice(0, 120)

  return (
    <div className="event-card card-chunk">
      <EventHeader event={event} label={'流式增量 · ' + chunk.type} icon="⚡" color="#8b949e" />
      <div className="chunk-body">
        <div className="chunk-summary">{summary}</div>
        <button className="toggle-args" onClick={() => onToggleExpand(event.seq)}>
          {expanded ? '▾ 收起' : '▸ 展开'}
        </button>
        {expanded && (
          <div className="tool-args"><JsonBlock value={chunk} /></div>
        )}
      </div>
    </div>
  )
}
