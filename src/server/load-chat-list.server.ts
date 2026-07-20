import { aggregateChats } from '../lib/aggregator'
import {
  buildChatListResponse,
  type ChatListQuery,
  type ChatListResponse,
} from '../lib/chat-list'
import { getDataPaths, type DataPaths } from '../lib/config'

/**
 * Server-only list loader. Must not be imported from client components —
 * use getChats() RPC instead.
 */
export async function loadChatList(
  query: ChatListQuery,
  paths: DataPaths = getDataPaths(),
): Promise<ChatListResponse> {
  const chats = await aggregateChats(paths)
  return buildChatListResponse(chats, query)
}
