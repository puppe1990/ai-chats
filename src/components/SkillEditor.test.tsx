/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SkillDetail } from '../lib/skills'
import { SkillEditor } from './SkillEditor'

const skill: SkillDetail = {
  id: 'id-1',
  name: 'firecrawl',
  description: 'Scrape the web',
  source: 'agents',
  path: '/home/.agents/skills/firecrawl',
  realPath: '/home/.agents/skills/firecrawl',
  isSymlink: false,
  content: '---\nname: firecrawl\n---\n\nOriginal body\n',
}

describe('SkillEditor', () => {
  it('renders skill metadata and content', () => {
    render(<SkillEditor skill={skill} onSave={vi.fn()} />)

    expect(screen.getByText('firecrawl')).toBeInTheDocument()
    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Original body/)).toBeInTheDocument()
  })

  it('disables save until content changes', () => {
    render(<SkillEditor skill={skill} onSave={vi.fn()} />)

    const save = screen.getByRole('button', { name: /salvar/i })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '---\nname: firecrawl\n---\n\nEdited\n' },
    })

    expect(save).not.toBeDisabled()
    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument()
  })

  it('calls onSave with new content and clears dirty on success', async () => {
    const onSave = vi.fn().mockResolvedValue({
      ...skill,
      content: '---\nname: firecrawl\n---\n\nEdited\n',
      description: 'Scrape the web',
    })

    render(<SkillEditor skill={skill} onSave={onSave} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '---\nname: firecrawl\n---\n\nEdited\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'id-1',
        '---\nname: firecrawl\n---\n\nEdited\n',
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled()
    })
  })

  it('shows error message when save fails', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new Error('Cannot write SKILL.md at /tmp: permission denied'))

    render(<SkillEditor skill={skill} onSave={onSave} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'changed' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/cannot write skill\.md/i)).toBeInTheDocument()
  })

  it('shows empty prompt when no skill selected', () => {
    render(<SkillEditor skill={null} onSave={vi.fn()} />)

    expect(screen.getByText(/selecione uma skill/i)).toBeInTheDocument()
  })
})
