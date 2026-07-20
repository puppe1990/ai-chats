import { Loader2 } from 'lucide-react'

type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
}

export function LoadingSpinner({
  size = 'md',
  className = '',
  label,
}: {
  size?: SpinnerSize
  className?: string
  label?: string
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Carregando'}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <Loader2
        className={`animate-spin text-[var(--lagoon)] ${SIZE_CLASS[size]}`}
        aria-hidden
      />
      {label && <span className="text-sm text-[var(--sea-ink-soft)]">{label}</span>}
    </span>
  )
}
