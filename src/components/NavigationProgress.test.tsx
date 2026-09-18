/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NavigationProgress } from './NavigationProgress'

const mockUseRouterState = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useRouterState: (opts: { select: (state: unknown) => unknown }) =>
    opts.select(mockUseRouterState()),
}))

describe('NavigationProgress', () => {
  it('shows overlay spinner and top bar while navigating', () => {
    mockUseRouterState.mockReturnValue({
      isLoading: true,
      matches: [{ routeId: '/', isFetching: 'loader', status: 'pending' }],
    })

    render(<NavigationProgress />)

    const overlay = document.querySelector('.route-transition')
    expect(overlay).toHaveClass('route-transition--on')
    expect(overlay).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    expect(document.querySelector('.navigation-progress-bar')).toBeTruthy()
    expect(document.querySelector('.route-transition__card')).toBeTruthy()
    expect(document.querySelector('.brand-spinner')).toBeTruthy()
  })

  it('hides overlay when idle so CSS can fade it out', () => {
    mockUseRouterState.mockReturnValue({
      isLoading: false,
      matches: [{ routeId: '/', isFetching: false, status: 'success' }],
    })

    render(<NavigationProgress />)

    const overlay = document.querySelector('.route-transition')
    expect(overlay).toBeTruthy()
    expect(overlay).not.toHaveClass('route-transition--on')
    expect(overlay).toHaveAttribute('aria-hidden', 'true')
    expect(overlay).toHaveAttribute('aria-busy', 'false')
  })
})
