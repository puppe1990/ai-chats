'use client'

import { useRouterState } from '@tanstack/react-router'
import { LoadingSpinner } from './LoadingSpinner'

function selectIsNavigating(state: {
  isLoading: boolean
  isTransitioning?: boolean
  status?: string
  matches: Array<{
    routeId: string
    isFetching: false | 'beforeLoad' | 'loader'
    status: string
  }>
}) {
  if (state.isLoading) return true
  if (state.isTransitioning) return true
  return state.matches.some(
    (match) =>
      match.routeId !== '__root__' &&
      (match.isFetching === 'loader' ||
        match.isFetching === 'beforeLoad' ||
        match.status === 'pending'),
  )
}

/**
 * Always-visible loading feedback while routes load:
 * - thick top progress bar (hard to miss)
 * - floating status pill with spinner + label
 */
export function NavigationProgress() {
  const isPending = useRouterState({ select: selectIsNavigating })

  if (!isPending) return null

  return (
    <div
      className="pointer-events-none"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="fixed inset-x-0 top-0 z-[200] h-1 overflow-hidden bg-[color-mix(in_oklab,var(--lagoon)_18%,transparent)]"
        aria-hidden
      >
        <div className="navigation-progress-bar h-full bg-[linear-gradient(90deg,var(--lagoon),var(--palm),var(--lagoon))]" />
      </div>

      <div className="fixed left-1/2 top-[max(4.75rem,env(safe-area-inset-top))] z-[200] -translate-x-1/2">
        <div className="nav-loading-pill">
          <LoadingSpinner size="sm" />
          <span className="text-xs font-semibold tracking-tight text-[var(--sea-ink)]">
            Carregando…
          </span>
        </div>
      </div>
    </div>
  )
}
