export function ChatListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando chats">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-10 flex-1 rounded-lg skeleton-shimmer" />
        <div className="h-10 w-40 rounded-lg skeleton-shimmer" />
      </div>
      <div className="h-3 w-16 rounded skeleton-shimmer" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full skeleton-shimmer" />
        ))}
      </div>
      <ul className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <li
            key={i}
            className="rounded-lg border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full skeleton-shimmer" />
                  <div className="h-4 w-12 rounded skeleton-shimmer" />
                </div>
                <div className="h-4 w-3/4 max-w-sm rounded skeleton-shimmer" />
                <div className="h-3 w-1/2 max-w-xs rounded skeleton-shimmer" />
              </div>
              <div className="h-3 w-10 rounded skeleton-shimmer" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
