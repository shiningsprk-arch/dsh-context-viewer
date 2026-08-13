import type { ContentBlock } from '../shared/types'

export function fmtTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

export function fmtDateTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  const rs = Math.round(s % 60)
  return `${m} 分 ${rs} 秒`
}

export function fmtTokens(n: number | undefined | null): string {
  if (n === undefined || n === null) return '-'
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export function truncate(s: string, n = 200): string {
  if (s.length <= n) return s
  return s.slice(0, n) + '…'
}

export function parseToolArguments(raw: string): unknown | null {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    try {
      // 有的模型输出非严格 JSON（尾逗号/单引号），尽力解析
      return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"'))
    } catch {
      return null
    }
  }
}

export function extractReasoning(content: ContentBlock[] | undefined): string | null {
  if (!Array.isArray(content)) return null
  const r = content.find(b => b.type === 'reasoning')
  return r && 'text' in r ? r.text : null
}

export function extractText(content: ContentBlock[] | undefined): string {
  if (!Array.isArray(content)) return ''
  return content.filter(b => b.type === 'text' && 'text' in b).map(b => (b as { text: string }).text).join('\n')
}

export function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((item: unknown) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        if (typeof o.text === 'string') return o.text
        if (typeof o.content === 'string') return o.content
        if (o.type === 'tool-result' && 'content' in o) return contentToText(o.content)
        return JSON.stringify(o)
      }
      return String(item)
    }).join('\n')
  }
  return JSON.stringify(content)
}

export function getToolResultText(message: unknown): string {
  if (typeof message === 'string') return message
  if (message && typeof message === 'object' && Array.isArray((message as Record<string, unknown>).content)) {
    return contentToText((message as Record<string, unknown>).content)
  }
  return JSON.stringify(message)
}

export function isShellTool(name: string): boolean {
  return name === 'pwsh' || name === 'bash' || name === 'cmd' || name === 'shell'
}

export function isCodeTool(name: string): boolean {
  return name === 'run_code' || name === 'code'
}
