import React, { useState } from 'react'

/** 思考链折叠块。 */
export function ThinkingBlock({ text, defaultOpen = false }: { text: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="thinking-block">
      <button className="thinking-toggle" onClick={() => setOpen(!open)}>
        <span className="thinking-chevron">{open ? '▾' : '▸'}</span>
        <span className="thinking-title">思考链</span>
        <span className="thinking-meta">{text.length} 字符</span>
      </button>
      {open && <pre className="thinking-text">{text}</pre>}
    </div>
  )
}
