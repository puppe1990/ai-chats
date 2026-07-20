export const CHAT_FAVORITES_STORAGE_KEY = 'ai-chats:favorites'

export function normalizeFavoriteIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

export function readStoredFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CHAT_FAVORITES_STORAGE_KEY)
    if (!raw) return []
    return normalizeFavoriteIds(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

export function writeStoredFavorites(ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    CHAT_FAVORITES_STORAGE_KEY,
    JSON.stringify(normalizeFavoriteIds(ids)),
  )
}

export function isFavorite(favoriteIds: string[], chatId: string): boolean {
  return favoriteIds.includes(chatId)
}

export function toggleFavoriteId(favoriteIds: string[], chatId: string): string[] {
  if (favoriteIds.includes(chatId)) {
    return favoriteIds.filter((id) => id !== chatId)
  }
  return normalizeFavoriteIds([...favoriteIds, chatId])
}
