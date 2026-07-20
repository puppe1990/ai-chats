# Rust Native Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone Tauri desktop app whose data layer (5 providers + list/detail) runs entirely in Rust via `invoke`, with a static SPA frontend and zero Node at runtime.

**Architecture:** Cargo workspace with `ai-chats-core` (providers, aggregate, list query) and a thin `src-tauri` shell exposing `get_chats` / `get_chat_detail`. Frontend becomes a client-only SPA that calls those commands. Release `frontendDist` is a static directory; no `npm run preview`.

**Tech Stack:** Rust 2021, serde/serde_json, rusqlite (bundled), chrono, walkdir, tauri 2, @tauri-apps/api, React 19, TanStack Router (SPA), Vite, Vitest (UI only).

**Spec:** `docs/superpowers/specs/2026-07-20-rust-native-data-layer-design.md`

**Disk note:** Prefer `cargo test -p ai-chats-core` over full `tauri build` during development. Delete `src-tauri/target/debug` if free space drops below ~8 GB.

---

## File structure (target)

```
Cargo.toml                          # workspace
crates/ai-chats-core/
  Cargo.toml
  src/lib.rs
  src/types.rs
  src/paths.rs
  src/text.rs                       # extract_text / strip_user_query_tags
  src/aggregate.rs
  src/list.rs
  src/providers/{mod,grok,claude,codex,cursor,opencode}.rs
  src/messages/{mod,grok,claude,codex,cursor,opencode}.rs
  tests/fixtures/                   # copy of src/lib/providers/__fixtures__
  tests/*.rs
src-tauri/
  Cargo.toml                        # path dep ai-chats-core
  src/lib.rs                        # commands only
  tauri.conf.json                   # frontendDist ../dist
src/lib/desktop-api.ts              # invoke wrappers
src/main.tsx                        # SPA entry (new)
index.html                          # SPA shell (new)
vite.config.ts                      # SPA plugins (drop Start SSR for desktop path)
src/routes/*.tsx                    # loaders call desktop-api
scripts/launch-desktop.sh           # open .app only
README.md
```

**Oracle reference (read-only while porting):**

- List: `src/lib/providers/{grok,claude,codex,cursor,opencode}.ts`
- Messages: `src/lib/messages/*`
- Aggregate/list: `src/lib/aggregator.ts`, `src/lib/chat-list.ts`, `src/lib/filter-chats.ts`, `src/lib/paginate.ts`, `src/lib/chat-display-order.ts`
- Fixtures: `src/lib/providers/__fixtures__/**`
- Vitest expectations: `src/lib/providers/*.test.ts`, `src/lib/messages/*.test.ts`

---

### Task 1: Cargo workspace + `ai-chats-core` skeleton

**Files:**

- Create: `Cargo.toml`
- Create: `crates/ai-chats-core/Cargo.toml`
- Create: `crates/ai-chats-core/src/lib.rs`
- Create: `crates/ai-chats-core/src/types.rs`
- Create: `crates/ai-chats-core/src/paths.rs`
- Modify: `src-tauri/Cargo.toml` (add path dependency later in Task 8; workspace member only here)
- Modify: `.gitignore` if needed for workspace `target/`

- [ ] **Step 1: Create workspace root `Cargo.toml`**

```toml
[workspace]
resolver = "2"
members = [
  "crates/ai-chats-core",
  "src-tauri",
]

[workspace.package]
edition = "2021"
license = "MIT"
```

- [ ] **Step 2: Create `crates/ai-chats-core/Cargo.toml`**

```toml
[package]
name = "ai-chats-core"
version = "0.1.0"
edition = "2021"
license = "MIT"
description = "Local chat aggregation core for AI Chats desktop"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", default-features = false, features = ["clock", "std"] }
walkdir = "2"
rusqlite = { version = "0.32", features = ["bundled"] }
thiserror = "2"
regex = "1"

[dev-dependencies]
pretty_assertions = "1"
```

- [ ] **Step 3: Create `types.rs` with camelCase serde**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatSource {
    Cursor,
    Grok,
    Codex,
    Opencode,
    Claude,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
    pub id: String,
    pub source: ChatSource,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_path: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatMessageRole {
    User,
    Assistant,
    System,
    Tool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: ChatMessageRole,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatDetail {
    pub session: ChatSession,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatListQuery {
    pub page: u32,
    #[serde(default)]
    pub page_size: Option<u32>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub order: Option<Vec<String>>,
    #[serde(default)]
    pub favorite_ids: Option<Vec<String>>,
    #[serde(default)]
    pub favorites_only: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatListResponse {
    pub items: Vec<ChatSession>,
    pub page: u32,
    pub page_size: u32,
    pub total_items: u32,
    pub total_pages: u32,
    pub start_index: u32,
    pub end_index: u32,
    pub has_previous_page: bool,
    pub has_next_page: bool,
    pub counts: SourceCounts,
    pub total_chats: u32,
    pub favorite_count: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub struct SourceCounts {
    pub cursor: u32,
    pub grok: u32,
    pub codex: u32,
    pub opencode: u32,
    pub claude: u32,
}
```

- [ ] **Step 4: Create `paths.rs`**

```rust
use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct DataPaths {
    pub cursor_home: PathBuf,
    pub grok_home: PathBuf,
    pub codex_home: PathBuf,
    pub opencode_data_dir: PathBuf,
    pub claude_home: PathBuf,
}

fn home_dir() -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("/tmp"))
}

impl DataPaths {
    pub fn from_env() -> Self {
        let home = home_dir();
        Self {
            cursor_home: env::var_os("CURSOR_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".cursor")),
            grok_home: env::var_os("GROK_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".grok")),
            codex_home: env::var_os("CODEX_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".codex")),
            opencode_data_dir: env::var_os("OPENCODE_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".local/share/opencode")),
            claude_home: env::var_os("CLAUDE_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".claude")),
        }
    }
}
```

- [ ] **Step 5: Create `lib.rs` exports**

```rust
pub mod paths;
pub mod types;

pub use paths::DataPaths;
pub use types::*;
```

- [ ] **Step 6: Make `src-tauri` a workspace member without breaking it**

Ensure `src-tauri/Cargo.toml` keeps its `[package]` section. Workspace membership alone is enough for now (no core dep yet).

If `cargo metadata` fails because tauri package name conflicts, keep `name = "ai-chats"` as today.

- [ ] **Step 7: Compile check**

Run:

```bash
cargo test -p ai-chats-core --lib
```

Expected: PASS (0 tests) or “running 0 tests”.

- [ ] **Step 8: Commit**

```bash
git add Cargo.toml crates/ai-chats-core src-tauri/Cargo.toml
git commit -m "chore: add ai-chats-core workspace crate skeleton"
```

---

### Task 2: Fixtures + text helpers + Grok list provider

**Files:**

- Create: `crates/ai-chats-core/src/text.rs`
- Create: `crates/ai-chats-core/src/providers/mod.rs`
- Create: `crates/ai-chats-core/src/providers/grok.rs`
- Create: `crates/ai-chats-core/tests/fixtures/` (copy from `src/lib/providers/__fixtures__`)
- Create: `crates/ai-chats-core/tests/grok_list.rs`

- [ ] **Step 1: Copy fixtures**

```bash
mkdir -p crates/ai-chats-core/tests/fixtures
cp -R src/lib/providers/__fixtures__/* crates/ai-chats-core/tests/fixtures/
```

- [ ] **Step 2: Write failing integration test**

```rust
// crates/ai-chats-core/tests/grok_list.rs
use ai_chats_core::providers::grok::fetch_grok_chats;
use std::path::PathBuf;

fn fixture_sessions() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/grok/sessions")
}

#[test]
fn parses_summary_json_into_session() {
    let sessions = fetch_grok_chats(&fixture_sessions()).unwrap();
    assert_eq!(sessions.len(), 1);
    let s = &sessions[0];
    assert_eq!(s.id, "grok:session-1"); // match fixture info.id — adjust if fixture differs
    assert_eq!(s.source, ai_chats_core::ChatSource::Grok);
    assert!(!s.title.is_empty());
    assert!(s.storage_path.is_some());
}

#[test]
fn missing_dir_returns_empty() {
    let sessions = fetch_grok_chats(std::path::Path::new("/nonexistent/grok-sessions")).unwrap();
    assert!(sessions.is_empty());
}
```

**Before locking assertions:** open `crates/ai-chats-core/tests/fixtures/grok/sessions/**/summary.json` and align `id` / title with real fixture (mirror `src/lib/providers/grok.test.ts`).

- [ ] **Step 3: Run test — expect FAIL**

```bash
cargo test -p ai-chats-core --test grok_list
```

Expected: compile error `providers` not found / `fetch_grok_chats` missing.

- [ ] **Step 4: Implement `text.rs` helpers**

```rust
use serde_json::Value;

pub fn extract_text_from_parts(parts: &[Value]) -> String {
    let mut out = String::new();
    for part in parts {
        if let Some(t) = part.get("text").and_then(|v| v.as_str()) {
            if !t.trim().is_empty() {
                if !out.is_empty() {
                    out.push('\n');
                }
                out.push_str(t.trim());
            }
        }
    }
    out
}

pub fn strip_user_query_tags(input: &str) -> String {
    // Port minimal behavior from src/lib/messages/extract-text.ts
    let mut s = input.to_string();
    // Remove <user_query>...</user_query> wrappers if present
    if let Some(start) = s.find("<user_query>") {
        if let Some(end) = s.find("</user_query>") {
            let inner = &s[start + "<user_query>".len()..end];
            s = inner.trim().to_string();
        }
    }
    s.trim().to_string()
}
```

- [ ] **Step 5: Implement `providers/grok.rs`**

Port logic from `src/lib/providers/grok.ts`:

- Walk `sessionsDir` recursively for files named `summary.json`
- Parse JSON fields: `info.id`, `info.cwd`, `generated_title` / `session_summary`, timestamps, `num_messages`, `current_model_id`
- Build `ChatSession` with `id = format!("grok:{}", info.id)`, `storage_path = parent dir of summary.json`
- On any error for a file: skip; missing root: return `Ok(vec![])`

```rust
pub fn fetch_grok_chats(sessions_dir: &Path) -> Result<Vec<ChatSession>, std::io::Error> {
    // walkdir + serde_json
}
```

- [ ] **Step 6: Wire modules in `lib.rs` and `providers/mod.rs`**

```rust
// providers/mod.rs
pub mod grok;
```

```rust
// lib.rs
pub mod paths;
pub mod providers;
pub mod text;
pub mod types;
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cargo test -p ai-chats-core --test grok_list
```

- [ ] **Step 8: Commit**

```bash
git add crates/ai-chats-core
git commit -m "feat(core): port Grok session list provider"
```

---

### Task 3: Claude + Codex list providers

**Files:**

- Create: `crates/ai-chats-core/src/providers/claude.rs`
- Create: `crates/ai-chats-core/src/providers/codex.rs`
- Create: `crates/ai-chats-core/tests/claude_list.rs`
- Create: `crates/ai-chats-core/tests/codex_list.rs`
- Modify: `crates/ai-chats-core/src/providers/mod.rs`

- [ ] **Step 1: Write Claude failing test from TS oracle**

Mirror `src/lib/providers/claude.test.ts`:

```rust
// tests/claude_list.rs
use ai_chats_core::providers::claude::fetch_claude_chats;
use std::path::PathBuf;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/claude")
}

#[test]
fn parses_project_session_jsonl() {
    let sessions = fetch_claude_chats(&fixture_root()).unwrap();
    assert_eq!(sessions.len(), 1);
    let s = &sessions[0];
    assert_eq!(s.id, "claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c");
    assert_eq!(s.title, "Build chat aggregator with TanStack Start");
    assert_eq!(s.cwd.as_deref(), Some("/test/project"));
    assert_eq!(s.model.as_deref(), Some("claude-sonnet-4-6"));
    assert_eq!(s.message_count, Some(3));
}

#[test]
fn missing_dir_empty() {
    assert!(fetch_claude_chats(std::path::Path::new("/nonexistent")).unwrap().is_empty());
}
```

- [ ] **Step 2: Implement `claude.rs` list**

Port `src/lib/providers/claude.ts`:

- Read optional `history.jsonl` index
- Find `projects/**/<uuid>.jsonl` (UUID filename regex)
- Title from history display or first user message (`extract_claude_title_from_session`)
- `storage_path` = session file path

- [ ] **Step 3: Write Codex failing test from `codex.test.ts`**

Use fixture under `tests/fixtures/codex`. Assert at least the archived rollout session appears with `codex:` id prefix.

- [ ] **Step 4: Implement `codex.rs` list**

Port `src/lib/providers/codex.ts`:

- Read `session_index.jsonl` into map
- Walk `sessions/` and `archived_sessions/` for `rollout-*.jsonl`
- Merge index metadata (thread_name, updated_at) with file mtime / rollout parse

- [ ] **Step 5: Run tests**

```bash
cargo test -p ai-chats-core --test claude_list --test codex_list
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add crates/ai-chats-core
git commit -m "feat(core): port Claude and Codex list providers"
```

---

### Task 4: OpenCode + Cursor list providers (SQLite)

**Files:**

- Create: `crates/ai-chats-core/src/providers/opencode.rs`
- Create: `crates/ai-chats-core/src/providers/cursor.rs`
- Create: `crates/ai-chats-core/src/sqlite_util.rs`
- Create: `crates/ai-chats-core/tests/opencode_list.rs`
- Create: `crates/ai-chats-core/tests/cursor_list.rs`

- [ ] **Step 1: Shared readonly open helper**

```rust
// sqlite_util.rs
use rusqlite::{Connection, OpenFlags};
use std::path::Path;
use std::time::{Duration, Instant};

pub fn open_readonly(db_path: &Path) -> rusqlite::Result<Connection> {
    let uri = format!("file:{}?mode=ro", db_path.display());
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI;
    match Connection::open_with_flags(&uri, flags) {
        Ok(c) => Ok(c),
        Err(first) => {
            let deadline = Instant::now() + Duration::from_millis(100);
            while Instant::now() < deadline {
                if let Ok(c) = Connection::open_with_flags(&uri, flags) {
                    return Ok(c);
                }
            }
            Err(first)
        }
    }
}
```

- [ ] **Step 2: OpenCode test + implement**

Oracle: `src/lib/providers/opencode.test.ts` + fixture `opencode.db`.

SQL:

```sql
SELECT id, title, directory, time_created, time_updated, model
FROM session ORDER BY time_updated DESC
```

Map to `id = format!("opencode:{id}")`, ISO times from ms.

- [ ] **Step 3: Cursor test + implement**

Oracle: `src/lib/providers/cursor.test.ts`.

- Walk `chats/*/*/store.db`
- `SELECT value FROM meta WHERE key = '0'`
- Decode hex → JSON → `name`, `createdAt`, `agentId`
- `updated_at` from file mtime
- `id = format!("cursor:{chat_folder_name}")`

- [ ] **Step 4: Run tests**

```bash
cargo test -p ai-chats-core --test opencode_list --test cursor_list
```

- [ ] **Step 5: Commit**

```bash
git add crates/ai-chats-core
git commit -m "feat(core): port OpenCode and Cursor list providers"
```

---

### Task 5: Message detail loaders (all 5)

**Files:**

- Create: `crates/ai-chats-core/src/messages/mod.rs`
- Create: `crates/ai-chats-core/src/messages/{grok,claude,codex,cursor,opencode}.rs`
- Create: `crates/ai-chats-core/src/messages/mod.rs` re-export `fetch_chat_detail`
- Create: `crates/ai-chats-core/tests/*_messages.rs` (or one `messages_all.rs`)
- Modify: `lib.rs`

- [ ] **Step 1: Write detail tests using same fixtures**

Minimum assertions (adjust to fixture content):

- Grok: ≥1 user or assistant message from `chat_history.jsonl` if present in fixture; if fixture lacks history, add a minimal history file under fixtures (keep deterministic).
- Claude: messages from session jsonl include the title user text.
- Codex: parse rollout events into user/assistant text (port `messages/codex.ts`).
- Cursor: blobs table roles user/assistant.
- OpenCode: `message` + `part` tables for session id.

- [ ] **Step 2: Implement each messages module**

Port from:

| Module   | TS source                      |
| -------- | ------------------------------ |
| grok     | `src/lib/messages/grok.ts`     |
| claude   | `src/lib/messages/claude.ts`   |
| codex    | `src/lib/messages/codex.ts`    |
| cursor   | `src/lib/messages/cursor.ts`   |
| opencode | `src/lib/messages/opencode.ts` |

- [ ] **Step 3: Implement dispatcher**

```rust
// messages/mod.rs
pub fn fetch_chat_detail(
    chat_id: &str,
    session: &ChatSession,
    paths: &DataPaths,
) -> Option<ChatDetail> {
    if session.id != chat_id {
        return None;
    }
    let storage = session.storage_path.as_deref()?;
    let messages = match session.source {
        ChatSource::Grok => grok::fetch_grok_messages(Path::new(storage)),
        ChatSource::Claude => claude::fetch_claude_messages(Path::new(storage)),
        ChatSource::Codex => codex::fetch_codex_messages(/* resolve rollout path */),
        ChatSource::Cursor => cursor::fetch_cursor_messages(Path::new(storage)),
        ChatSource::Opencode => {
            let raw = chat_id.strip_prefix("opencode:")?;
            opencode::fetch_opencode_messages(Path::new(storage), raw)
        }
    };
    Some(ChatDetail {
        session: session.clone(),
        messages,
    })
}
```

- [ ] **Step 4: Run**

```bash
cargo test -p ai-chats-core
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add crates/ai-chats-core
git commit -m "feat(core): port message detail loaders for all providers"
```

---

### Task 6: Aggregate + list query (filter/sort/paginate)

**Files:**

- Create: `crates/ai-chats-core/src/aggregate.rs`
- Create: `crates/ai-chats-core/src/list.rs`
- Create: `crates/ai-chats-core/tests/list_and_aggregate.rs`
- Modify: `lib.rs`

- [ ] **Step 1: Port list helpers**

Implement in `list.rs` (behavior match TS):

- `CHAT_PAGE_SIZE = 10`
- `normalize_chat_list_query`
- `filter_chats` (source, query haystack title/cwd/model/source label, favoritesOnly)
- `paginate`
- `merge_chat_order` / `sort_chats_by_custom_order` from `chat-display-order.ts`
- `build_chat_list_response` → `ChatListResponse` with `counts` + `favorite_count`

Source labels for search:

```text
cursor → Cursor, grok → Grok, codex → Codex, opencode → OpenCode, claude → Claude Code
```

- [ ] **Step 2: Tests for list**

```rust
#[test]
fn filters_by_source_and_paginates() {
    // build 3 fake ChatSessions with different sources
    // build_chat_list_response page=1 page_size=1 source=Some("grok")
    // assert items len 1, counts, has_next_page
}

#[test]
fn favorites_only() {
    // favorite_ids + favorites_only true
}
```

- [ ] **Step 3: Implement `aggregate_chats`**

```rust
pub const PROVIDER_TIMEOUT_MS: u64 = 3500;

pub fn aggregate_chats(paths: &DataPaths) -> Vec<ChatSession> {
    // Run each provider; on error or timeout → empty for that provider
    // Prefer std::thread::scope + channel with recv_timeout for real timeouts
    // Sort by updated_at descending (ISO strings parseable; use chrono)
}
```

Timeout strategy (simple, reliable):

```rust
fn safe_fetch<F>(name: &str, f: F) -> Vec<ChatSession>
where
    F: FnOnce() -> Vec<ChatSession> + Send + 'static,
{
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(f());
    });
    match rx.recv_timeout(Duration::from_millis(PROVIDER_TIMEOUT_MS)) {
        Ok(v) => v,
        Err(_) => {
            eprintln!("[aggregate_chats] {name} timed out or failed");
            vec![]
        }
    }
}
```

Wire providers:

```rust
let grok = safe_fetch("grok", {
    let p = paths.grok_home.join("sessions");
    move || fetch_grok_chats(&p).unwrap_or_default()
});
// codex, cursor, opencode (opencode.db path), claude similarly
```

- [ ] **Step 4: Public API convenience**

```rust
// lib.rs
pub fn get_chats(query: ChatListQuery, paths: &DataPaths) -> ChatListResponse {
    let chats = aggregate_chats(paths);
    build_chat_list_response(chats, query)
}

pub fn get_chat_detail(chat_id: &str, paths: &DataPaths) -> Option<ChatDetail> {
    let chats = aggregate_chats(paths);
    let session = chats.into_iter().find(|c| c.id == chat_id)?;
    messages::fetch_chat_detail(chat_id, &session, paths)
}
```

- [ ] **Step 5: Integration test with all fixtures via env paths**

```rust
#[test]
fn aggregate_fixture_roots() {
    // set DataPaths fields to tests/fixtures/* roots (not real home)
    // assert total sessions >= 1 across providers present in fixtures
}
```

Note: construct `DataPaths` with fixture paths directly (add `DataPaths { ... }` public fields already).

- [ ] **Step 6: Run all core tests**

```bash
cargo test -p ai-chats-core
```

- [ ] **Step 7: Commit**

```bash
git add crates/ai-chats-core
git commit -m "feat(core): aggregate providers and build chat list responses"
```

---

### Task 7: JSON camelCase golden test

**Files:**

- Create: `crates/ai-chats-core/tests/serde_camel_case.rs`

- [ ] **Step 1: Ensure wire format matches frontend**

```rust
#[test]
fn chat_session_serializes_camel_case() {
    let s = ChatSession { /* minimal */ };
    let v = serde_json::to_value(&s).unwrap();
    assert!(v.get("createdAt").is_some());
    assert!(v.get("created_at").is_none());
    assert!(v.get("storagePath").is_some() || s.storage_path.is_none());
}
```

- [ ] **Step 2: Fix any rename attributes if failing**

- [ ] **Step 3: Commit**

```bash
git add crates/ai-chats-core/tests/serde_camel_case.rs
git commit -m "test(core): lock camelCase JSON wire format for UI"
```

---

### Task 8: Tauri commands + remove Node backend

**Files:**

- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs` (replace Node backend entirely)
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json` if invoke ACL needed (Tauri 2)

- [ ] **Step 1: Add dependency**

```toml
# src-tauri/Cargo.toml
[dependencies]
ai-chats-core = { path = "../crates/ai-chats-core" }
# existing tauri, serde, etc.
```

- [ ] **Step 2: Rewrite `lib.rs` (release + debug)**

Remove entire `backend` module and process spawn. New structure:

```rust
use ai_chats_core::{get_chat_detail as core_detail, get_chats as core_chats, ChatListQuery, ChatListResponse, ChatDetail, DataPaths};
use tauri::Manager;

#[tauri::command]
fn get_chats(query: ChatListQuery) -> Result<ChatListResponse, String> {
    let paths = DataPaths::from_env();
    Ok(core_chats(query, &paths))
}

#[tauri::command]
fn get_chat_detail(chat_id: String) -> Result<Option<ChatDetail>, String> {
    let paths = DataPaths::from_env();
    Ok(core_detail(&chat_id, &paths))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
        .invoke_handler(tauri::generate_handler![get_chats, get_chat_detail])
        .setup(|app| {
            // Ensure main window exists from tauri.conf (set create: true)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Update `tauri.conf.json`**

```json
{
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://127.0.0.1:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "AI Chats",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "create": true,
        "visible": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"],
    "icon": [
      /* keep existing */
    ]
  }
}
```

- [ ] **Step 4: Capabilities**

If Tauri 2 requires allowing commands, update `capabilities/default.json` to permit core defaults (usually automatic for app commands).

- [ ] **Step 5: Compile tauri lib (debug, no full bundle if disk low)**

```bash
cd src-tauri && cargo check
```

Expected: SUCCESS (may take several minutes first time)

- [ ] **Step 6: Update/remove obsolete test `src/server/tauri-shell.test.ts`**

Change expectations: production no longer requires Node preview URL. Either delete test or assert config `frontendDist` is not an `http` URL by reading `tauri.conf.json` in a small node test.

- [ ] **Step 7: Commit**

```bash
git add src-tauri crates/ai-chats-core
git commit -m "feat(tauri): expose get_chats/get_chat_detail and drop Node backend"
```

---

### Task 9: Frontend SPA + desktop-api adapter

**Files:**

- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/lib/desktop-api.ts`
- Modify: `vite.config.ts`
- Modify: `package.json` (deps + scripts)
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/chat.$source.$sessionId.tsx`
- Modify: `src/routes/__root.tsx` (SPA head/scripts)
- Modify: `src/components/ChatList.tsx`
- Modify: `src/components/ExportMarkdownButton.tsx`
- Modify: tests that mock `getChats` / `getChatDetail`
- Possibly remove or gut: `src/server/chats.ts`, `chat-detail.ts` (keep re-export shim calling desktop-api during transition)

- [ ] **Step 1: Add dependency**

```bash
npm install @tauri-apps/api
```

- [ ] **Step 2: Create `src/lib/desktop-api.ts`**

```ts
import { invoke } from '@tauri-apps/api/core'
import type { ChatDetail } from './types'
import type { ChatListQuery, ChatListResponse } from './chat-list'

/** Matches previous createServerFn call shape where callers passed { data: ... }. */
export async function getChats(input: {
  data: ChatListQuery
}): Promise<ChatListResponse> {
  return invoke<ChatListResponse>('get_chats', { query: input.data })
}

export async function getChatDetail(input: {
  data: string
}): Promise<ChatDetail | null> {
  return invoke<ChatDetail | null>('get_chat_detail', { chatId: input.data })
}
```

- [ ] **Step 3: Replace server imports**

In `src/routes/index.tsx`, `ChatList.tsx`, `chat.$source.$sessionId.tsx`, `ExportMarkdownButton.tsx`:

```ts
// from:
import { getChats } from '../server/chats'
// to:
import { getChats } from '../lib/desktop-api'
```

Same for `getChatDetail`.

Remove `useServerFn` wrappers — call promises directly:

```ts
// before
const fetchChats = useServerFn(getChats)
const data = await fetchChats({ data: query })

// after
const data = await getChats({ data: query })
```

- [ ] **Step 4: SPA entry**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Chats</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import './styles.css'

const router = getRouter()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
```

- [ ] **Step 5: Vite SPA config**

Replace TanStack Start plugin with Router plugin if needed:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    tailwindcss(),
    react(),
  ],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

Install if missing:

```bash
npm install -D @tanstack/router-plugin
```

- [ ] **Step 6: Fix `__root.tsx` for SPA**

Remove Start-only `Scripts` SSR assumptions that require server streaming. Keep `HeadContent` if still valid with Router; otherwise use plain document title + layout shell with `<Outlet />`.

Pattern:

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { AppReadyGate } from '../components/AppReadyGate'
// Header/Footer as today

export const Route = createRootRoute({
  component: () => (
    <AppReadyGate>
      <Header />
      <Outlet />
      <Footer />
    </AppReadyGate>
  ),
})
```

- [ ] **Step 7: Update package scripts**

```json
{
  "dev": "vite --host 127.0.0.1 --port 3000",
  "build": "vite build",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build",
  "desktop": "bash scripts/launch-desktop.sh"
}
```

Remove or repurpose `start`/`preview` Node server scripts (optional leave as no-op message).

- [ ] **Step 8: Update component tests**

Mock `../lib/desktop-api` instead of `../server/chats`. Drop `useServerFn` mocks.

- [ ] **Step 9: Run frontend tests**

```bash
npm test
```

Expected: PASS (adjust broken Start-specific tests; delete pure server tests that require Node providers if obsolete).

- [ ] **Step 10: Smoke `tauri dev` (manual)**

```bash
npm run tauri:dev
```

Expected: window opens, chat list loads from real `~` agent data (or empty).

- [ ] **Step 11: Commit**

```bash
git add index.html src package.json package-lock.json vite.config.ts
git commit -m "feat(ui): SPA frontend calling Tauri invoke for chat data"
```

---

### Task 10: Launch scripts + README

**Files:**

- Modify: `scripts/launch-desktop.sh`
- Modify: `scripts/lib/runtime.sh` (stop requiring server for Tauri)
- Modify: `README.md`

- [ ] **Step 1: Launch script opens app only**

```bash
# Prefer release bundle; no ensure_server_running for Tauri native
if app_path="$(find_tauri_app 2>/dev/null)"; then
  echo "Opening Tauri app: $app_path"
  open "$app_path"
  exit 0
fi
```

- [ ] **Step 2: README desktop section**

Document:

```bash
# Dev
npm run tauri:dev

# Production build (need ~15GB free disk recommended)
npm run tauri:build
# App: src-tauri/target/release/bundle/macos/AI Chats.app
# DMG: src-tauri/target/release/bundle/dmg/

# Requirements: Rust, Node only for build tooling — not at runtime
```

Remove claims that release starts Node preview.

- [ ] **Step 3: Commit**

```bash
git add scripts README.md
git commit -m "docs: document standalone Tauri desktop without Node runtime"
```

---

### Task 11: Production bundle smoke + cleanup

**Files:**

- Possibly delete unused Node provider runtime path from desktop docs
- Keep TS provider tests only if still used; otherwise leave fixtures for Rust and remove Node-only server loaders when safe

- [ ] **Step 1: Free disk if needed**

```bash
df -h /System/Volumes/Data
rm -rf src-tauri/target/debug
```

- [ ] **Step 2: Build**

```bash
npm run tauri:build
```

Expected: `AI Chats.app` and DMG under `src-tauri/target/release/bundle/`.

- [ ] **Step 3: Runtime without Node in PATH**

```bash
# Copy app to temp Applications-like dir
APP="src-tauri/target/release/bundle/macos/AI Chats.app"
env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin" open "$APP"
```

Expected: app launches (list may populate from agent homes).

- [ ] **Step 4: Manual checklist**

- [ ] List loads / empty state OK
- [ ] Open a chat detail
- [ ] Search + source filter
- [ ] Favorites star + Favoritos filter
- [ ] Export markdown copies
- [ ] No dependency on repo path when app is moved

- [ ] **Step 5: Cleanup dead Node desktop path**

- Remove `backend` leftovers if any
- Delete or archive `src/server/*.ts` server fns if unused
- Update CI: add `cargo test -p ai-chats-core`
- Optional: drop `better-sqlite3` from runtime deps if nothing else needs it (only after Node providers removed)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: standalone native desktop bundle without Node runtime"
```

---

## Spec coverage checklist

| Spec requirement                      | Task                        |
| ------------------------------------- | --------------------------- |
| `ai-chats-core` workspace             | 1                           |
| Types + paths + camelCase             | 1, 7                        |
| 5 list providers                      | 2–4                         |
| 5 message loaders                     | 5                           |
| Aggregate + timeouts                  | 6                           |
| List filter/sort/page/favorites       | 6                           |
| Tauri `get_chats` / `get_chat_detail` | 8                           |
| No Node in release                    | 8, 11                       |
| Static `frontendDist`                 | 8–9                         |
| SPA + invoke adapter                  | 9                           |
| Export client-side                    | 9 (unchanged markdown util) |
| Favorites localStorage                | 9 (unchanged)               |
| DMG/app bundle                        | 11                          |
| README / launch scripts               | 10                          |
| Tests with fixtures                   | 2–7                         |

## Type/API consistency

- Command args: `{ query: ChatListQuery }` and `{ chatId: String }` — match `desktop-api.ts` invoke payloads.
- `ChatListQuery.page` is `u32` (not optional); frontend always sends `page: number`.
- `get_chats` / `get_chat_detail` names are identical in Rust commands and TS invoke strings.
- `DataPaths` fields are public for fixture injection in tests.

## Execution notes

1. Do **not** run full `tauri build` until Task 11.
2. After heavy compiles, `rm -rf src-tauri/target/debug` to protect the machine.
3. Port parsers line-by-line from TS; use Vitest files as oracle for assertions.
4. If SPA migration of TanStack Start fights you, finishing Router-only SPA (Task 9) is mandatory — do not keep SSR server fns for desktop.
