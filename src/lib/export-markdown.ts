import type { ChatDetail, ChatMessage, ChatSession } from './types'
import { SOURCE_LABELS } from './types'

const ROLE_HEADINGS: Record<ChatMessage['role'], string> = {
  user: 'Você',
  assistant: 'Assistente',
  system: 'Sistema',
  tool: 'Ferramenta',
}

function formatTimestamp(iso?: string): string | undefined {
  if (!iso) return undefined
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return iso
  }
}

export function chatToMarkdown({ session, messages }: ChatDetail): string {
  const lines: string[] = [
    `# ${session.title}`,
    '',
    `**Source:** ${SOURCE_LABELS[session.source]}`,
    `**Chat ID:** \`${session.id}\``,
  ]

  if (session.cwd) lines.push(`**Directory:** \`${session.cwd}\``)
  if (session.model) lines.push(`**Model:** ${session.model}`)
  lines.push(`**Created:** ${formatTimestamp(session.createdAt) ?? session.createdAt}`)
  lines.push(`**Updated:** ${formatTimestamp(session.updatedAt) ?? session.updatedAt}`)
  lines.push(`**Messages:** ${messages.length}`)
  lines.push('', '---', '')

  for (const msg of messages) {
    if (!msg.content.trim()) continue

    lines.push(`## ${ROLE_HEADINGS[msg.role]}`)
    const ts = formatTimestamp(msg.timestamp)
    if (ts) lines.push(`_${ts}_`, '')
    lines.push(msg.content.trim(), '', '---', '')
  }

  return `${lines.join('\n').trim()}\n`
}

export function markdownFilename(session: ChatSession): string {
  const slug = session.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  const base = slug || session.id.replace(':', '-')
  return `${session.source}-${base}.md`
}
