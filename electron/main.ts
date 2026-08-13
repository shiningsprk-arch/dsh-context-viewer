/**
 * Electron 主进程：窗口管理 + DSH 数据层 + IPC + 实时推送。
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { DshClient } from './dsh-client'
import type {
  HistoryResult, IpcApi, PushMessage, SearchResult, SessionEvent, SessionSummary, Snapshot, WorkspaceView,
} from '../shared/types'

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null
let client: DshClient | null = null

function sendPush(msg: PushMessage): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dsh:push', msg)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: 1000,
    minHeight: 640,
    title: 'DSH上下文查看器',
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (DEV_SERVER_URL) {
    void mainWindow.loadURL(DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'))
  }

  // 渲染进程 console → 主进程 stdout
  mainWindow.webContents.on('console-message', (event) => {
    const params = event as unknown as { level: string; message: string; lineNumber: number; sourceId: string }
    console.log('[renderer:' + params.level + '] ' + params.message + ' (' + params.sourceId + ':' + params.lineNumber + ')')
  })

  // 验证截图钩子：DSH_CV_SHOT=<path> 时截图后退出
  const shotPath = process.env.DSH_CV_SHOT
  if (shotPath) {
    setTimeout(async () => {
      try {
        const verify = async (label: string): Promise<string> => {
          const info = await mainWindow!.webContents.executeJavaScript(`(() => {
            const pick = (sel) => document.querySelector(sel)?.textContent ?? null
            return {
              logo: pick('.app-logo'),
              conn: pick('.conn-dot'),
              sessionItems: document.querySelectorAll('.session-item').length,
              sectionTitles: [...document.querySelectorAll('.sidebar-section-title')].map(e => e.textContent),
              infoBar: pick('.session-info-name'),
              eventCards: document.querySelectorAll('.event-card').length,
              boundaryRows: document.querySelectorAll('.boundary-row').length,
              hasThinking: document.querySelectorAll('.thinking-block').length,
              hasToolCall: document.querySelectorAll('.card-tool-call').length,
              hasShellCmd: document.querySelectorAll('.shell-command').length,
              hasToolResult: document.querySelectorAll('.card-tool-result').length,
              timelineCount: pick('.timeline-count'),
              emptyState: pick('.empty-state'),
            }
          })()`)
          console.log('[verify:' + label + '] ' + JSON.stringify(info))
          return info
        }
        await verify('boot')
        // 模拟选择第一个会话
        await mainWindow!.webContents.executeJavaScript(`document.querySelector('.session-item')?.click()`)
        await new Promise(res => setTimeout(res, 4000))
        const after = await verify('session-selected')
        // 工具调用名称分布
        const toolNames = await mainWindow!.webContents.executeJavaScript(`[...document.querySelectorAll('.card-tool-call .event-type')].map(e => e.textContent.trim())`)
        console.log('[verify:toolNames] ' + JSON.stringify(toolNames.slice(0, 40)))
        // 循环加载更早事件，寻找 pwsh/bash 调用验证 shell 命令渲染
        for (let i = 0; i < 6; i++) {
          const found = await mainWindow!.webContents.executeJavaScript(`(() => ({
            shell: document.querySelectorAll('.shell-command').length,
            names: [...document.querySelectorAll('.card-tool-call .event-type')].map(e => e.textContent.trim()).filter(t => t.includes('pwsh') || t.includes('bash') || t.includes('cmd')),
          }))()`)
          if (found.shell > 0 || found.names.length > 0) {
            console.log('[verify:shell] found at round ' + i + ': ' + JSON.stringify(found))
            break
          }
          const clicked = await mainWindow!.webContents.executeJavaScript(`(() => { const b = document.querySelector('.load-more-btn'); if (b && !b.disabled) { b.click(); return true } return false })()`)
          if (!clicked) { console.log('[verify:shell] no more button'); break }
          await new Promise(res => setTimeout(res, 2500))
          if (i === 5) console.log('[verify:shell] not found in 6 rounds')
        }
        // 切换到统计视图
        await mainWindow!.webContents.executeJavaScript(`document.querySelectorAll('.view-switch button')[1]?.click()`)
        await new Promise(res => setTimeout(res, 1500))
        const stats = await mainWindow!.webContents.executeJavaScript(`(() => ({
          statCards: document.querySelectorAll('.stat-card').length,
          toolStatRows: document.querySelectorAll('.tool-stat-row').length,
          typeChips: document.querySelectorAll('.type-stat-chip').length,
          pressureBar: !!document.querySelector('.pressure-fill'),
          statText: document.querySelector('.stats-pane')?.innerText.slice(0, 400) ?? null,
        }))()`)
        console.log('[verify:stats] ' + JSON.stringify(stats))
        // 切换到原始日志视图
        await mainWindow!.webContents.executeJavaScript(`document.querySelectorAll('.view-switch button')[2]?.click()`)
        await new Promise(res => setTimeout(res, 1500))
        const raw = await mainWindow!.webContents.executeJavaScript(`(() => ({
          rawEvents: document.querySelectorAll('.raw-event').length,
          hasView: document.querySelectorAll('.raw-has-view').length,
          firstType: document.querySelector('.raw-type')?.textContent ?? null,
          rawSearch: !!document.querySelector('.raw-search'),
        }))()`)
        console.log('[verify:raw] ' + JSON.stringify(raw))
        // 回到时间线
        await mainWindow!.webContents.executeJavaScript(`document.querySelectorAll('.view-switch button')[0]?.click()`)
        await new Promise(res => setTimeout(res, 800))
        const image = await mainWindow!.webContents.capturePage()
        const fs = await import('node:fs')
        fs.writeFileSync(shotPath, image.toPNG())
        console.log('[shot] saved ' + shotPath)
        console.log('[verify-done] ' + JSON.stringify(after))
      } catch (err) {
        console.error('[shot] failed', err)
      }
      app.quit()
    }, Number(process.env.DSH_CV_SHOT_DELAY ?? 9000))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setupDshClient(): void {
  client = new DshClient({
    onConnectionChange: (connected) => {
      sendPush({ kind: 'connection', connected, baseUrl: client?.getBaseUrl() ?? '' })
    },
    onMuxFrame: (frame) => {
      switch (frame.type) {
        case 'session/event':
          sendPush({ kind: 'session/event', sessionId: frame.sessionId, event: frame.event, view: frame.view })
          break
        case 'session/projection':
          sendPush({ kind: 'session/projection', sessionId: frame.sessionId, key: frame.key, value: frame.value, seq: frame.seq })
          break
        case 'session/subscribed':
          sendPush({ kind: 'session/subscribed', sessionId: frame.sessionId, lastSeq: frame.lastSeq })
          break
        case 'approval/requested':
          sendPush({
            kind: 'approval/requested', sessionId: frame.sessionId, approvalId: frame.approvalId,
            toolName: frame.toolName, reason: frame.reason,
          })
          break
        default:
          break
      }
    },
    onHostFrame: (frame) => {
      switch (frame.type) {
        case 'host/session-status':
          sendPush({ kind: 'host/session-status', sessionId: frame.sessionId, running: frame.running })
          break
        case 'host/session-added':
          sendPush({ kind: 'host/session-added', sessionId: frame.sessionId, blank: frame.blank, cwd: frame.cwd, agentPreset: frame.agentPreset })
          break
        case 'host/session-removed':
          sendPush({ kind: 'host/session-removed', sessionId: frame.sessionId })
          break
        case 'host/workspace-changed':
          sendPush({ kind: 'host/workspace-changed', workspace: frame.workspace })
          break
        case 'host/workspace-removed':
          sendPush({ kind: 'host/workspace-removed', workspaceId: frame.workspaceId })
          break
        case 'host/agent-error':
          sendPush({ kind: 'host/agent-error', sessionId: frame.sessionId, message: frame.message })
          break
        default:
          break
      }
    },
  })

  void client.connect().catch(() => { /* 主进程静默，状态由推送反映 */ })
}

function registerIpc(): void {
  const api: IpcApi = {
    async getSnapshot(): Promise<Snapshot> {
      const baseUrl = client?.getBaseUrl() ?? ''
      let workspaces: WorkspaceView[] = []
      let sessions: SessionSummary[] = []
      let connected = client?.connected ?? false
      if (client) {
        try {
          const [w, s] = await Promise.all([client.listWorkspaces(), client.listSessions()])
          workspaces = w
          sessions = s
          connected = true
        } catch {
          connected = false
        }
      }
      return { connected, baseUrl, workspaces, sessions }
    },
    async listSessions(): Promise<SessionSummary[]> {
      if (!client) return []
      return client.listSessions()
    },
    async sessionHistory(sessionId: string, beforeSeq?: number, maxMessages?: number): Promise<HistoryResult> {
      if (!client) throw new Error('未连接 DSH')
      return client.sessionHistory(sessionId, beforeSeq, maxMessages)
    },
    async searchSessions(query: string): Promise<SearchResult[]> {
      if (!client) return []
      return client.searchSessions(query)
    },
    async openExternal(url: string): Promise<void> {
      await shell.openExternal(url)
    },
    async saveExport(suggestedName: string, ext: 'md' | 'jsonl' | 'json', content: string) {
      if (!mainWindow) return { canceled: true }
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出会话',
        defaultPath: suggestedName,
        filters: ext === 'md' ? [{ name: 'Markdown', extensions: ['md'] }]
          : ext === 'jsonl' ? [{ name: 'JSON Lines', extensions: ['jsonl'] }]
            : [{ name: 'JSON', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePath) return { canceled: true }
      await writeFile(result.filePath, content, 'utf8')
      return { canceled: false, path: result.filePath }
    },
  }

  ipcMain.handle('dsh:getSnapshot', () => api.getSnapshot())
  ipcMain.handle('dsh:listSessions', () => api.listSessions())
  ipcMain.handle('dsh:sessionHistory', (_e, sessionId: string, beforeSeq?: number, maxMessages?: number) =>
    api.sessionHistory(sessionId, beforeSeq, maxMessages))
  ipcMain.handle('dsh:searchSessions', (_e, query: string) => api.searchSessions(query))
  ipcMain.handle('dsh:openExternal', (_e, url: string) => api.openExternal(url))

  // 导出：renderer 传入内容，主进程弹保存框并写盘
  ipcMain.handle('dsh:saveExport', (_e, suggestedName: string, ext: 'md' | 'jsonl' | 'json', content: string) =>
    api.saveExport(suggestedName, ext, content))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  setupDshClient()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  client?.destroy()
})
