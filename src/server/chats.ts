import { createServerFn } from '@tanstack/react-start'
import { type ChatListQuery, normalizeChatListQuery } from '../lib/chat-list'

/**
 * Thin RPC surface for the client.
 * Implementation is dynamically imported so Node/SQLite code never lands in the browser bundle.
 */
export const getChats = createServerFn({ method: 'GET' })
  .validator((input: ChatListQuery) => normalizeChatListQuery(input))
  .handler(async ({ data }) => {
    const { loadChatList } = await import('./load-chat-list.server')
    return loadChatList(data)
  })
