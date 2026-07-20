import { createServerFn } from '@tanstack/react-start'

/**
 * Thin RPC surface for the client.
 * Implementation is dynamically imported so Node/SQLite code never lands in the browser bundle.
 */
export const getChatDetail = createServerFn({ method: 'GET' })
  .validator((chatId: string) => chatId)
  .handler(async ({ data: chatId }) => {
    const { loadChatDetail } = await import('./load-chat-detail.server')
    return loadChatDetail(chatId)
  })
