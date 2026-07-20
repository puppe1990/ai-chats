import type { DragEvent } from 'react'
import type { ChatSession } from './types'

export const CHAT_ORDER_STORAGE_KEY = 'db-code-harness:chat-order'
export const CHAT_DRAG_MIME = 'application/x-db-code-harness-chat-id'

export function mergeChatOrder(stored: string[], chats: ChatSession[]): string[] {
  const validIds = new Set(chats.map((chat) => chat.id))
  const seen = new Set<string>()
  const merged: string[] = []

  for (const id of stored) {
    if (!validIds.has(id) || seen.has(id)) continue
    merged.push(id)
    seen.add(id)
  }

  for (const chat of chats) {
    if (seen.has(chat.id)) continue
    merged.push(chat.id)
    seen.add(chat.id)
  }

  return merged
}

export function sortChatsByCustomOrder(
  chats: ChatSession[],
  order: string[],
): ChatSession[] {
  if (order.length === 0) return chats

  const rank = new Map(order.map((id, index) => [id, index]))

  return [...chats].sort((a, b) => {
    const rankA = rank.get(a.id)
    const rankB = rank.get(b.id)

    if (rankA != null && rankB != null && rankA !== rankB) {
      return rankA - rankB
    }
    if (rankA != null && rankB == null) return -1
    if (rankA == null && rankB != null) return 1

    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export function reorderChatIds(
  order: string[],
  draggedId: string,
  targetId: string,
): string[] {
  if (draggedId === targetId) return order

  const fromIndex = order.indexOf(draggedId)
  const toIndex = order.indexOf(targetId)
  if (fromIndex === -1 || toIndex === -1) return order

  const next = [...order]
  next.splice(fromIndex, 1)
  next.splice(toIndex, 0, draggedId)
  return next
}

export function readStoredChatOrder(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(CHAT_ORDER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

export function writeStoredChatOrder(order: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CHAT_ORDER_STORAGE_KEY, JSON.stringify(order))
}

export function setChatDragData(event: DragEvent, chatId: string) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(CHAT_DRAG_MIME, chatId)
  event.dataTransfer.setData('text/plain', chatId)
}

export function readChatDragData(event: DragEvent): string | null {
  const custom = event.dataTransfer.getData(CHAT_DRAG_MIME)
  if (custom) return custom
  const plain = event.dataTransfer.getData('text/plain')
  return plain || null
}
