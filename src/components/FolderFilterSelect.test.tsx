/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ALL_FOLDERS } from '../lib/types'
import { FolderFilterSelect } from './FolderFilterSelect'

const options = [
  { value: ALL_FOLDERS, label: 'Todas as pastas (3)' },
  { value: '/Users/test/alpha', label: 'alpha (1)' },
  { value: '/srv/beta', label: 'beta (1)' },
]

function renderSelect(
  overrides: Partial<React.ComponentProps<typeof FolderFilterSelect>> = {},
) {
  const onChange = vi.fn()
  render(
    <FolderFilterSelect
      inputId="folder-filter"
      value={ALL_FOLDERS}
      options={options}
      placeholder="Selecionar pasta"
      noOptionsMessage="Nenhuma pasta encontrada"
      onChange={onChange}
      {...overrides}
    />,
  )
  return { onChange }
}

describe('FolderFilterSelect', () => {
  it('shows the selected folder', () => {
    renderSelect({ value: '/Users/test/alpha' })

    expect(screen.getByText('alpha (1)')).toBeInTheDocument()
  })

  it('reports the picked folder', () => {
    const { onChange } = renderSelect()

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'beta (1)' }))

    expect(onChange).toHaveBeenCalledWith('/srv/beta')
  })

  it('searches by the full folder path, not only the short label', () => {
    renderSelect()

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Users' } })

    expect(screen.getByRole('option', { name: 'alpha (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'beta (1)' })).not.toBeInTheDocument()
  })

  it('tells the user when no folder matches the search', () => {
    renderSelect()

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })

    expect(screen.getByText('Nenhuma pasta encontrada')).toBeInTheDocument()
  })

  it('shows the placeholder when the selected folder is gone', () => {
    renderSelect({ value: '/Users/test/deleted' })

    expect(screen.getByText('Selecionar pasta')).toBeInTheDocument()
  })
})
