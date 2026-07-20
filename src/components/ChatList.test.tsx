/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildChatListResponse } from '../lib/chat-list'
import type { ChatSession } from '../lib/types'
import { ChatList } from './ChatList'

const mockFetchChats = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode
    to: string
    params?: { source: string; sessionId: string }
  }) => (
    <a
      href={`${to.replace('$source', params?.source ?? '').replace('$sessionId', params?.sessionId ?? '')}`}
    >
      {children}
    </a>
  ),
}))

vi.mock('../server/chats', () => ({
  getChats: { id: 'getChats' },
}))

vi.mock('@tanstack/react-start', () => ({
  useServerFn: () => mockFetchChats,
}))

vi.mock('./RelativeTime', () => ({
  RelativeTime: () => <span>2h ago</span>,
}))

vi.mock('./ExportMarkdownButton', () => ({
  ExportMarkdownButton: () => <button type="button">Export</button>,
}))

const chats: ChatSession[] = [
  {
    id: 'grok:1',
    source: 'grok',
    title: 'Build chat aggregator',
    cwd: '/Users/test/project',
    createdAt: '2026-06-24T10:00:00Z',
    updatedAt: '2026-06-24T12:00:00Z',
    messageCount: 8,
  },
  {
    id: 'codex:2',
    source: 'codex',
    title: 'Limpar HD com script',
    cwd: '/Users/test/other',
    createdAt: '2026-06-20T10:00:00Z',
    updatedAt: '2026-06-20T14:00:00Z',
    messageCount: 3,
  },
  {
    id: 'claude:3',
    source: 'claude',
    title: 'Breadcrumb nos arquivos',
    cwd: '/Users/test/claude-project',
    createdAt: '2026-06-22T10:00:00Z',
    updatedAt: '2026-06-22T14:00:00Z',
    messageCount: 12,
  },
]

function initialData() {
  return buildChatListResponse(chats, { page: 1, source: 'all', query: '' })
}

describe('ChatList', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockFetchChats.mockReset()
    mockFetchChats.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        buildChatListResponse(chats, {
          page: Number(data.page ?? 1),
          source: (data.source as 'all') ?? 'all',
          query: String(data.query ?? ''),
          order: Array.isArray(data.order) ? (data.order as string[]) : [],
          favoriteIds: Array.isArray(data.favoriteIds)
            ? (data.favoriteIds as string[])
            : [],
          favoritesOnly: Boolean(data.favoritesOnly),
        }),
    )
  })

  it('renders search, provider filters, and view mode controls', () => {
    render(<ChatList initialData={initialData()} />)

    expect(screen.getByLabelText('Buscar chats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Favoritos/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Visualização em lista' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Visualização em grade' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Todos/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Grok/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Codex/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Claude Code/ })).toBeInTheDocument()
  })

  it('filters chats by search query via backend', async () => {
    render(<ChatList initialData={initialData()} />)

    fireEvent.change(screen.getByLabelText('Buscar chats'), {
      target: { value: 'limpar hd' },
    })

    await waitFor(() => {
      expect(mockFetchChats).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByText('Limpar HD com script')).toBeInTheDocument()
      expect(screen.queryByText('Build chat aggregator')).not.toBeInTheDocument()
      expect(screen.getByText(/1 resultado/)).toBeInTheDocument()
    })
  })

  it('filters chats by provider via backend', async () => {
    render(<ChatList initialData={initialData()} />)

    fireEvent.click(screen.getByRole('button', { name: /Grok/ }))

    await waitFor(() => {
      expect(mockFetchChats).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByText('Build chat aggregator')).toBeInTheDocument()
      expect(screen.queryByText('Limpar HD com script')).not.toBeInTheDocument()
      expect(screen.getByText(/1 resultado/)).toBeInTheDocument()
    })
  })

  it('favorites a chat instantly without refetch, then filters favorites', async () => {
    render(<ChatList initialData={initialData()} />)
    mockFetchChats.mockClear()

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Adicionar aos favoritos' })[0],
    )

    await waitFor(() => {
      expect(window.localStorage.getItem('ai-chats:favorites')).toBe(
        JSON.stringify(['grok:1']),
      )
    })
    // Star toggle must stay local — a full list refetch freezes the UI.
    expect(mockFetchChats).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Remover dos favoritos' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Favoritos \(1\)/ }))

    await waitFor(() => {
      expect(mockFetchChats).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            favoritesOnly: true,
            favoriteIds: ['grok:1'],
          }),
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Build chat aggregator')).toBeInTheDocument()
      expect(screen.queryByText('Limpar HD com script')).not.toBeInTheDocument()
      expect(screen.getByText(/nos favoritos/)).toBeInTheDocument()
    })
  })

  it('switches between list and grid layouts', () => {
    render(<ChatList initialData={initialData()} />)

    const list = screen.getByRole('list')
    expect(list.className).toContain('space-y-2')

    fireEvent.click(screen.getByRole('button', { name: 'Visualização em grade' }))
    expect(list.className).toContain('grid')
    expect(list.className).toContain('sm:grid-cols-2')

    fireEvent.click(screen.getByRole('button', { name: 'Visualização em lista' }))
    expect(list.className).toContain('space-y-2')
  })

  it('persists the selected view mode in localStorage', () => {
    const { unmount } = render(<ChatList initialData={initialData()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Visualização em grade' }))
    expect(window.localStorage.getItem('db-code-harness:chat-view-mode')).toBe('grid')

    unmount()
    render(<ChatList initialData={initialData()} />)

    expect(
      screen.getByRole('button', { name: 'Visualização em grade' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('list').className).toContain('grid')
  })

  it('reorders chats when dropping onto another card', async () => {
    render(<ChatList initialData={initialData()} />)

    const handles = screen.getAllByLabelText(/Reordenar chat/)
    const listItems = screen.getAllByRole('listitem')

    fireEvent.dragStart(handles[2], {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: 'move',
        types: ['application/x-db-code-harness-chat-id'],
      },
    })

    fireEvent.drop(listItems[0], {
      dataTransfer: {
        getData: (type: string) =>
          type === 'application/x-db-code-harness-chat-id' ? 'claude:3' : '',
        types: ['application/x-db-code-harness-chat-id'],
      },
    })

    await waitFor(() => {
      expect(window.localStorage.getItem('db-code-harness:chat-order')).toBe(
        JSON.stringify(['claude:3', 'grok:1', 'codex:2']),
      )
      expect(mockFetchChats).toHaveBeenCalled()
    })
  })
})
