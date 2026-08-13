import React from 'react'
import type { SessionEvent } from '../../shared/types'
import { extractReasoning, extractText, parseToolArguments } from '../format'
import { EventHeader } from './EventRow'
import { ThinkingBlock } from './ThinkingBlock'

export function AssistantMessageCard({
  event, expanded, onToggleExpand,
}: {
  event: SessionEvent<'assistant/message'>
  expanded: boolean
  onToggleExpand: (seq: number) => void
}) {
  const data = event.data as { turn: number; step: number; message: { role: string; content: unknown[] }; usage?: Record<string, unknown> }
  const content = data.message.content as { type: string; text?: string; id?: string; name?: string; arguments?: string }[]
  const reasoning = extractReasoning(content as never)
  const text = extractText(content as never)
  const toolCalls = content.filter(b => b.type === 'tool-call')
  const usage = data.usage

  return (
    <div className="event-card card-assistant">
      <EventHeader
        event={event}
        label={'助手消息 · 第 ' + data.turn + ' 轮/第 ' + data.step + ' 步'}
        icon="🤖"
        color="#79c0ff"
      />
      {usage && (
        <div className="usage-line">
          {usage.outputTokens !== undefined && <>输出 {usage.outputTokens} tok</>}
          {usage.reasoningTokens !== undefined && <> · 思考 {usage.reasoningTokens} tok</>}
          {usage.inputTokens !== undefined && <> · 输入 {usage.inputTokens} tok</>}
          {usage.cacheReadTokens !== undefined && <> · 缓存 {usage.cacheReadTokens} tok</>}
        </div>
      )}
      {reasoning && <ThinkingBlock text={reasoning} />}
      {text && <div className="assistant-text">{text}</div>}
      {toolCalls.map((tc, i) => (
        <div key={i} className="assistant-tool-ref">
          <span className="tool-ref-name">🔧 {tc.name}</span>
          <span className="tool-ref-id">{tc.id}</span>
          {tc.arguments && <pre className="tool-ref-args">{JSON.stringify(parseToolArguments(tc.arguments), null, 2)}</pre>}
        </div>
      ))}
      {toolCalls.length === 0 && !text && !reasoning && (
        <div className="assistant-empty">（无内容）</div>
      )}
    </div>
  )
}
