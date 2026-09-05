/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SkillDeleteConfirmModal } from './SkillDeleteConfirmModal'

describe('SkillDeleteConfirmModal', () => {
  it('renders confirmation copy with skill name', () => {
    render(
      <SkillDeleteConfirmModal
        skillName="firecrawl"
        open
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/tem certeza/i)).toBeInTheDocument()
    expect(screen.getByText(/firecrawl/i)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <SkillDeleteConfirmModal
        skillName="firecrawl"
        open={false}
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onCancel and onConfirm from actions', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <SkillDeleteConfirmModal
        skillName="firecrawl"
        open
        deleting={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /excluir/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables actions while deleting', () => {
    render(
      <SkillDeleteConfirmModal
        skillName="firecrawl"
        open
        deleting
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /excluindo/i })).toBeDisabled()
  })
})
