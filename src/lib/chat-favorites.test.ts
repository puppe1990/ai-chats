/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import {
  CHAT_FAVORITES_STORAGE_KEY,
  isFavorite,
  normalizeFavoriteIds,
  readStoredFavorites,
  toggleFavoriteId,
  writeStoredFavorites,
} from './chat-favorites'

describe('chat favorites', () => {
  afterEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  it('normalizes favorite ids (strings only, unique, non-empty)', () => {
    expect(normalizeFavoriteIds(['a', 'b', 'a', '', 1, null, 'c'])).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(normalizeFavoriteIds('nope')).toEqual([])
  })

  it('toggles favorite membership', () => {
    expect(toggleFavoriteId(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleFavoriteId(['a', 'b'], 'a')).toEqual(['b'])
    expect(isFavorite(['a'], 'a')).toBe(true)
    expect(isFavorite(['a'], 'b')).toBe(false)
  })

  it('persists favorites to localStorage', () => {
    writeStoredFavorites(['grok:1', 'claude:2', 'grok:1'])
    expect(
      JSON.parse(window.localStorage.getItem(CHAT_FAVORITES_STORAGE_KEY)!),
    ).toEqual(['grok:1', 'claude:2'])
    expect(readStoredFavorites()).toEqual(['grok:1', 'claude:2'])
  })
})
