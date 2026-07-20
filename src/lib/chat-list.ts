import { mergeChatOrder, sortChatsByCustomOrder } from './chat-display-order'
import { filterChats } from './filter-chats'
import { paginate } from './paginate'
import type { ChatSession, ChatSource } from './types'

export const CHAT_PAGE_SIZE = 10

const ALL_SOURCES: ChatSource[] = ['cursor', 'grok', 'codex', 'opencode', 'claude']

export interface ChatListQuery {
  page: number
  pageSize?: number
  source?: ChatSource | 'all'
  query?: string
  order?: string[]
  favoriteIds?: string[]
  favoritesOnly?: boolean
}

export interface ChatListResponse {
  items: ChatSession[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  startIndex: number
  endIndex: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  counts: Record<ChatSource, number>
  totalChats: number
  favoriteCount: number
}

export function normalizeChatListQuery(input: ChatListQuery): Required<
  Omit<ChatListQuery, 'favoriteIds' | 'favoritesOnly'>
> & {
  favoriteIds: string[]
  favoritesOnly: boolean
} {
  return {
    page: Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page)) : 1,
    pageSize: Number.isFinite(input.pageSize)
      ? Math.max(1, Math.floor(input.pageSize!))
      : CHAT_PAGE_SIZE,
    source: input.source ?? 'all',
    query: input.query ?? '',
    order: Array.isArray(input.order)
      ? input.order.filter((id): id is string => typeof id === 'string')
      : [],
    favoriteIds: Array.isArray(input.favoriteIds)
      ? input.favoriteIds.filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        )
      : [],
    favoritesOnly: Boolean(input.favoritesOnly),
  }
}

export function buildChatListResponse(
  chats: ChatSession[],
  rawQuery: ChatListQuery,
): ChatListResponse {
  const query = normalizeChatListQuery(rawQuery)

  const counts = Object.fromEntries(ALL_SOURCES.map((source) => [source, 0])) as Record<
    ChatSource,
    number
  >
  for (const chat of chats) counts[chat.source]++

  const favoriteSet = new Set(query.favoriteIds)
  const favoriteCount = chats.reduce(
    (n, chat) => n + (favoriteSet.has(chat.id) ? 1 : 0),
    0,
  )

  const mergedOrder = mergeChatOrder(query.order, chats)
  const filtered = filterChats(chats, {
    source: query.source,
    query: query.query,
    favoriteIds: query.favoriteIds,
    favoritesOnly: query.favoritesOnly,
  })
  const ordered = sortChatsByCustomOrder(filtered, mergedOrder)
  const pagination = paginate(ordered, { page: query.page, pageSize: query.pageSize })

  return {
    items: pagination.items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    startIndex: pagination.startIndex,
    endIndex: pagination.endIndex,
    hasPreviousPage: pagination.hasPreviousPage,
    hasNextPage: pagination.hasNextPage,
    counts,
    totalChats: chats.length,
    favoriteCount,
  }
}
