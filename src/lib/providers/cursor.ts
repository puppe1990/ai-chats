import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { ChatSession } from '../types'

interface CursorMeta {
  agentId: string
  name?: string
  createdAt?: number
}

async function findStoreDbs(chatsDir: string): Promise<string[]> {
  const results: string[] = []
  try {
    const workspaces = await fsPromises.readdir(chatsDir, { withFileTypes: true })
    for (const ws of workspaces) {
      if (!ws.isDirectory()) continue
      const wsPath = path.join(chatsDir, ws.name)
      const chats = await fsPromises.readdir(wsPath, { withFileTypes: true })
      for (const chat of chats) {
        if (!chat.isDirectory()) continue
        const dbPath = path.join(wsPath, chat.name, 'store.db')
        try {
          await fsPromises.access(dbPath)
          results.push(dbPath)
        } catch {
          // skip
        }
      }
    }
  } catch {
    return []
  }
  return results
}

function openDatabase(dbPath: string): Database.Database {
  try {
    return new Database(dbPath, { readonly: true, fileMustExist: true })
  } catch (firstErr) {
    const deadline = Date.now() + 100
    while (Date.now() < deadline) {
      /* brief wait for lock release */
    }
    try {
      return new Database(dbPath, { readonly: true, fileMustExist: true })
    } catch {
      throw firstErr
    }
  }
}

function parseStoreDb(dbPath: string): ChatSession | null {
  try {
    const chatId = path.basename(path.dirname(dbPath))
    const db = openDatabase(dbPath)
    const row = db.prepare("SELECT value FROM meta WHERE key = '0'").get() as
      | { value: string }
      | undefined
    db.close()
    if (!row) return null

    const meta: CursorMeta = JSON.parse(Buffer.from(row.value, 'hex').toString('utf-8'))
    const stat = fs.statSync(dbPath)

    return {
      id: `cursor:${chatId}`,
      source: 'cursor',
      title: meta.name?.trim() || `Cursor ${meta.agentId.slice(0, 8)}`,
      createdAt: new Date(meta.createdAt ?? 0).toISOString(),
      updatedAt: new Date(stat.mtimeMs).toISOString(),
      storagePath: dbPath,
    }
  } catch {
    return null
  }
}

export async function fetchCursorChats(chatsDir: string): Promise<ChatSession[]> {
  const dbs = await findStoreDbs(chatsDir)
  return dbs.map(parseStoreDb).filter((s): s is ChatSession => s !== null)
}
