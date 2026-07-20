import { createServerFn } from '@tanstack/react-start'
import { type ChatListQuery, normalizeChatListQuery } from '../lib/chat-list'

/**
 * @deprecated Desktop path uses Tauri `invoke('get_chats')` via `src/lib/desktop-api.ts`
 * and Rust `ai-chats-core`. Kept only as an optional Node/createServerFn RPC shim for
 * non-desktop/web experiments — not used by the SPA routes.
 *
 * Thin RPC surface. Implementation is dynamically imported so Node/SQLite code
 * never lands in the browser bundle.
 */
export const getChats = createServerFn({ method: 'GET' })
  .validator((input: ChatListQuery) => normalizeChatListQuery(input))
  .handler(async ({ data }) => {
    const { loadChatList } = await import('./load-chat-list.server')
    return loadChatList(data)
  })
