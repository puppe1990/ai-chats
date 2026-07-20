# AI Chats

[![CI](https://github.com/puppe1990/db-code-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/puppe1990/db-code-harness/actions/workflows/ci.yml)

A local web app that aggregates coding-agent chat sessions from **Cursor**, **Grok**, **Codex**, **OpenCode**, and **Claude Code** into a single timeline sorted by most recent activity.

Built with [TanStack Start](https://tanstack.com/start), React 19, Tailwind CSS, Vitest, and a [Tauri](https://tauri.app) desktop shell.

## Features

- **Unified inbox** — all chats from five tools in one list
- **Sort by recency** — newest sessions first
- **Search** — filter by title, working directory, tool, or model
- **Source filters** — quick chips for Cursor, Grok, Codex, OpenCode, Claude
- **Chat detail view** — click a session to read user/assistant messages
- **Light & dark mode** — theme toggle in the header
- **Read-only** — no writes to agent data; safe to run locally
- **Desktop app** — native window via Tauri (primary) with a local Node backend

## Supported data sources

| Tool         | Local path                                                              | Format                               |
| ------------ | ----------------------------------------------------------------------- | ------------------------------------ |
| **Grok**     | `~/.grok/sessions/**/summary.json`                                      | JSON metadata + `chat_history.jsonl` |
| **OpenCode** | `~/.local/share/opencode/opencode.db`                                   | SQLite `session` table               |
| **Codex**    | `~/.codex/session_index.jsonl` + `sessions/**` + `archived_sessions/**` | JSONL rollouts                       |
| **Cursor**   | `~/.cursor/chats/*/*/store.db`                                          | SQLite `meta` + `blobs`              |
| **Claude**   | `~/.claude/projects/**/*.jsonl`                                         | JSONL session transcripts            |

## Requirements

- Node.js 20+
- macOS or Linux (paths above are Unix-style; Windows would need path overrides)
- The coding agents installed and used at least once on the machine
- For the desktop app: [Rust](https://rustup.rs) (for Tauri) in addition to Node

## Quick start

```bash
git clone https://github.com/puppe1990/db-code-harness.git
cd db-code-harness
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command               | Description                                      |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Start web dev server on port 3000                |
| `npm run build`       | Production build                                 |
| `npm run start`       | Run production server on port 3847               |
| `npm run preview`     | Preview production build                         |
| `npm run tauri:dev`   | **Desktop (primary)** — Tauri + Vite dev         |
| `npm run tauri:build` | Build native Tauri app bundle                    |
| `npm run desktop`     | Launch desktop app (Tauri, or dev shell)         |
| `npm run desktop:stop`| Stop background desktop Node server              |
| `npm test`            | Run Vitest test suite                            |
| `npm run test:watch`  | Run tests in watch mode                          |
| `npm run pake`        | Legacy Pake desktop packaging (optional)         |

## Desktop app (Tauri)

The primary desktop path is **Tauri**. The native window loads the existing TanStack Start app; chat list/detail still run through the Node data layer (`createServerFn` + local filesystem/SQLite providers).

**Prerequisites:** Node.js 20+, Rust (`rustup`), platform deps for Tauri ([guide](https://v2.tauri.app/start/prerequisites/)).

**Development (hot reload):**

```bash
npm run tauri:dev
```

This starts the Vite/TanStack dev server on port 3000 and opens a Tauri webview pointed at it.

**Production-style window:**

```bash
npm run tauri:build
npm run desktop
```

Release builds start (or reuse) the local production server on `http://127.0.0.1:3847` and open the Tauri shell. The server is stopped when the app exits if Tauri started it.

**Stop a background server** (e.g. left over from scripts):

```bash
npm run desktop:stop
```

Optional env vars:

```env
AI_CHATS_PORT=3847
AI_CHATS_APP_NAME=AI Chats
AI_CHATS_ROOT=/absolute/path/to/db-code-harness   # for packaged launches outside the repo
```

### Legacy: Pake

Pake packaging remains available but is **not** the primary desktop path:

```bash
npm run pake          # build AI Chats.app via pake-cli
npm run pake:launch   # same launcher script (prefers Tauri when present)
```

## Configuration

Override default data paths with environment variables:

```env
CURSOR_HOME=~/.cursor
GROK_HOME=~/.grok
CODEX_HOME=~/.codex
OPENCODE_DATA_DIR=~/.local/share/opencode
CLAUDE_HOME=~/.claude
```

## Architecture

```
UI (TanStack Router / Tauri webview)
  └── getChats / getChatDetail (server functions → loadChatList / loadChatDetail)
        └── aggregator
              ├── cursor provider
              ├── grok provider
              ├── codex provider
              ├── opencode provider
              └── claude provider
```

- Providers normalize local files into a shared `ChatSession` type
- `sortByUpdatedAt` merges and orders results
- Message parsers load conversation history per tool on the detail page
- Unit tests use fixtures under `src/lib/**/__fixtures__`
- Tauri (`src-tauri/`) is the native shell; Node keeps FS/SQLite access

## Project structure

```
src/
├── components/     # ChatList, ChatItem, MessageList, SourceBadge
├── lib/
│   ├── providers/  # Per-tool session readers
│   ├── messages/   # Per-tool message parsers
│   ├── aggregator.ts
│   └── filter-chats.ts
├── routes/         # / and /chat/$source/$sessionId
└── server/         # TanStack Start server functions + loadChatList/Detail
src-tauri/          # Tauri 2 Rust shell (window + backend lifecycle)
scripts/            # Desktop launch / legacy Pake helpers
```

## CI & pre-commit

GitHub Actions runs on every push and PR:

- Prettier check
- ESLint
- Vitest
- Production build
