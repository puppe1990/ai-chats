/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RefreshButton } from './RefreshButton'

const invalidate = vi.fn().mockResolvedValue(undefined)

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate }),
  useRouterState: ({
    select,
  }: {
    select: (state: {
      isLoading: boolean
      matches: Array<{ isFetching: false | 'beforeLoad' | 'loader' }>
    }) => boolean
  }) => select({ isLoading: false, matches: [] }),
}))

describe('RefreshButton', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('calls router.invalidate when clicked', async () => {
    render(<RefreshButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados' }))

    expect(invalidate).toHaveBeenCalledWith({
      filter: expect.any(Function),
    })
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})
