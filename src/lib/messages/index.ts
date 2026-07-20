import type { DataPaths } from '../config'
import type { ChatDetail, ChatMessage, ChatSession } from '../types'
import { fetchClaudeMessages } from './claude'
import { fetchCodexMessages, findCodexRolloutById } from './codex'
import { fetchCursorMessages } from './cursor'
import { fetchGrokMessages } from './grok'
import { fetchOpenCodeMessages } from './opencode'

function parseChatId(chatId: string): { source: string; rawId: string } | null {
  const idx = chatId.indexOf(':')
  if (idx === -1) return null
  return { source: chatId.slice(0, idx), rawId: chatId.slice(idx + 1) }
}

async function loadMessages(
  session: ChatSession,
  paths: DataPaths,
): Promise<ChatMessage[]> {
  const storagePath = session.storagePath
  if (!storagePath) return []

  switch (session.source) {
    case 'codex': {
      let rolloutPath = storagePath
      if (!rolloutPath.endsWith('.jsonl')) {
        rolloutPath =
          (await findCodexRolloutById(paths.codexHome, session.id.slice(6))) ?? ''
      }
      return rolloutPath ? fetchCodexMessages(rolloutPath) : []
    }
    case 'grok':
      return fetchGrokMessages(storagePath)
    case 'cursor':
      return fetchCursorMessages(storagePath)
    case 'opencode':
      return fetchOpenCodeMessages(storagePath, session.id.slice(9))
    case 'claude':
      return fetchClaudeMessages(storagePath)
    default:
      return []
  }
}

export async function fetchChatDetail(
  chatId: string,
  session: ChatSession,
  paths: DataPaths,
): Promise<ChatDetail | null> {
  const parsed = parseChatId(chatId)
  if (!parsed || parsed.source !== session.source || session.id !== chatId) {
    return null
  }

  const messages = await loadMessages(session, paths)
  return { session, messages }
}
