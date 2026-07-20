import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchClaudeMessages } from './claude'

const SESSION_PATH = path.join(
  __dirname,
  '../providers/__fixtures__/claude/projects/-test-project/7a176d05-ee9d-42f2-81ee-72b9ac9c800c.jsonl',
)

describe('fetchClaudeMessages', () => {
  it('parses user, assistant, and tool messages from session jsonl', async () => {
    const messages = await fetchClaudeMessages(SESSION_PATH)
    expect(messages).toHaveLength(3)
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: 'Build chat aggregator with TanStack Start',
      timestamp: '2026-06-24T10:00:00.000Z',
    })
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: "I'll help you build the aggregator.",
      timestamp: '2026-06-24T10:00:05.000Z',
    })
    expect(messages[2]).toMatchObject({
      role: 'tool',
    })
    expect(messages[2].content).toContain('Read')
  })

  it('returns empty array for missing file', async () => {
    expect(await fetchClaudeMessages('/nonexistent.jsonl')).toEqual([])
  })
})
