# AI Chats

[![CI](https://github.com/puppe1990/ai-chats/actions/workflows/ci.yml/badge.svg)](https://github.com/puppe1990/ai-chats/actions/workflows/ci.yml)

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
- **Desktop app** — standalone native window via Tauri (Rust data layer; no Node at runtime)

## Supported data sources

| Tool         | Local path                                                              | Format                               |
| ------------ | ----------------------------------------------------------------------- | ------------------------------------ |
| **Grok**     | `~/.grok/sessions/**/summary.json`                                      | JSON metadata + `chat_history.jsonl` |
| **OpenCode** | `~/.local/share/opencode/opencode.db`                                   | SQLite `session` table               |
| **Codex**    | `~/.codex/session_index.jsonl` + `sessions/**` + `archived_sessions/**` | JSONL rollouts                       |
| **Cursor**   | `~/.cursor/chats/*/*/store.db`                                          | SQLite `meta` + `blobs`              |
| **Claude**   | `~/.claude/projects/**/*.jsonl`                                         | JSONL session transcripts            |

## Requirements

- Node.js 20+ (web dev, and **build tooling** for the desktop app — not required at desktop runtime)
- macOS or Linux (paths above are Unix-style; Windows would need path overrides)
- The coding agents installed and used at least once on the machine
- For the desktop app: [Rust](https://rustup.rs) (for Tauri). Recommend **≥15 GB free disk** for full Rust release builds.

## Quick start

```bash
git clone https://github.com/puppe1990/db-code-harness.git
cd db-code-harness
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start web dev server on port 3000        |
| `npm run build`        | Production build                         |
| `npm run start`        | Run production server on port 3847       |
| `npm run preview`      | Preview production build                 |
| `npm run tauri:dev`    | **Desktop (primary)** — Tauri + Vite dev |
| `npm run tauri:build`  | Build standalone native Tauri app/DMG    |
| `npm run desktop`      | Open built Tauri `.app` (no Node server) |
| `npm run desktop:stop` | Stop legacy background Node server       |
| `npm test`             | Run Vitest test suite                    |
| `npm run test:watch`   | Run tests in watch mode                  |
| `npm run pake`         | Legacy Pake desktop packaging (optional) |

## Desktop app (Tauri)

The primary desktop path is a **standalone Tauri** app. Chat list/detail load through **Rust** commands (`get_chats` / `get_chat_detail` in `ai-chats-core`); the webview serves a static SPA from the bundle. **Node is not required at runtime** — only as build tooling (`npm`, Vite, Tauri CLI).

**Prerequisites (build):** Node.js 20+, Rust (`rustup`), platform deps for Tauri ([guide](https://v2.tauri.app/start/prerequisites/)). Plan for **≥15 GB free disk** for a full release compile.

**Development (hot reload):**

```bash
npm run tauri:dev
```

Starts the Vite dev server and opens a Tauri webview pointed at it (Node only during development).

**Production build:**

```bash
npm run tauri:build
```

Artifacts (macOS):

- App: `src-tauri/target/release/bundle/macos/AI Chats.app`
- DMG: `src-tauri/target/release/bundle/dmg/`

Launch the built app (opens the `.app` only — no Node preview server, no repo path required):

```bash
npm run desktop
```

You can also open the `.app` from Finder or copy it to `/Applications`. It runs without the repository checkout and without Node on `PATH`.

**Optional env vars** (legacy / naming):

```env
AI_CHATS_PORT=3847
AI_CHATS_APP_NAME=AI Chats
```

`npm run desktop:stop` only applies if a **legacy** Node preview server was started (e.g. Pake). Standalone Tauri does not use it.

### Legacy: Pake

Pake packaging remains available but is **not** the primary desktop path (and still depends on a local Node server):

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
UI (TanStack Router / Tauri webview SPA)
  └── invoke get_chats / get_chat_detail
        └── ai-chats-core (Rust)
              ├── cursor provider
              ├── grok provider
              ├── codex provider
              ├── opencode provider
              └── claude provider
```

- Providers normalize local agent data into a shared chat session model
- List query supports source filters, search, pagination, and favorites
- Message parsers load conversation history per tool on the detail page
- Unit tests: Vitest for UI/pure TS; Rust tests for providers under `crates/ai-chats-core`
- Tauri (`src-tauri/`) is the native shell + command bridge; **no Node process at runtime**

## Project structure

```
src/
├── components/     # ChatList, ChatItem, MessageList, SourceBadge
├── lib/
│   ├── desktop-api.ts  # Tauri invoke adapter
│   ├── providers/      # TS providers (tests / web parity)
│   ├── messages/
│   ├── aggregator.ts
│   └── filter-chats.ts
├── routes/         # / and /chat/$source/$sessionId
└── server/         # Optional web/server helpers (desktop uses Rust)
crates/ai-chats-core/  # Rust data layer (providers, aggregate, detail)
src-tauri/          # Tauri 2 shell (static SPA + invoke handlers)
scripts/            # Desktop launch / legacy Pake helpers
```

## CI & pre-commit

GitHub Actions runs on every push and PR:

- Prettier check
- ESLint
- Vitest
- `cargo test -p ai-chats-core` (Rust data layer)
- Production frontend build
