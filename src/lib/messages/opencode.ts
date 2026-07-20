import Database from 'better-sqlite3'
import type { ChatMessage } from '../types'
import { extractTextFromParts } from './extract-text'

function openDatabase(dbPath: string): Database.Database {
  try {
    return new Database(dbPath, { readonly: true, fileMustExist: true })
  } catch (firstErr) {
    const deadline = Date.now() + 100
    while (Date.now() < deadline) {
      /* brief wait */
    }
    try {
      return new Database(dbPath, { readonly: true, fileMustExist: true })
    } catch {
      throw firstErr
    }
  }
}

export function fetchOpenCodeMessages(
  dbPath: string,
  sessionId: string,
): ChatMessage[] {
  try {
    const db = openDatabase(dbPath)

    const messages = db
      .prepare(
        `SELECT id, data, time_created
         FROM message
         WHERE session_id = ?
         ORDER BY time_created ASC`,
      )
      .all(sessionId) as Array<{
      id: string
      data: string
      time_created: number
    }>

    const partsStmt = db.prepare(
      `SELECT data FROM part WHERE message_id = ? ORDER BY time_created ASC`,
    )

    const result: ChatMessage[] = []

    for (const row of messages) {
      try {
        const meta = JSON.parse(row.data)
        const role = meta.role
        if (role !== 'user' && role !== 'assistant') continue

        const partRows = partsStmt.all(row.id) as Array<{ data: string }>
        const partChunks = partRows
          .map((chunk) => {
            try {
              return JSON.parse(chunk.data)
            } catch {
              return null
            }
          })
          .filter(Boolean)

        const text = extractTextFromParts(partChunks)
        if (!text) continue

        result.push({
          id: `opencode-msg-${row.id}`,
          role,
          content: text,
          timestamp: meta.time?.created
            ? new Date(meta.time.created).toISOString()
            : new Date(row.time_created).toISOString(),
        })
      } catch {
        // skip malformed row
      }
    }

    db.close()
    return result
  } catch {
    return []
  }
}
