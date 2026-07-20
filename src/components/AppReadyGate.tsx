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

  return null
}
