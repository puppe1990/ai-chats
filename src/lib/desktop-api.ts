import { invoke } from '@tauri-apps/api/core'
import type { ChatDetail } from './types'
import type { ChatListQuery, ChatListResponse } from './chat-list'

export async function getChats(input: {
  data: ChatListQuery
}): Promise<ChatListResponse> {
  return invoke<ChatListResponse>('get_chats', { query: input.data })
}

export async function getChatDetail(input: {
  data: string
}): Promise<ChatDetail | null> {
  return invoke<ChatDetail | null>('get_chat_detail', { chatId: input.data })
}
