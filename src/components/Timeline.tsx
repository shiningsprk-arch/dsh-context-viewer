import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { FilterState } from '../store'
import type { HistoryEntry } from '../../shared/types'
import { EventRow } from './EventRow'
import { SessionInfoBar } from './SessionInfoBar'

function matchesFilter(entry: HistoryEntry, filter: FilterState): boolean {
  const type = entry.event.type
  switch (type) {
    case 'user/message': return filter.user
    case 'assistant/message': {
      const data = entry.event.data as { message?: { content?: { type?: string }[] } }
      const content = data.message?.content ?? []
      const hasReasoning = content.some(b => b.type === 'reasoning')
      const hasText = content.some(b => b.type === 'text')
      const hasTool = content.some(b => b.type === 'tool-call')
      if (hasReasoning && !hasText && !hasTool) return filter.thinking
      if (!hasReasoning && !hasText && !hasTool) return filter.thinking
      return filter.assistant
    }
    case 'assistant/chunk': return filter.chunks
    case 'tool/call':
    case 'tool/code-dispatch':
    case 'tool/code-dispatch-start':
      return filter.toolCall
    case 'tool/result': return filter.toolResult
    case 'turn/start':
    case 'turn/end':
    case 'step/start':
    case 'step/end':
      return filter.boundary
    default:
      return filter.other
  }
}

export function Timeline() {
  const { state, dispatch } = useStore()
  const [autoScroll, setAutoScroll] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCount = useRef(0)
  const loadSeq = useRef(0)
  const [reloadTick, setReloadTick] = useState(0)

  // 打开会话：拉取尾部
  useEffect(() => {
    if (!state.selectedSessionId) return
    const id = state.selectedSessionId
    const seq = ++loadSeq.current
    dispatch({ type: 'loading', loading: true })
    window.dsh.sessionHistory(id, undefined, 400)
      .then(res => {
        if (seq !== loadSeq.current) return
        const projections: Record<string, unknown> = {}
        if (res.projections?.values) {
          for (const [k, v] of Object.entries(res.projections.values)) projections[k] = v
        }
        dispatch({ type: 'history', events: res.events, hasMore: res.hasMore, projections })
        setAutoScroll(true)
      })
      .catch(() => {
        if (seq === loadSeq.current) dispatch({ type: 'loading', loading: false })
      })
    return () => { loadSeq.current++ }
  }, [state.selectedSessionId, reloadTick])

  // 新事件到达时自动滚动到底部
  useEffect(() => {
    if (autoScroll && listRef.current && state.events.length > prevCount.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCount.current = state.events.length
  }, [state.events.length, autoScroll])

  const loadMore = useCallback(async () => {
    if (!state.selectedSessionId || state.loadingMore || !state.hasMore) return
    const minSeq = state.events.length > 0 ? state.events[0].event.seq : undefined
    if (minSeq === undefined || minSeq <= 1) return
    dispatch({ type: 'loadingMore', loadingMore: true })
    try {
      const res = await window.dsh.sessionHistory(state.selectedSessionId, minSeq - 1, 400)
      dispatch({ type: 'more', events: res.events, hasMore: res.hasMore })
    } catch {
      dispatch({ type: 'loadingMore', loadingMore: false })
    }
  }, [state.selectedSessionId, state.loadingMore, state.hasMore, state.events])

  if (!state.selectedSessionId) {
    return (
      <main className="main-pane">
        <div className="empty-state">
          <div className="empty-icon">🕵️</div>
          <div>从左侧选择一个会话，查看完整上下文</div>
          <div className="empty-sub">包括思考链、shell 命令、工具调用与结果、原始事件日志</div>
        </div>
      </main>
    )
  }

  const filtered = state.events.filter(e => matchesFilter(e, state.filter))
  const count = filtered.length
  const hidden = state.events.length - count

  return (
    <main className="main-pane">
      <SessionInfoBar />
      <div className="timeline-toolbar">
        <span className="timeline-count">已加载 {state.events.length} 个事件{hidden > 0 ? '（过滤隐藏 ' + hidden + '）' : ''}</span>
        <label className="autoscroll-label">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          自动滚动
        </label>
      </div>
      <div className="timeline-scroll" ref={listRef} onScroll={e => {
        const el = e.currentTarget
        if (el.scrollTop < 60 && !state.loadingMore && state.hasMore) void loadMore()
      }}>
        {state.loading && <div className="loading-hint">加载中…</div>}
        {!state.loading && state.hasMore && (
          <button className="load-more-btn" onClick={() => void loadMore()} disabled={state.loadingMore}>
            {state.loadingMore ? '加载中…' : '↑ 加载更早的事件'}
          </button>
        )}
        {filtered.map(entry => (
          <EventRow
            key={entry.event.seq}
            entry={entry}
            expanded={state.expanded.has(entry.event.seq)}
            onToggleExpand={seq => dispatch({ type: 'toggleExpand', seq })}
          />
        ))}
        {!state.loading && filtered.length === 0 && (
          <div className="empty-state small">
            <div>{state.events.length > 0 ? '没有匹配的事件（可调整过滤选项）' : '事件加载失败或为空'}</div>
            {state.events.length === 0 && (
              <button className="load-more-btn" onClick={() => setReloadTick(t => t + 1)}>重新加载</button>
            )}
          </div>
        )}
        <div className="timeline-end">—— 事件流结束 ——</div>
      </div>
    </main>
  )
}
