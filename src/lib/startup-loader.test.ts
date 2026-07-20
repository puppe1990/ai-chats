/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import {
  dismissStartupLoader,
  STARTUP_LOADER_CRITICAL_CSS,
  STARTUP_LOADER_HTML,
} from './startup-loader'

describe('dismissStartupLoader', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-app-ready')
    document.getElementById('app-startup-loader')?.remove()
  })

  it('hides and schedules removal of the startup loader', () => {
    document.body.innerHTML =
      '<div id="app-startup-loader" class="startup-loader"></div>'

    expect(dismissStartupLoader()).toBe(true)
    expect(document.getElementById('app-startup-loader')).toHaveClass(
      'startup-loader--hide',
    )
    expect(document.documentElement.getAttribute('data-app-ready')).toBe('true')
  })
})

describe('startup loader markup', () => {
  it('ships a branded mark, progress bar, and dual-orbit styles', () => {
    expect(STARTUP_LOADER_HTML).toContain('startup-loader__mark')
    expect(STARTUP_LOADER_HTML).toContain('startup-loader__bar')
    expect(STARTUP_LOADER_HTML).toContain('AI Chats')
    expect(STARTUP_LOADER_CRITICAL_CSS).toContain('startup-loader__orbit')
    expect(STARTUP_LOADER_CRITICAL_CSS).toContain('@keyframes startup-loader-spin')
  })
})
