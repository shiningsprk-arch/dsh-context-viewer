import React, { useState } from 'react'

/** 可折叠 JSON 树查看器。 */
export function JsonBlock({ value, maxDepth = 6 }: { value: unknown; maxDepth?: number }) {
  return <JsonNode value={value} depth={0} maxDepth={maxDepth} />
}

function JsonNode({ value, depth, maxDepth }: { value: unknown; depth: number; maxDepth: number }) {
  const [open, setOpen] = useState(depth < 2)

  if (value === null) return <span className="jv-null">null</span>
  if (value === undefined) return <span className="jv-null">undefined</span>
  if (typeof value === 'string') return <span className="jv-string">"{value}"</span>
  if (typeof value === 'number') return <span className="jv-number">{String(value)}</span>
  if (typeof value === 'boolean') return <span className="jv-bool">{String(value)}</span>

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="jv-punct">[]</span>
    const collapsible = depth >= maxDepth
    if (collapsible) {
      return (
        <span className="jv-fold" onClick={() => setOpen(!open)}>
          <span className="jv-toggle">{open ? '▾' : '▸'}</span>
          <span className="jv-punct">[{value.length}]</span>
          {open && (
            <span className="jv-children">
              {value.map((v, i) => (
                <span key={i}>
                  {i > 0 && <span className="jv-punct">, </span>}
                  <JsonNode value={v} depth={depth + 1} maxDepth={maxDepth} />
                </span>
              ))}
            </span>
          )}
        </span>
      )
    }
    return (
      <span className="jv-array">
        <span className="jv-punct">[</span>
        {value.map((v, i) => (
          <span key={i} className="jv-array-item">
            {i > 0 && <span className="jv-punct">,</span>}
            <JsonNode value={v} depth={depth + 1} maxDepth={maxDepth} />
          </span>
        ))}
        <span className="jv-punct">]</span>
      </span>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="jv-punct">{'{}'}</span>
    const collapsible = depth >= maxDepth
    if (collapsible) {
      return (
        <span className="jv-fold" onClick={() => setOpen(!open)}>
          <span className="jv-toggle">{open ? '▾' : '▸'}</span>
          <span className="jv-punct">{'{' + entries.length + '}'}</span>
          {open && (
            <span className="jv-children">
              {entries.map(([k, v], i) => (
                <span key={k}>
                  {i > 0 && <span className="jv-punct">, </span>}
                  <span className="jv-key">"{k}"</span>
                  <span className="jv-punct">: </span>
                  <JsonNode value={v} depth={depth + 1} maxDepth={maxDepth} />
                </span>
              ))}
            </span>
          )}
        </span>
      )
    }
    return (
      <span className="jv-object">
        <span className="jv-punct">{'{'}</span>
        {entries.map(([k, v], i) => (
          <span key={k} className="jv-object-item">
            {i > 0 && <span className="jv-punct">,</span>}
            <span className="jv-key">"{k}"</span>
            <span className="jv-punct">: </span>
            <JsonNode value={v} depth={depth + 1} maxDepth={maxDepth} />
          </span>
        ))}
        <span className="jv-punct">{'}'}</span>
      </span>
    )
  }

  return <span>{String(value)}</span>
}

/** 等宽代码块（shell 命令、代码、输出）。 */
export function CodeBlock({ text, lang, maxHeight }: { text: string; lang?: string; maxHeight?: number }) {
  return (
    <pre className={'code-block' + (lang ? ' lang-' + lang : '')} style={maxHeight ? { maxHeight } : undefined}>
      {text}
    </pre>
  )
}
