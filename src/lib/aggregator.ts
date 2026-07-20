import path from 'node:path'
import type { DataPaths } from './config'
import { sortByUpdatedAt } from './sort'
import type { ChatSession } from './types'
import { fetchClaudeChats } from './providers/claude'
import { fetchCodexChats } from './providers/codex'
import { fetchCursorChats } from './providers/cursor'
import { fetchGrokChats } from './providers/grok'
import { fetchOpenCodeChats } from './providers/opencode'

/** Prevent a single slow/locked agent store from freezing the whole UI. */
export const PROVIDER_TIMEOUT_MS = 3_500

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[aggregateChats] ${label} timed out after ${ms}ms`))
    }, ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export async function safeFetch(
  name: string,
  fn: () => Promise<ChatSession[]>,
  timeoutMs: number = PROVIDER_TIMEOUT_MS,
): Promise<ChatSession[]> {
  try {
    return await withTimeout(fn(), timeoutMs, name)
  } catch (err) {
    console.error(`[aggregateChats] ${name} provider failed:`, err)
    return []
  }
}

export async function aggregateChats(paths: DataPaths): Promise<ChatSession[]> {
  const [grok, codex, cursor, opencode, claude] = await Promise.all([
    safeFetch('grok', () => fetchGrokChats(path.join(paths.grokHome, 'sessions'))),
    safeFetch('codex', () => fetchCodexChats(paths.codexHome)),
    safeFetch('cursor', () => fetchCursorChats(path.join(paths.cursorHome, 'chats'))),
    safeFetch('opencode', async () =>
      fetchOpenCodeChats(path.join(paths.opencodeDataDir, 'opencode.db')),
    ),
    safeFetch('claude', () => fetchClaudeChats(paths.claudeHome)),
  ])

  return sortByUpdatedAt([...grok, ...codex, ...cursor, ...opencode, ...claude])
}
