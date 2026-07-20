import fs from 'node:fs/promises'
import type { ChatMessage, ChatMessageRole } from '../types'
import { extractTextFromParts } from './extract-text'

interface ClaudeContentPart {
  type?: string
  text?: string
  name?: string
  input?: unknown
}

interface ClaudeSessionLine {
  type?: string
  timestamp?: string
  message?: {
    role?: string
    content?: string | ClaudeContentPart[]
  }
}

function parseUserContent(
  content: ClaudeSessionLine['message'] extends infer M
    ? M extends { content?: infer C }
      ? C
      : never
    : never,
): string {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) return extractTextFromParts(content)
  return ''
}

function formatToolUse(part: ClaudeContentPart): string {
  const name = part.name?.trim() || 'tool'
  const input =
    part.input && typeof part.input === 'object'
      ? JSON.stringify(part.input, null, 2)
      : ''
  return input ? `${name}\n${input}` : name
}

function parseAssistantContent(
  content: ClaudeContentPart[] | undefined,
): Array<{ role: ChatMessageRole; content: string }> {
  if (!Array.isArray(content)) return []

  const messages: Array<{ role: ChatMessageRole; content: string }> = []
  for (const part of content) {
    if (part.type === 'text' && part.text?.trim()) {
      messages.push({ role: 'assistant', content: part.text.trim() })
      continue
    }
    if (part.type === 'tool_use') {
      messages.push({ role: 'tool', content: formatToolUse(part) })
    }
  }
  return messages
}

export async function fetchClaudeMessages(sessionPath: string): Promise<ChatMessage[]> {
  try {
    const content = await fs.readFile(sessionPath, 'utf-8')
    const messages: ChatMessage[] = []
    let index = 0

    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const row: ClaudeSessionLine = JSON.parse(line)
        if (row.type === 'user') {
          const text = parseUserContent(row.message?.content)
          if (!text) continue
          messages.push({
            id: `claude-msg-${index++}`,
            role: 'user',
            content: text,
            timestamp: row.timestamp,
          })
          continue
        }

        if (row.type === 'assistant') {
          const parts = parseAssistantContent(
            Array.isArray(row.message?.content) ? row.message.content : undefined,
          )
          for (const part of parts) {
            messages.push({
              id: `claude-msg-${index++}`,
              role: part.role,
              content: part.content,
              timestamp: row.timestamp,
            })
          }
        }
      } catch {
        // skip malformed line
      }
    }

    return messages
  } catch {
    return []
  }
}
