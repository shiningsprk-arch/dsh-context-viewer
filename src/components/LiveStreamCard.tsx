import React from 'react'
import type { ContentBlock } from '../../shared/types'
import { parseToolArguments } from '../format'
import { ThinkingBlock } from './ThinkingBlock'

/** 实时生成中的助手输出（session/follow 的 assistant-stream 帧）。 */
export function LiveStreamCard({ blocks }: { blocks: ContentBlock[] }) {
  const reasoning = blocks.filter(b => b.type === 'reasoning').map(b => b.text).join('')
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('')
  const toolCalls = blocks.filter((b): b is { type: 'tool-call'; id: string; name: string; arguments: string } => b.type === 'tool-call')

  return (
    <div className="event-card card-assistant live-stream-card">
      <div className="event-header">
        <span className="live-badge">● 实时生成中</span>
        <span className="event-type" style={{ color: '#79c0ff' }}>助手流式输出</span>
        <span className="event-seq">{blocks.length} 块</span>
      </div>
      {reasoning && <ThinkingBlock text={reasoning} defaultOpen />}
      {text && <div className="assistant-text">{text}</div>}
      {toolCalls.map((tc, i) => (
        <div key={i} className="assistant-tool-ref">
          <span className="tool-ref-name">🔧 {tc.name || '工具'}</span>
          <span className="tool-ref-id">{tc.id}</span>
          {tc.arguments && <pre className="tool-ref-args">{JSON.stringify(parseToolArguments(tc.arguments), null, 2)}</pre>}
        </div>
      ))}
    </div>
  )
}
