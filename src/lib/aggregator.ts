import path from 'node:path'
import type { DataPaths } from './config'
import { sortByUpdatedAt } from './sort'
import type { ChatSession } from './types'
import { fetchClaudeChats } from './providers/claude'
import { fetchCodexChats } from './providers/codex'
import { fetchCursorChats } from './providers/cursor'
import { fetchGrokChats } from './providers/grok'
import { fetchOpenCodeChats } from './providers/opencode'

async function safeFetch(
  name: string,
  fn: () => Promise<ChatSession[]>,
): Promise<ChatSession[]> {
  try {
    return await fn()
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
