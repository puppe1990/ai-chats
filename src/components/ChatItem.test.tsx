/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChatSession } from '../lib/types'
import { ChatItem } from './ChatItem'

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

vi.mock('./RelativeTime', () => ({
  RelativeTime: () => <span>2h ago</span>,
}))

vi.mock('./ExportMarkdownButton', () => ({
  ExportMarkdownButton: ({ chatId }: { chatId: string }) => (
    <div data-testid="export-buttons">{chatId}</div>
  ),
}))

const chat: ChatSession = {
  id: 'claude:59d60b82-b957-48e6-adff-c1cfd70a2470',
  source: 'claude',
  title: 'Breadcrumb nos arquivos',
  cwd: '/Users/test/project',
  createdAt: '2026-06-24T10:00:00.000Z',
  updatedAt: '2026-06-24T12:00:00.000Z',
  messageCount: 12,
}

describe('ChatItem', () => {
  it('renders chat metadata, link, and export actions', () => {
    render(<ChatItem chat={chat} />)

    expect(screen.getByText('Claude Code')).toBeInTheDocument()
    expect(screen.getByText('Breadcrumb nos arquivos')).toBeInTheDocument()
    expect(screen.getByText('/Users/test/project')).toBeInTheDocument()
    expect(screen.getByText('12 msgs')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/chat/claude/59d60b82-b957-48e6-adff-c1cfd70a2470',
    )
    expect(screen.getByTestId('export-buttons')).toHaveTextContent(
      'claude:59d60b82-b957-48e6-adff-c1cfd70a2470',
    )
  })

  it('renders grid variant with the same metadata', () => {
    render(<ChatItem chat={chat} variant="grid" />)

    expect(screen.getByText('Claude Code')).toBeInTheDocument()
    expect(screen.getByText('Breadcrumb nos arquivos')).toBeInTheDocument()
    expect(screen.getByText('/Users/test/project')).toBeInTheDocument()
    expect(screen.getByText('12 msgs')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/chat/claude/59d60b82-b957-48e6-adff-c1cfd70a2470',
    )
  })

  it('toggles favorite from the action button', () => {
    const onToggleFavorite = vi.fn()
    render(
      <ChatItem chat={chat} isFavorite={false} onToggleFavorite={onToggleFavorite} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar aos favoritos' }))
    expect(onToggleFavorite).toHaveBeenCalledTimes(1)
  })

  it('shows favorite state when starred', () => {
    render(<ChatItem chat={chat} isFavorite onToggleFavorite={() => {}} />)

    expect(
      screen.getByRole('button', { name: 'Remover dos favoritos' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Favorito')).toBeInTheDocument()
  })

  it('copies grok id as resume command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const grokChat: ChatSession = {
      ...chat,
      id: 'grok:session-abc-123',
      source: 'grok',
      title: 'Grok session',
    }
    render(<ChatItem chat={grokChat} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copiar ID' }))
    expect(writeText).toHaveBeenCalledWith('grok --resume session-abc-123')
  })

  it('falls back to execCommand when clipboard API fails (Tauri)', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    })
    const copiedValues: string[] = []
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: (command: string) => {
        if (command === 'copy') {
          const textarea = document.querySelector('textarea')
          if (textarea) copiedValues.push(textarea.value)
          return true
        }
        return false
      },
    })

    const grokChat: ChatSession = {
      ...chat,
      id: 'grok:019f0219-5579-7a71-b49b-13806a68763d',
      source: 'grok',
      title: 'Grok session',
    }
    render(<ChatItem chat={grokChat} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copiar ID' }))
    await vi.waitFor(() => {
      expect(copiedValues).toEqual([
        'grok --resume 019f0219-5579-7a71-b49b-13806a68763d',
      ])
    })
    expect(await screen.findByRole('button', { name: 'Copiado!' })).toBeInTheDocument()
  })
})
