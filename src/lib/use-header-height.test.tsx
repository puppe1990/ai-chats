/** @vitest-environment jsdom */

import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installResizeObserverStub,
  ResizeObserverStub,
} from '../test/resize-observer-stub'
import { HEADER_HEIGHT_VAR, useHeaderHeightVar } from './use-header-height'

function Probe() {
  const ref = useRef<HTMLElement | null>(null)
  useHeaderHeightVar(ref)
  return <header ref={ref} data-testid="probe" />
}

function mockHeaderHeight(height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    height,
    width: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

function readVar(): string {
  return document.documentElement.style.getPropertyValue(HEADER_HEIGHT_VAR)
}

describe('useHeaderHeightVar', () => {
  beforeEach(() => {
    installResizeObserverStub()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.documentElement.style.removeProperty(HEADER_HEIGHT_VAR)
  })

  it('publishes the measured height on mount', () => {
    mockHeaderHeight(64)

    render(<Probe />)

    expect(readVar()).toBe('64px')
  })

  it('updates the variable when the element resizes', () => {
    mockHeaderHeight(64)
    render(<Probe />)

    mockHeaderHeight(80)
    const observer = ResizeObserverStub.instances[0]
    act(() => observer.callback([], observer as unknown as ResizeObserver))

    expect(readVar()).toBe('80px')
  })

  it('disconnects the observer on unmount', () => {
    mockHeaderHeight(64)
    const { unmount } = render(<Probe />)
    const observer = ResizeObserverStub.instances[0]

    unmount()

    expect(observer.disconnect).toHaveBeenCalledTimes(1)
  })
})
