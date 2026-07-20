import Database from 'better-sqlite3'
import type { ChatMessage } from '../types'
import { extractTextFromParts, stripUserQueryTags } from './extract-text'

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

export function fetchCursorMessages(storeDbPath: string): ChatMessage[] {
  try {
    const db = openDatabase(storeDbPath)
    const rows = db.prepare('SELECT id, data FROM blobs').all() as Array<{
      id: string
      data: Buffer
    }>
    db.close()

    const messages: ChatMessage[] = []
    let index = 0

    for (const row of rows) {
      try {
        const payload = JSON.parse(row.data.toString('utf-8'))
        const role = payload.role
        if (role !== 'user' && role !== 'assistant') continue

        const text = stripUserQueryTags(extractTextFromParts(payload.content ?? []))
        if (!text) continue

        messages.push({
          id: `cursor-msg-${row.id.slice(0, 8)}-${index++}`,
          role,
          content: text,
        })
      } catch {
        // skip non-json blobs
      }
    }

    return messages
  } catch {
    return []
  }
}
