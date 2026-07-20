import { describe, it, expect } from 'vitest'
import { filterChats } from './filter-chats'
import type { ChatSession } from './types'

const sample: ChatSession[] = [
  {
    id: 'grok:1',
    source: 'grok',
    title: 'Build chat aggregator',
    cwd: '/Users/test/project',
    createdAt: '2026-06-24T10:00:00Z',
    updatedAt: '2026-06-24T12:00:00Z',
    model: 'grok-composer-2.5-fast',
  },
  {
    id: 'codex:2',
    source: 'codex',
    title: 'Limpar HD com script',
    cwd: '/Users/test/other',
    createdAt: '2026-06-20T10:00:00Z',
    updatedAt: '2026-06-20T14:00:00Z',
  },
  {
    id: 'claude:3',
    source: 'claude',
    title: 'Breadcrumb nos arquivos',
    cwd: '/Users/test/claude-project',
    createdAt: '2026-06-22T10:00:00Z',
    updatedAt: '2026-06-22T14:00:00Z',
  },
]

describe('filterChats', () => {
  it('filters by source', () => {
    expect(filterChats(sample, { source: 'grok' })).toHaveLength(1)
    expect(filterChats(sample, { source: 'grok' })[0].id).toBe('grok:1')
  })

  it('filters by query matching title', () => {
    expect(filterChats(sample, { query: 'limpar hd' })).toHaveLength(1)
    expect(filterChats(sample, { query: 'limpar hd' })[0].source).toBe('codex')
  })

  it('filters by query matching cwd or model', () => {
    expect(filterChats(sample, { query: '/project' })).toHaveLength(1)
    expect(filterChats(sample, { query: 'composer' })).toHaveLength(1)
  })

  it('combines source and query filters', () => {
    expect(filterChats(sample, { source: 'grok', query: 'limpar' })).toHaveLength(0)
    expect(filterChats(sample, { source: 'grok', query: 'aggregator' })).toHaveLength(1)
  })

  it('filters by claude source label', () => {
    expect(filterChats(sample, { source: 'claude' })).toHaveLength(1)
    expect(filterChats(sample, { query: 'claude code' })).toHaveLength(1)
  })
})
