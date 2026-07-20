import fs from 'node:fs/promises'
import path from 'node:path'
import type { ChatMessage } from '../types'
import { extractTextFromParts } from './extract-text'

export async function fetchCodexMessages(storagePath: string): Promise<ChatMessage[]> {
  if (!storagePath.endsWith('.jsonl')) return []

  try {
    const content = await fs.readFile(storagePath, 'utf-8')
    const messages: ChatMessage[] = []
    let index = 0

    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        if (event.type !== 'response_item') continue
        const payload = event.payload
        const role = payload?.role
        if (role !== 'user' && role !== 'assistant') continue

        const text = extractTextFromParts(payload.content ?? [])
        if (!text) continue

        messages.push({
          id: `codex-msg-${index++}`,
          role,
          content: text,
          timestamp: event.timestamp,
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

export async function findCodexRolloutById(
  codexHome: string,
  sessionId: string,
): Promise<string | undefined> {
  const dirs = [
    path.join(codexHome, 'sessions'),
    path.join(codexHome, 'archived_sessions'),
  ]

  async function walk(dir: string): Promise<string | undefined> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          const found = await walk(full)
          if (found) return found
        } else if (entry.name.includes(sessionId) && entry.name.endsWith('.jsonl')) {
          return full
        }
      }
    } catch {
      // skip
    }
    return undefined
  }

  for (const dir of dirs) {
    const found = await walk(dir)
    if (found) return found
  }
  return undefined
}
