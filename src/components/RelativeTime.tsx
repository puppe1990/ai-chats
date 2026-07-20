'use client'

import { useEffect, useState } from 'react'

function formatRelative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function RelativeTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    // Deferred to client to avoid SSR/client clock mismatch during hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe
    setLabel(formatRelative(iso, Date.now()))
  }, [iso])

  return (
    <span className="text-xs text-zinc-500" suppressHydrationWarning>
      {label ?? '…'}
    </span>
  )
}
