import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchCodexMessages } from './codex'

const ROLLOUT = path.join(
  __dirname,
  '../providers/__fixtures__/codex/archived_sessions/rollout-2026-04-01T13-29-09-019d49e0-9893-76c0-b51e-094cae8d855c.jsonl',
)

describe('fetchCodexMessages', () => {
  it('extracts user and assistant messages from rollout', async () => {
    const messages = await fetchCodexMessages(ROLLOUT)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: 'Sessão só no disco do Codex',
    })
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Entendido, vou ajudar.',
    })
  })
})
