import type { ChatSource } from './types'

const SOURCES: ChatSource[] = ['cursor', 'grok', 'codex', 'opencode', 'claude']

export function toChatRouteParams(chatId: string): {
  source: ChatSource
  sessionId: string
} {
  const idx = chatId.indexOf(':')
  if (idx === -1) {
    throw new Error(`Invalid chat id: ${chatId}`)
  }
  const source = chatId.slice(0, idx) as ChatSource
  if (!SOURCES.includes(source)) {
    throw new Error(`Unknown chat source: ${source}`)
  }
  return { source, sessionId: chatId.slice(idx + 1) }
}

export function fromChatRouteParams(source: string, sessionId: string): string {
  return `${source}:${decodeURIComponent(sessionId)}`
}

/**
 * Clipboard text for "Copy ID".
 * Grok always becomes a ready-to-run: `grok --resume {sessionId}`
 */
export function formatCopyId(chatId: string, source?: ChatSource | string): string {
  const idx = chatId.indexOf(':')
  let sessionId = chatId
  let resolvedSource = source

  if (idx !== -1) {
    const prefix = chatId.slice(0, idx)
    if (SOURCES.includes(prefix as ChatSource)) {
      resolvedSource = resolvedSource ?? prefix
      sessionId = chatId.slice(idx + 1)
    }
  }

  if (resolvedSource === 'grok') {
    // Guard against double-prefix if id was already a resume command.
    const bare = sessionId.replace(/^grok\s+--resume\s+/i, '').trim()
    return `grok --resume ${bare}`
  }

  return chatId
}
