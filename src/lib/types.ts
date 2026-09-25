export type ChatSource =
  | 'cursor'
  | 'grok'
  | 'codex'
  | 'opencode'
  | 'claude'
  | 'commandcode'

export interface ChatSession {
  id: string
  source: ChatSource
  title: string
  cwd?: string
  createdAt: string
  updatedAt: string
  messageCount?: number
  model?: string
  /** Path to primary data file/dir for loading messages */
  storagePath?: string
}

/** Sentinel for the "chats without a cwd" folder bucket — never a real folder path. */
export const NO_FOLDER_FILTER = '__no_folder__'

/** Sentinel meaning "do not filter by folder". */
export const ALL_FOLDERS = 'all'

export interface FolderCount {
  /** Absolute working directory, or NO_FOLDER_FILTER for chats without one. */
  path: string
  count: number
}

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  timestamp?: string
}

export interface ChatDetail {
  session: ChatSession
  messages: ChatMessage[]
}

export const SOURCE_LABELS: Record<ChatSource, string> = {
  cursor: 'Cursor',
  grok: 'Grok',
  codex: 'Codex',
  opencode: 'OpenCode',
  claude: 'Claude Code',
  commandcode: 'Command Code',
}
