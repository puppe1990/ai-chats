import { describe, expect, it } from 'vitest'
import { isNearBottom } from './chat-scroll'

describe('isNearBottom', () => {
  it('returns true when scrolled to the bottom within threshold', () => {
    expect(
      isNearBottom({ scrollTop: 920, scrollHeight: 1000, clientHeight: 100 }, 80),
    ).toBe(true)
  })

  it('returns false when scrolled away from the bottom', () => {
    expect(
      isNearBottom({ scrollTop: 100, scrollHeight: 1000, clientHeight: 100 }, 80),
    ).toBe(false)
  })
})
