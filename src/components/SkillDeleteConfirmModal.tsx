import { useTranslation } from 'react-i18next'

type SkillDeleteConfirmModalProps = {
  skillName: string
  open: boolean
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Confirm permanent skill deletion before FS remove. */
export function SkillDeleteConfirmModal({
  skillName,
  open,
  deleting,
  onCancel,
  onConfirm,
}: SkillDeleteConfirmModalProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onClick={() => {
        if (!deleting) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-delete-title"
        className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="skill-delete-title"
          className="m-0 text-lg font-semibold text-[var(--sea-ink)]"
        >
          {t('skills.deleteConfirmTitle')}
        </h2>
        <p className="mt-2 mb-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
          {t('skills.deleteConfirmBody', { name: skillName })}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-1.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {t('skills.deleteCancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-full border border-red-400/50 bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {deleting ? t('skills.deleting') : t('skills.deleteConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
