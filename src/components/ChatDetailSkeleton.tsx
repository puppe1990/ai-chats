export function ChatDetailSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando chat">
      <div className="h-4 w-28 rounded skeleton-shimmer" />

      <header className="border-b border-[var(--line)] pb-6 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full skeleton-shimmer" />
          <div className="h-4 w-24 rounded skeleton-shimmer" />
        </div>
        <div className="h-7 w-2/3 max-w-md rounded skeleton-shimmer" />
        <div className="h-4 w-1/2 max-w-sm rounded skeleton-shimmer" />
        <div className="flex gap-2 pt-2">
          <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
          <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
        </div>
      </header>

      <ul className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className={`rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800 ${
              i % 2 === 0 ? 'ml-8' : 'mr-8'
            }`}
          >
            <div className="h-3 w-20 rounded skeleton-shimmer mb-2" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded skeleton-shimmer" />
              <div className="h-3 w-5/6 rounded skeleton-shimmer" />
              <div className="h-3 w-2/3 rounded skeleton-shimmer" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
