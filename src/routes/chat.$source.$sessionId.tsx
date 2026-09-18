import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { fromChatRouteParams } from '../lib/chat-id'
import { getChatDetail } from '../lib/desktop-api'
import { ChatDetailHeader } from '../components/ChatDetailHeader'
import { ChatDetailSkeleton } from '../components/ChatDetailSkeleton'
import { MessageList } from '../components/MessageList'
import { PageLoadingState } from '../components/PageLoadingState'

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

  const { messages } = detail

  return (
    <main className="min-h-screen pb-24 text-[var(--sea-ink)]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/"
          className="text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] mb-6 inline-block"
        >
          {t('chatDetail.allChats')}
        </Link>

        <ChatDetailHeader detail={detail} />

        <MessageList messages={messages} />
      </div>
    </main>
  )
}
