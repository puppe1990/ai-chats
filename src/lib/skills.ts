export type SkillSource = 'grok' | 'agents' | 'claude' | 'codex' | 'cursor' | 'other'

export type SkillSummary = {
  id: string
  name: string
  description: string
  source: SkillSource
  path: string
  realPath: string
  isSymlink: boolean
}

export type SkillDetail = SkillSummary & {
  content: string
}

export const SKILL_SOURCES: SkillSource[] = [
  'grok',
  'agents',
  'claude',
  'codex',
  'cursor',
]

export type SkillListFilter = {
  query?: string
  source?: SkillSource | 'all'
}

/** Filter skills by free-text query and optional source chip. */
export function filterSkills(
  skills: SkillSummary[],
  options: SkillListFilter = {},
): SkillSummary[] {
  const query = (options.query ?? '').trim().toLowerCase()
  const source = options.source ?? 'all'

  return skills.filter((skill) => {
    if (source !== 'all' && skill.source !== source) {
      return false
    }
    if (!query) return true
    return skillMatchesQuery(skill, query)
  })
}

function skillMatchesQuery(skill: SkillSummary, query: string): boolean {
  return (
    skill.name.toLowerCase().includes(query) ||
    skill.description.toLowerCase().includes(query) ||
    skill.path.toLowerCase().includes(query) ||
    skill.source.toLowerCase().includes(query)
  )
}

/** Counts per source for filter chips (includes `all`). */
export function countSkillsBySource(
  skills: SkillSummary[],
): Partial<Record<SkillSource | 'all', number>> {
  const counts: Partial<Record<SkillSource | 'all', number>> = {
    all: skills.length,
  }
  for (const skill of skills) {
    counts[skill.source] = (counts[skill.source] ?? 0) + 1
  }
  return counts
}

/** Merge name/description from a saved detail into the list row. */
export function applySavedSkillToList(
  skills: SkillSummary[],
  saved: SkillDetail,
): SkillSummary[] {
  return skills.map((skill) =>
    skill.id === saved.id
      ? {
          ...skill,
          name: saved.name,
          description: saved.description,
        }
      : skill,
  )
}

export function skillSourceLabel(source: SkillSource): string {
  switch (source) {
    case 'grok':
      return 'Grok'
    case 'agents':
      return 'Agents'
    case 'claude':
      return 'Claude'
    case 'codex':
      return 'Codex'
    case 'cursor':
      return 'Cursor'
    default:
      return 'Other'
  }
}

/** Normalize unknown thrown values into a string for UI alerts. */
export function errorMessageFromUnknown(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}
