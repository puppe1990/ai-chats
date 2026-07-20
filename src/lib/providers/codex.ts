import fs from 'node:fs/promises'
import path from 'node:path'
import type { ChatSession } from '../types'

interface CodexIndexEntry {
  id: string
  thread_name?: string
  updated_at?: string
}

const ROLLOUT_UUID_RE =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i
const ROLLOUT_TS_RE = /rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-/i

function parseRolloutTimestamp(filename: string): string | undefined {
  const match = filename.match(ROLLOUT_TS_RE)
  if (!match) return undefined
  const iso = match[1].replace(
    /(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})/,
    '$1$2:$3:$4',
  )
  return `${iso}.000Z`
}

function parseRolloutId(filename: string): string | undefined {
  return filename.match(ROLLOUT_UUID_RE)?.[1]
}

async function readIndex(indexPath: string): Promise<Map<string, CodexIndexEntry>> {
  const map = new Map<string, CodexIndexEntry>()
  try {
    const content = await fs.readFile(indexPath, 'utf-8')
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const entry: CodexIndexEntry = JSON.parse(line)
        map.set(entry.id, entry)
      } catch {
        // skip malformed line
      }
    }
  } catch {
    // index optional when rollouts exist
  }
  return map
}

async function findRolloutFiles(codexHome: string): Promise<string[]> {
  const dirs = [
    path.join(codexHome, 'sessions'),
    path.join(codexHome, 'archived_sessions'),
  ]
  const results: string[] = []

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else if (entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) {
          results.push(full)
        }
      }
    } catch {
      // skip missing dirs
    }
  }

  for (const dir of dirs) {
    await walk(dir)
  }
  return results
}

export async function extractCodexTitleFromRollout(
  filePath: string,
  maxLines = 50,
): Promise<string | undefined> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').slice(0, maxLines)
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        if (event.type !== 'response_item') continue
        const payload = event.payload
        if (payload?.role !== 'user') continue
        for (const part of payload.content ?? []) {
          const text = part.text?.trim()
          if (text && part.type !== 'tool_use') {
            return text.length > 120 ? `${text.slice(0, 117)}...` : text
          }
        }
      } catch {
        // skip malformed line
      }
    }
  } catch {
    // unreadable file
  }
  return undefined
}

function toSession(
  id: string,
  title: string,
  updatedAt: string,
  storagePath: string,
  cwd?: string,
  createdAt?: string,
): ChatSession {
  return {
    id: `codex:${id}`,
    source: 'codex',
    title,
    cwd,
    createdAt: createdAt ?? updatedAt,
    updatedAt,
    storagePath,
  }
}

export async function fetchCodexChats(codexHome: string): Promise<ChatSession[]> {
  const index = await readIndex(path.join(codexHome, 'session_index.jsonl'))
  const rollouts = await findRolloutFiles(codexHome)
  const byId = new Map<string, ChatSession>()

  for (const [id, entry] of index) {
    const updatedAt = entry.updated_at ?? new Date(0).toISOString()
    byId.set(
      id,
      toSession(
        id,
        entry.thread_name?.trim() || `Codex ${id.slice(0, 8)}`,
        updatedAt,
        path.join(codexHome, 'session_index.jsonl'),
      ),
    )
  }

  for (const filePath of rollouts) {
    const filename = path.basename(filePath)
    const id = parseRolloutId(filename)
    if (!id) continue

    const fileUpdatedAt =
      parseRolloutTimestamp(filename) ??
      new Date((await fs.stat(filePath)).mtimeMs).toISOString()

    const existing = byId.get(id)
    if (existing) {
      if (new Date(fileUpdatedAt) > new Date(existing.updatedAt)) {
        existing.updatedAt = fileUpdatedAt
      }
      existing.storagePath = filePath
      continue
    }

    const title =
      (await extractCodexTitleFromRollout(filePath)) ?? `Codex ${id.slice(0, 8)}`

    let cwd: string | undefined
    try {
      const firstLine = (await fs.readFile(filePath, 'utf-8')).split('\n')[0]
      const meta = JSON.parse(firstLine)
      cwd = meta.payload?.cwd
    } catch {
      // optional cwd
    }

    byId.set(id, toSession(id, title, fileUpdatedAt, filePath, cwd, fileUpdatedAt))
  }

  return [...byId.values()]
}
