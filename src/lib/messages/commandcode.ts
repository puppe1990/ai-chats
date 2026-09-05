import fs from 'node:fs/promises'
import type { ChatMessage, ChatMessageRole } from '../types'
import { extractTextFromParts } from './extract-text'

interface ContentPart {
  type?: string
  text?: string
  name?: string
  toolName?: string
  input?: unknown
}

function nonemptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return extractTextFromParts(content as Array<{ type?: string; text?: string }>)
  }
  return ''
}

function formatToolUse(part: ContentPart): string {
  const name = part.name?.trim() || part.toolName?.trim() || 'tool'
  const input =
    part.input && typeof part.input === 'object'
      ? JSON.stringify(part.input, null, 2)
      : ''
  return input ? `${name}\n${input}` : name
}

function parseEntry(
  row: Record<string, unknown>,
): { role: string; content: unknown; timestamp?: string } | null {
  const timestamp = nonemptyString(row.timestamp)
  if (row.type === 'message' && row.message && typeof row.message === 'object') {
    const message = row.message as Record<string, unknown>
    const role = nonemptyString(message.role)
    if (!role) return null
    return { role, content: message.content, timestamp }
  }
  const role = nonemptyString(row.role)
  if (!role) return null
  return { role, content: row.content, timestamp }
}

function assistantParts(
  content: unknown,
): Array<{ role: ChatMessageRole; content: string }> {
  if (typeof content === 'string') {
    const trimmed = content.trim()
    return trimmed ? [{ role: 'assistant', content: trimmed }] : []
  }
  if (!Array.isArray(content)) return []
  const messages: Array<{ role: ChatMessageRole; content: string }> = []
  for (const part of content as ContentPart[]) {
    if (part.type === 'text' && part.text?.trim()) {
      messages.push({ role: 'assistant', content: part.text.trim() })
      continue
    }
    if (part.type === 'tool_use' || part.type === 'tool-call') {
      messages.push({ role: 'tool', content: formatToolUse(part) })
    }
  }
  return messages
}

export async function fetchCommandCodeMessages(
  sessionPath: string,
): Promise<ChatMessage[]> {
  try {
    const raw = await fs.readFile(sessionPath, 'utf-8')
    const messages: ChatMessage[] = []
    let index = 0
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line) as Record<string, unknown>
        const entry = parseEntry(row)
        if (!entry) continue
        appendEntry(messages, () => index++, entry)
      } catch {
        // skip malformed line
      }
    }
    return messages
  } catch {
    return []
  }
}

function appendEntry(
  messages: ChatMessage[],
  nextIndex: () => number,
  entry: { role: string; content: unknown; timestamp?: string },
) {
  if (entry.role === 'user') {
    const text = textFromContent(entry.content)
    if (!text) return
    messages.push({
      id: `commandcode-msg-${nextIndex()}`,
      role: 'user',
      content: text,
      timestamp: entry.timestamp,
    })
    return
  }
  if (entry.role !== 'assistant') return
  for (const part of assistantParts(entry.content)) {
    messages.push({
      id: `commandcode-msg-${nextIndex()}`,
      role: part.role,
      content: part.content,
      timestamp: entry.timestamp,
    })
  }
}
