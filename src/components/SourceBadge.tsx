import type { ChatSource } from '../lib/types'
import { SOURCE_LABELS } from '../lib/types'

const COLORS: Record<ChatSource, string> = {
  cursor:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
  grok: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
  codex:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
  opencode:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
  claude:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30',
}

export function SourceBadge({ source }: { source: ChatSource }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${COLORS[source]}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  )
}
