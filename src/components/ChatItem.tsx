import { Link } from '@tanstack/react-router'
import { GripVertical, Star } from 'lucide-react'
import { useState } from 'react'
import { toChatRouteParams } from '../lib/chat-id'
import type { ChatSession } from '../lib/types'
import { ExportMarkdownButton } from './ExportMarkdownButton'
import { LoadingSpinner } from './LoadingSpinner'
import { RelativeTime } from './RelativeTime'
import { SourceBadge } from './SourceBadge'

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="demo-button-secondary demo-button"
      style={{
        padding: '0.35rem 0.65rem',
        fontSize: '0.75rem',
        borderRadius: '0.5rem',
      }}
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}

function ChatActions({
  chat,
  isFavorite,
  onToggleFavorite,
}: {
  chat: ChatSession
  isFavorite?: boolean
  onToggleFavorite?: () => void
}) {
  return (
    <div
      className="border-t border-zinc-100 px-4 py-2.5 dark:border-zinc-800 flex items-center gap-1 flex-wrap"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleFavorite()
          }}
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={Boolean(isFavorite)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            isFavorite
              ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70'
              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Star
            className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`}
            aria-hidden
          />
          {isFavorite ? 'Favorito' : 'Favoritar'}
        </button>
      )}
      <ExportMarkdownButton chatId={chat.id} />
      <CopyButton label="Copy ID" text={chat.id} />
      <CopyButton
        label="Copy All"
        text={`${chat.title}\n${chat.source} | ${chat.updatedAt}${chat.cwd ? ` | ${chat.cwd}` : ''}`}
      />
    </div>
  )
}

export type ChatItemDragProps = {
  isDragging: boolean
  isDropTarget: boolean
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent<HTMLLIElement>) => void
  onDrop: (event: React.DragEvent<HTMLLIElement>) => void
}

export function ChatItem({
  chat,
  variant = 'list',
  drag,
  isFavorite = false,
  onToggleFavorite,
}: {
  chat: ChatSession
  variant?: 'list' | 'grid'
  drag?: ChatItemDragProps
  isFavorite?: boolean
  onToggleFavorite?: () => void
}) {
  const { source, sessionId } = toChatRouteParams(chat.id)
  const cardClass =
    'group relative rounded-lg border border-zinc-200 bg-white/80 shadow-sm transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none dark:hover:border-zinc-700 dark:hover:bg-zinc-900 has-[[data-status=pending]]:border-[var(--lagoon)] has-[[data-status=pending]]:ring-2 has-[[data-status=pending]]:ring-[color-mix(in_oklab,var(--lagoon)_45%,transparent)] has-[[data-status=pending]]:bg-[color-mix(in_oklab,var(--lagoon)_8%,white)] dark:has-[[data-status=pending]]:bg-[color-mix(in_oklab,var(--lagoon)_12%,#0f1a1e)]'

  const linkClass =
    'chat-item-link relative flex flex-1 no-underline outline-none data-[status=pending]:cursor-wait'

  const listItemClass = [
    drag?.isDragging ? 'opacity-50' : '',
    drag?.isDropTarget
      ? 'ring-2 ring-zinc-400 ring-offset-2 ring-offset-[var(--bg-base)] dark:ring-zinc-500'
      : '',
    isFavorite ? 'border-amber-200/80 dark:border-amber-900/50' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const dragHandle = drag ? (
    <button
      type="button"
      draggable
      aria-label={`Reordenar chat ${chat.title}`}
      className="mt-0.5 inline-flex shrink-0 cursor-grab rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      onDragStart={drag.onDragStart}
      onDragEnd={drag.onDragEnd}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.preventDefault()}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  ) : null

  const favoriteBadge = isFavorite ? (
    <Star
      className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
      aria-label="Favorito"
    />
  ) : null

  if (variant === 'grid') {
    return (
      <li
        className={`min-h-0 ${listItemClass}`}
        onDragOver={drag?.onDragOver}
        onDrop={drag?.onDrop}
      >
        <div className={`${cardClass} flex h-full flex-col`}>
          <div className="flex items-start gap-2 px-4 pt-3">
            {dragHandle}
            <Link
              to="/chat/$source/$sessionId"
              params={{ source, sessionId }}
              className={`${linkClass} flex-col gap-2 pb-3`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <SourceBadge source={chat.source} />
                  {favoriteBadge}
                </div>
                <RelativeTime iso={chat.updatedAt} />
              </div>
              <p className="font-medium text-zinc-900 line-clamp-2 dark:text-zinc-100">
                {chat.title}
              </p>
              {chat.cwd && <p className="text-xs text-zinc-500 truncate">{chat.cwd}</p>}
              {chat.messageCount != null && (
                <span className="mt-auto text-xs text-zinc-400 tabular-nums dark:text-zinc-600">
                  {chat.messageCount} msgs
                </span>
              )}
              <span className="chat-item-pending-badge" aria-hidden>
                <LoadingSpinner size="sm" />
                <span>Abrindo…</span>
              </span>
            </Link>
          </div>
          <ChatActions
            chat={chat}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      </li>
    )
  }

  return (
    <li className={listItemClass} onDragOver={drag?.onDragOver} onDrop={drag?.onDrop}>
      <div className={cardClass}>
        <div className="flex items-start gap-2 px-4 py-3">
          {dragHandle}
          <Link
            to="/chat/$source/$sessionId"
            params={{ source, sessionId }}
            className={`${linkClass} items-start gap-4`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <SourceBadge source={chat.source} />
                {favoriteBadge}
                <RelativeTime iso={chat.updatedAt} />
              </div>
              <p className="font-medium text-zinc-900 truncate dark:text-zinc-100">
                {chat.title}
              </p>
              {chat.cwd && (
                <p className="text-xs text-zinc-500 truncate mt-0.5">{chat.cwd}</p>
              )}
            </div>
            {chat.messageCount != null && (
              <span className="text-xs text-zinc-400 tabular-nums dark:text-zinc-600">
                {chat.messageCount} msgs
              </span>
            )}
            <span className="chat-item-pending-badge" aria-hidden>
              <LoadingSpinner size="sm" />
              <span>Abrindo…</span>
            </span>
          </Link>
        </div>
        <ChatActions
          chat={chat}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      </div>
    </li>
  )
}
