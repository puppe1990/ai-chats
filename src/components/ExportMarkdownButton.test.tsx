/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getChatDetail } from '../lib/desktop-api'
import type { ChatDetail } from '../lib/types'
import { ExportMarkdownButton } from './ExportMarkdownButton'

vi.mock('../lib/desktop-api', () => ({
  getChatDetail: vi.fn(),
}))

const sampleDetail: ChatDetail = {
  session: {
    id: 'grok:test-session',
    source: 'grok',
    title: 'Test chat',
    cwd: '/test/project',
    createdAt: '2026-06-24T10:00:00.000Z',
    updatedAt: '2026-06-24T12:00:00.000Z',
  },
  messages: [
    {
      id: 'm1',
      role: 'user',
      content: 'hello',
    },
  ],
}

describe('ExportMarkdownButton', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  beforeEach(() => {
    vi.mocked(getChatDetail).mockResolvedValue(sampleDetail)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('copies markdown immediately when detail is provided', async () => {
    render(<ExportMarkdownButton detail={sampleDetail} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copiar MD' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copiado!' })).toBeInTheDocument()
    })
    expect(getChatDetail).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('# Test chat'),
    )
  })

  it('fetches detail by chatId before exporting', async () => {
    render(<ExportMarkdownButton chatId="grok:test-session" />)

    fireEvent.click(screen.getByRole('button', { name: 'Exportar .md' }))

    await waitFor(() => {
      expect(getChatDetail).toHaveBeenCalledWith({ data: 'grok:test-session' })
    })
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exportar .md' })).toBeEnabled()
    })
  })

  it('fetches detail by chatId before copying', async () => {
    render(<ExportMarkdownButton chatId="grok:test-session" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copiar MD' }))

    await waitFor(() => {
      expect(getChatDetail).toHaveBeenCalledWith({ data: 'grok:test-session' })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copiado!' })).toBeInTheDocument()
    })
  })

  it('shows error state when chat detail is missing', async () => {
    vi.mocked(getChatDetail).mockResolvedValue(null)

    render(<ExportMarkdownButton chatId="grok:missing" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar MD' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Erro ao copiar' })).toBeInTheDocument()
    })
  })
})
