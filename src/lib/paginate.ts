export interface PaginateOptions {
  page: number
  pageSize: number
}

export interface PaginateResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  startIndex: number
  endIndex: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export function paginate<T>(
  items: T[],
  { page, pageSize }: PaginateOptions,
): PaginateResult<T> {
  const safePageSize = Math.max(1, pageSize)
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))
  const normalizedPage = Number.isFinite(page)
    ? Math.min(Math.max(1, Math.floor(page)), totalPages)
    : 1
  const start = (normalizedPage - 1) * safePageSize
  const slice = items.slice(start, start + safePageSize)
  const endIndex = totalItems === 0 ? 0 : start + slice.length

  return {
    items: slice,
    page: normalizedPage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex: totalItems === 0 ? 0 : start + 1,
    endIndex,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
  }
}
