'use client'

import { useEffect, useState } from 'react'

export function FormattedDate({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    // Deferred to client to avoid SSR/client locale mismatch during hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe
    setLabel(new Date(iso).toLocaleString('pt-BR'))
  }, [iso])

  return (
    <span className={className} suppressHydrationWarning>
      {label ?? '…'}
    </span>
  )
}
