import Database from 'better-sqlite3'
import type { ChatSession } from '../types'

interface OpenCodeRow {
  id: string
  title: string
  directory: string
  time_created: number
  time_updated: number
  model: string | null
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

export function fetchOpenCodeChats(dbPath: string): ChatSession[] {
  try {
    const db = openDatabase(dbPath)
    const rows = db
      .prepare(
        `SELECT id, title, directory, time_created, time_updated, model
         FROM session ORDER BY time_updated DESC`,
      )
      .all() as OpenCodeRow[]
    db.close()

    return rows.map((row) => ({
      id: `opencode:${row.id}`,
      source: 'opencode' as const,
      title: row.title || `OpenCode ${row.id.slice(0, 8)}`,
      cwd: row.directory,
      createdAt: new Date(row.time_created).toISOString(),
      updatedAt: new Date(row.time_updated).toISOString(),
      model: row.model ?? undefined,
      storagePath: dbPath,
    }))
  } catch {
    return []
  }
}
