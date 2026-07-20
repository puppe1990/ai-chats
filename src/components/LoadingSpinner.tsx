type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-9 w-9',
}

/**
 * Branded dual-orbit spinner used across page and inline loading states.
 */
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
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
      <span className={`brand-spinner ${SIZE_CLASS[size]}`} aria-hidden>
        <span className="brand-spinner__ring brand-spinner__ring--outer" />
        <span className="brand-spinner__ring brand-spinner__ring--inner" />
        <span className="brand-spinner__core" />
      </span>
      {label && (
        <span className="text-sm font-medium text-[var(--sea-ink-soft)]">{label}</span>
      )}
    </span>
  )
}
