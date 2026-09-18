import { vi } from 'vitest'

export class ResizeObserverStub {
  static instances: ResizeObserverStub[] = []
  callback: ResizeObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverStub.instances.push(this)
  }
}

export function installResizeObserverStub(): typeof ResizeObserverStub {
  ResizeObserverStub.instances = []
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  return ResizeObserverStub
}
