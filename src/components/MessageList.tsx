import { ArrowDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChatMessage } from '../lib/types'
import { getScrollMetrics, isNearBottom, scrollToBottom } from '../lib/chat-scroll'
import { FormattedDate } from './FormattedDate'

const ROLE_STYLES: Record<ChatMessage['role'], string> = {
  user: 'bg-zinc-100 border-zinc-200 ml-8 dark:bg-zinc-800 dark:border-zinc-700',
  assistant: 'bg-white border-zinc-200 mr-8 dark:bg-zinc-900/80 dark:border-zinc-800',
  system:
    'bg-zinc-50 border-zinc-200 text-zinc-500 text-sm dark:bg-zinc-900/40 dark:border-zinc-800/50',
  tool: 'bg-zinc-50 border-zinc-200 text-zinc-500 text-xs font-mono dark:bg-zinc-900/40 dark:border-zinc-800/50',
}

const ROLE_LABELS: Record<ChatMessage['role'], string> = {
  user: 'Você',
  assistant: 'Assistente',
  system: 'Sistema',
  tool: 'Ferramenta',
}

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const [showJumpButton, setShowJumpButton] = useState(false)

  useEffect(() => {
    if (messages.length === 0) return

    scrollToBottom('instant')
    setShowJumpButton(false)
  }, [messages])

  useEffect(() => {
    function handleScroll() {
      setShowJumpButton(!isNearBottom(getScrollMetrics()))
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (messages.length === 0) {
    return (
      <p className="text-zinc-500 text-center py-12">
        Nenhuma mensagem encontrada para este chat.
      </p>
    )
  }

  return (
    <>
      <ul className="space-y-4">
        {messages.map((msg) => (
          <li
            key={msg.id}
            className={`rounded-lg border px-4 py-3 shadow-sm dark:shadow-none ${ROLE_STYLES[msg.role]}`}
          >
            <p className="text-xs font-medium text-zinc-500 mb-1.5">
              {ROLE_LABELS[msg.role]}
              {msg.timestamp && (
                <FormattedDate iso={msg.timestamp} className="ml-2 font-normal" />
              )}
            </p>
            <p className="text-sm text-zinc-800 whitespace-pre-wrap break-words dark:text-zinc-200">
              {msg.content}
            </p>
          </li>
        ))}
      </ul>

      {showJumpButton && (
        <button
          type="button"
          aria-label="Ir para o final"
          onClick={() => scrollToBottom('smooth')}
          className="fixed bottom-6 left-1/2 z-50 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-700 shadow-lg backdrop-blur transition hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
        >
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
      )}
    </>
  )
}