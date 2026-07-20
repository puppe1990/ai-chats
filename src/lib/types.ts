export type ChatSource = 'cursor' | 'grok' | 'codex' | 'opencode' | 'claude'

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
}
