import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'

export const LOCALE_STORAGE_KEY = 'ai-chats:locale'
export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en' || value === 'pt-BR'
}

export function detectLocale(): AppLocale {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isAppLocale(stored)) return stored

    const browser = window.navigator.language.toLowerCase()
    if (browser.startsWith('en')) return 'en'
  }
  return 'pt-BR'
}

export function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale === 'pt-BR' ? 'pt-BR' : 'en'
}

export function setAppLocale(locale: AppLocale) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }
  applyDocumentLocale(locale)
  return i18n.changeLanguage(locale)
}

const initialLocale =
  typeof process !== 'undefined' && process.env.VITEST ? 'pt-BR' : detectLocale()

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'pt-BR': { translation: ptBR },
  },
  lng: initialLocale,
  fallbackLng: 'pt-BR',
  supportedLngs: [...SUPPORTED_LOCALES],
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyDocumentLocale(initialLocale)

export default i18n
