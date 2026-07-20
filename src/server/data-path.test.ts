/**
 * Data-path smoke test for the Tauri desktop shell.
 *
 * The UI calls createServerFn handlers which delegate to loadChatList /
 * loadChatDetail. Those are the same shipped functions exercised here against
 * real provider fixtures (not stubs, not reimplemented).
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import type { DataPaths } from '../lib/config'
import { loadChatDetail } from './chat-detail'
import { loadChatList } from './chats'

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../lib/providers/__fixtures__',
)

const fixturePaths: DataPaths = {
  cursorHome: path.join(FIXTURES, 'cursor'),
  grokHome: path.join(FIXTURES, 'grok'),
  codexHome: path.join(FIXTURES, 'codex'),
  opencodeDataDir: path.join(FIXTURES, 'opencode'),
  claudeHome: path.join(FIXTURES, 'claude'),
}

describe('desktop data path (list + detail)', () => {
  it('loadChatList aggregates non-empty sessions from real fixtures', async () => {
    const list = await loadChatList({ page: 1, source: 'all', query: '' }, fixturePaths)

    expect(list.totalChats).toBeGreaterThan(0)
    expect(list.items.length).toBeGreaterThan(0)
    expect(list.totalItems).toBe(list.totalChats)

    const sources = new Set(list.items.map((c) => c.source))
    // Fixtures cover at least these product sources
    expect(sources.has('grok') || list.counts.grok > 0).toBe(true)
    expect(list.counts.claude).toBeGreaterThan(0)
    expect(list.counts.codex).toBeGreaterThan(0)
  })

  it('loadChatDetail returns messages for a Claude fixture session', async () => {
    const list = await loadChatList(
      { page: 1, source: 'claude', query: '' },
      fixturePaths,
    )
    expect(list.items.length).toBeGreaterThan(0)

    const session = list.items[0]
    const detail = await loadChatDetail(session.id, fixturePaths)

    expect(detail).not.toBeNull()
    expect(detail!.session.id).toBe(session.id)
    expect(detail!.session.source).toBe('claude')
    expect(detail!.messages.length).toBeGreaterThan(0)
    expect(detail!.messages.some((m) => m.role === 'user')).toBe(true)
  })

  it('loadChatDetail returns null for unknown id', async () => {
    const detail = await loadChatDetail('claude:does-not-exist', fixturePaths)
    expect(detail).toBeNull()
  })
})
