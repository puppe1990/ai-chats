import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aggregateChats, PROVIDER_TIMEOUT_MS, safeFetch } from './aggregator'
import type { ChatSession } from './types'
import { fetchGrokChats } from './providers/grok'

vi.mock('./providers/grok', () => ({
  fetchGrokChats: vi.fn().mockResolvedValue([
    {
      id: 'grok:1',
      source: 'grok',
      title: 'Grok chat',
      createdAt: '2026-06-24T10:00:00Z',
      updatedAt: '2026-06-24T12:00:00Z',
    },
  ] satisfies ChatSession[]),
}))
vi.mock('./providers/codex', () => ({
  fetchCodexChats: vi.fn().mockResolvedValue([
    {
      id: 'codex:1',
      source: 'codex',
      title: 'Codex chat',
      createdAt: '2026-06-24T08:00:00Z',
      updatedAt: '2026-06-24T14:00:00Z',
    },
  ] satisfies ChatSession[]),
}))
vi.mock('./providers/opencode', () => ({
  fetchOpenCodeChats: vi.fn().mockReturnValue([]),
}))
vi.mock('./providers/cursor', () => ({
  fetchCursorChats: vi.fn().mockResolvedValue([
    {
      id: 'cursor:1',
      source: 'cursor',
      title: 'Cursor chat',
      createdAt: '2026-06-24T06:00:00Z',
      updatedAt: '2026-06-24T11:00:00Z',
    },
  ] satisfies ChatSession[]),
}))
vi.mock('./providers/claude', () => ({
  fetchClaudeChats: vi.fn().mockResolvedValue([
    {
      id: 'claude:1',
      source: 'claude',
      title: 'Claude chat',
      createdAt: '2026-06-24T07:00:00Z',
      updatedAt: '2026-06-24T13:00:00Z',
    },
  ] satisfies ChatSession[]),
}))

describe('aggregateChats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('merges all providers and sorts by updatedAt desc', async () => {
    const result = await aggregateChats({
      cursorHome: '/c',
      grokHome: '/g',
      codexHome: '/x',
      opencodeDataDir: '/o',
      claudeHome: '/cl',
    })
    expect(result).toHaveLength(4)
    expect(result.map((s) => s.source)).toEqual(['codex', 'claude', 'grok', 'cursor'])
  })

  it('returns empty for a provider that never resolves (timeout)', async () => {
    vi.mocked(fetchGrokChats).mockImplementation(
      () => new Promise(() => {}), // hang forever
    )

    const result = await safeFetch('grok', () => fetchGrokChats('/x'), 40)
    expect(result).toEqual([])
  })

  it('still returns other providers when one hangs', async () => {
    vi.mocked(fetchGrokChats).mockImplementation(() => new Promise(() => {}))

    const started = Date.now()
    const result = await aggregateChats({
      cursorHome: '/c',
      grokHome: '/g',
      codexHome: '/x',
      opencodeDataDir: '/o',
      claudeHome: '/cl',
    })
    const elapsed = Date.now() - started

    expect(result.map((s) => s.source).sort()).toEqual(['claude', 'codex', 'cursor'])
    // Should not wait for the full hang — timeout bounds total wait.
    expect(elapsed).toBeLessThan(PROVIDER_TIMEOUT_MS + 1500)
  }, 10_000)
})
