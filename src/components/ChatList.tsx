'use client'
import { useServerFn } from '@tanstack/react-start'
import { LayoutGrid, List } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  CHAT_DRAG_MIME,
  mergeChatOrder,
  readChatDragData,
  readStoredChatOrder,
  reorderChatIds,
  setChatDragData,
  writeStoredChatOrder,
} from '../lib/chat-display-order'
import {
  isFavorite,
  readStoredFavorites,
  toggleFavoriteId,
  writeStoredFavorites,
} from '../lib/chat-favorites'
import { CHAT_PAGE_SIZE, type ChatListResponse } from '../lib/chat-list'
import type { ChatSource } from '../lib/types'
import { SOURCE_LABELS } from '../lib/types'
import { getChats } from '../server/chats'
import { ChatItem } from './ChatItem'
import { LoadingSpinner } from './LoadingSpinner'
import { Pagination } from './Pagination'

const ALL_SOURCES: ChatSource[] = ['cursor', 'grok', 'codex', 'opencode', 'claude']
const VIEW_MODE_STORAGE_KEY = 'db-code-harness:chat-view-mode'
const SEARCH_DEBOUNCE_MS = 300

type ViewMode = 'list' | 'grid'

const CHIP_ACTIVE = 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
const CHIP_INACTIVE =
  'bg-white text-zinc-600 border border-zinc-200 hover:text-zinc-900 hover:border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-transparent dark:hover:text-zinc-200'

const VIEW_TOGGLE_ACTIVE =
  'bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
const VIEW_TOGGLE_INACTIVE =
  'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'

function readStoredViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'list'
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
  return stored === 'grid' ? 'grid' : 'list'
}

function isChatDragEvent(event: React.DragEvent) {
  return (
    event.dataTransfer.types.includes(CHAT_DRAG_MIME) ||
    event.dataTransfer.types.includes('text/plain')
  )
}

export function ChatList({ initialData }: { initialData: ChatListResponse }) {
  const [filter, setFilter] = useState<ChatSource | 'all'>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredViewMode)
  const [chatOrder, setChatOrder] = useState<string[]>(() => readStoredChatOrder())
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readStoredFavorites())
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [draggingChatId, setDraggingChatId] = useState<string | null>(null)
  const [dropTargetChatId, setDropTargetChatId] = useState<string | null>(null)
  const skipInitialFetch = useRef(true)
  const fetchChats = useServerFn(getChats)

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false

    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }

    setLoading(true)
    fetchChats({
      data: {
        page,
        pageSize: CHAT_PAGE_SIZE,
        source: filter,
        query: debouncedQuery,
        order: chatOrder,
        favoriteIds,
        favoritesOnly,
      },
    })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, filter, debouncedQuery, chatOrder, favoriteIds, favoritesOnly, fetchChats])

  const hasActiveSearch = debouncedQuery.trim().length > 0
  const hasActiveFilter = filter !== 'all' || favoritesOnly
  const favoriteCount = data.favoriteCount ?? favoriteIds.length

  function commitReorder(draggedId: string, targetId: string) {
    const baseOrder = mergeChatOrder(chatOrder, data.items)
    const nextOrder = reorderChatIds(baseOrder, draggedId, targetId)
    setChatOrder(nextOrder)
    writeStoredChatOrder(nextOrder)
  }

  function handleToggleFavorite(chatId: string) {
    const next = toggleFavoriteId(favoriteIds, chatId)
    setFavoriteIds(next)
    writeStoredFavorites(next)
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por título, pasta, provider ou modelo..."
            aria-label="Buscar chats"
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600 dark:focus:ring-zinc-600"
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setPage(1)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Limpar
            </button>
          )}
        </div>

        <div
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80"
          role="group"
          aria-label="Modo de visualização"
        >
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            aria-label="Visualização em lista"
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${viewMode === 'list' ? VIEW_TOGGLE_ACTIVE : VIEW_TOGGLE_INACTIVE}`}
          >
            <List className="h-4 w-4" aria-hidden />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label="Visualização em grade"
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${viewMode === 'grid' ? VIEW_TOGGLE_ACTIVE : VIEW_TOGGLE_INACTIVE}`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Grade
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-zinc-500">
        Arraste pelo ícone de alça para reordenar os chats. A ordem fica salva neste
        navegador.
      </p>

      <div className="mb-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Provider
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setFilter('all')
              setPage(1)
            }}
            className={`rounded-full px-3 py-1 text-sm ${filter === 'all' ? CHIP_ACTIVE : CHIP_INACTIVE}`}
          >
            Todos ({data.totalChats})
          </button>
          <button
            type="button"
            onClick={() => {
              setFavoritesOnly((prev) => !prev)
              setPage(1)
            }}
            aria-pressed={favoritesOnly}
            className={`rounded-full px-3 py-1 text-sm ${favoritesOnly ? CHIP_ACTIVE : CHIP_INACTIVE}`}
          >
            Favoritos ({favoriteCount})
          </button>
          {ALL_SOURCES.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => {
                setFilter(source)
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-sm ${filter === source ? CHIP_ACTIVE : CHIP_INACTIVE}`}
            >
              {SOURCE_LABELS[source]} ({data.counts[source]})
            </button>
          ))}
        </div>
      </div>

      {(hasActiveSearch || hasActiveFilter) && (
        <p className="mb-4 text-xs text-zinc-500">
          {data.totalItems} resultado{data.totalItems !== 1 ? 's' : ''}
          {hasActiveSearch && <> para &ldquo;{debouncedQuery.trim()}&rdquo;</>}
          {favoritesOnly && <> nos favoritos</>}
          {filter !== 'all' && <> em {SOURCE_LABELS[filter]}</>}
        </p>
      )}

      {data.totalItems === 0 ? (
        <p className="py-12 text-center text-zinc-500">
          {favoritesOnly && favoriteCount === 0
            ? 'Nenhum favorito ainda. Toque em Favoritar em um chat.'
            : hasActiveSearch || hasActiveFilter
              ? 'Nenhum chat corresponde aos filtros.'
              : 'Nenhum chat encontrado.'}
        </p>
      ) : (
        <div className={`relative ${loading ? 'cursor-wait' : ''}`}>
          {loading && (
            <div className="list-loading-overlay">
              <div className="list-loading-pill" role="status" aria-live="polite">
                <LoadingSpinner size="sm" />
                <span className="text-xs font-semibold text-[var(--sea-ink)]">
                  Atualizando lista…
                </span>
              </div>
            </div>
          )}
          <ul
            className={`transition-opacity duration-200 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'} ${
              viewMode === 'grid'
                ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
                : 'space-y-2'
            }`}
            aria-busy={loading}
          >
            {data.items.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                variant={viewMode}
                isFavorite={isFavorite(favoriteIds, chat.id)}
                onToggleFavorite={() => handleToggleFavorite(chat.id)}
                drag={{
                  isDragging: draggingChatId === chat.id,
                  isDropTarget: dropTargetChatId === chat.id,
                  onDragStart: (event) => {
                    setChatDragData(event, chat.id)
                    setDraggingChatId(chat.id)
                  },
                  onDragEnd: () => {
                    setDraggingChatId(null)
                    setDropTargetChatId(null)
                  },
                  onDragOver: (event) => {
                    if (!isChatDragEvent(event)) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    if (dropTargetChatId !== chat.id) {
                      setDropTargetChatId(chat.id)
                    }
                  },
                  onDrop: (event) => {
                    if (!isChatDragEvent(event)) return
                    event.preventDefault()
                    const draggedId = readChatDragData(event)
                    setDraggingChatId(null)
                    setDropTargetChatId(null)
                    if (!draggedId || draggedId === chat.id) return
                    commitReorder(draggedId, chat.id)
                  },
                }}
              />
            ))}
          </ul>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            totalItems={data.totalItems}
            startIndex={data.startIndex}
            endIndex={data.endIndex}
            hasPreviousPage={data.hasPreviousPage}
            hasNextPage={data.hasNextPage}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
