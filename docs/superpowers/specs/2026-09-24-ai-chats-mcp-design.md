# AI Chats MCP — Design Spec

**Date:** 2026-09-24  
**Status:** Draft — awaiting spec review  
**Related:** `ai-chats-core` (`get_chats`, `get_chat_detail`, `DataPaths`)

## Problem

Conversas de Cursor, Grok, Codex, OpenCode, Claude Code e Command Code já estão agregadas no app, mas um agente (Grok, Cursor, Claude) não consegue procurá-las por ferramenta. Achar “aquela sessão em que falamos de X” exige abrir o app e filtrar na mão.

## Goal

Servidor MCP **local, stdio, somente leitura**, no mesmo workspace, que reusa `ai-chats-core` e expõe quatro tools. O modelo segue esta ordem:

1. **`search_chats`** — busca da UI (título, `cwd`, source, modelo)
2. **`list_recent_chats`** — últimas sessões por recência, source opcional
3. **`search_chat_messages`** — último caso: substring no corpo das mensagens
4. **`get_chat`** — abre a sessão escolhida (mensagens paginadas)

Sucesso: em qualquer projeto, o agente encontra e lê uma conversa antiga sem o app Tauri aberto.

## Decisions (locked)

| Decisão          | Escolha                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Transporte       | stdio (processo local). Sem HTTP/Netlify nesta entrega                                                                          |
| Runtime          | crate Rust `ai-chats-mcp` + SDK oficial `rmcp` **3.x** (`server`, `transport-io`; MSRV 1.88; CI já usa `rust-toolchain@stable`) |
| Data layer       | só `ai-chats-core`; MCP formata JSON compacto                                                                                   |
| Paths            | `DataPaths::from_env()` (mesmos `GROK_HOME`, `CLAUDE_HOME`, …)                                                                  |
| Ordem das tools  | A → C → B; `get_chat` depois de ter um `chatId`                                                                                 |
| Busca B          | substring case-insensitive no `content`; sem regex, sem FTS persistente                                                         |
| Superfície       | só chats. Skills ficam no app                                                                                                   |
| Mutação          | nenhuma (chats continuam read-only)                                                                                             |
| Favoritos        | fora do MCP (hoje são `localStorage` da UI)                                                                                     |
| Nome do servidor | `ai-chats` (catálogo Grok: `ai-chats__search_chats`, …)                                                                         |
| Logs             | stderr (`tracing`); stdout é o protocolo MCP                                                                                    |

## Non-Goals (esta entrega)

- Skills (`list` / `get` / `save` / `delete`)
- Editar, apagar ou retomar a sessão na tool de origem
- Índice persistente (SQLite FTS, embeddings)
- Transporte HTTP / SSE / Netlify
- Resources e prompts MCP além das quatro tools
- File watcher / cache entre invocações (cada call re-agrega, como o app)
- Windows como alvo de packaging (código deve compilar; paths Unix-first)

## Architecture

```
MCP client (Grok / Cursor / Claude)
        │ stdin/stdout JSON-RPC
        ▼
crates/ai-chats-mcp
        │ tool args → core → JSON compacto
        ▼
crates/ai-chats-core
        │ aggregate / list / messages / message_search
        ▼
~/.cursor  ~/.grok  ~/.codex  ~/.claude  ~/.commandcode  opencode.db
```

### Cargo workspace

```
Cargo.toml                         # members += crates/ai-chats-mcp
crates/ai-chats-core/
  src/
    lib.rs                         # reexport search_chat_messages
    types.rs                       # MessageSearchQuery / Hit / Response (serde camelCase)
    list.rs                        # exportar `parse_source_filter` para o scan B
    message_search.rs              # B: scan + snippet + caps
crates/ai-chats-mcp/
  Cargo.toml
  src/
    main.rs                        # rmcp stdio + tool router
    compact.rs                     # paginação de mensagens, caps de texto, JSON
```

`ai-chats-mcp` é binário fino. Lógica de busca e fixtures ficam no core (testável sem o protocolo).

### Data flow

1. Cliente chama `tools/call`.
2. Handler valida args (tipos + limites). Query vazia em `search_chat_messages` falha com valor recebido e shape esperado.
3. Handler chama core de forma síncrona (`spawn_blocking` se o runtime for tokio).
4. `compact` serializa camelCase, aplica caps de tamanho, devolve `content: [{ type: "text", text: json }]`.
5. Provider ausente ou timeout de aggregate: lista vazia (comportamento atual do core).

## Tools

Instruções do servidor (`ServerHandler::get_info` / `instructions`):

> Find coding-agent chats on this machine (Cursor, Grok, Codex, OpenCode, Claude Code, Command Code). Call `search_chats` first (title, working directory, source, model). If that misses, call `list_recent_chats`. Call `search_chat_messages` only when the topic is likely inside message bodies and the first two tools failed. Then call `get_chat` with a `chatId` from those results.

### 1. `search_chats` (A — primeira)

Filtra o índice como a UI: título, `cwd`, modelo, label/key do source.

| Arg         | Tipo            | Default | Limite      |
| ----------- | --------------- | ------- | ----------- |
| `query`     | string          | `""`    | —           |
| `source`    | string opcional | all     | keys abaixo |
| `page`      | u32             | `1`     | ≥ 1         |
| `page_size` | u32             | `10`    | max `50`    |

`source` válido: `cursor` \| `grok` \| `codex` \| `opencode` \| `claude` \| `commandcode`. Valor desconhecido: resposta de erro com o valor recebido e a lista esperada.

Implementação: `get_chats(ChatListQuery { query, source, page, page_size, ..Default }, paths)`.

Resposta compacta:

```json
{
  "page": 1,
  "pageSize": 10,
  "totalItems": 3,
  "hasNextPage": false,
  "items": [
    {
      "id": "grok:session-1",
      "source": "grok",
      "title": "MCP search",
      "cwd": "/Users/me/proj",
      "updatedAt": "2026-09-24T12:00:00Z",
      "messageCount": 12,
      "model": "grok-4"
    }
  ]
}
```

Campos omitidos quando `None` (`cwd`, `messageCount`, `model`). Sem `counts` / `favoriteCount` (ruído para o agente).

### 2. `list_recent_chats` (C — segunda)

Últimas sessões por `updatedAt` desc (ordem já produzida por `aggregate_chats`).

| Arg      | Tipo            | Default | Limite   |
| -------- | --------------- | ------- | -------- |
| `source` | string opcional | all     | keys     |
| `limit`  | u32             | `15`    | max `50` |

Implementação: `get_chats` com `query` vazio, `page = 1`, `page_size = limit`.

```json
{
  "totalItems": 15,
  "items": [
    {
      "id": "…",
      "source": "grok",
      "title": "…",
      "cwd": "…",
      "updatedAt": "…",
      "messageCount": 8,
      "model": "…"
    }
  ]
}
```

### 3. `search_chat_messages` (B — último caso)

Description **obrigatória** na tool: use only after `search_chats` and `list_recent_chats` did not find the conversation.

| Arg         | Tipo            | Default | Limite             |
| ----------- | --------------- | ------- | ------------------ |
| `query`     | string          | —       | trim; vazio = erro |
| `source`    | string opcional | all     | keys               |
| `max_chats` | u32             | `40`    | max `80`           |
| `max_hits`  | u32             | `10`    | max `25`           |

Algoritmo em `message_search.rs`:

1. `needle = query.trim().to_lowercase()`. Se vazio: erro `empty query: received {query:?}, expected a non-empty search string`.
2. `chats = aggregate_chats(paths)`, filtro de source (mesmo `parse_source_filter` da listagem).
3. Percorrer em ordem de recência até `max_chats`.
4. Para cada sessão, `fetch_chat_detail`; em cada mensagem, `content.to_lowercase().contains(needle)`.
5. Primeiro match da mensagem vira um hit com snippet.
6. Parar ao atingir `max_hits`, ou orçamento **8000 ms** desde o início da scan.

Snippet: primeira ocorrência case-insensitive; 80 caracteres antes e depois; `…` se cortou; quebras de linha viram espaço; teto 200 caracteres.

```json
{
  "query": "path_guard",
  "hits": [
    {
      "chatId": "claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c",
      "title": "Skill save confinement",
      "source": "claude",
      "updatedAt": "2026-07-28T10:00:00Z",
      "messageId": "msg-3",
      "role": "user",
      "snippet": "…confinar save em skill roots via path_guard…"
    }
  ],
  "chatsScanned": 12,
  "truncated": false
}
```

`truncated: true` quando o scan parou por `max_chats`, timeout, ou ainda havia sessões sem varrer. Hits parciais ainda são úteis.

### 4. `get_chat`

| Arg       | Tipo   | Default | Limite         |
| --------- | ------ | ------- | -------------- |
| `chat_id` | string | —       | `source:rawId` |
| `offset`  | u32    | `0`     | —              |
| `limit`   | u32    | `20`    | max `40`       |

Sessão inexistente: texto de erro `chat not found: received {chat_id:?}, expected an id from search_chats or list_recent_chats (format source:sessionId)`.

Mensagens na ordem do transcript. Cada `content` corta em **2000** caracteres (`contentTruncated: true`). Grok limita resultado MCP a ~20 KB; default 20 msgs × 2 KB cabe com folga.

```json
{
  "session": {
    "id": "grok:session-1",
    "source": "grok",
    "title": "…",
    "cwd": "…",
    "updatedAt": "…",
    "messageCount": 40,
    "model": "…"
  },
  "messages": [
    {
      "id": "1",
      "role": "user",
      "content": "…",
      "timestamp": "…",
      "contentTruncated": false
    }
  ],
  "offset": 0,
  "limit": 20,
  "totalMessages": 40,
  "hasMore": true
}
```

## Components

| Unidade                  | Faz o quê                                   | Path                                         |
| ------------------------ | ------------------------------------------- | -------------------------------------------- |
| `search_chat_messages`   | Scan B + snippet + timeout                  | `crates/ai-chats-core/src/message_search.rs` |
| `MessageSearch*` types   | Query / hit / response                      | `crates/ai-chats-core/src/types.rs`          |
| `AiChatsMcp` + `#[tool]` | Quatro tools, instructions, stdio           | `crates/ai-chats-mcp/src/main.rs`            |
| `compact`                | Caps, paginação de msgs, JSON camelCase     | `crates/ai-chats-mcp/src/compact.rs`         |
| README / AGENTS.md       | Como buildar, testar e registrar o servidor | raiz                                         |

`filter_chats` / `get_chats` / `get_chat_detail` não mudam de contrato. `page_size` já existe em `ChatListQuery`.

## Error handling

- Erros de tool: `is_error: true` + texto com valor ofensivo e shape esperado (regra do repo).
- Source inválido: lista os seis keys.
- `search_chat_messages` com query em branco: erro (não scan).
- Home de provider faltando: `[]` / zero hits, sem crash.
- Panic/timeout de um provider: aggregate já isola; a tool devolve o que veio.
- Logs de scan B (chatsScanned, hits, truncated, elapsed) no stderr, nível info.

## Testing

TDD no core para B; testes de formatação no crate MCP.

**Core** (`crates/ai-chats-core/tests/message_search.rs` + unit do snippet):

- Hit em fixture Grok/Claude pelo texto da mensagem; `chatId` e `role` corretos
- Source filter ignora outros providers
- Query vazia / só whitespace: erro com o valor recebido
- `max_hits` corta a lista
- `max_chats` define `truncated: true` quando há mais sessões
- Snippet inclui o needle, respeita teto 200, troca newline por espaço
- Fixture sem match: `hits: []`, `truncated` coerente

**MCP** (`crates/ai-chats-mcp` unit em `compact.rs`):

- Paginação: `offset`/`limit`/`hasMore`/`totalMessages`
- Cap de 2000 chars liga `contentTruncated`
- Item de lista omite `None` e não inclui `counts`

**CI:** `cargo test -p ai-chats-core` (já existe) passa a cobrir message search; adicionar `cargo test -p ai-chats-mcp`.

Comando local do servidor (Inspector / smoke): `cargo run -q -p ai-chats-mcp`. Handshake MCP completo fica fora do CI (precisa cliente).

## Client configuration

O processo precisa do **binário** (cwd de outro projeto quebra `cargo run -p` sem `--manifest-path` absoluto).

Uso diário, depois de `cargo build -p ai-chats-mcp --release`:

```toml
# ~/.grok/config.toml
[mcp_servers.ai-chats]
command = "/ABS/REPO/target/release/ai-chats-mcp"
enabled = true
```

```bash
grok mcp add ai-chats -- /ABS/REPO/target/release/ai-chats-mcp
```

Cursor: mesma `command` em `mcp.json` (stdio). Claude Desktop: `claude_desktop_config.json` no mesmo formato.

README documenta o path absoluto e o `grok mcp add`. Esta entrega **não** escreve no `~/.grok/config.toml` da máquina do desenvolvedor (fica no README / AGENTS.md).

Dev no clone:

```bash
cargo run -q -p ai-chats-mcp
```

Env de paths (`GROK_HOME`, …) é herdado do processo pai; o MCP não define homes próprios.

## Testing the protocol by hand

```bash
cargo build -p ai-chats-mcp --release
npx @modelcontextprotocol/inspector /ABS/REPO/target/release/ai-chats-mcp
```

Chamar `search_chats` com `query` de um título conhecido das fixtures **não** vale no Inspector contra HOME real; smoke manual usa as sessões da máquina.

## Rollout

1. Core: types + `search_chat_messages` + testes de fixture
2. Crate MCP: `compact` + quatro tools + `cargo test -p ai-chats-mcp`
3. Workspace member, CI, README, AGENTS.md
4. Documentar `grok mcp add` (sem auto-install)

## Open questions

Nenhuma. Ordem A → C → B, crate Rust stdio, B com caps e timeout, skills fora.
