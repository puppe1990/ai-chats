import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import i18n from '../i18n'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('pt-BR')
})
