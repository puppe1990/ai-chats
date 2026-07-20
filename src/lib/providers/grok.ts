import fs from 'node:fs/promises'
import path from 'node:path'
import type { ChatSession } from '../types'

interface GrokSummary {
  info: { id: string; cwd?: string }
  session_summary?: string
  generated_title?: string
  created_at?: string
  updated_at?: string
  num_messages?: number
  current_model_id?: string
}

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...(await walkDir(full)))
      } else if (entry.name === 'summary.json') {
        results.push(full)
      }
    }
  } catch {
    return []
  }
  return results
}

export async function fetchGrokChats(sessionsDir: string): Promise<ChatSession[]> {
  const files = await walkDir(sessionsDir)
  const sessions: ChatSession[] = []

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, 'utf-8')
      const data: GrokSummary = JSON.parse(raw)
      const title =
        data.generated_title?.trim() ||
        data.session_summary?.trim() ||
        `Grok ${data.info.id.slice(0, 8)}`

      sessions.push({
        id: `grok:${data.info.id}`,
        source: 'grok',
        title,
        cwd: data.info.cwd,
        createdAt: data.created_at ?? data.updated_at ?? new Date(0).toISOString(),
        updatedAt: data.updated_at ?? data.created_at ?? new Date(0).toISOString(),
        messageCount: data.num_messages,
        model: data.current_model_id,
        storagePath: path.dirname(file),
      })
    } catch {
      // skip malformed
    }
  }

  return sessions
}
