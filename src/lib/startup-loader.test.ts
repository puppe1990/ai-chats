/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { dismissStartupLoader } from './startup-loader'

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
