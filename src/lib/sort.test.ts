import { describe, it, expect } from 'vitest'
import { sortByUpdatedAt } from './sort'
import type { ChatSession } from './types'

const make = (id: string, updatedAt: string): ChatSession => ({
  id,
  source: 'grok',
  title: id,
  createdAt: updatedAt,
  updatedAt,
})

describe('sortByUpdatedAt', () => {
  it('sorts sessions by updatedAt descending', () => {
    const sessions = [
      make('old', '2026-06-20T10:00:00.000Z'),
      make('new', '2026-06-24T15:00:00.000Z'),
      make('mid', '2026-06-22T12:00:00.000Z'),
    ]
    const sorted = sortByUpdatedAt(sessions)
    expect(sorted.map((s) => s.id)).toEqual(['new', 'mid', 'old'])
  })

  it('returns empty array for empty input', () => {
    expect(sortByUpdatedAt([])).toEqual([])
  })
})
