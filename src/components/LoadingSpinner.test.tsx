/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingSpinner } from './LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders branded dual-orbit spinner with accessible label', () => {
    const { container } = render(<LoadingSpinner label="Carregando chats" />)

    expect(screen.getByRole('status', { name: 'Carregando chats' })).toBeInTheDocument()
    expect(screen.getByText('Carregando chats')).toBeInTheDocument()
    expect(container.querySelector('.brand-spinner')).toBeTruthy()
    expect(container.querySelector('.brand-spinner__ring--outer')).toBeTruthy()
    expect(container.querySelector('.brand-spinner__ring--inner')).toBeTruthy()
  })
})
