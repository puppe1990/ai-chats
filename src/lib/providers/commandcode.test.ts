import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchCommandCodeChats } from './commandcode'

const FIXTURE_ROOT = path.join(__dirname, '__fixtures__/commandcode')
const V3_PATH = path.join(
  FIXTURE_ROOT,
  'projects/-test-project/7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e.jsonl',
)

describe('fetchCommandCodeChats', () => {
  it('parses v3 session jsonl and sidecar meta into ChatSession', async () => {
    const sessions = await fetchCommandCodeChats(FIXTURE_ROOT)
    const session = sessions.find(
      (s) => s.id === 'commandcode:7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e',
    )
    expect(session).toMatchObject({
      source: 'commandcode',
      title: 'Command Code History',
      cwd: '/test/commandcode-project',
      createdAt: '2026-09-03T16:10:47.946Z',
      messageCount: 2,
      model: 'deepseek/deepseek-v4-flash',
      storagePath: V3_PATH,
    })
    expect(session?.updatedAt).toBeTruthy()
  })

  it('parses legacy v2 transcripts without a session header', async () => {
    const sessions = await fetchCommandCodeChats(FIXTURE_ROOT)
    const session = sessions.find(
      (s) => s.id === 'commandcode:8c9d0e1f-2a3b-4c5d-6e7f-8a9b0c1d2e3f',
    )
    expect(session).toMatchObject({
      source: 'commandcode',
      title: 'Legacy Command Code session',
      createdAt: '2026-07-15T11:58:26.522Z',
      messageCount: 2,
    })
    expect(session?.cwd).toBeUndefined()
  })

  it('ignores checkpoint sidecars', async () => {
    const sessions = await fetchCommandCodeChats(FIXTURE_ROOT)
    expect(sessions).toHaveLength(2)
  })

  it('returns empty array for missing directory', async () => {
    expect(await fetchCommandCodeChats('/nonexistent')).toEqual([])
  })
})
