/**
 * preload：contextBridge 暴露 DSH 桥到 renderer。
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { DshBridge, PushMessage } from '../shared/types'

const bridge: DshBridge = {
  getSnapshot: () => ipcRenderer.invoke('dsh:getSnapshot'),
  listSessions: () => ipcRenderer.invoke('dsh:listSessions'),
  sessionHistory: (sessionId, beforeSeq, maxMessages) =>
    ipcRenderer.invoke('dsh:sessionHistory', sessionId, beforeSeq, maxMessages),
  searchSessions: (query) => ipcRenderer.invoke('dsh:searchSessions', query),
  saveExport: (suggestedName, ext, content) =>
    ipcRenderer.invoke('dsh:saveExport', suggestedName, ext, content),
  openExternal: (url) => ipcRenderer.invoke('dsh:openExternal', url),
  onPush: (cb: (msg: PushMessage) => void) => {
    const listener = (_e: unknown, msg: PushMessage) => cb(msg)
    ipcRenderer.on('dsh:push', listener)
    return () => {
      ipcRenderer.removeListener('dsh:push', listener)
    }
  },
}

contextBridge.exposeInMainWorld('dsh', bridge)
