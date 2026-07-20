import fs from 'node:fs/promises'
import path from 'node:path'
import type { ChatMessage } from '../types'
import { extractTextFromParts, stripUserQueryTags } from './extract-text'

interface GrokHistoryLine {
  type?: string
  role?: string
  content?: string | Array<{ type?: string; text?: string }>
}

function parseGrokContent(content: GrokHistoryLine['content']): string {
  if (typeof content === 'string') return stripUserQueryTags(content)
  if (Array.isArray(content)) {
    return stripUserQueryTags(extractTextFromParts(content))
  }
  return ''
}

export async function fetchGrokMessages(sessionDir: string): Promise<ChatMessage[]> {
  const historyPath = path.join(sessionDir, 'chat_history.jsonl')
  try {
    const content = await fs.readFile(historyPath, 'utf-8')
    const messages: ChatMessage[] = []
    let index = 0

    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const row: GrokHistoryLine = JSON.parse(line)
        const role =
          row.role ??
          (row.type === 'user'
            ? 'user'
            : row.type === 'assistant'
              ? 'assistant'
              : undefined)
        if (role !== 'user' && role !== 'assistant') continue

        const text = parseGrokContent(row.content)
        if (!text) continue

        messages.push({
          id: `grok-msg-${index++}`,
          role,
          content: text,
        })
      } catch {
        // skip malformed line
      }
    }

    return messages
  } catch {
    return []
  }
}
