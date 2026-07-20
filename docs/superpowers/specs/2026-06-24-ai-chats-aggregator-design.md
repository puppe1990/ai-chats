# AI Chats Aggregator — Design Spec

**Date:** 2026-06-24  
**Status:** Draft — awaiting review

## Problem

Chats de coding agents ficam espalhados em diretórios locais diferentes (Cursor, Grok, Codex, OpenCode). Não há visão unificada ordenada por recência.

## Goal

App local que agrega sessões de chat das 4 ferramentas e lista por `updatedAt` descendente (mais novo primeiro).

## Non-Goals (v1)

- Abrir/continuar chat na ferramenta original
- Busca full-text no conteúdo das mensagens
- Sync em tempo real / file watcher
- Suporte multi-usuário ou deploy remoto
- Editar ou deletar sessões

## Data Sources (descobertos no sistema do usuário)

| Source       | Path                                                                                                    | Formato                            | Campos principais                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| **Grok**     | `~/.grok/sessions/<encoded-cwd>/<session-id>/summary.json`                                              | JSON                               | `updated_at`, `generated_title` / `session_summary`, `info.cwd`, `num_messages` |
| **OpenCode** | `~/.local/share/opencode/opencode.db`                                                                   | SQLite (`session` table)           | `title`, `directory`, `time_updated` (ms), `model`                              |
| **Codex**    | `~/.codex/session_index.jsonl` + `~/.codex/sessions/**/rollout-*.jsonl` + `~/.codex/archived_sessions/` | JSONL                              | `thread_name`, `updated_at`, `id`                                               |
| **Cursor**   | `~/.cursor/chats/<workspace-hash>/<chat-uuid>/store.db`                                                 | SQLite (`meta` key `0` = hex JSON) | `name`, `createdAt` (ms); `updatedAt` = `mtime` do `store.db`                   |

### Cursor — notas

- `store.db` tem schema mínimo (`meta` + `blobs`). Metadata em hex JSON com `name`, `createdAt`, `agentId`.
- `cwd` não está no metadata; workspace vem do hash da pasta pai (não reversível). v1: `cwd` opcional/vazio para Cursor chats.
- `agent-transcripts` em `~/.cursor/projects/*/agent-transcripts/` existe mas é fonte secundária; v1 usa `store.db` como primária.

### Codex — notas

- `session_index.jsonl` tem 501 entradas com `updated_at`.
- Sessões ativas em `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.
- Arquivados em `~/.codex/archived_sessions/`.
- Index é fonte primária; fallback para `mtime` do arquivo rollout se ID não estiver no index.

## Unified Model

```typescript
type ChatSource = 'cursor' | 'grok' | 'codex' | 'opencode'

interface ChatSession {
  id: string // único por source (prefixo: "cursor:", "grok:", etc.)
  source: ChatSource
  title: string
  cwd?: string
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  messageCount?: number
  model?: string
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│  TanStack Start (React + Tailwind)      │
│  ┌─────────────┐    ┌────────────────┐│
│  │  / (index)  │───▶│ server function ││
│  │  ChatList   │    │ getChats()      ││
│  └─────────────┘    └───────┬────────┘│
└─────────────────────────────┼─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  aggregator.ts    │
                    │  sortByUpdatedAt  │
                    └─────────┬─────────┘
          ┌──────────┬────────┼────────┬──────────┐
          ▼          ▼        ▼        ▼          │
     cursor.ts   grok.ts  codex.ts  opencode.ts   │
          │          │        │        │          │
          ▼          ▼        ▼        ▼          │
     ~/.cursor  ~/.grok  ~/.codex  ~/.local/...   │
```

### Abordagem escolhida: Server Functions + Providers

**Por quê:** TanStack Start roda Node no servidor — leitura direta de SQLite/JSONL sem expor paths ao browser. Providers isolados facilitam TDD com fixtures.

### Alternativas consideradas

| Abordagem                              | Prós                                  | Contras                         |
| -------------------------------------- | ------------------------------------- | ------------------------------- |
| **A. Server functions + providers** ✅ | Simples, testável, sem API REST extra | Requer Node (ok para app local) |
| B. CLI separado + JSON export          | Desacoplado                           | Dois processos, UX pior         |
| C. Electron app                        | Acesso nativo a FS                    | Overkill para v1                |

## UI (v1)

- Header: "AI Chats" + contadores por source
- Lista ordenada por `updatedAt` desc
- Cada item: badge de source (cor), título, cwd truncado, data relativa, message count
- Filtro por source (tabs ou chips)
- Dark theme minimal com Tailwind
- Empty state por source quando não há dados

## Error Handling

- Provider falha isoladamente → retorna `[]` + log no servidor; outros continuam
- Path home customizável via env vars (`CURSOR_HOME`, `GROK_HOME`, `CODEX_HOME`, `OPENCODE_DATA_DIR`)
- SQLite locked (app aberto) → retry 1x com backoff 100ms

## Testing Strategy (TDD)

- **Vitest** para unit tests dos providers e aggregator
- Fixtures em `src/lib/providers/__fixtures__/` com dados mínimos reais (sanitizados)
- Testes usam paths de fixture, não `~` real
- Ordem TDD: model → sort → cada provider → aggregator → server function → UI smoke

## Tech Stack

- TanStack Start (React 19, file-based routing)
- Tailwind CSS v4
- Vitest + @testing-library/react
- better-sqlite3 (leitura read-only dos DBs)
- TypeScript strict

## Env Config

```env
# defaults to os.homedir() paths
CURSOR_HOME=~/.cursor
GROK_HOME=~/.grok
CODEX_HOME=~/.codex
OPENCODE_DATA_DIR=~/.local/share/opencode
```

## File Structure

```
db-code-harness/
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   └── index.tsx              # Chat list page
│   ├── components/
│   │   ├── ChatList.tsx
│   │   ├── ChatItem.tsx
│   │   └── SourceBadge.tsx
│   ├── lib/
│   │   ├── types.ts
│   │   ├── aggregator.ts
│   │   ├── sort.ts
│   │   ├── config.ts
│   │   └── providers/
│   │       ├── cursor.ts
│   │       ├── grok.ts
│   │       ├── codex.ts
│   │       ├── opencode.ts
│   │       └── __fixtures__/
│   └── server/
│       └── chats.ts               # createServerFn getChats
├── tests/
│   └── (mirror src/lib structure)
├── docs/superpowers/
│   ├── specs/...
│   └── plans/...
└── package.json
```
