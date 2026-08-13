import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { FilterState, ViewMode } from '../store'
import { DEFAULT_FILTER } from '../store'

const FILTER_DEFS: { key: keyof FilterState; label: string }[] = [
  { key: 'user', label: '用户' },
  { key: 'assistant', label: '助手' },
  { key: 'thinking', label: '思考' },
  { key: 'toolCall', label: '调用' },
  { key: 'toolResult', label: '结果' },
  { key: 'boundary', label: '边界' },
  { key: 'chunks', label: '流式' },
  { key: 'other', label: '其他' },
]

export function Header() {
  const { state, dispatch } = useStore()
  const [filterOpen, setFilterOpen] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFilter = (key: keyof FilterState) => {
    dispatch({ type: 'setFilter', filter: { ...state.filter, [key]: !state.filter[key] } })
  }

  const onSearch = (q: string) => {
    dispatch({ type: 'setSearchQuery', query: q })
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) {
      dispatch({ type: 'setGlobalSearch', items: [], searching: false })
      return
    }
    dispatch({ type: 'setGlobalSearch', items: state.globalSearch, searching: true })
    searchTimer.current = setTimeout(async () => {
      try {
        const items = await window.dsh.searchSessions(q.trim())
        dispatch({ type: 'setGlobalSearch', items, searching: false })
      } catch {
        dispatch({ type: 'setGlobalSearch', items: [], searching: false })
      }
    }, 400)
  }

  const onExport = async (format: 'md' | 'jsonl' | 'json') => {
    if (!state.selectedSessionId) return
    const session = state.sessions.find(s => s.sessionId === state.selectedSessionId)
    const title = (state.projections['title'] as string) || session?.sessionId || '会话'
    let content = ''
    if (format === 'jsonl') {
      content = state.events.map(e => JSON.stringify(e.event)).join('\n')
    } else if (format === 'json') {
      content = JSON.stringify({ sessionId: state.selectedSessionId, title, events: state.events.map(e => e.event) }, null, 2)
    } else {
      content = exportMarkdown(state, title)
    }
    const safe = title.replace(/[\\/:*?"<>|]/g, '_')
    const res = await window.dsh.saveExport(safe + '.' + format, format, content)
    if (!res.canceled && res.path) {
      dispatch({ type: 'toast', message: '已导出到 ' + res.path })
      setTimeout(() => dispatch({ type: 'toast', message: null }), 4000)
    }
  }

  const exportMarkdown = (st: typeof state, title: string): string => {
    const lines: string[] = []
    lines.push('# ' + title)
    lines.push('')
    lines.push('- 会话 ID: ' + st.selectedSessionId)
    lines.push('- 事件数: ' + st.events.length)
    lines.push('')
    for (const entry of st.events) {
      const ev = entry.event
      const time = new Date(ev.time).toISOString()
      lines.push('## [' + ev.seq + '] ' + ev.type + ' · ' + time)
      lines.push('')
      lines.push('\`\`\`json')
      lines.push(JSON.stringify(ev.data, null, 2))
      lines.push('\`\`\`')
      lines.push('')
    }
    return lines.join('\n')
  }

  const setView = (view: ViewMode) => dispatch({ type: 'setView', view })

  return (
    <header className="app-header">
      <div className="header-left">
        <span className="app-logo">🕵️ DSH上下文查看器</span>
        <span className={'conn-dot' + (state.connected ? ' conn-on' : ' conn-off')} title={state.baseUrl}>
          {state.connected ? '已连接 ' + state.baseUrl : '未连接 DSH'}
        </span>
      </div>
      <div className="header-center">
        <input
          className="search-input"
          placeholder="搜索会话内容（Enter 查看结果）…"
          value={state.searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
        {state.searching && <span className="search-spinner">…</span>}
      </div>
      <div className="header-right">
        <div className="view-switch">
          <button className={state.view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>时间线</button>
          <button className={state.view === 'stats' ? 'active' : ''} onClick={() => setView('stats')}>统计</button>
          <button className={state.view === 'raw' ? 'active' : ''} onClick={() => setView('raw')}>原始日志</button>
        </div>
        <div className="filter-wrap">
          <button className="filter-btn" onClick={() => setFilterOpen(!filterOpen)}>
            过滤 ▾
          </button>
          {filterOpen && (
            <div className="filter-menu">
              {FILTER_DEFS.map(f => (
                <label key={f.key} className="filter-item">
                  <input
                    type="checkbox"
                    checked={state.filter[f.key]}
                    onChange={() => toggleFilter(f.key)}
                  />
                  {f.label}
                </label>
              ))}
              <button className="filter-reset" onClick={() => dispatch({ type: 'setFilter', filter: DEFAULT_FILTER })}>
                重置
              </button>
            </div>
          )}
        </div>
        <div className="export-wrap">
          <button className="export-btn" disabled={!state.selectedSessionId || state.events.length === 0} onClick={() => onExport('md')}>
            导出 MD
          </button>
          <button className="export-btn" disabled={!state.selectedSessionId || state.events.length === 0} onClick={() => onExport('jsonl')}>
            导出 JSONL
          </button>
        </div>
        <button
          className="refresh-btn"
          onClick={async () => {
            try {
              const sessions = await window.dsh.listSessions()
              dispatch({ type: 'sessions', sessions })
            } catch { /* ignore */ }
          }}
          title="刷新会话列表"
        >
          ⟳
        </button>
      </div>
    </header>
  )
}
