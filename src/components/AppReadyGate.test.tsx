/** @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppReadyGate } from './AppReadyGate'

let bootstrapping = true

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: unknown) => boolean }) =>
    select({
      matches: bootstrapping
        ? [{ routeId: '/', status: 'pending', isFetching: 'loader' as const }]
        : [{ routeId: '/', status: 'success', isFetching: false as const }],
    }),
}))

describe('AppReadyGate', () => {
  afterEach(() => {
    cleanup()
    bootstrapping = true
    document.documentElement.removeAttribute('data-app-ready')
    document.getElementById('app-startup-loader')?.remove()
  })

  it('hides the startup loader after bootstrap completes', async () => {
    document.body.innerHTML =
      '<div id="app-startup-loader" class="startup-loader"></div>'

    const { rerender } = render(<AppReadyGate />)

    expect(document.getElementById('app-startup-loader')).toBeTruthy()
    expect(document.getElementById('app-startup-loader')).not.toHaveClass(
      'startup-loader--hide',
    )

    bootstrapping = false
    rerender(<AppReadyGate />)

    await vi.waitFor(() => {
      expect(document.getElementById('app-startup-loader')).toHaveClass(
        'startup-loader--hide',
      )
    })
  })
})
