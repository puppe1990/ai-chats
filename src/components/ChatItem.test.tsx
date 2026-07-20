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
})
