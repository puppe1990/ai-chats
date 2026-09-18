/** @vitest-environment jsdom */

import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HEADER_HEIGHT_VAR } from '../lib/use-header-height'
import { installResizeObserverStub } from '../test/resize-observer-stub'
import Header from './Header'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: ReactNode; className?: string }) => (
    <a className={props.className}>{props.children}</a>
  ),
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ isLoading: false, matches: [] }),
}))

describe('Header', () => {
  beforeEach(() => {
    installResizeObserverStub()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 72,
      width: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.documentElement.style.removeProperty(HEADER_HEIGHT_VAR)
  })

  it('publishes its height as --app-header-h', () => {
    render(<Header />)

    expect(document.documentElement.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe(
      '72px',
    )
  })
})
