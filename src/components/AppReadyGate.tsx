'use client'

import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { dismissStartupLoader } from '../lib/startup-loader'

function isBootstrapping(state: {
  matches: Array<{
    routeId: string
    status: string
    isFetching: false | 'beforeLoad' | 'loader'
  }>
}) {
  return state.matches.some(
    (match) =>
      match.routeId !== '__root__' &&
      (match.status === 'pending' || match.isFetching === 'loader'),
  )
}

export function AppReadyGate() {
  const bootstrapping = useRouterState({
    select: isBootstrapping,
  })

  useEffect(() => {
    if (bootstrapping) return
    dismissStartupLoader()
  }, [bootstrapping])

  // Hard safety: never keep the full-screen loader forever, even if a route
  // stays pending (e.g. a locked SQLite file).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      dismissStartupLoader()
    }, 5_000)
    return () => window.clearTimeout(timer)
  }, [])

  return null
}
