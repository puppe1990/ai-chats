import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchOpenCodeChats } from './opencode'

const DB_PATH = path.join(__dirname, '__fixtures__/opencode/opencode.db')

describe('fetchOpenCodeChats', () => {
  it('reads sessions from opencode.db', () => {
    const sessions = fetchOpenCodeChats(DB_PATH)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({
      id: 'opencode:ses_test2',
      source: 'opencode',
      title: 'Add dark mode',
      cwd: '/test/other',
    })
    // sorted by time_updated desc within provider is aggregator's job
    expect(sessions.find((s) => s.id === 'opencode:ses_test1')).toMatchObject({
      title: 'Fix login bug',
      model: 'claude-sonnet',
    })
  })

  it('returns empty array for missing db', () => {
    expect(fetchOpenCodeChats('/nonexistent.db')).toEqual([])
  })
})
