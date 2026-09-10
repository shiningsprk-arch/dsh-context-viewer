import type { AttemptStreamEntry, ContentBlock, MessageSource } from '../shared/types'

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

/** 消息来源标签：V3 的 source 可能是对象。 */
export function sourceLabel(source: string | MessageSource | undefined | null): string | null {
  if (!source) return null
  if (typeof source === 'string') return source === 'human' ? null : source
  const parts: string[] = []
  if (typeof source.kind === 'string' && source.kind !== 'human') parts.push(source.kind)
  if (typeof source.plugin === 'string') parts.push('插件:' + source.plugin)
  if (typeof source.form === 'string') parts.push(source.form)
  if (parts.length > 0) return parts.join(' · ')
  return typeof source.summary === 'string' ? source.summary : null
}

/** 把 assistant/attempt 的压缩流还原为内容块（对应 dsh-llm BlockAssembler）。 */
export function assembleAttemptStream(stream: AttemptStreamEntry[] | undefined): ContentBlock[] {
  if (!Array.isArray(stream)) return []
  interface Partial {
    blockType?: string
    text?: string
    toolCallId?: string
    toolCallName?: string
    args?: string
    block?: ContentBlock
  }
  const partials = new Map<number, Partial>()
  const get = (index: number): Partial => {
    let p = partials.get(index)
    if (!p) {
      p = {}
      partials.set(index, p)
    }
    return p
  }
  for (const entry of stream) {
    if (!entry || typeof entry !== 'object') continue
    switch (entry.type) {
      case 'chunk': {
        const chunk = entry.chunk as { type?: string; index?: number; blockType?: string; text?: string; id?: string; name?: string; argumentsDelta?: string; block?: ContentBlock }
        if (typeof chunk?.index !== 'number') break
        if (chunk.type === 'block-start') get(chunk.index).blockType = chunk.blockType
        else if (chunk.type === 'text-delta') {
          const p = get(chunk.index)
          p.blockType ??= 'text'
          p.text = (p.text ?? '') + (chunk.text ?? '')
        } else if (chunk.type === 'reasoning-delta') {
          const p = get(chunk.index)
          p.blockType ??= 'reasoning'
          p.text = (p.text ?? '') + (chunk.text ?? '')
        } else if (chunk.type === 'tool-call-delta') {
          const p = get(chunk.index)
          p.blockType ??= 'tool-call'
          if (chunk.id) p.toolCallId = chunk.id
          if (chunk.name) p.toolCallName = chunk.name
          p.args = (p.args ?? '') + (chunk.argumentsDelta ?? '')
        } else if (chunk.type === 'block-end' && chunk.block) {
          get(chunk.index).block = chunk.block
        }
        break
      }
      case 'text-chunks':
      case 'reasoning-chunks': {
        const p = get(entry.index)
        p.blockType ??= entry.type === 'text-chunks' ? 'text' : 'reasoning'
        p.text = (p.text ?? '') + entry.texts.join('')
        break
      }
      case 'tool-call-chunks': {
        const p = get(entry.index)
        p.blockType ??= 'tool-call'
        p.toolCallId = entry.id
        if (entry.name) p.toolCallName = entry.name
        p.args = (p.args ?? '') + entry.args.join('')
        break
      }
      default:
        break
    }
  }
  const blocks: ContentBlock[] = []
  const indexes = [...partials.keys()].sort((a, b) => a - b)
  for (const i of indexes) {
    const p = partials.get(i)
    if (!p) continue
    if (p.block) {
      blocks.push(p.block)
      continue
    }
    if (p.blockType === 'tool-call') {
      blocks.push({ type: 'tool-call', id: p.toolCallId ?? 'call-' + i, name: p.toolCallName ?? '', arguments: p.args ?? '' })
    } else if (p.blockType === 'reasoning') {
      if (p.text) blocks.push({ type: 'reasoning', text: p.text })
    } else if (p.text) {
      blocks.push({ type: 'text', text: p.text })
    }
  }
  return blocks
}
