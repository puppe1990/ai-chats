import { aggregateChats } from '../lib/aggregator'
import { getDataPaths, type DataPaths } from '../lib/config'
import { fetchChatDetail } from '../lib/messages'
import type { ChatDetail } from '../lib/types'

/**
 * Server-only detail loader. Must not be imported from client components —
 * use getChatDetail() RPC instead.
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
