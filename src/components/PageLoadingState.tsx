import { LoadingSpinner } from './LoadingSpinner'

export function PageLoadingState({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <main className="min-h-screen text-[var(--sea-ink)]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <LoadingSpinner size="md" />
          <div>
            <p className="text-sm font-medium text-[var(--sea-ink)]">{title}</p>
            {description && (
              <p className="text-xs text-[var(--sea-ink-soft)] mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </main>
  )
}
