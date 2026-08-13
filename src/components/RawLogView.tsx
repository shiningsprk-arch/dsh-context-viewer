import React, { useMemo, useState } from 'react'
import { useStore } from '../store'
import { JsonBlock } from './JsonBlock'

/** 原始 JSONL 视图：逐事件显示原始 JSON。 */
export function RawLogView() {
  const { state, dispatch } = useStore()
  const [autoExpand, setAutoExpand] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return state.events
    const q = query.toLowerCase()
    return state.events.filter(e => {
      try {
        return JSON.stringify(e.event).toLowerCase().includes(q)
      } catch {
        return false
      }
    })
  }, [state.events, query])

  return (
    <main className="main-pane raw-pane">
      <div className="raw-toolbar">
        <input
          className="raw-search"
          placeholder="在原始事件中搜索…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <label>
          <input type="checkbox" checked={autoExpand} onChange={e => setAutoExpand(e.target.checked)} />
          全部展开
        </label>
        <span className="timeline-count">显示 {filtered.length} / {state.events.length} 条</span>
      </div>
      <div className="raw-list">
        {filtered.map(entry => (
          <RawEventBlock
            key={entry.event.seq}
            entry={entry}
            autoExpand={autoExpand}
            expanded={state.expanded.has(entry.event.seq)}
            onToggle={() => dispatch({ type: 'toggleExpand', seq: entry.event.seq })}
          />
        ))}
        {filtered.length === 0 && <div className="empty-hint">无匹配事件</div>}
      </div>
    </main>
  )
}

function RawEventBlock({
  entry, autoExpand, expanded, onToggle,
}: {
  entry: { event: { type: string; seq: number; time: number; data: unknown }; view?: unknown }
  autoExpand: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const ev = entry.event
  const open = autoExpand || expanded
  const raw = JSON.stringify(ev)
  return (
    <div className="raw-event">
      <div className="raw-event-head" onClick={onToggle}>
        <span className="raw-toggle">{open ? '▾' : '▸'}</span>
        <span className="raw-seq">#{ev.seq}</span>
        <span className="raw-type">{ev.type}</span>
        <span className="raw-time">{new Date(ev.time).toISOString()}</span>
        <span className="raw-size">{raw.length} B</span>
        {!!entry.view && <span className="raw-has-view">view</span>}
      </div>
      {open && (
        <div className="raw-event-body">
          <JsonBlock value={ev.data} maxDepth={4} />
          {!!entry.view && (
            <div className="raw-view">
              <div className="raw-view-label">tool view:</div>
              <JsonBlock value={entry.view} maxDepth={3} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
