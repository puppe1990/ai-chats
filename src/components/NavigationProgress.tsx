'use client'

import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
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
 * Route-change overlay: top progress bar + glass spinner that fades in/out.
 */
export function NavigationProgress() {
  const { t } = useTranslation()
  const isPending = useRouterState({ select: selectIsNavigating })

  return (
    <div
      className={`route-transition${isPending ? ' route-transition--on' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={isPending}
      aria-hidden={!isPending}
    >
      <div className="route-transition__bar-track" aria-hidden>
        <div className="navigation-progress-bar" />
      </div>
      <div className="route-transition__veil" aria-hidden />
      <div className="route-transition__stage">
        <div className="route-transition__card">
          <LoadingSpinner size="lg" />
          <span className="route-transition__label">{t('nav.loading')}</span>
        </div>
      </div>
    </div>
  )
}
