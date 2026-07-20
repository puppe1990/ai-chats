import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { extractClaudeTitleFromSession, fetchClaudeChats } from './claude'

const FIXTURE_ROOT = path.join(__dirname, '__fixtures__/claude')
const SESSION_PATH = path.join(
  FIXTURE_ROOT,
  'projects/-test-project/7a176d05-ee9d-42f2-81ee-72b9ac9c800c.jsonl',
)

describe('extractClaudeTitleFromSession', () => {
  it('uses the first user message as title', async () => {
    const title = await extractClaudeTitleFromSession(SESSION_PATH)
    expect(title).toBe('Build chat aggregator with TanStack Start')
  })
})

describe('fetchClaudeChats', () => {
  it('parses project session jsonl files into ChatSession', async () => {
    const sessions = await fetchClaudeChats(FIXTURE_ROOT)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      id: 'claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c',
      source: 'claude',
      title: 'Build chat aggregator with TanStack Start',
      cwd: '/test/project',
      createdAt: '2026-06-24T10:00:00.000Z',
      messageCount: 3,
      model: 'claude-sonnet-4-6',
      storagePath: SESSION_PATH,
    })
    expect(sessions[0].updatedAt).toBeTruthy()
  })

  it('returns empty array for missing directory', async () => {
    expect(await fetchClaudeChats('/nonexistent')).toEqual([])
  })
})
