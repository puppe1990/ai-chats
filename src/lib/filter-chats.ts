import type { ChatSession, ChatSource } from './types'
import { ALL_FOLDERS, NO_FOLDER_FILTER, SOURCE_LABELS } from './types'

export interface ChatFilterOptions {
  source?: ChatSource | 'all'
  /** Exact cwd to keep, or NO_FOLDER_FILTER for chats without one. */
  folder?: string
  query?: string
  favoriteIds?: string[]
  favoritesOnly?: boolean
}

/** Folder bucket a chat belongs to: its cwd, or NO_FOLDER_FILTER when missing. */
export function chatFolderBucket(chat: ChatSession): string {
  const cwd = chat.cwd?.trim()
  return cwd ? cwd : NO_FOLDER_FILTER
}

export function filterChats(
  chats: ChatSession[],
  options: ChatFilterOptions,
): ChatSession[] {
  const normalizedQuery = options.query?.trim().toLowerCase() ?? ''
  const favoriteSet =
    options.favoritesOnly && options.favoriteIds ? new Set(options.favoriteIds) : null
  const folder =
    options.folder && options.folder !== ALL_FOLDERS ? options.folder : null

  return chats.filter((chat) => {
    if (options.source && options.source !== 'all' && chat.source !== options.source) {
      return false
    }

    if (favoriteSet && !favoriteSet.has(chat.id)) {
      return false
    }

    if (folder && chatFolderBucket(chat) !== folder) {
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
