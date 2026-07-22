'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type ThemeMode = 'light' | 'dark'

function readStoredMode(): ThemeMode {
  const stored = window.localStorage.getItem('theme')
  return stored === 'dark' ? 'dark' : 'light'
}

function applyThemeMode(mode: ThemeMode) {
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(mode)
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
}

export default function ThemeToggle() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<ThemeMode>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = readStoredMode()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe
    setMode(stored)
    applyThemeMode(stored)
    setReady(true)
  }, [])

  function toggleMode() {
    const nextMode: ThemeMode = mode === 'light' ? 'dark' : 'light'
    setMode(nextMode)
    applyThemeMode(nextMode)
    window.localStorage.setItem('theme', nextMode)
  }

  const modeLabel = mode === 'dark' ? t('theme.modeDark') : t('theme.modeLight')
  const label = t('theme.toggleAria', { mode: modeLabel })

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={label}
      title={label}
      suppressHydrationWarning
      className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5"
    >
      {!ready || mode === 'light' ? t('theme.light') : t('theme.dark')}
    </button>
  )
}
