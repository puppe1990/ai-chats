import { describe, expect, it } from 'vitest'
import type { ChatSession } from './types'
import {
  mergeChatOrder,
  reorderChatIds,
  sortChatsByCustomOrder,
} from './chat-display-order'

const chats: ChatSession[] = [
  {
    id: 'grok:1',
    source: 'grok',
    title: 'A',
    createdAt: '2026-06-24T10:00:00Z',
    updatedAt: '2026-06-24T12:00:00Z',
  },
  {
    id: 'codex:2',
    source: 'codex',
    title: 'B',
    createdAt: '2026-06-20T10:00:00Z',
    updatedAt: '2026-06-20T14:00:00Z',
  },
  {
    id: 'claude:3',
    source: 'claude',
    title: 'C',
    createdAt: '2026-06-22T10:00:00Z',
    updatedAt: '2026-06-22T14:00:00Z',
  },
]

describe('chat display order', () => {
  it('merges stored order with new chat ids', () => {
    expect(mergeChatOrder(['codex:2', 'missing:9'], chats)).toEqual([
      'codex:2',
      'grok:1',
      'claude:3',
    ])
  })

  it('sorts chats using custom order', () => {
    const sorted = sortChatsByCustomOrder(chats, ['claude:3', 'grok:1', 'codex:2'])
    expect(sorted.map((chat) => chat.id)).toEqual(['claude:3', 'grok:1', 'codex:2'])
  })

  it('reorders ids when dragging onto another chat', () => {
    const order = ['grok:1', 'codex:2', 'claude:3']
    expect(reorderChatIds(order, 'claude:3', 'grok:1')).toEqual([
      'claude:3',
      'grok:1',
      'codex:2',
    ])
  })
})
