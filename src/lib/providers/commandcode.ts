import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import type { ChatSession } from '../types'
import { extractTextFromParts } from '../messages/extract-text'

const UUID_JSONL_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i

interface SidecarMeta {
  title?: string
  model?: string
}

interface SessionScan {
  cwd?: string
  createdAt?: string
  model?: string
  messageCount: number
  title?: string
}

interface TranscriptEntry {
  role: string
  content: unknown
  timestamp?: string
  model?: string
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

async function readSidecarMeta(sessionPath: string): Promise<SidecarMeta> {
  const metaPath = sessionPath.replace(/\.jsonl$/i, '.meta.json')
  try {
    const raw = await fsPromises.readFile(metaPath, 'utf-8')
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return {}
    const record = value as Record<string, unknown>
    return {
      title: nonemptyString(record.title),
      model: nonemptyString(record.model),
    }
  } catch {
    return {}
  }
}

function parseEntry(row: Record<string, unknown>): TranscriptEntry | null {
  const timestamp = nonemptyString(row.timestamp)
  if (row.type === 'message' && row.message && typeof row.message === 'object') {
    const message = row.message as Record<string, unknown>
    const role = nonemptyString(message.role)
    if (!role) return null
    return {
      role,
      content: message.content,
      timestamp,
      model: nonemptyString(row.model),
    }
  }
  const role = nonemptyString(row.role)
  if (!role) return null
  return { role, content: row.content, timestamp, model: nonemptyString(row.model) }
}

function applySessionHeader(row: Record<string, unknown>, scan: SessionScan) {
  if (row.type !== 'session') return
  scan.cwd ??= nonemptyString(row.cwd)
  scan.createdAt ??= nonemptyString(row.timestamp)
}

function applyModelChange(row: Record<string, unknown>, scan: SessionScan) {
  if (row.type !== 'model_change') return
  const model = nonemptyString(row.model)
  if (model) scan.model = model
}

function applyEntry(entry: TranscriptEntry, scan: SessionScan) {
  scan.createdAt ??= entry.timestamp
  if (entry.role === 'assistant' && entry.model) scan.model = entry.model
  if (entry.role !== 'user' && entry.role !== 'assistant') return
  if (entry.role === 'user' && !textFromContent(entry.content)) return
  scan.messageCount += 1
  if (!scan.title && entry.role === 'user') {
    const text = textFromContent(entry.content)
    if (text) scan.title = text.slice(0, 120)
  }
}

async function scanSessionFile(sessionPath: string): Promise<SessionScan> {
  const scan: SessionScan = { messageCount: 0 }
  try {
    const content = await fsPromises.readFile(sessionPath, 'utf-8')
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line) as Record<string, unknown>
        applySessionHeader(row, scan)
        applyModelChange(row, scan)
        const entry = parseEntry(row)
        if (entry) applyEntry(entry, scan)
      } catch {
        // skip malformed line
      }
    }
  } catch {
    return scan
  }
  return scan
}

function fallbackTitle(sessionId: string): string {
  return `Command Code ${sessionId.slice(0, 8)}`
}

async function parseSessionFile(sessionPath: string): Promise<ChatSession | null> {
  try {
    const sessionId = path.basename(sessionPath, '.jsonl')
    const sidecar = await readSidecarMeta(sessionPath)
    const scan = await scanSessionFile(sessionPath)
    const stat = fs.statSync(sessionPath)
    return {
      id: `commandcode:${sessionId}`,
      source: 'commandcode',
      title: sidecar.title ?? scan.title ?? fallbackTitle(sessionId),
      cwd: scan.cwd,
      createdAt: scan.createdAt ?? new Date(0).toISOString(),
      updatedAt: new Date(stat.mtimeMs).toISOString(),
      messageCount: scan.messageCount || undefined,
      model: sidecar.model ?? scan.model,
      storagePath: sessionPath,
    }
  } catch {
    return null
  }
}

export async function fetchCommandCodeChats(
  commandcodeHome: string,
): Promise<ChatSession[]> {
  const files = await findSessionFiles(path.join(commandcodeHome, 'projects'))
  const sessions = await Promise.all(files.map((file) => parseSessionFile(file)))
  return sessions.filter((s): s is ChatSession => s !== null)
}
