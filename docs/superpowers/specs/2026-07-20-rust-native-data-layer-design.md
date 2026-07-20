# Rust Native Data Layer — Design Spec

**Date:** 2026-07-20  
**Status:** Approved architecture (desktop-only, Tauri invoke, full parity)  
**Supersedes (desktop path):** Node backend + `frontendDist` URL + `npm run preview` shell in `src-tauri/src/lib.rs`

## Problem

O app desktop Tauri empacota apenas um shell fino. Em release ele:

1. Resolve o path do **repositório** em compile-time (`CARGO_MANIFEST_DIR`)
2. Roda `npm run preview` (Node + Vite)
3. Abre o webview em `http://127.0.0.1:3847`

Consequências:

- DMG/`.app` em `/Applications` **não é standalone** (depende de Node + clone do repo)
- Builds de DMG + `target/` estouram disco e travam a máquina
- O data layer (providers SQLite/JSONL) vive só em TypeScript/Node

## Goal

App **macOS desktop self-contained**:

- Data layer (5 providers + aggregator + list/detail) em **Rust**
- UI fala via **Tauri commands** (`invoke`), sem Node em runtime
- Frontend **SPA estática** embutida no `.app` (`frontendDist` = pasta de build)
- **Paridade total** com o produto atual: list/detail, search/filter/sort/pagination, favorites, export markdown
- `npm run tauri:build` produz `.app`/DMG que instala e roda **sem** repositório e **sem** Node

## Decisions (locked)

| Decisão          | Escolha                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superfície alvo  | **Só desktop Tauri** (web browser com dados reais fica deprecado / fora de escopo)                                                                                                       |
| IPC              | **Tauri commands** (`invoke`), não HTTP local                                                                                                                                            |
| Escopo v1 nativo | **Paridade total**                                                                                                                                                                       |
| Layout Rust      | **Workspace**: crate `ai-chats-core` + thin `src-tauri`                                                                                                                                  |
| Favorites        | Continuam em **localStorage** no frontend (sem backend)                                                                                                                                  |
| Export markdown  | Preferência: **frontend puro** a partir do `ChatDetail` já carregado (como lógica atual em `export-markdown.ts`); se precisar de save dialog nativo, Tauri dialog plugin opcional depois |

## Non-Goals (esta entrega)

- File watchers / live reload de sessões
- Full-text search no corpo das mensagens
- Editar/apagar chats nas tools de origem
- Notarização Apple / signed distribution (pode ser follow-up)
- Windows/Linux packaging (código Rust deve ser portável; DMG/macOS é o foco de packaging)
- Manter TanStack Start SSR + `createServerFn` no path desktop
- Sidecar Node ou runtime Node embutido

## Architecture

```
AI Chats.app
├── WebView: React SPA (static assets from dist/)
│     invoke('get_chats' | 'get_chat_detail' | …)
└── Rust
      ├── src-tauri (commands, window, logging)
      └── ai-chats-core
            ├── types, paths, aggregate, list query
            └── providers: claude, codex, cursor, grok, opencode
                  └── messages/*  (detail loaders)
```

### Cargo workspace

```
/
├── Cargo.toml                 # workspace root
├── crates/
│   └── ai-chats-core/
│       ├── Cargo.toml
│       ├── src/
│       │   ├── lib.rs
│       │   ├── types.rs
│       │   ├── paths.rs
│       │   ├── aggregate.rs
│       │   ├── list.rs        # filter/sort/paginate → ChatListResponse
│       │   ├── providers/
│       │   │   ├── mod.rs
│       │   │   ├── claude.rs
│       │   │   ├── codex.rs
│       │   │   ├── cursor.rs
│       │   │   ├── grok.rs
│       │   │   └── opencode.rs
│       │   └── messages/
│       │       ├── mod.rs
│       │       ├── claude.rs
│       │       ├── codex.rs
│       │       ├── cursor.rs
│       │       ├── grok.rs
│       │       └── opencode.rs
│       └── tests/ + fixtures (copied/adapted from src/lib/providers/__fixtures__)
└── src-tauri/
    ├── Cargo.toml             # depends on ai-chats-core
    └── src/lib.rs             # commands only; no Node spawn
```

### Frontend shape

- Build **SPA** com Vite + TanStack Router (client-only data).
- Remover dependência de `createServerFn` / loaders server no path desktop.
- Camada fina `src/lib/desktop-api.ts` (nome final livre):

```ts
import { invoke } from '@tauri-apps/api/core'

export function getChats(query: ChatListQuery): Promise<ChatListResponse> {
  return invoke('get_chats', { query })
}

export function getChatDetail(chatId: string): Promise<ChatDetail | null> {
  return invoke('get_chat_detail', { chatId })
}
```

- Rotas e componentes existentes permanecem; só a origem dos dados muda.
- Favorites / order em localStorage inalterados (`chat-favorites.ts`, `chat-display-order.ts`).
- Export: reutilizar `chatToMarkdown` no client; botão gera download/blob no browser webview.

### Tauri config (release)

```json
{
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://127.0.0.1:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  }
}
```

- `frontendDist` **deve ser path de arquivos estáticos**, nunca URL de preview.
- Windows: `create: true` (ou builder default) — sem splash que depende de Node.
- Remover lógica de `backend::start_backend` / `npm run preview` de `lib.rs`.

## Data model (wire format)

Espelhar o TypeScript atual para minimizar churn na UI. Serde com `camelCase`.

```rust
// Conceptual — exact derives in implementation

enum ChatSource { Cursor, Grok, Codex, Opencode, Claude }

struct ChatSession {
  id: String,              // "cursor:…", "grok:…", …
  source: ChatSource,
  title: String,
  cwd: Option<String>,
  created_at: String,      // ISO 8601 → serde rename createdAt
  updated_at: String,
  message_count: Option<u32>,
  model: Option<String>,
  storage_path: Option<String>,
}

struct ChatMessage {
  id: String,
  role: ChatMessageRole,   // user | assistant | system | tool
  content: String,
  timestamp: Option<String>,
}

struct ChatDetail {
  session: ChatSession,
  messages: Vec<ChatMessage>,
}

struct ChatListQuery {
  page: u32,
  page_size: Option<u32>,
  source: Option<String>,  // "all" | source name
  query: Option<String>,
  order: Option<Vec<String>>,
  favorite_ids: Option<Vec<String>>,
  favorites_only: Option<bool>,
}

struct ChatListResponse { /* same fields as TS ChatListResponse */ }
```

IDs e paths de dados:

| Source   | Default root              | List strategy                                                        | Detail strategy                        |
| -------- | ------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| Grok     | `~/.grok`                 | Walk `sessions/**/summary.json`                                      | `chat_history.jsonl` no dir da session |
| Codex    | `~/.codex`                | `session_index.jsonl` + walk `sessions`/`archived_sessions` rollouts | Parse rollout JSONL                    |
| Cursor   | `~/.cursor`               | Walk `chats/*/*/store.db`, meta key `0` hex JSON                     | blobs/meta conforme TS atual           |
| OpenCode | `~/.local/share/opencode` | SQLite `session` table                                               | messages table/query como TS           |
| Claude   | `~/.claude`               | history + `projects/**/<uuid>.jsonl`                                 | Parse session JSONL                    |

Env overrides (paridade com `getDataPaths()`):

- `CURSOR_HOME`, `GROK_HOME`, `CODEX_HOME`, `OPENCODE_DATA_DIR`, `CLAUDE_HOME`
- `HOME` via standard dirs

## Commands (Tauri)

| Command                   | Args                   | Returns               | Notes                                                                         |
| ------------------------- | ---------------------- | --------------------- | ----------------------------------------------------------------------------- |
| `get_chats`               | `query: ChatListQuery` | `ChatListResponse`    | Timeout por provider no core (espelhar ~3.5s); provider falho → lista parcial |
| `get_chat_detail`         | `chatId: String`       | `Option<ChatDetail>`  | `null` se não achar session                                                   |
| `get_app_info` (optional) | —                      | version / paths debug | Útil para About / troubleshooting                                             |

Errors: falhas de I/O de um provider **não** derrubam a app — log + empty partial. Erros de comando (serde inválido) retornam `Result` com mensagem legível.

## Provider behavior (port from TS)

Regras obrigatórias (comportamento já coberto por testes Vitest; portar fixtures):

1. **Timeouts:** cada provider na agregação tem deadline (~3500 ms); timeout → `[]` + log.
2. **SQLite readonly:** `rusqlite` com URI `file:…?mode=ro` (Cursor, OpenCode). Retry curto se lock (como o spin 100ms no TS).
3. **Malformed lines:** skip em JSONL; não panic.
4. **Missing dirs:** return `[]`, não erro fatal.
5. **Sort:** `updatedAt` desc para lista base; order custom / favorites aplicados em `list.rs` como `buildChatListResponse`.

Detalhe de mensagens: portar parsers de `src/lib/messages/*` (incluindo `extract-text` para parts Claude/etc.).

## Frontend migration plan

1. Adicionar `@tauri-apps/api` dependency.
2. Criar API adapter `getChats` / `getChatDetail` via `invoke`.
3. Trocar imports de `src/server/chats.ts` / `chat-detail.ts` nas rotas para o adapter.
4. Ajustar build Vite para output SPA estático consumível por Tauri (`dist/` com `index.html` + assets).
   - Se TanStack Start exigir SSR, migrar para **TanStack Router SPA** (mesmo React tree) **ou** configurar Start em modo client-only/static se suportado de forma estável.
5. Remover `beforeBuildCommand` que assume server bundle Node para o desktop; `npm run build` deve produzir só o que o webview precisa.
6. Manter testes Vitest de UI/lib pura (filter, sort, favorites, markdown). Testes de providers TS: manter temporariamente como **oráculo de paridade** até os testes Rust cobrirem as fixtures; depois deprecar/remover o path Node de providers.

## Build / DMG

- `tauri.conf.json` → `bundle.targets` incluir `dmg` (ou `all` em macOS).
- Release **sem** spawn de Node; binary embute assets.
- Documentar: `npm run tauri:build` → artefato em `src-tauri/target/release/bundle/macos|dmg`.
- Pré-requisito de espaço em disco: documentar ≥15 GB livres recomendados para compile Rust completo.
- Remover scripts de runtime Node do path primário (`launch-desktop.sh` sobe só o `.app`; não precisa `ensure_server_running` para Tauri nativo).

## Testing strategy

### Rust (`ai-chats-core`)

- Unit/integration com fixtures copiadas de `src/lib/providers/__fixtures__`.
- Um teste de paridade por provider: lista ≥ N sessions com ids/titles esperados.
- Um teste de detail por provider: ≥ 1 mensagem user/assistant quando fixture tiver.
- Teste de `build_chat_list_response`: filter source, query string, pagination, favoritesOnly.
- Teste de timeout/safe_fetch: provider lento retorna `[]` sem bloquear outros (usar mock/sleep controlado se necessário).

### Frontend

- Manter Vitest para UI e pure TS (favorites, markdown, filter).
- Smoke manual: `tauri dev` abre lista e detail de pelo menos um provider real no machine do dev.

### Regression checklist (manual)

- [ ] App abre sem Node no PATH (simular `PATH=/usr/bin:/bin`)
- [ ] `.app` copiado para `/Applications` roda sem o repo
- [ ] DMG monta, drag to Applications, launch OK
- [ ] 5 source chips + counts
- [ ] Search, pagination, favorites, export markdown

## Migration / deprecation

| Antes                                   | Depois                                              |
| --------------------------------------- | --------------------------------------------------- |
| `frontendDist: "http://127.0.0.1:3847"` | `frontendDist: "../dist"` (static)                  |
| Release spawns `npm run preview`        | Sem processo Node                                   |
| `npm run desktop` → open app + server   | open app only                                       |
| `createServerFn` data path              | `invoke` only (desktop)                             |
| Pake legacy                             | Continua opcional/fora do path nativo; não bloquear |

README: desktop primário = Tauri nativo; `npm run dev` web fica “UI only / legacy” ou removido do quick start.

## Error handling & UX

- Provider falha: lista parcial + log (`tauri-plugin-log` / `tracing`).
- Detail vazio: tela de empty state existente.
- Paths ausentes: app útil mesmo com 0 agents instalados (lista vazia, não crash).
- Primeira abertura: splash/loading leve no React até `get_chats` resolver (sem HTML injetado por `document.write` no Rust).

## Implementation phases (for the plan)

Ordem recomendada para manter o app testável a cada passo:

1. **Workspace + types + paths** — `ai-chats-core` compila; fixtures path helpers
2. **Providers list (JSONL first):** Grok, Claude, Codex
3. **Providers list (SQLite):** OpenCode, Cursor (`rusqlite`)
4. **Messages detail** para os 5
5. **Aggregate + list query** (timeouts, filter, page)
6. **Tauri commands** + strip Node backend
7. **Frontend adapter** + SPA static build wiring
8. **Export/favorites** verify; polish About/errors
9. **Bundle DMG** + install smoke; README
10. **Cleanup** Node server path / dead code

## Risks

| Risk                           | Mitigation                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Disco baixo trava compile      | Limpar `target/debug` entre iterações; documentar free space; prefer `cargo test -p ai-chats-core` antes de full tauri build |
| Parser drift vs TS             | Portar fixtures 1:1; testes de paridade                                                                                      |
| TanStack Start ≠ SPA fácil     | Se bloquear, migrar para Router-only SPA explicitamente no plano                                                             |
| SQLite locks (Cursor aberto)   | readonly + short retry; skip on failure                                                                                      |
| Serialize field names break UI | Golden JSON tests camelCase                                                                                                  |

## Success criteria

1. `cargo test -p ai-chats-core` verde com fixtures dos 5 providers
2. `npm run tauri:build` gera `.app` (e DMG se target ativo)
3. App em `/Applications` roda **sem** Node e **sem** pasta do repo
4. Paridade de features: list, detail, search, filter, sort, pagination, favorites, export
5. Nenhum `npm run preview` / path hard-coded do monorepo no binary de release

## Open items (resolved for implementers)

- Export: client-side markdown from loaded detail (no Rust command required in v1).
- Web browser data path: **out of scope**; do not dual-maintain Node providers after Rust parity tests land (optional keep fixtures/tests as reference until deleted in cleanup task).
- Claude included in the five sources (already in current product).
