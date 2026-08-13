import React, { useEffect } from 'react'
import { StoreProvider, useStore } from './store'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { StatsPanel } from './components/StatsPanel'
import { RawLogView } from './components/RawLogView'

function Shell() {
  const { state, dispatch } = useStore()

  // 启动快照
  useEffect(() => {
    let alive = true
    window.dsh.getSnapshot().then(snapshot => {
      if (!alive) return
      dispatch({ type: 'connected', connected: snapshot.connected, baseUrl: snapshot.baseUrl })
      dispatch({ type: 'snapshot', workspaces: snapshot.workspaces, sessions: snapshot.sessions })
    })
    return () => { alive = false }
  }, [])

  return (
    <div className="app-root">
      <Header />
      <div className="app-body">
        <Sidebar />
        {state.view === 'timeline' && <Timeline />}
        {state.view === 'stats' && <StatsPanel />}
        {state.view === 'raw' && <RawLogView />}
      </div>
      {state.toast && <div className="toast">{state.toast}</div>}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
