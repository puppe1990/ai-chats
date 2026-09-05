import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchCommandCodeMessages } from './commandcode'

const V3_PATH = path.join(
  __dirname,
  '../providers/__fixtures__/commandcode/projects/-test-project/7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e.jsonl',
)
const V2_PATH = path.join(
  __dirname,
  '../providers/__fixtures__/commandcode/projects/-test-project/8c9d0e1f-2a3b-4c5d-6e7f-8a9b0c1d2e3f.jsonl',
)

describe('fetchCommandCodeMessages', () => {
  it('parses v3 user, assistant, and tool messages and skips thinking', async () => {
    const messages = await fetchCommandCodeMessages(V3_PATH)
    expect(messages).toHaveLength(3)
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: 'Add Command Code chat history',
      timestamp: '2026-09-03T16:11:02.685Z',
    })
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: "I'll parse the session JSONL files.",
    })
    expect(messages[2].role).toBe('tool')
    expect(messages[2].content).toContain('read_file')
    expect(messages.some((m) => m.content.includes('hidden'))).toBe(false)
  })

  it('parses legacy v2 roles and tool-call parts', async () => {
    const messages = await fetchCommandCodeMessages(V2_PATH)
    expect(messages).toHaveLength(3)
    expect(messages[0].content).toBe('Legacy Command Code session')
    expect(messages[1].content).toBe('Working on the legacy transcript.')
    expect(messages[2].role).toBe('tool')
    expect(messages[2].content).toContain('shell_command')
  })

  it('returns empty array for missing file', async () => {
    expect(await fetchCommandCodeMessages('/nonexistent.jsonl')).toEqual([])
  })
})
