import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SkillEditor } from '../components/SkillEditor'
import { SkillList } from '../components/SkillList'
import { PageLoadingState } from '../components/PageLoadingState'
import { getSkill, getSkills, saveSkill } from '../lib/desktop-api'
import {
  applySavedSkillToList,
  errorMessageFromUnknown,
  type SkillDetail,
  type SkillSummary,
} from '../lib/skills'

export const Route = createFileRoute('/skills')({
  loader: () => getSkills(),
  staleTime: 15_000,
  pendingMs: 0,
  pendingMinMs: 280,
  pendingComponent: SkillsPending,
  component: SkillsPage,
})

function SkillsPending() {
  const { t } = useTranslation()
  return (
    <PageLoadingState
      title={t('skills.loadingTitle')}
      description={t('skills.loadingDescription')}
    />
  )
}

function SkillsPage() {
  const { t } = useTranslation()
  const initialSkills = Route.useLoaderData() as SkillSummary[]
  const [skills, setSkills] = useState(initialSkills)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SkillDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const handleSelect = useCallback(
    async (id: string) => {
      setSelectedId(id)
      setLoadingDetail(true)
      setLoadError(null)
      try {
        const next = await getSkill(id)
        setDetail(next)
        if (!next) {
          setLoadError(t('skills.notFound', { id }))
        }
      } catch (err) {
        setDetail(null)
        setLoadError(errorMessageFromUnknown(err, t('skills.loadError')))
      } finally {
        setLoadingDetail(false)
      }
    },
    [t],
  )

  const handleSave = useCallback(async (id: string, content: string) => {
    const updated = await saveSkill(id, content)
    setDetail(updated)
    setSkills((prev) => applySavedSkillToList(prev, updated))
    return updated
  }, [])

  return (
    <main className="min-h-screen pb-24 text-[var(--sea-ink)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{t('skills.title')}</h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            {t('skills.tagline')}
          </p>
        </header>

        <div className="grid min-h-[560px] gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
          <section className="island-shell flex min-h-0 flex-col rounded-2xl p-4">
            <SkillList
              skills={skills}
              selectedId={selectedId}
              onSelect={(id) => {
                void handleSelect(id)
              }}
            />
          </section>

          <section className="island-shell min-h-0 rounded-2xl p-4 sm:p-6">
            <SkillsEditorPanel
              loading={loadingDetail}
              loadError={loadError}
              detail={detail}
              onSave={handleSave}
            />
          </section>
        </div>
      </div>
    </main>
  )
}

function SkillsEditorPanel({
  loading,
  loadError,
  detail,
  onSave,
}: {
  loading: boolean
  loadError: string | null
  detail: SkillDetail | null
  onSave: (id: string, content: string) => Promise<SkillDetail>
}) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        {t('skills.loadingTitle')}
      </p>
    )
  }
  if (loadError && !detail) {
    return (
      <p role="alert" className="m-0 text-sm text-red-700 dark:text-red-300">
        {loadError}
      </p>
    )
  }
  return <SkillEditor skill={detail} onSave={onSave} />
}
