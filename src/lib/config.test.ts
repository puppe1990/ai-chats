import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDataPaths } from './config'

describe('getDataPaths', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, HOME: '/Users/test' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns default paths based on HOME', () => {
    const paths = getDataPaths()
    expect(paths.cursorHome).toBe('/Users/test/.cursor')
    expect(paths.grokHome).toBe('/Users/test/.grok')
    expect(paths.codexHome).toBe('/Users/test/.codex')
    expect(paths.opencodeDataDir).toBe('/Users/test/.local/share/opencode')
    expect(paths.claudeHome).toBe('/Users/test/.claude')
  })

  it('respects env overrides', () => {
    process.env.GROK_HOME = '/custom/grok'
    const paths = getDataPaths()
    expect(paths.grokHome).toBe('/custom/grok')
  })
})
