import type { ChatSession, ChatSource } from './types'
import { SOURCE_LABELS } from './types'

export function filterChats(
  chats: ChatSession[],
  options: {
    source?: ChatSource | 'all'
    query?: string
    favoriteIds?: string[]
    favoritesOnly?: boolean
  },
): ChatSession[] {
  const normalizedQuery = options.query?.trim().toLowerCase() ?? ''
  const favoriteSet =
    options.favoritesOnly && options.favoriteIds ? new Set(options.favoriteIds) : null

  return chats.filter((chat) => {
    if (options.source && options.source !== 'all' && chat.source !== options.source) {
      return false
    }

    if (favoriteSet && !favoriteSet.has(chat.id)) {
      return false
    }

    if (!normalizedQuery) return true

    const haystack = [
      chat.title,
      chat.cwd,
      chat.model,
      SOURCE_LABELS[chat.source],
      chat.source,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedQuery)
  })
}
