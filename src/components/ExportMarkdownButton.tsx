'use client'

import { useState } from 'react'
import type { ChatDetail } from '../lib/types'
import { chatToMarkdown, markdownFilename } from '../lib/export-markdown'
import { getChatDetail } from '../server/chat-detail'
import { LoadingSpinner } from './LoadingSpinner'

const BUTTON_PRIMARY =
  'rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800'

const BUTTON_SECONDARY =
  'inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800'

type ExportMarkdownButtonProps =
  | { detail: ChatDetail; chatId?: never }
  | { chatId: string; detail?: never }

type Status = 'idle' | 'loading' | 'copying' | 'copied' | 'error'

export function ExportMarkdownButton(props: ExportMarkdownButtonProps) {
  const [status, setStatus] = useState<Status>('idle')

  async function resolveDetail(): Promise<ChatDetail | null> {
    if (props.detail) return props.detail
    return getChatDetail({ data: props.chatId })
  }

  async function download() {
    setStatus('loading')
    try {
      const detail = await resolveDetail()
      if (!detail) {
        setStatus('error')
        window.setTimeout(() => setStatus('idle'), 2000)
        return
      }

      const markdown = chatToMarkdown(detail)
      const filename = markdownFilename(detail.session)
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
      setStatus('idle')
    } catch {
      setStatus('error')
      window.setTimeout(() => setStatus('idle'), 2000)
    }
  }

  async function copy() {
    setStatus('copying')
    try {
      const detail = await resolveDetail()
      if (!detail) {
        setStatus('error')
        window.setTimeout(() => setStatus('idle'), 2000)
        return
      }

      await navigator.clipboard.writeText(chatToMarkdown(detail))
      setStatus('copied')
      window.setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      window.setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const isBusy = status === 'loading' || status === 'copying'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={download}
        disabled={isBusy}
        className={BUTTON_PRIMARY}
      >
        {status === 'loading' ? 'Exportando...' : 'Exportar .md'}
      </button>
      <button
        type="button"
        onClick={copy}
        disabled={isBusy}
        className={BUTTON_SECONDARY}
      >
        {status === 'copying' && <LoadingSpinner size="sm" />}
        {status === 'copied'
          ? 'Copiado!'
          : status === 'error'
            ? 'Erro ao copiar'
            : status === 'copying'
              ? 'Copiando...'
              : 'Copiar MD'}
      </button>
    </div>
  )
}
