import { describe, it, expect } from 'vitest'
import { extractTextFromParts, stripUserQueryTags } from './extract-text'

describe('extractTextFromParts', () => {
  it('joins text parts and skips tool content', () => {
    const text = extractTextFromParts([
      { type: 'input_text', text: 'Hello' },
      { type: 'tool_use', text: 'ignored' },
      { type: 'output_text', text: 'World' },
    ])
    expect(text).toBe('Hello\n\nWorld')
  })
})

describe('stripUserQueryTags', () => {
  it('removes user_query tags', () => {
    expect(stripUserQueryTags('<user_query>\nFix bug\n</user_query>')).toBe('Fix bug')
  })
})
