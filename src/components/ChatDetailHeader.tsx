import { useTranslation } from 'react-i18next'
import type { ChatDetail } from '../lib/types'
import { ExportMarkdownButton } from './ExportMarkdownButton'
import { FormattedDate } from './FormattedDate'
import { SourceBadge } from './SourceBadge'

export function ChatDetailHeader({ detail }: { detail: ChatDetail }) {
  const { t } = useTranslation()
  const { session, messages } = detail

  return (
    <header className="chat-detail-header mb-8 border-b border-[var(--line)] pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SourceBadge source={session.source} />
            <FormattedDate
              iso={session.updatedAt}
              className="text-xs text-[var(--sea-ink-soft)]"
            />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{session.title}</h1>
          {session.cwd && (
            <p className="text-sm text-[var(--sea-ink-soft)] mt-1 truncate">
              {session.cwd}
            </p>
          )}
          <p className="text-xs text-[var(--sea-ink-soft)] mt-2 opacity-80">
            {t('chatDetail.messages', { count: messages.length })}
          </p>
        </div>
        <ExportMarkdownButton detail={detail} />
      </div>
    </header>
  )
}
