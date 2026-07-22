import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { fromChatRouteParams } from '../lib/chat-id'
import { getChatDetail } from '../lib/desktop-api'
import { ChatDetailSkeleton } from '../components/ChatDetailSkeleton'
import { ExportMarkdownButton } from '../components/ExportMarkdownButton'
import { FormattedDate } from '../components/FormattedDate'
import { MessageList } from '../components/MessageList'
import { PageLoadingState } from '../components/PageLoadingState'
import { SourceBadge } from '../components/SourceBadge'

export const Route = createFileRoute('/chat/$source/$sessionId')({
  loader: ({ params }) =>
    getChatDetail({
      data: fromChatRouteParams(params.source, params.sessionId),
    }),
  staleTime: 30_000,
  pendingMs: 0,
  pendingMinMs: 280,
  pendingComponent: ChatDetailPending,
  component: ChatDetailPage,
})

function ChatDetailPending() {
  const { t } = useTranslation()

  return (
    <PageLoadingState
      title={t('chatDetail.loadingTitle')}
      description={t('chatDetail.loadingDescription')}
    >
      <ChatDetailSkeleton />
    </PageLoadingState>
  )
}

function ChatDetailPage() {
  const { t } = useTranslation()
  const detail = Route.useLoaderData()

  if (!detail) {
    return (
      <main className="min-h-screen pb-24 text-[var(--sea-ink)]">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="text-[var(--sea-ink-soft)]">{t('chatDetail.notFound')}</p>
          <Link
            to="/"
            className="text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] mt-4 inline-block"
          >
            {t('chatDetail.back')}
          </Link>
        </div>
      </main>
    )
  }

  const { session, messages } = detail

  return (
    <main className="min-h-screen pb-24 text-[var(--sea-ink)]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/"
          className="text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] mb-6 inline-block"
        >
          {t('chatDetail.allChats')}
        </Link>

        <header className="mb-8 border-b border-[var(--line)] pb-6">
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

        <MessageList messages={messages} />
      </div>
    </main>
  )
}
