import { Link, createFileRoute } from '@tanstack/react-router'
import { fromChatRouteParams } from '../lib/chat-id'
import { getChatDetail } from '../server/chat-detail'
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
  return (
    <PageLoadingState
      title="Abrindo chat..."
      description="Carregando mensagens da sessão"
    >
      <ChatDetailSkeleton />
    </PageLoadingState>
  )
}

function ChatDetailPage() {
  const detail = Route.useLoaderData()

  if (!detail) {
    return (
      <main className="min-h-screen pb-24 text-[var(--sea-ink)]">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="text-[var(--sea-ink-soft)]">Chat não encontrado.</p>
          <Link
            to="/"
            className="text-sm text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] mt-4 inline-block"
          >
            ← Voltar
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
          ← Todos os chats
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
                {messages.length} mensagens
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
