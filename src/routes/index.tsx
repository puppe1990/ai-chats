import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getChats } from '../lib/desktop-api'
import { ChatList } from '../components/ChatList'
import { ChatListSkeleton } from '../components/ChatListSkeleton'
import { PageLoadingState } from '../components/PageLoadingState'

export const Route = createFileRoute('/')({
  loader: () =>
    getChats({
      data: {
        page: 1,
        source: 'all',
        query: '',
      },
    }),
  // Prefer showing the previous list while revalidating — never freeze navigation.
  staleTime: 30_000,
  pendingMs: 0,
  pendingMinMs: 280,
  pendingComponent: HomePending,
  component: Home,
})

function HomePending() {
  const { t } = useTranslation()

  return (
    <PageLoadingState
      title={t('home.loadingTitle')}
      description={t('app.loadingProviders')}
    >
      <header className="mb-8">
        <div className="h-8 w-40 rounded skeleton-shimmer mb-2" />
        <div className="h-4 w-72 max-w-full rounded skeleton-shimmer" />
      </header>
      <ChatListSkeleton />
    </PageLoadingState>
  )
}

function Home() {
  const { t } = useTranslation()
  const chatList = Route.useLoaderData()
  return (
    <main className="min-h-screen pb-24 text-[var(--sea-ink)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{t('home.title')}</h1>
          <p className="text-sm text-[var(--sea-ink-soft)] mt-1">{t('app.tagline')}</p>
        </header>
        <ChatList initialData={chatList} />
      </div>
    </main>
  )
}
