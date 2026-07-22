'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800'

export function Pagination({
  page,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  hasPreviousPage,
  hasNextPage,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  startIndex: number
  endIndex: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()

  if (totalItems === 0) return null

  return (
    <nav
      className="mt-8 flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
      aria-label={t('pagination.navAria')}
    >
      <p className="text-sm text-zinc-500 tabular-nums">
        {t('pagination.showing', {
          start: startIndex,
          end: endIndex,
          total: totalItems,
        })}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPreviousPage}
          className={BUTTON_CLASS}
          aria-label={t('pagination.previousAria')}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t('pagination.previous')}
        </button>

        <span className="min-w-[7rem] text-center text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
          {t('pagination.pageOf', { page, total: totalPages })}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
          className={BUTTON_CLASS}
          aria-label={t('pagination.nextAria')}
        >
          {t('pagination.next')}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  )
}
