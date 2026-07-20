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
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-[color-mix(in_oklab,var(--lagoon)_18%,transparent)] blur-md" />
              <LoadingSpinner size="lg" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-[var(--sea-ink)]">
                {title}
              </p>
              {description && (
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--sea-ink-soft)]">
                  {description}
                </p>
              )}
              <div className="page-loader-bar mt-3" aria-hidden>
                <div className="page-loader-bar__fill" />
              </div>
            </div>
          </div>
        </div>
        {children}
      </div>
    </main>
  )
}
