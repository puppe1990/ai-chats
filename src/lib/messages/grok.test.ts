import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchGrokMessages } from './grok'

const SESSION_DIR = path.join(__dirname, '__fixtures__/grok')

describe('fetchGrokMessages', () => {
  it('parses chat_history.jsonl', async () => {
    const messages = await fetchGrokMessages(SESSION_DIR)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ role: 'user', content: 'Olá Grok' })
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Olá! Como posso ajudar?',
    })
  })
})
