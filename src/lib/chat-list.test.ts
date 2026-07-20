import { describe, expect, it } from 'vitest'
import { buildChatListResponse, CHAT_PAGE_SIZE } from './chat-list'
import type { ChatSession } from './types'

const chats: ChatSession[] = Array.from({ length: 25 }, (_, index) => ({
  id: `grok:${index + 1}`,
  source: 'grok',
  title: `Chat ${index + 1}`,
  cwd: `/Users/test/project-${index + 1}`,
  createdAt: '2026-06-24T10:00:00Z',
  updatedAt: `2026-06-24T${String(10 + index).padStart(2, '0')}:00:00Z`,
  messageCount: index + 1,
}))

describe('buildChatListResponse', () => {
  it('paginates chats with the default page size of 10', () => {
    const result = buildChatListResponse(chats, { page: 1 })

    expect(CHAT_PAGE_SIZE).toBe(10)
    expect(result.items).toHaveLength(10)
    expect(result.page).toBe(1)
    expect(result.totalItems).toBe(25)
    expect(result.totalPages).toBe(3)
    expect(result.hasNextPage).toBe(true)
    expect(result.hasPreviousPage).toBe(false)
  })

  it('returns the requested backend page slice', () => {
    const page2 = buildChatListResponse(chats, { page: 2 })
    const page3 = buildChatListResponse(chats, { page: 3 })

    expect(page2.items).toHaveLength(10)
    expect(page2.items[0].title).toBe('Chat 11')
    expect(page2.page).toBe(2)
    expect(page2.hasPreviousPage).toBe(true)
    expect(page2.hasNextPage).toBe(true)

    expect(page3.items).toHaveLength(5)
    expect(page3.items[0].title).toBe('Chat 21')
    expect(page3.page).toBe(3)
    expect(page3.hasNextPage).toBe(false)
  })

  it('filters and paginates on the server', () => {
    const mixed: ChatSession[] = [
      ...chats.slice(0, 3),
      {
        id: 'codex:1',
        source: 'codex',
        title: 'Codex task',
        cwd: '/Users/test/codex',
        createdAt: '2026-06-24T10:00:00Z',
        updatedAt: '2026-06-24T11:00:00Z',
      },
    ]

    const result = buildChatListResponse(mixed, {
      page: 1,
      source: 'grok',
      query: 'chat 2',
    })

    expect(result.totalItems).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe('grok:2')
    expect(result.counts.codex).toBe(1)
    expect(result.totalChats).toBe(4)
  })
})
