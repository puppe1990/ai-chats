import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchCursorChats } from './cursor'

const FIXTURE_ROOT = path.join(__dirname, '__fixtures__/cursor')

describe('fetchCursorChats', () => {
  it('parses store.db meta into ChatSession', async () => {
    const sessions = await fetchCursorChats(path.join(FIXTURE_ROOT, 'chats'))
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      id: 'cursor:chat1',
      source: 'cursor',
      title: 'Sentiment Analyzer',
      createdAt: '2024-06-21T20:00:00.000Z',
    })
    expect(sessions[0].updatedAt).toBeTruthy()
  })

  it('returns empty array for missing directory', async () => {
    expect(await fetchCursorChats('/nonexistent')).toEqual([])
  })
})
