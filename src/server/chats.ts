import { createServerFn } from '@tanstack/react-start'
import { aggregateChats } from '../lib/aggregator'
import {
  buildChatListResponse,
  type ChatListQuery,
  type ChatListResponse,
  normalizeChatListQuery,
} from '../lib/chat-list'
import { getDataPaths, type DataPaths } from '../lib/config'

/**
 * Core list handler used by the UI server function.
 * Exported so desktop/data-path tests can drive the same code path.
 */
export async function loadChatList(
  query: ChatListQuery,
  paths: DataPaths = getDataPaths(),
): Promise<ChatListResponse> {
  const chats = await aggregateChats(paths)
  return buildChatListResponse(chats, query)
}

export const getChats = createServerFn({ method: 'GET' })
  .validator((input: ChatListQuery) => normalizeChatListQuery(input))
  .handler(async ({ data }) => loadChatList(data))
