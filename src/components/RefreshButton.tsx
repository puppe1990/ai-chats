'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter, useRouterState } from '@tanstack/react-router'

function isRouteRefreshing(state: {
  isLoading: boolean
  matches: Array<{ isFetching: false | 'beforeLoad' | 'loader' }>
}) {
  return state.isLoading || state.matches.some((match) => match.isFetching === 'loader')
}

export function RefreshButton() {
  const router = useRouter()
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const isRouterRefreshing = useRouterState({
    select: isRouteRefreshing,
  })
  const isRefreshing = isManualRefresh || isRouterRefreshing

  async function handleRefresh() {
    setIsManualRefresh(true)
    try {
      await router.invalidate({
        // forcePending on __root__ leaves the shell stuck with no loader to finish.
        filter: (match) => match.routeId !== '__root__',
      })
    } finally {
      setIsManualRefresh(false)
    }
  }

  const label = isRefreshing ? 'Atualizando...' : 'Atualizar dados'

  return (
    <button
      type="button"
      onClick={() => void handleRefresh()}
      disabled={isRefreshing}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
    >
      <RefreshCw
        className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
        aria-hidden
      />
      <span>{isRefreshing ? 'Atualizando' : 'Atualizar'}</span>
    </button>
  )
}
