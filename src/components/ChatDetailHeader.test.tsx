/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChatDetail } from '../lib/types'
import { ChatDetailHeader } from './ChatDetailHeader'

vi.mock('./ExportMarkdownButton', () => ({
  ExportMarkdownButton: ({ detail }: { detail: ChatDetail }) => (
    <button type="button" data-testid="export">
      {detail.session.title}
    </button>
  ),
}))

const detail: ChatDetail = {
  session: {
    id: 'opencode:ses_test',
    source: 'opencode',
    title: 'Test task dispatch (@general subagent)',
    cwd: '/Users/test/projects/gestao-bem-app',
    createdAt: '2026-09-18T00:00:00.000Z',
    updatedAt: '2026-09-18T00:23:02.000Z',
  },
  messages: [],
}

describe('ChatDetailHeader', () => {
  it('renders session context inside the sticky header', () => {
    const { container } = render(<ChatDetailHeader detail={detail} />)

    const header = container.querySelector('header')
    expect(header).toHaveClass('chat-detail-header')
    expect(
      screen.getByRole('heading', { name: detail.session.title }),
    ).toBeInTheDocument()
    expect(screen.getByText('/Users/test/projects/gestao-bem-app')).toBeInTheDocument()
    expect(screen.getByText('0 mensagens')).toBeInTheDocument()
    expect(screen.getByTestId('export')).toBeInTheDocument()
  })
})
