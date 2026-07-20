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
