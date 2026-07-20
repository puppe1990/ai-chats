import { createServerFn } from '@tanstack/react-start'

/**
 * @deprecated Desktop path uses Tauri `invoke('get_chat_detail')` via `src/lib/desktop-api.ts`
 * and Rust `ai-chats-core`. Kept only as an optional Node/createServerFn RPC shim for
 * non-desktop/web experiments — not used by the SPA routes.
 *
 * Thin RPC surface. Implementation is dynamically imported so Node/SQLite code
 * never lands in the browser bundle.
 */
export const getChatDetail = createServerFn({ method: 'GET' })
  .validator((chatId: string) => chatId)
  .handler(async ({ data: chatId }) => {
    const { loadChatDetail } = await import('./load-chat-detail.server')
    return loadChatDetail(chatId)
  })
