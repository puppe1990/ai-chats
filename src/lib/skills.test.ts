import { describe, expect, it } from 'vitest'
import {
  applySavedSkillToList,
  countSkillsBySource,
  errorMessageFromUnknown,
  filterSkills,
  skillSourceLabel,
  type SkillDetail,
  type SkillSummary,
} from './skills'

const skills: SkillSummary[] = [
  {
    id: '1',
    name: 'firecrawl',
    description: 'Scrape the web',
    source: 'agents',
    path: '/home/.agents/skills/firecrawl',
    realPath: '/home/.agents/skills/firecrawl',
    isSymlink: false,
  },
  {
    id: '2',
    name: 'check-work',
    description: 'Verify changes',
    source: 'grok',
    path: '/home/.grok/skills/check-work',
    realPath: '/home/.grok/skills/check-work',
    isSymlink: false,
  },
  {
    id: '3',
    name: 'seo-audit',
    description: 'SEO checks',
    source: 'claude',
    path: '/home/.claude/skills/seo-audit',
    realPath: '/home/.agents/skills/seo-audit',
    isSymlink: true,
  },
]

describe('filterSkills', () => {
  it('returns all skills when no filters', () => {
    expect(filterSkills(skills)).toHaveLength(3)
  })

  it('filters by source', () => {
    const result = filterSkills(skills, { source: 'grok' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('check-work')
  })

  it('filters by query against name and description', () => {
    const byName = filterSkills(skills, { query: 'fire' })
    expect(byName.map((s) => s.name)).toEqual(['firecrawl'])

    const byDesc = filterSkills(skills, { query: 'verify' })
    expect(byDesc.map((s) => s.name)).toEqual(['check-work'])
  })

  it('combines query and source filters', () => {
    const result = filterSkills(skills, { query: 'seo', source: 'claude' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('seo-audit')

    expect(filterSkills(skills, { query: 'seo', source: 'grok' })).toHaveLength(0)
  })
})

describe('skillSourceLabel', () => {
  it('maps known sources to display labels', () => {
    expect(skillSourceLabel('grok')).toBe('Grok')
    expect(skillSourceLabel('agents')).toBe('Agents')
    expect(skillSourceLabel('claude')).toBe('Claude')
  })
})

describe('countSkillsBySource', () => {
  it('counts all and per-source entries', () => {
    expect(countSkillsBySource(skills)).toEqual({
      all: 3,
      agents: 1,
      grok: 1,
      claude: 1,
    })
  })
})

describe('applySavedSkillToList', () => {
  it('updates only the matching skill name and description', () => {
    const saved: SkillDetail = {
      ...skills[0],
      name: 'firecrawl-v2',
      description: 'New desc',
      content: 'body',
    }
    const next = applySavedSkillToList(skills, saved)
    expect(next[0].name).toBe('firecrawl-v2')
    expect(next[0].description).toBe('New desc')
    expect(next[1].name).toBe('check-work')
  })
})

describe('errorMessageFromUnknown', () => {
  it('prefers Error.message then string then fallback', () => {
    expect(errorMessageFromUnknown(new Error('boom'), 'fb')).toBe('boom')
    expect(errorMessageFromUnknown('plain', 'fb')).toBe('plain')
    expect(errorMessageFromUnknown(42, 'fb')).toBe('fb')
  })
})
