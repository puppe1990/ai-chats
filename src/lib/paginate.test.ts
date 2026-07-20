import { describe, it, expect } from 'vitest'
import { paginate } from './paginate'

const items = Array.from({ length: 25 }, (_, i) => i + 1)

describe('paginate', () => {
  it('returns a slice for the requested page', () => {
    const result = paginate(items, { page: 2, pageSize: 10 })
    expect(result.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(result).toMatchObject({
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      startIndex: 11,
      endIndex: 20,
      hasPreviousPage: true,
      hasNextPage: true,
    })
  })

  it('clamps page to the last page when out of range', () => {
    const result = paginate(items, { page: 99, pageSize: 10 })
    expect(result.page).toBe(3)
    expect(result.items).toEqual([21, 22, 23, 24, 25])
    expect(result.hasNextPage).toBe(false)
  })

  it('normalizes invalid page numbers to page 1', () => {
    const result = paginate(items, { page: 0, pageSize: 10 })
    expect(result.page).toBe(1)
    expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('returns empty items for empty input', () => {
    const result = paginate([], { page: 1, pageSize: 10 })
    expect(result).toMatchObject({
      items: [],
      page: 1,
      totalItems: 0,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    })
  })
})
