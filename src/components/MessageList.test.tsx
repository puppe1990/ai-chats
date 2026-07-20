/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../lib/types'
import { MessageList } from './MessageList'

vi.mock('./FormattedDate', () => ({
  FormattedDate: () => <span>10:00</span>,
}))

const messages: ChatMessage[] = [
  { id: 'm1', role: 'user', content: 'Primeira mensagem' },
  { id: 'm2', role: 'assistant', content: 'Última mensagem' },
]

function setPageScroll({
  scrollTop,
  scrollHeight,
  clientHeight,
}: {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}) {
  Object.defineProperty(document.documentElement, 'scrollTop', {
    configurable: true,
    value: scrollTop,
  })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  })
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  })
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: scrollTop,
  })
}

describe('MessageList scroll behavior', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    setPageScroll({ scrollTop: 0, scrollHeight: 1000, clientHeight: 100 })
  })

  it('scrolls to the bottom when messages load', async () => {
    render(<MessageList messages={messages} />)

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ top: expect.any(Number), behavior: 'instant' }),
      )
    })
  })

  it('shows a jump-to-bottom button when the user scrolls up', async () => {
    render(<MessageList messages={messages} />)

    setPageScroll({ scrollTop: 0, scrollHeight: 1000, clientHeight: 100 })
    fireEvent.scroll(window)

    expect(
      await screen.findByRole('button', { name: 'Ir para o final' }),
    ).toBeInTheDocument()
  })

  it('hides the jump-to-bottom button when already at the bottom', async () => {
    render(<MessageList messages={messages} />)

    setPageScroll({ scrollTop: 920, scrollHeight: 1000, clientHeight: 100 })
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Ir para o final' }),
      ).not.toBeInTheDocument()
    })
  })

  it('scrolls to the bottom when the jump button is clicked', async () => {
    render(<MessageList messages={messages} />)

    setPageScroll({ scrollTop: 0, scrollHeight: 1000, clientHeight: 100 })
    fireEvent.scroll(window)

    const button = await screen.findByRole('button', { name: 'Ir para o final' })
    fireEvent.click(button)

    expect(window.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: expect.any(Number), behavior: 'smooth' }),
    )
  })
})
