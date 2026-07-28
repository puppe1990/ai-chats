import { invoke } from '@tauri-apps/api/core'
import type { ChatDetail } from './types'
import type { ChatListQuery, ChatListResponse } from './chat-list'
import type { SkillDetail, SkillSummary } from './skills'

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

export async function getSkills(): Promise<SkillSummary[]> {
  return invoke<SkillSummary[]>('get_skills')
}

export async function getSkill(skillId: string): Promise<SkillDetail | null> {
  return invoke<SkillDetail | null>('get_skill', { skillId })
}

export async function saveSkill(
  skillId: string,
  content: string,
): Promise<SkillDetail> {
  return invoke<SkillDetail>('save_skill', { skillId, content })
}
