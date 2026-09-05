import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  errorMessageFromUnknown,
  skillSourceLabel,
  type SkillDetail,
} from '../lib/skills'
import { SkillDeleteConfirmModal } from './SkillDeleteConfirmModal'

type SkillEditorProps = {
  skill: SkillDetail | null
  onSave: (id: string, content: string) => Promise<SkillDetail>
  onDelete: (id: string) => Promise<void>
}

/** Empty-state shell when nothing is selected. */
function SkillEditorEmpty() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 text-center">
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        {t('skills.selectPrompt')}
      </p>
    </div>
  )
}

/**
 * Editor for a loaded skill. Parent should remount with `key={skill.id}`
 * so draft state resets without effects.
 */
function SkillEditorForm({
  skill,
  onSave,
  onDelete,
}: {
  skill: SkillDetail
  onSave: (id: string, content: string) => Promise<SkillDetail>
  onDelete: (id: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [content, setContent] = useState(skill.content)
  const [baseline, setBaseline] = useState(skill.content)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = content !== baseline
  const busy = saving || deleting

  async function handleSave() {
    if (!dirty || busy) return
    setSaving(true)
    setError(null)
    try {
      const updated = await onSave(skill.id, content)
      setContent(updated.content)
      setBaseline(updated.content)
    } catch (err) {
      setError(errorMessageFromUnknown(err, t('skills.saveError')))
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (busy) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(skill.id)
      setConfirmOpen(false)
    } catch (err) {
      setError(errorMessageFromUnknown(err, t('skills.deleteError')))
      setConfirmOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
            {skill.name}
          </h2>
          <span className="rounded-md border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--sea-ink-soft)]">
            {skillSourceLabel(skill.source)}
          </span>
          {skill.isSymlink ? (
            <span className="rounded-md border border-amber-300/50 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
              {t('skills.symlink')}
            </span>
          ) : null}
        </div>
        {skill.description ? (
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{skill.description}</p>
        ) : null}
        <p className="m-0 break-all font-mono text-xs text-[var(--sea-ink-soft)]">
          {skill.path}
          {skill.isSymlink && skill.realPath !== skill.path
            ? ` → ${skill.realPath}`
            : null}
        </p>
      </header>

      <label className="sr-only" htmlFor="skill-editor-content">
        {t('skills.editorLabel')}
      </label>
      <textarea
        id="skill-editor-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
        className="min-h-[320px] flex-1 resize-y rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3 font-mono text-sm leading-6 text-[var(--sea-ink)] outline-none ring-[var(--lagoon)] focus:ring-2"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!dirty || busy}
          className="rounded-full border border-[var(--chip-line)] bg-[var(--lagoon)] px-4 py-1.5 text-sm font-semibold text-[#0b2422] shadow-[0_8px_22px_rgba(30,90,72,0.12)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {saving ? t('skills.saving') : t('skills.save')}
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
          className="rounded-full border border-red-300/60 bg-transparent px-4 py-1.5 text-sm font-semibold text-red-700 transition hover:-translate-y-0.5 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
        >
          {t('skills.delete')}
        </button>
        {dirty ? (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {t('skills.unsaved')}
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="m-0 rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        >
          {error}
        </p>
      ) : null}

      <SkillDeleteConfirmModal
        skillName={skill.name}
        open={confirmOpen}
        deleting={deleting}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false)
        }}
        onConfirm={() => {
          void handleConfirmDelete()
        }}
      />
    </div>
  )
}

export function SkillEditor({ skill, onSave, onDelete }: SkillEditorProps) {
  if (!skill) {
    return <SkillEditorEmpty />
  }

  // Remount when switching skills so draft state starts from the loaded content.
  return (
    <SkillEditorForm key={skill.id} skill={skill} onSave={onSave} onDelete={onDelete} />
  )
}
