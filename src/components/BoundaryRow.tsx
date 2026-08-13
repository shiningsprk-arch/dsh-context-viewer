import React from 'react'
import type { SessionEvent } from '../../shared/types'
import { EventHeader } from './EventRow'

export function BoundaryRow({ event }: { event: SessionEvent }) {
  const isTurn = event.type === 'turn/start' || event.type === 'turn/end'
  let label = event.type
  if (event.type === 'turn/start') label = '第 ' + (event.data as { turn: number }).turn + ' 轮开始'
  if (event.type === 'turn/end') label = '第 ' + (event.data as { turn: number }).turn + ' 轮结束 · ' + JSON.stringify((event.data as { reason: unknown }).reason)
  if (event.type === 'step/start') label = '第 ' + (event.data as { turn: number }).turn + ' 轮 / 第 ' + (event.data as { step: number }).step + ' 步开始'
  if (event.type === 'step/end') label = '第 ' + (event.data as { turn: number }).turn + ' 轮 / 第 ' + (event.data as { step: number }).step + ' 步结束'
  return (
    <div className={'boundary-row' + (isTurn ? ' boundary-turn' : '')}>
      <EventHeader event={event} label={label} icon={isTurn ? '📖' : '•'} color="#8b949e" />
    </div>
  )
}
