import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { extractCodexTitleFromRollout, fetchCodexChats } from './codex'

const FIXTURE_DIR = path.join(__dirname, '__fixtures__/codex')

describe('fetchCodexChats', () => {
  it('parses session_index.jsonl', async () => {
    const sessions = await fetchCodexChats(FIXTURE_DIR)
    const indexed = sessions.find(
      (s) => s.id === 'codex:019e45c9-4c4c-7783-a976-c0eec1cc306b',
    )
    expect(indexed).toMatchObject({
      source: 'codex',
      title: 'Limpar HD com script',
      updatedAt: '2026-05-20T14:28:22.699524Z',
    })
  })

  it('includes rollout files not in session_index', async () => {
    const sessions = await fetchCodexChats(FIXTURE_DIR)
    const diskOnly = sessions.find(
      (s) => s.id === 'codex:019d49e0-9893-76c0-b51e-094cae8d855c',
    )
    expect(diskOnly).toMatchObject({
      source: 'codex',
      title: 'Sessão só no disco do Codex',
      cwd: '/test/only-on-disk',
      updatedAt: '2026-04-01T13:29:09.000Z',
    })
    expect(diskOnly?.storagePath).toContain('rollout-2026-04-01')
  })

  it('returns empty array for missing directory', async () => {
    expect(await fetchCodexChats('/nonexistent')).toEqual([])
  })
})

describe('extractCodexTitleFromRollout', () => {
  it('extracts first user message as title', async () => {
    const rollout = path.join(
      FIXTURE_DIR,
      'archived_sessions/rollout-2026-04-01T13-29-09-019d49e0-9893-76c0-b51e-094cae8d855c.jsonl',
    )
    expect(await extractCodexTitleFromRollout(rollout)).toBe(
      'Sessão só no disco do Codex',
    )
  })
})
