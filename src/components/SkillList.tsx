import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  countSkillsBySource,
  filterSkills,
  skillSourceLabel,
  SKILL_SOURCES,
  type SkillSource,
  type SkillSummary,
} from '../lib/skills'

type SkillListProps = {
  skills: SkillSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function SkillList({ skills, selectedId, onSelect }: SkillListProps) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<SkillSource | 'all'>('all')

  const filtered = useMemo(
    () => filterSkills(skills, { query, source }),
    [skills, query, source],
  )
  const sourceCounts = useMemo(() => countSkillsBySource(skills), [skills])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SkillListFilters
        query={query}
        source={source}
        sourceCounts={sourceCounts}
        onQueryChange={setQuery}
        onSourceChange={setSource}
      />
      <SkillListItems
        skills={skills}
        filtered={filtered}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}

function SkillListFilters({
  query,
  source,
  sourceCounts,
  onQueryChange,
  onSourceChange,
}: {
  query: string
  source: SkillSource | 'all'
  sourceCounts: Partial<Record<SkillSource | 'all', number>>
  onQueryChange: (value: string) => void
  onSourceChange: (value: SkillSource | 'all') => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        role="searchbox"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t('skills.searchPlaceholder')}
        aria-label={t('skills.searchAria')}
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none ring-[var(--lagoon)] placeholder:text-[var(--sea-ink-soft)] focus:ring-2"
      />
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={t('skills.sourceFilterAria')}
      >
        <SkillSourceChip
          active={source === 'all'}
          label={t('skills.all', { count: sourceCounts.all ?? 0 })}
          onClick={() => onSourceChange('all')}
        />
        {SKILL_SOURCES.map((src) => {
          const count = sourceCounts[src] ?? 0
          if (count === 0) return null
          return (
            <SkillSourceChip
              key={src}
              active={source === src}
              label={`${skillSourceLabel(src)} (${count})`}
              onClick={() => onSourceChange(src)}
            />
          )
        })}
      </div>
    </div>
  )
}

function SkillListItems({
  skills,
  filtered,
  selectedId,
  onSelect,
}: {
  skills: SkillSummary[]
  filtered: SkillSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()

  if (filtered.length === 0) {
    return (
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        <li className="px-2 py-6 text-center text-sm text-[var(--sea-ink-soft)]">
          {skills.length === 0 ? t('skills.empty') : t('skills.emptyFiltered')}
        </li>
      </ul>
    )
  }

  return (
    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
      {filtered.map((skill) => (
        <li key={skill.id}>
          <SkillListRow
            skill={skill}
            selected={skill.id === selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  )
}

function SkillListRow({
  skill,
  selected,
  onSelect,
}: {
  skill: SkillSummary
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(skill.id)}
      className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition ${
        selected
          ? 'border-[var(--lagoon)] bg-[var(--surface-strong)] shadow-[0_8px_20px_rgba(30,90,72,0.08)]'
          : 'border-transparent bg-transparent hover:border-[var(--line)] hover:bg-[var(--surface)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-[var(--sea-ink)]">
          {skill.name}
        </span>
        <span className="shrink-0 rounded-md border border-[var(--chip-line)] bg-[var(--chip-bg)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">
          {skillSourceLabel(skill.source)}
        </span>
      </div>
      {skill.description ? (
        <p className="m-0 line-clamp-2 text-xs text-[var(--sea-ink-soft)]">
          {skill.description}
        </p>
      ) : null}
    </button>
  )
}

function SkillSourceChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
        active
          ? 'border-[var(--lagoon)] bg-[var(--lagoon)]/15 text-[var(--sea-ink)]'
          : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
      }`}
    >
      {label}
    </button>
  )
}
