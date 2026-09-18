import { describe, it, expect } from 'vitest'
import { formatCopyId, fromChatRouteParams, toChatRouteParams } from './chat-id'

describe('chat-id route helpers', () => {
  it('splits composite chat id into route params', () => {
    expect(toChatRouteParams('opencode:ses_10f6ac97bffeW0GdEvduSLGMSP')).toEqual({
      source: 'opencode',
      sessionId: 'ses_10f6ac97bffeW0GdEvduSLGMSP',
    })
  })

  it('rebuilds chat id from route params', () => {
    expect(fromChatRouteParams('opencode', 'ses_10f6ac97bffeW0GdEvduSLGMSP')).toBe(
      'opencode:ses_10f6ac97bffeW0GdEvduSLGMSP',
    )
  })

  it('supports claude source ids', () => {
    expect(toChatRouteParams('claude:59d60b82-b957-48e6-adff-c1cfd70a2470')).toEqual({
      source: 'claude',
      sessionId: '59d60b82-b957-48e6-adff-c1cfd70a2470',
    })
    expect(fromChatRouteParams('claude', '59d60b82-b957-48e6-adff-c1cfd70a2470')).toBe(
      'claude:59d60b82-b957-48e6-adff-c1cfd70a2470',
    )
  })

  it('formats grok copy id as resume command', () => {
    expect(formatCopyId('grok:session-abc-123')).toBe('grok --resume session-abc-123')
  })

  it('formats grok using explicit source even if id is bare', () => {
    expect(formatCopyId('019f0219-5579-7a71-b49b-13806a68763d', 'grok')).toBe(
      'grok --resume 019f0219-5579-7a71-b49b-13806a68763d',
    )
  })

  it('keeps non-grok copy id as composite chat id', () => {
    expect(formatCopyId('claude:59d60b82-b957-48e6-adff-c1cfd70a2470')).toBe(
      'claude:59d60b82-b957-48e6-adff-c1cfd70a2470',
    )
  })

  it('formats opencode copy id as session command', () => {
    expect(formatCopyId('opencode:ses_f4eafd656ffeQe78qZDRnPukqV')).toBe(
      'opencode --session ses_f4eafd656ffeQe78qZDRnPukqV',
    )
  })

  it('does not double-prefix an opencode session command', () => {
    expect(formatCopyId('opencode:opencode --session ses_abc')).toBe(
      'opencode --session ses_abc',
    )
  })

  it('supports commandcode source ids', () => {
    expect(
      toChatRouteParams('commandcode:7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e'),
    ).toEqual({
      source: 'commandcode',
      sessionId: '7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e',
    })
  })

  it('formats commandcode copy id as resume command', () => {
    expect(formatCopyId('commandcode:7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e')).toBe(
      'cmd --resume 7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e',
    )
  })
})
