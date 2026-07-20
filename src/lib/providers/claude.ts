import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import type { ChatSession } from '../types'
import { extractTextFromParts } from '../messages/extract-text'

interface ClaudeHistoryEntry {
  display?: string
  timestamp?: number
  project?: string
  sessionId?: string
}

interface ClaudeSessionLine {
  type?: string
  timestamp?: string
  cwd?: string
  message?: {
    model?: string
    role?: string
    content?: string | Array<{ type?: string; text?: string }>
  }
}

const UUID_JSONL_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i

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

function isSlashCommand(display: string): boolean {
  return display.startsWith('/') && !display.includes(' ')
}

async function readHistoryIndex(
  historyPath: string,
): Promise<Map<string, ClaudeHistoryEntry>> {
  const map = new Map<string, ClaudeHistoryEntry>()
  try {
    const content = await fsPromises.readFile(historyPath, 'utf-8')
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const entry: ClaudeHistoryEntry = JSON.parse(line)
        if (!entry.sessionId) continue
        const prev = map.get(entry.sessionId)
        if (!prev || (entry.timestamp ?? 0) >= (prev.timestamp ?? 0)) {
          map.set(entry.sessionId, entry)
        }
      } catch {
        // skip malformed line
      }
    }
  } catch {
    // history optional
  }
  return map
}

async function findSessionFiles(projectsDir: string): Promise<string[]> {
  const results: string[] = []
  try {
    const projects = await fsPromises.readdir(projectsDir, { withFileTypes: true })
    for (const project of projects) {
      if (!project.isDirectory()) continue
      const projectPath = path.join(projectsDir, project.name)
      const entries = await fsPromises.readdir(projectPath, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile() || !UUID_JSONL_RE.test(entry.name)) continue
        results.push(path.join(projectPath, entry.name))
      }
    }
  } catch {
    return []
  }
  return results
}

export async function extractClaudeTitleFromSession(
  sessionPath: string,
  maxLines = 80,
): Promise<string | undefined> {
  try {
    const content = await fsPromises.readFile(sessionPath, 'utf-8')
    let lineCount = 0
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      if (++lineCount > maxLines) break
      try {
        const row: ClaudeSessionLine = JSON.parse(line)
        if (row.type !== 'user') continue
        const text = parseUserContent(row.message?.content)
        if (text) return text.slice(0, 120)
      } catch {
        // skip malformed line
      }
    }
  } catch {
    return undefined
  }
  return undefined
}

async function scanSessionMetadata(sessionPath: string): Promise<{
  cwd?: string
  createdAt?: string
  model?: string
  messageCount: number
  title?: string
}> {
  let cwd: string | undefined
  let createdAt: string | undefined
  let model: string | undefined
  let messageCount = 0
  let title: string | undefined

  try {
    const content = await fsPromises.readFile(sessionPath, 'utf-8')
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const row: ClaudeSessionLine = JSON.parse(line)
        cwd ??= row.cwd
        if (!createdAt && row.timestamp) createdAt = row.timestamp
        if (row.type === 'user' || row.type === 'assistant') messageCount++
        if (row.type === 'assistant' && row.message?.model) model = row.message.model
        if (!title && row.type === 'user') {
          const text = parseUserContent(row.message?.content)
          if (text) title = text.slice(0, 120)
        }
      } catch {
        // skip malformed line
      }
    }
  } catch {
    return { messageCount: 0 }
  }

  return { cwd, createdAt, model, messageCount, title }
}

function titleFromHistory(entry: ClaudeHistoryEntry | undefined): string | undefined {
  const display = entry?.display?.trim()
  if (!display) return undefined
  if (isSlashCommand(display)) return undefined
  return display.slice(0, 120)
}

async function parseSessionFile(
  sessionPath: string,
  history: Map<string, ClaudeHistoryEntry>,
): Promise<ChatSession | null> {
  try {
    const sessionId = path.basename(sessionPath, '.jsonl')
    const meta = await scanSessionMetadata(sessionPath)
    const historyEntry = history.get(sessionId)
    const title =
      meta.title ?? titleFromHistory(historyEntry) ?? `Claude ${sessionId.slice(0, 8)}`
    const stat = fs.statSync(sessionPath)
    const cwd = meta.cwd ?? historyEntry?.project
    const createdAt =
      meta.createdAt ??
      (historyEntry?.timestamp
        ? new Date(historyEntry.timestamp).toISOString()
        : new Date(0).toISOString())

    return {
      id: `claude:${sessionId}`,
      source: 'claude',
      title,
      cwd,
      createdAt,
      updatedAt: new Date(stat.mtimeMs).toISOString(),
      messageCount: meta.messageCount || undefined,
      model: meta.model,
      storagePath: sessionPath,
    }
  } catch {
    return null
  }
}

export async function fetchClaudeChats(claudeHome: string): Promise<ChatSession[]> {
  const projectsDir = path.join(claudeHome, 'projects')
  const history = await readHistoryIndex(path.join(claudeHome, 'history.jsonl'))
  const files = await findSessionFiles(projectsDir)
  const sessions = await Promise.all(
    files.map((file) => parseSessionFile(file, history)),
  )
  return sessions.filter((s): s is ChatSession => s !== null)
}
