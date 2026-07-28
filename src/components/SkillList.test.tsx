/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SkillSummary } from '../lib/skills'
import { SkillList } from './SkillList'

const skills: SkillSummary[] = [
  {
    id: 'id-fire',
    name: 'firecrawl',
    description: 'Scrape the web',
    source: 'agents',
    path: '/home/.agents/skills/firecrawl',
    realPath: '/home/.agents/skills/firecrawl',
    isSymlink: false,
  },
  {
    id: 'id-check',
    name: 'check-work',
    description: 'Verify changes',
    source: 'grok',
    path: '/home/.grok/skills/check-work',
    realPath: '/home/.grok/skills/check-work',
    isSymlink: false,
  },
]

describe('SkillList', () => {
  it('renders skill names and source labels', () => {
    render(<SkillList skills={skills} selectedId={null} onSelect={vi.fn()} />)

    expect(screen.getByText('firecrawl')).toBeInTheDocument()
    expect(screen.getByText('check-work')).toBeInTheDocument()
    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Grok')).toBeInTheDocument()
  })

  it('filters by search query', () => {
    render(<SkillList skills={skills} selectedId={null} onSelect={vi.fn()} />)

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'check' },
    })

    expect(screen.getByText('check-work')).toBeInTheDocument()
    expect(screen.queryByText('firecrawl')).not.toBeInTheDocument()
  })

  it('filters by source chip', () => {
    render(<SkillList skills={skills} selectedId={null} onSelect={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Agents (1)' }))

    expect(screen.getByText('firecrawl')).toBeInTheDocument()
    expect(screen.queryByText('check-work')).not.toBeInTheDocument()
  })

  it('calls onSelect when a skill is clicked', () => {
    const onSelect = vi.fn()
    render(<SkillList skills={skills} selectedId={null} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /firecrawl/i }))
    expect(onSelect).toHaveBeenCalledWith('id-fire')
  })

  it('shows empty state when no skills match', () => {
    render(<SkillList skills={skills} selectedId={null} onSelect={vi.fn()} />)

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'zzzz-no-match' },
    })

    expect(
      screen.getByText(/nenhuma skill corresponde aos filtros/i),
    ).toBeInTheDocument()
  })
})
