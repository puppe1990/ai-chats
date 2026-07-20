import { createServerFn } from '@tanstack/react-start'
import { getDataPaths, type DataPaths } from '../lib/config'
import { aggregateChats } from '../lib/aggregator'
import { fetchChatDetail } from '../lib/messages'
import type { ChatDetail } from '../lib/types'

/**
 * Core detail handler used by the UI server function.
 * Exported so desktop/data-path tests can drive the same code path.
 */
export async function loadChatDetail(
  chatId: string,
  paths: DataPaths = getDataPaths(),
): Promise<ChatDetail | null> {
  const chats = await aggregateChats(paths)
  const session = chats.find((c) => c.id === chatId)
  if (!session) return null
  return fetchChatDetail(chatId, session, paths)
}

export const getChatDetail = createServerFn({ method: 'GET' })
  .validator((chatId: string) => chatId)
  .handler(async ({ data: chatId }) => loadChatDetail(chatId))
