'use client'

import { useTranslation } from 'react-i18next'
import { type AppLocale, setAppLocale } from '../i18n'

const LOCALES: Array<{ code: AppLocale; labelKey: 'language.en' | 'language.ptBR' }> = [
  { code: 'en', labelKey: 'language.en' },
  { code: 'pt-BR', labelKey: 'language.ptBR' },
]

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const active: AppLocale = i18n.language === 'en' ? 'en' : 'pt-BR'

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] p-0.5 shadow-[0_8px_22px_rgba(30,90,72,0.08)]"
      role="group"
      aria-label={t('language.label')}
    >
      {LOCALES.map(({ code, labelKey }) => {
        const isActive = active === code
        const ariaLabel =
          code === 'en' ? t('language.switchToEn') : t('language.switchToPtBR')

        return (
          <button
            key={code}
            type="button"
            onClick={() => void setAppLocale(code)}
            aria-pressed={isActive}
            aria-label={ariaLabel}
            title={ariaLabel}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition sm:px-3 sm:text-sm ${
              isActive
                ? 'bg-[var(--sea-ink)] text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
            }`}
          >
            {t(labelKey)}
          </button>
        )
      })}
    </div>
  )
}
