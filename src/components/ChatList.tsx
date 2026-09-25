import { LayoutGrid, List } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { uniqueFolderLabels } from '../lib/chat-folders'
import { getChats } from '../lib/desktop-api'
import type { ChatSource } from '../lib/types'
import { ALL_FOLDERS, NO_FOLDER_FILTER, SOURCE_LABELS } from '../lib/types'
import { ChatItem } from './ChatItem'
import { FolderFilterSelect } from './FolderFilterSelect'
import { LoadingSpinner } from './LoadingSpinner'
import { Pagination } from './Pagination'

const ALL_SOURCES: ChatSource[] = [
  'cursor',
  'grok',
  'codex',
  'opencode',
  'claude',
  'commandcode',
]
const VIEW_MODE_STORAGE_KEY = 'db-code-harness:chat-view-mode'
const SEARCH_DEBOUNCE_MS = 300

type ViewMode = 'list' | 'grid'

const CHIP_ACTIVE = 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
const CHIP_INACTIVE =
  'bg-white text-zinc-700 border border-zinc-200 hover:text-zinc-900 hover:border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600 dark:hover:text-white dark:hover:border-zinc-500'

const VIEW_TOGGLE_ACTIVE =
  'bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
const VIEW_TOGGLE_INACTIVE =
  'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white'

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
  const { t } = useTranslation()
  const [filter, setFilter] = useState<ChatSource | 'all'>('all')
  const [folder, setFolder] = useState<string>(ALL_FOLDERS)
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
  const fetchGeneration = useRef(0)
  const favoriteIdsRef = useRef(favoriteIds)

  useEffect(() => {
    favoriteIdsRef.current = favoriteIds
  }, [favoriteIds])

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  /**
   * Desktop API refetch for pagination/filters/order.
   * favoriteIds is read from a ref so starring a chat stays local + instant
   * (a full aggregate refetch freezes the UI for seconds).
   */
  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }

    const generation = ++fetchGeneration.current
    setLoading(true)

    getChats({
      data: {
        page,
        pageSize: CHAT_PAGE_SIZE,
        source: filter,
        folder,
        query: debouncedQuery,
        order: chatOrder,
        favoriteIds: favoriteIdsRef.current,
        favoritesOnly,
      },
    })
      .then((result) => {
        if (generation !== fetchGeneration.current) return
        setData(result)
      })
      .catch((err: unknown) => {
        console.error('[ChatList] failed to load chats', err)
      })
      .finally(() => {
        if (generation === fetchGeneration.current) {
          setLoading(false)
        }
      })
  }, [page, filter, folder, debouncedQuery, chatOrder, favoritesOnly])

  const hasActiveSearch = debouncedQuery.trim().length > 0
  const hasActiveFilter = filter !== 'all' || favoritesOnly || folder !== ALL_FOLDERS
  // Local set so the Favoritos chip updates the instant a star is toggled.
  const favoriteCount = favoriteIds.length

  // Keep favorites filter in sync with local star toggles without network.
  const visibleItems = useMemo(() => {
    if (!favoritesOnly) return data.items
    return data.items.filter((chat) => favoriteIds.includes(chat.id))
  }, [data.items, favoritesOnly, favoriteIds])

  const visibleTotalItems = favoritesOnly ? visibleItems.length : data.totalItems

  // Shortest unique trailing path per folder, so equal basenames stay tellable apart.
  const folderLabels = useMemo(
    () =>
      uniqueFolderLabels(
        data.folders
          .filter((entry) => entry.path !== NO_FOLDER_FILTER)
          .map((entry) => entry.path),
      ),
    [data.folders],
  )

  const folderLabel = useCallback(
    (path: string) => {
      if (path === NO_FOLDER_FILTER) return t('chatList.noFolder')
      return folderLabels.get(path) ?? path
    },
    [folderLabels, t],
  )

  const folderOptions = useMemo(
    () => [
      {
        value: ALL_FOLDERS,
        label: t('chatList.allFolders', { count: data.totalChats }),
      },
      ...data.folders.map((entry) => ({
        value: entry.path,
        label: t('chatList.folderOption', {
          label: folderLabel(entry.path),
          count: entry.count,
        }),
      })),
    ],
    [data.folders, data.totalChats, folderLabel, t],
  )

  function commitReorder(draggedId: string, targetId: string) {
    const baseOrder = mergeChatOrder(chatOrder, data.items)
    const nextOrder = reorderChatIds(baseOrder, draggedId, targetId)
    setChatOrder(nextOrder)
    writeStoredChatOrder(nextOrder)
  }

  function handleToggleFavorite(chatId: string) {
    setFavoriteIds((prev) => {
      const next = toggleFavoriteId(prev, chatId)
      writeStoredFavorites(next)
      return next
    })
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
            placeholder={t('chatList.searchPlaceholder')}
            aria-label={t('chatList.searchAria')}
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus:border-zinc-400 dark:focus:ring-zinc-500"
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setPage(1)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              {t('chatList.clear')}
            </button>
          )}
        </div>

        <div
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
          role="group"
          aria-label={t('chatList.viewModeAria')}
        >
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            aria-label={t('chatList.listViewAria')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${viewMode === 'list' ? VIEW_TOGGLE_ACTIVE : VIEW_TOGGLE_INACTIVE}`}
          >
            <List className="h-4 w-4" aria-hidden />
            {t('chatList.listView')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label={t('chatList.gridViewAria')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${viewMode === 'grid' ? VIEW_TOGGLE_ACTIVE : VIEW_TOGGLE_INACTIVE}`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            {t('chatList.gridView')}
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-zinc-600 dark:text-zinc-300">
        {t('chatList.reorderHint')}
      </p>

      {data.folders.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label
            htmlFor="chat-folder-filter"
            className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
          >
            {t('chatList.folder')}
          </label>
          <FolderFilterSelect
            inputId="chat-folder-filter"
            value={folder}
            options={folderOptions}
            placeholder={t('chatList.folderPlaceholder')}
            noOptionsMessage={t('chatList.folderNoOptions')}
            onChange={(nextFolder) => {
              setFolder(nextFolder)
              setPage(1)
            }}
          />
        </div>
      )}

      <div className="mb-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
          {t('chatList.provider')}
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
            {t('chatList.all', { count: data.totalChats })}
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
            {t('chatList.favorites', { count: favoriteCount })}
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
              {t('chatList.sourceCount', {
                label: SOURCE_LABELS[source],
                count: data.counts[source],
              })}
            </button>
          ))}
        </div>
      </div>

      {(hasActiveSearch || hasActiveFilter) && (
        <p className="mb-4 text-xs text-zinc-600 dark:text-zinc-300">
          {t('chatList.results', { count: visibleTotalItems })}
          {hasActiveSearch &&
            t('chatList.resultsFor', { query: debouncedQuery.trim() })}
          {favoritesOnly && t('chatList.resultsFavorites')}
          {filter !== 'all' &&
            t('chatList.resultsIn', { source: SOURCE_LABELS[filter] })}
          {folder !== ALL_FOLDERS &&
            t('chatList.resultsInFolder', { folder: folderLabel(folder) })}
        </p>
      )}

      {visibleTotalItems === 0 ? (
        <p className="py-12 text-center text-zinc-600 dark:text-zinc-300">
          {favoritesOnly && favoriteCount === 0
            ? t('chatList.emptyFavorites')
            : hasActiveSearch || hasActiveFilter
              ? t('chatList.emptyFiltered')
              : t('chatList.empty')}
        </p>
      ) : (
        <div className="relative">
          {loading && (
            <div className="list-loading-overlay">
              <div className="list-loading-pill" role="status" aria-live="polite">
                <LoadingSpinner size="sm" />
                <span className="text-xs font-semibold text-[var(--sea-ink)]">
                  {t('chatList.updatingList')}
                </span>
              </div>
            </div>
          )}
          <ul
            className={`transition-opacity duration-200 ${loading ? 'opacity-70' : 'opacity-100'} ${
              viewMode === 'grid'
                ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
                : 'space-y-2'
            }`}
            aria-busy={loading}
          >
            {visibleItems.map((chat) => (
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
          {!favoritesOnly && (
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
          )}
        </div>
      )}
    </div>
  )
}
