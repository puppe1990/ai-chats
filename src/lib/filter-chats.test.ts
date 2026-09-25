import { describe, it, expect } from 'vitest'
import { chatFolderBucket, filterChats } from './filter-chats'
import type { ChatSession } from './types'
import { ALL_FOLDERS, NO_FOLDER_FILTER } from './types'

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

  it('filters by commandcode source label', () => {
    const withCommandCode: ChatSession[] = [
      ...sample,
      {
        id: 'commandcode:4',
        source: 'commandcode',
        title: 'Parse session jsonl',
        cwd: '/Users/test/commandcode-project',
        createdAt: '2026-09-03T16:10:47Z',
        updatedAt: '2026-09-03T16:11:06Z',
      },
    ]
    expect(filterChats(withCommandCode, { source: 'commandcode' })).toHaveLength(1)
    expect(filterChats(withCommandCode, { query: 'command code' })).toHaveLength(1)
  })

  it('filters to favorite ids when favoritesOnly is set', () => {
    const onlyFav = filterChats(sample, {
      favoritesOnly: true,
      favoriteIds: ['codex:2', 'missing'],
    })
    expect(onlyFav).toHaveLength(1)
    expect(onlyFav[0].id).toBe('codex:2')
  })

  it('filters by exact folder path', () => {
    const inOther = filterChats(sample, { folder: '/Users/test/other' })

    expect(inOther).toHaveLength(1)
    expect(inOther[0].id).toBe('codex:2')
    expect(filterChats(sample, { folder: '/Users/test' })).toHaveLength(0)
  })

  it('keeps every folder when folder is all or unset', () => {
    expect(filterChats(sample, { folder: ALL_FOLDERS })).toHaveLength(3)
    expect(filterChats(sample, {})).toHaveLength(3)
  })

  it('buckets chats without a cwd under the no-folder filter', () => {
    const withoutCwd: ChatSession[] = [
      ...sample,
      {
        id: 'cursor:9',
        source: 'cursor',
        title: 'Sem diretório',
        createdAt: '2026-06-25T10:00:00Z',
        updatedAt: '2026-06-25T10:00:00Z',
      },
    ]

    expect(chatFolderBucket(withoutCwd[3])).toBe(NO_FOLDER_FILTER)
    const noFolder = filterChats(withoutCwd, { folder: NO_FOLDER_FILTER })

    expect(noFolder).toHaveLength(1)
    expect(noFolder[0].id).toBe('cursor:9')
    expect(filterChats(withoutCwd, { folder: '/Users/test/other' })).toHaveLength(1)
  })

  it('combines folder and query filters', () => {
    expect(
      filterChats(sample, { folder: '/Users/test/project', query: 'limpar' }),
    ).toHaveLength(0)
    expect(
      filterChats(sample, { folder: '/Users/test/project', query: 'aggregator' }),
    ).toHaveLength(1)
  })
})
