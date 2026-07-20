import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchGrokChats } from './grok'

const FIXTURE_ROOT = path.join(__dirname, '__fixtures__/grok')

describe('fetchGrokChats', () => {
  it('parses summary.json files into ChatSession', async () => {
    const sessions = await fetchGrokChats(path.join(FIXTURE_ROOT, 'sessions'))
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      id: 'grok:019efae4-e451-7d22-b51f-ee6b3cee0f95',
      source: 'grok',
      title: 'Build chat aggregator',
      cwd: '/test/project',
      updatedAt: '2026-06-24T15:30:00.000Z',
      messageCount: 42,
      model: 'grok-composer-2.5-fast',
    })
  })

  it('returns empty array for missing directory', async () => {
    expect(await fetchGrokChats('/nonexistent')).toEqual([])
  })
})
