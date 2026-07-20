import { describe, it, expect } from 'vitest'
import { chatToMarkdown, markdownFilename } from './export-markdown'
import type { ChatDetail } from './types'

const sample: ChatDetail = {
  session: {
    id: 'opencode:ses_test',
    source: 'opencode',
    title: 'Análise: Argentina 1-0 Áustria',
    cwd: '/Users/test/project',
    createdAt: '2026-06-24T10:00:00.000Z',
    updatedAt: '2026-06-24T14:00:00.000Z',
    model: 'claude-sonnet',
  },
  messages: [
    {
      id: 'm1',
      role: 'user',
      content: 'analise essa partida',
      timestamp: '2026-06-24T14:01:00.000Z',
    },
    {
      id: 'm2',
      role: 'assistant',
      content: '## Análise\n\nVitória da Argentina.',
      timestamp: '2026-06-24T14:02:00.000Z',
    },
  ],
}

describe('chatToMarkdown', () => {
  it('exports session metadata and messages', () => {
    const md = chatToMarkdown(sample)
    expect(md).toContain('# Análise: Argentina 1-0 Áustria')
    expect(md).toContain('**Source:** OpenCode')
    expect(md).toContain('**Directory:** `/Users/test/project`')
    expect(md).toContain('**Model:** claude-sonnet')
    expect(md).toContain('## Você')
    expect(md).toContain('analise essa partida')
    expect(md).toContain('## Assistente')
    expect(md).toContain('## Análise')
  })

  it('skips empty messages', () => {
    const md = chatToMarkdown({
      ...sample,
      messages: [{ id: 'x', role: 'user', content: '   ' }],
    })
    expect(md).not.toContain('## Você')
  })
})

describe('markdownFilename', () => {
  it('slugifies title and adds source prefix', () => {
    expect(markdownFilename(sample.session)).toBe(
      'opencode-analise-argentina-1-0-austria.md',
    )
  })
})
