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
  it('shows top bar and pill while navigating', () => {
    mockUseRouterState.mockReturnValue({
      isLoading: true,
      matches: [{ routeId: '/', isFetching: 'loader', status: 'pending' }],
    })

    render(<NavigationProgress />)

    const statuses = screen.getAllByRole('status')
    expect(statuses.some((el) => el.getAttribute('aria-busy') === 'true')).toBe(true)
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    expect(document.querySelector('.navigation-progress-bar')).toBeTruthy()
    expect(document.querySelector('.nav-loading-pill')).toBeTruthy()
  })

  it('renders nothing when idle', () => {
    mockUseRouterState.mockReturnValue({
      isLoading: false,
      matches: [{ routeId: '/', isFetching: false, status: 'success' }],
    })

    const { container } = render(<NavigationProgress />)
    expect(container).toBeEmptyDOMElement()
  })
})
