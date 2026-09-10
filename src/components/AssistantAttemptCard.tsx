import React from 'react'
import type { SessionEvent } from '../../shared/types'
import { assembleAttemptStream, parseToolArguments } from '../format'
import { EventHeader } from './EventRow'
import { ThinkingBlock } from './ThinkingBlock'
import { JsonBlock } from './JsonBlock'

/** assistant/attempt（V3）：完整的模型尝试，包含思考链/文本/工具调用。 */
export function AssistantAttemptCard({
  event, expanded, onToggleExpand,
}: {
  event: SessionEvent<'assistant/attempt'>
  expanded: boolean
  onToggleExpand: (seq: number) => void
}) {
  const data = event.data
  const blocks = assembleAttemptStream(data.stream)
  const reasoning = blocks.filter(b => b.type === 'reasoning').map(b => b.text).join('\n')
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n')
  const toolCalls = blocks.filter((b): b is { type: 'tool-call'; id: string; name: string; arguments: string } => b.type === 'tool-call')

  return (
    <div className="event-card card-assistant">
      <EventHeader
        event={event}
        label={'助手尝试 · 第 ' + data.turn + ' 轮/第 ' + data.step + ' 步'}
        icon="🧠"
        color="#79c0ff"
      />
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
      <button className="toggle-args" onClick={() => onToggleExpand(event.seq)}>
        {expanded ? '▾ 收起原始流' : '▸ 查看原始流（含时间戳）'}
      </button>
      {expanded && (
        <div className="tool-args"><JsonBlock value={data.stream} maxDepth={3} /></div>
      )}
    </div>
  )
}
