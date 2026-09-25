# AI Chats MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local stdio MCP server so agents can find and read coding-agent chats (search metadata → recent list → message-body scan → open session).

**Architecture:** New binary crate `ai-chats-mcp` talks MCP over stdin/stdout via `rmcp` 3.x. Tools call `ai-chats-core` (`get_chats`, `get_chat_detail`, new `search_chat_messages`). Compact JSON lives in the MCP crate so the 20 KB client cap stays intact. Chats stay read-only.

**Tech Stack:** Rust 2021, `ai-chats-core`, `rmcp` 3.4 (`server`, `transport-io`), tokio, serde_json, `cargo test`.

**Spec:** `docs/superpowers/specs/2026-09-24-ai-chats-mcp-design.md`

---

## File Structure

| File                                                                                                      | Responsibility                                       |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Modify `Cargo.toml`                                                                                       | Add workspace member `crates/ai-chats-mcp`           |
| Modify `crates/ai-chats-core/src/list.rs`                                                                 | Export `parse_source_filter`; add `parse_source_arg` |
| Modify `crates/ai-chats-core/src/lib.rs`                                                                  | Reexport list helpers + message search               |
| Modify `crates/ai-chats-core/src/types.rs`                                                                | `MessageSearchQuery` / `Hit` / `Response`            |
| Create `crates/ai-chats-core/src/message_search.rs`                                                       | Snippet + scan + `search_chat_messages`              |
| Create `crates/ai-chats-core/tests/source_arg.rs`                                                         | `parse_source_arg` tests                             |
| Create `crates/ai-chats-core/tests/message_search.rs`                                                     | Scan + fixture search tests                          |
| Create `crates/ai-chats-core/tests/fixtures/grok/sessions/%2Ftest%2Fproject/session-1/chat_history.jsonl` | Grok transcript next to `summary.json`               |
| Create `crates/ai-chats-mcp/Cargo.toml`                                                                   | Binary crate deps                                    |
| Create `crates/ai-chats-mcp/src/compact.rs`                                                               | List/detail JSON + pagination + text cap             |
| Create `crates/ai-chats-mcp/src/handlers.rs`                                                              | Four tool handlers → `Result<Value, String>`         |
| Create `crates/ai-chats-mcp/src/server.rs`                                                                | `rmcp` tools + instructions                          |
| Create `crates/ai-chats-mcp/src/main.rs`                                                                  | stderr tracing + stdio serve                         |
| Modify `.github/workflows/ci.yml`                                                                         | `cargo test -p ai-chats-mcp`                         |
| Modify `README.md`                                                                                        | MCP section + `grok mcp add`                         |
| Modify `AGENTS.md`                                                                                        | MCP run/test commands                                |

---

### Task 1: `parse_source_arg`

**Files:**

- Create: `crates/ai-chats-core/tests/source_arg.rs`
- Modify: `crates/ai-chats-core/src/list.rs` (make `parse_source_filter` public; add `parse_source_arg`)
- Modify: `crates/ai-chats-core/src/lib.rs`

- [ ] **Step 1: Write the failing tests**

`crates/ai-chats-core/tests/source_arg.rs`:

```rust
use ai_chats_core::{parse_source_arg, ChatSource};

#[test]
fn missing_empty_and_all_mean_no_filter() {
    assert_eq!(parse_source_arg(None).unwrap(), None);
    assert_eq!(parse_source_arg(Some("")).unwrap(), None);
    assert_eq!(parse_source_arg(Some("  ")).unwrap(), None);
    assert_eq!(parse_source_arg(Some("all")).unwrap(), None);
}

#[test]
fn known_source_maps_to_enum() {
    assert_eq!(
        parse_source_arg(Some("claude")).unwrap(),
        Some(ChatSource::Claude)
    );
    assert_eq!(
        parse_source_arg(Some("commandcode")).unwrap(),
        Some(ChatSource::CommandCode)
    );
}

#[test]
fn unknown_source_errors_with_received_value() {
    let err = parse_source_arg(Some("windsurf")).unwrap_err();
    assert!(err.contains("windsurf"), "error was {err}");
    assert!(err.contains("cursor"), "error was {err}");
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p ai-chats-core --test source_arg`

Expected: FAIL compiling (`parse_source_arg` not found).

- [ ] **Step 3: Implement**

In `list.rs`, change `fn parse_source_filter` to `pub fn parse_source_filter`. Add:

```rust
pub const SOURCE_KEYS: &str = "cursor, grok, codex, opencode, claude, commandcode";

pub fn parse_source_arg(source: Option<&str>) -> Result<Option<ChatSource>, String> {
    let raw = source.map(str::trim).unwrap_or("");
    if raw.is_empty() || raw.eq_ignore_ascii_case("all") {
        return Ok(None);
    }
    parse_source_filter(raw).map(Some).ok_or_else(|| {
        format!("invalid source: received {raw:?}, expected one of {SOURCE_KEYS}")
    })
}
```

In `lib.rs` add:

```rust
pub use list::{
    build_chat_list_response, parse_source_arg, parse_source_filter, CHAT_PAGE_SIZE, SOURCE_KEYS,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p ai-chats-core --test source_arg`

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add crates/ai-chats-core/src/list.rs crates/ai-chats-core/src/lib.rs crates/ai-chats-core/tests/source_arg.rs
git commit -m "feat: parse optional chat source arg with explicit errors"
```

---

### Task 2: Message search types

**Files:**

- Modify: `crates/ai-chats-core/src/types.rs`
- Modify: `crates/ai-chats-core/tests/serde_camel_case.rs`

- [ ] **Step 1: Write the failing serde test**

Append to `crates/ai-chats-core/tests/serde_camel_case.rs`:

```rust
use ai_chats_core::{MessageSearchHit, MessageSearchResponse};

#[test]
fn message_search_response_serializes_camel_case() {
    let hit = MessageSearchHit {
        chat_id: "claude:abc".into(),
        title: "T".into(),
        source: ChatSource::Claude,
        updated_at: "2026-01-01T00:00:00.000Z".into(),
        message_id: "m1".into(),
        role: ChatMessageRole::User,
        snippet: "hello".into(),
    };
    let response = MessageSearchResponse {
        query: "hello".into(),
        hits: vec![hit],
        chats_scanned: 1,
        truncated: false,
    };
    let v = serde_json::to_value(&response).unwrap();
    assert!(v.get("chatsScanned").is_some());
    assert!(v.get("chatId").is_none());
    assert_eq!(
        v.get("hits")
            .and_then(|h| h.get(0))
            .and_then(|h| h.get("chatId"))
            .and_then(|x| x.as_str()),
        Some("claude:abc")
    );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p ai-chats-core --test serde_camel_case message_search_response_serializes_camel_case`

Expected: FAIL compiling (`MessageSearchHit` not found).

- [ ] **Step 3: Add types**

Append to `crates/ai-chats-core/src/types.rs`:

```rust
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSearchQuery {
    pub query: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub max_chats: Option<u32>,
    #[serde(default)]
    pub max_hits: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSearchHit {
    pub chat_id: String,
    pub title: String,
    pub source: ChatSource,
    pub updated_at: String,
    pub message_id: String,
    pub role: ChatMessageRole,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSearchResponse {
    pub query: String,
    pub hits: Vec<MessageSearchHit>,
    pub chats_scanned: u32,
    pub truncated: bool,
}
```

`lib.rs` already has `pub use types::*;` — no extra export.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p ai-chats-core --test serde_camel_case message_search_response_serializes_camel_case`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/ai-chats-core/src/types.rs crates/ai-chats-core/tests/serde_camel_case.rs
git commit -m "feat: add message search DTO types"
```

---

### Task 3: `snippet_around`

**Files:**

- Create: `crates/ai-chats-core/src/message_search.rs`
- Modify: `crates/ai-chats-core/src/lib.rs`
- Create: `crates/ai-chats-core/tests/message_search.rs` (snippet tests only in this task)

- [ ] **Step 1: Write the failing tests**

`crates/ai-chats-core/tests/message_search.rs`:

```rust
use ai_chats_core::snippet_around;

#[test]
fn snippet_includes_needle_and_collapses_newlines() {
    let hay = "aaa\npath_guard\nbbb";
    let snippet = snippet_around(hay, "PATH_GUARD").expect("hit");
    assert!(snippet.to_lowercase().contains("path_guard"));
    assert!(!snippet.contains('\n'));
}

#[test]
fn snippet_adds_ellipsis_when_clipped() {
    let hay = format!("{}NEEDLE{}", "a".repeat(100), "b".repeat(100));
    let snippet = snippet_around(&hay, "needle").expect("hit");
    assert!(snippet.starts_with('…'));
    assert!(snippet.ends_with('…'));
    assert!(snippet.chars().count() <= 200);
}

#[test]
fn snippet_none_when_missing() {
    assert!(snippet_around("hello", "xyz").is_none());
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p ai-chats-core --test message_search snippet`

Expected: FAIL compiling (`snippet_around` not found).

- [ ] **Step 3: Implement snippet**

`crates/ai-chats-core/src/message_search.rs`:

```rust
use crate::list::{parse_source_arg, SOURCE_KEYS};
use crate::messages::fetch_chat_detail;
use crate::paths::DataPaths;
use crate::types::{
    ChatMessage, ChatSession, MessageSearchError, MessageSearchHit, MessageSearchQuery,
    MessageSearchResponse,
};
use crate::{aggregate_chats, get_chat_detail};
use std::time::{Duration, Instant};

pub const MESSAGE_SEARCH_TIMEOUT_MS: u64 = 8000;
pub const DEFAULT_MAX_CHATS: u32 = 40;
pub const MAX_MAX_CHATS: u32 = 80;
pub const DEFAULT_MAX_HITS: u32 = 10;
pub const MAX_MAX_HITS: u32 = 25;
const SNIPPET_RADIUS: usize = 80;
const SNIPPET_MAX: usize = 200;

pub fn snippet_around(haystack: &str, needle: &str) -> Option<String> {
    let lower = haystack.to_lowercase();
    let needle = needle.to_lowercase();
    let start = lower.find(&needle)?;
    let end = start + needle.len();
    let from = start.saturating_sub(SNIPPET_RADIUS);
    let mut to = (end + SNIPPET_RADIUS).min(haystack.len());
    while to < haystack.len() && !haystack.is_char_boundary(to) {
        to += 1;
    }
    let mut slice = haystack[from..to].replace(['\n', '\r'], " ");
    if from > 0 {
        slice.insert(0, '…');
    }
    if to < haystack.len() {
        slice.push('…');
    }
    if slice.chars().count() > SNIPPET_MAX {
        slice = slice.chars().take(SNIPPET_MAX).collect();
    }
    Some(slice)
}
```

`MessageSearchError` is used later — define it in this file (not `types.rs`) so Task 2 stays DTO-only. Remove it from the `use crate::types` line until Task 4. For this task only export `snippet_around`:

Keep `message_search.rs` to snippet + constants. Drop unused imports in this step (only `snippet_around` + consts). Full file for this step:

```rust
const SNIPPET_RADIUS: usize = 80;
const SNIPPET_MAX: usize = 200;

pub fn snippet_around(haystack: &str, needle: &str) -> Option<String> {
    let lower = haystack.to_lowercase();
    let needle_l = needle.to_lowercase();
    let start = lower.find(&needle_l)?;
    let end = start + needle_l.len();
    let from = start.saturating_sub(SNIPPET_RADIUS);
    let mut to = (end + SNIPPET_RADIUS).min(haystack.len());
    while to < haystack.len() && !haystack.is_char_boundary(to) {
        to += 1;
    }
    let mut from_b = from;
    while from_b > 0 && !haystack.is_char_boundary(from_b) {
        from_b -= 1;
    }
    let mut slice = haystack[from_b..to].replace(['\n', '\r'], " ");
    if from_b > 0 {
        slice.insert(0, '…');
    }
    if to < haystack.len() {
        slice.push('…');
    }
    if slice.chars().count() > SNIPPET_MAX {
        slice = slice.chars().take(SNIPPET_MAX).collect();
    }
    Some(slice)
}
```

`lib.rs`:

```rust
pub mod message_search;
pub use message_search::snippet_around;
```

Keep the existing `pub use` lines.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p ai-chats-core --test message_search snippet`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/ai-chats-core/src/message_search.rs crates/ai-chats-core/src/lib.rs crates/ai-chats-core/tests/message_search.rs
git commit -m "feat: add case-insensitive chat snippet helper"
```

---

### Task 4: `search_chat_messages`

**Files:**

- Modify: `crates/ai-chats-core/src/message_search.rs`
- Modify: `crates/ai-chats-core/src/lib.rs`
- Modify: `crates/ai-chats-core/tests/message_search.rs`
- Create: `crates/ai-chats-core/tests/fixtures/grok/sessions/%2Ftest%2Fproject/session-1/chat_history.jsonl` (copy of `tests/fixtures/messages/grok/chat_history.jsonl`)

- [ ] **Step 1: Copy Grok transcript into the session fixture**

```bash
cp crates/ai-chats-core/tests/fixtures/messages/grok/chat_history.jsonl \
  "crates/ai-chats-core/tests/fixtures/grok/sessions/%2Ftest%2Fproject/session-1/chat_history.jsonl"
```

- [ ] **Step 2: Write the failing search tests**

Append to `crates/ai-chats-core/tests/message_search.rs`:

```rust
use ai_chats_core::{
    scan_chat_messages, search_chat_messages, ChatMessage, ChatMessageRole, ChatSession,
    ChatSource, DataPaths, MessageSearchError, MessageSearchQuery,
};
use std::path::PathBuf;
use std::time::{Duration, Instant};

fn missing() -> PathBuf {
    PathBuf::from("/tmp/ai-chats-missing-provider-root")
}

fn fixture_paths() -> DataPaths {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    DataPaths {
        cursor_home: missing(),
        grok_home: root.join("grok"),
        codex_home: missing(),
        opencode_data_dir: missing(),
        claude_home: root.join("claude"),
        commandcode_home: missing(),
    }
}

fn session(id: &str, source: ChatSource) -> ChatSession {
    ChatSession {
        id: id.into(),
        source,
        title: id.into(),
        cwd: None,
        created_at: "2026-01-01T00:00:00.000Z".into(),
        updated_at: "2026-01-01T00:00:00.000Z".into(),
        message_count: None,
        model: None,
        storage_path: None,
    }
}

fn msg(id: &str, content: &str) -> ChatMessage {
    ChatMessage {
        id: id.into(),
        role: ChatMessageRole::User,
        content: content.into(),
        timestamp: None,
    }
}

#[test]
fn empty_query_is_an_error_with_received_value() {
    let err = search_chat_messages(
        MessageSearchQuery {
            query: "   ".into(),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .unwrap_err();
    match err {
        MessageSearchError::EmptyQuery { received } => assert_eq!(received, "   "),
        other => panic!("unexpected {other:?}"),
    }
}

#[test]
fn finds_claude_fixture_message() {
    let result = search_chat_messages(
        MessageSearchQuery {
            query: "TanStack".into(),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .expect("search");
    assert_eq!(result.hits.len(), 1);
    assert_eq!(
        result.hits[0].chat_id,
        "claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c"
    );
    assert_eq!(result.hits[0].role, ChatMessageRole::User);
    assert!(result.hits[0].snippet.contains("TanStack"));
}

#[test]
fn source_filter_skips_other_providers() {
    let result = search_chat_messages(
        MessageSearchQuery {
            query: "TanStack".into(),
            source: Some("grok".into()),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .expect("search");
    assert!(result.hits.is_empty());
}

#[test]
fn max_hits_stops_early() {
    let chats = vec![session("claude:1", ChatSource::Claude)];
    let (hits, scanned, _truncated) = scan_chat_messages(
        &chats,
        "hit",
        40,
        1,
        Instant::now() + Duration::from_secs(8),
        |_| vec![msg("a", "hit one"), msg("b", "hit two")],
    );
    assert_eq!(hits.len(), 1);
    assert_eq!(scanned, 1);
}

#[test]
fn max_chats_sets_truncated() {
    let chats = vec![
        session("claude:1", ChatSource::Claude),
        session("claude:2", ChatSource::Claude),
    ];
    let (_hits, scanned, truncated) = scan_chat_messages(
        &chats,
        "nope",
        1,
        10,
        Instant::now() + Duration::from_secs(8),
        |_| vec![msg("a", "nothing")],
    );
    assert_eq!(scanned, 1);
    assert!(truncated);
}

#[test]
fn no_match_returns_empty_hits() {
    let result = search_chat_messages(
        MessageSearchQuery {
            query: "zzzz-not-in-fixtures".into(),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .expect("search");
    assert!(result.hits.is_empty());
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test -p ai-chats-core --test message_search`

Expected: FAIL compiling (`search_chat_messages` / `MessageSearchError` not found).

- [ ] **Step 4: Implement scan + search**

Add to `message_search.rs` (keep `snippet_around`):

```rust
use crate::list::parse_source_arg;
use crate::messages::fetch_chat_detail;
use crate::paths::DataPaths;
use crate::types::{
    ChatMessage, ChatSession, MessageSearchHit, MessageSearchQuery, MessageSearchResponse,
};
use crate::aggregate_chats;
use std::time::{Duration, Instant};

pub const MESSAGE_SEARCH_TIMEOUT_MS: u64 = 8000;
pub const DEFAULT_MAX_CHATS: u32 = 40;
pub const MAX_MAX_CHATS: u32 = 80;
pub const DEFAULT_MAX_HITS: u32 = 10;
pub const MAX_MAX_HITS: u32 = 25;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MessageSearchError {
    EmptyQuery { received: String },
    InvalidSource { received: String },
}

impl std::fmt::Display for MessageSearchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyQuery { received } => write!(
                f,
                "empty query: received {received:?}, expected a non-empty search string"
            ),
            Self::InvalidSource { received } => write!(
                f,
                "invalid source: received {received:?}, expected one of {}",
                crate::SOURCE_KEYS
            ),
        }
    }
}

impl std::error::Error for MessageSearchError {}

fn clamp(value: Option<u32>, default: u32, max: u32) -> u32 {
    match value {
        Some(0) | None => default,
        Some(n) => n.min(max).max(1),
    }
}

pub fn scan_chat_messages<F>(
    chats: &[ChatSession],
    needle: &str,
    max_chats: u32,
    max_hits: u32,
    deadline: Instant,
    mut load_messages: F,
) -> (Vec<MessageSearchHit>, u32, bool)
where
    F: FnMut(&ChatSession) -> Vec<ChatMessage>,
{
    let mut hits = Vec::new();
    let mut scanned = 0u32;
    let cap = max_chats.min(chats.len() as u32);
    for chat in chats.iter().take(cap as usize) {
        if Instant::now() >= deadline {
            return (hits, scanned, true);
        }
        scanned += 1;
        for message in load_messages(chat) {
            let Some(snippet) = snippet_around(&message.content, needle) else {
                continue;
            };
            hits.push(MessageSearchHit {
                chat_id: chat.id.clone(),
                title: chat.title.clone(),
                source: chat.source,
                updated_at: chat.updated_at.clone(),
                message_id: message.id,
                role: message.role,
                snippet,
            });
            if hits.len() as u32 >= max_hits {
                let truncated = scanned < chats.len() as u32 || Instant::now() >= deadline;
                return (hits, scanned, truncated);
            }
        }
    }
    let truncated = scanned < chats.len() as u32;
    (hits, scanned, truncated)
}

pub fn search_chat_messages(
    query: MessageSearchQuery,
    paths: &DataPaths,
) -> Result<MessageSearchResponse, MessageSearchError> {
    let received = query.query.clone();
    let needle = query.query.trim().to_lowercase();
    if needle.is_empty() {
        return Err(MessageSearchError::EmptyQuery { received });
    }
    let source_filter = require_source(query.source)?;
    let max_chats = clamp(query.max_chats, DEFAULT_MAX_CHATS, MAX_MAX_CHATS);
    let max_hits = clamp(query.max_hits, DEFAULT_MAX_HITS, MAX_MAX_HITS);
    let mut chats = aggregate_chats(paths);
    if let Some(want) = source_filter {
        chats.retain(|c| c.source == want);
    }
    let deadline = Instant::now() + Duration::from_millis(MESSAGE_SEARCH_TIMEOUT_MS);
    let (hits, chats_scanned, truncated) = scan_chat_messages(
        &chats,
        &needle,
        max_chats,
        max_hits,
        deadline,
        |session| {
            fetch_chat_detail(&session.id, session, paths)
                .map(|d| d.messages)
                .unwrap_or_default()
        },
    );
    Ok(MessageSearchResponse {
        query: received,
        hits,
        chats_scanned,
        truncated,
    })
}

fn require_source(
    source: Option<String>,
) -> Result<Option<crate::ChatSource>, MessageSearchError> {
    parse_source_arg(source.as_deref()).map_err(|_| MessageSearchError::InvalidSource {
        received: source.unwrap_or_default(),
    })
}
```

Split `search_chat_messages` further if it exceeds ~20 lines.

`lib.rs` add:

```rust
pub use message_search::{
    scan_chat_messages, search_chat_messages, snippet_around, MessageSearchError,
    DEFAULT_MAX_CHATS, DEFAULT_MAX_HITS, MESSAGE_SEARCH_TIMEOUT_MS,
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test -p ai-chats-core --test message_search`

Expected: PASS. Also run `cargo test -p ai-chats-core` — existing grok_list still passes with the extra `chat_history.jsonl`.

- [ ] **Step 6: `cargo fmt` and commit**

```bash
cargo fmt
git add crates/ai-chats-core/src/message_search.rs crates/ai-chats-core/src/lib.rs \
  crates/ai-chats-core/tests/message_search.rs \
  "crates/ai-chats-core/tests/fixtures/grok/sessions/%2Ftest%2Fproject/session-1/chat_history.jsonl"
git commit -m "feat: search chat message bodies with caps and timeout"
```

---

### Task 5: MCP crate + `compact`

**Files:**

- Modify: `Cargo.toml` (workspace members)
- Create: `crates/ai-chats-mcp/Cargo.toml`
- Create: `crates/ai-chats-mcp/src/compact.rs`
- Create: `crates/ai-chats-mcp/src/main.rs` (stub `mod compact;` so the lib-less binary compiles; real main in Task 7)

- [ ] **Step 1: Add the crate (config; no behavior yet)**

Workspace `Cargo.toml` members:

```toml
members = [
  "crates/ai-chats-core",
  "crates/ai-chats-mcp",
  "src-tauri",
]
```

`crates/ai-chats-mcp/Cargo.toml`:

```toml
[package]
name = "ai-chats-mcp"
version = "0.1.0"
edition = "2021"
license = "MIT"
description = "stdio MCP server for searching local AI coding-agent chats"

[[bin]]
name = "ai-chats-mcp"
path = "src/main.rs"

[dependencies]
ai-chats-core = { path = "../ai-chats-core" }
rmcp = { version = "3.4", features = ["server", "transport-io"] }
tokio = { version = "1", features = ["macros", "rt-multi-thread", "io-std", "sync"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

Temporary `src/main.rs`:

```rust
mod compact;

fn main() {
    eprintln!("ai-chats-mcp stub");
}
```

- [ ] **Step 2: Write failing compact tests** at the bottom of `compact.rs` under `#[cfg(test)]`.

`crates/ai-chats-mcp/src/compact.rs` tests (write these first; module fns come in step 4):

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use ai_chats_core::{ChatDetail, ChatMessage, ChatMessageRole, ChatSession, ChatSource};

    fn session() -> ChatSession {
        ChatSession {
            id: "grok:1".into(),
            source: ChatSource::Grok,
            title: "T".into(),
            cwd: Some("/x".into()),
            created_at: "2026-01-01T00:00:00.000Z".into(),
            updated_at: "2026-01-01T00:00:00.000Z".into(),
            message_count: Some(2),
            model: Some("m".into()),
            storage_path: Some("/secret".into()),
        }
    }

    fn message(content: &str) -> ChatMessage {
        ChatMessage {
            id: "1".into(),
            role: ChatMessageRole::User,
            content: content.into(),
            timestamp: None,
        }
    }

    #[test]
    fn list_item_omits_storage_path() {
        let v = compact_session(&session());
        assert!(v.get("storagePath").is_none());
        assert_eq!(v.get("id").and_then(|x| x.as_str()), Some("grok:1"));
        assert_eq!(v.get("cwd").and_then(|x| x.as_str()), Some("/x"));
    }

    #[test]
    fn paginate_sets_has_more() {
        let detail = ChatDetail {
            session: session(),
            messages: vec![message("a"), message("b"), message("c")],
        };
        let page = paginate_detail(&detail, 0, 2);
        assert_eq!(page.messages.len(), 2);
        assert_eq!(page.total_messages, 3);
        assert!(page.has_more);
        assert_eq!(page.offset, 0);
        assert_eq!(page.limit, 2);
    }

    #[test]
    fn content_over_2000_is_flagged() {
        let long = "x".repeat(2001);
        let detail = ChatDetail {
            session: session(),
            messages: vec![message(&long)],
        };
        let page = paginate_detail(&detail, 0, 20);
        assert!(page.messages[0].content_truncated);
        assert_eq!(page.messages[0].content.len(), 2000);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test -p ai-chats-mcp`

Expected: FAIL compiling (`compact_session` not found).

- [ ] **Step 4: Implement compact**

```rust
use ai_chats_core::{ChatDetail, ChatListResponse, ChatMessage, ChatSession};
use serde::Serialize;
use serde_json::{json, Value};

pub const MESSAGE_CONTENT_CAP: usize = 2000;
pub const DEFAULT_GET_CHAT_LIMIT: u32 = 20;
pub const MAX_GET_CHAT_LIMIT: u32 = 40;
pub const DEFAULT_SEARCH_PAGE_SIZE: u32 = 10;
pub const MAX_PAGE_SIZE: u32 = 50;
pub const DEFAULT_RECENT_LIMIT: u32 = 15;

pub fn clamp_limit(value: Option<u32>, default: u32, max: u32) -> u32 {
    match value {
        Some(0) | None => default,
        Some(n) => n.min(max).max(1),
    }
}

pub fn compact_session(session: &ChatSession) -> Value {
    let mut v = json!({
        "id": session.id,
        "source": session.source,
        "title": session.title,
        "updatedAt": session.updated_at,
    });
    let obj = v.as_object_mut().expect("object");
    if let Some(cwd) = &session.cwd {
        obj.insert("cwd".into(), json!(cwd));
    }
    if let Some(count) = session.message_count {
        obj.insert("messageCount".into(), json!(count));
    }
    if let Some(model) = &session.model {
        obj.insert("model".into(), json!(model));
    }
    v
}

pub fn compact_list(response: &ChatListResponse) -> Value {
    json!({
        "page": response.page,
        "pageSize": response.page_size,
        "totalItems": response.total_items,
        "hasNextPage": response.has_next_page,
        "items": response.items.iter().map(compact_session).collect::<Vec<_>>(),
    })
}

pub fn compact_recent(response: &ChatListResponse) -> Value {
    json!({
        "totalItems": response.total_items,
        "items": response.items.iter().map(compact_session).collect::<Vec<_>>(),
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactChatMessage {
    pub id: String,
    pub role: ai_chats_core::ChatMessageRole,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    pub content_truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactChatPage {
    pub session: Value,
    pub messages: Vec<CompactChatMessage>,
    pub offset: u32,
    pub limit: u32,
    pub total_messages: u32,
    pub has_more: bool,
}

fn cap_message(message: &ChatMessage) -> CompactChatMessage {
    let char_count = message.content.chars().count();
    let truncated = char_count > MESSAGE_CONTENT_CAP;
    let content = if truncated {
        message.content.chars().take(MESSAGE_CONTENT_CAP).collect()
    } else {
        message.content.clone()
    };
    CompactChatMessage {
        id: message.id.clone(),
        role: message.role,
        content,
        timestamp: message.timestamp.clone(),
        content_truncated: truncated,
    }
}

pub fn paginate_detail(detail: &ChatDetail, offset: u32, limit: u32) -> CompactChatPage {
    let total = detail.messages.len() as u32;
    let start = (offset as usize).min(detail.messages.len());
    let end = (start + limit as usize).min(detail.messages.len());
    CompactChatPage {
        session: compact_session(&detail.session),
        messages: detail.messages[start..end].iter().map(cap_message).collect(),
        offset,
        limit,
        total_messages: total,
        has_more: end < detail.messages.len(),
    }
}
```

Split `compact.rs` if it grows past ~200 lines (`compact_list.rs` / `compact_detail.rs`). Prefer keeping it one file if it stays under 200.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test -p ai-chats-mcp`

Expected: PASS (3 tests). `cargo fmt`.

- [ ] **Step 6: Commit**

```bash
git add Cargo.toml crates/ai-chats-mcp Cargo.lock
git commit -m "feat: add ai-chats-mcp crate with compact JSON helpers"
```

---

### Task 6: Tool handlers

**Files:**

- Create: `crates/ai-chats-mcp/src/handlers.rs`
- Modify: `crates/ai-chats-mcp/src/main.rs` (`mod handlers;`)

Handlers return `Result<Value, String>` so tests avoid the MCP protocol. Invalid source, empty query, and missing chat_id are `Err(String)` with received value + expected shape.

- [ ] **Step 1: Write failing handler tests** in `handlers.rs` `#[cfg(test)]`.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use ai_chats_core::DataPaths;
    use std::path::PathBuf;

    fn fixture_paths() -> DataPaths {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../ai-chats-core/tests/fixtures");
        DataPaths {
            cursor_home: PathBuf::from("/tmp/ai-chats-missing-provider-root"),
            grok_home: root.join("grok"),
            codex_home: PathBuf::from("/tmp/ai-chats-missing-provider-root"),
            opencode_data_dir: PathBuf::from("/tmp/ai-chats-missing-provider-root"),
            claude_home: root.join("claude"),
            commandcode_home: PathBuf::from("/tmp/ai-chats-missing-provider-root"),
        }
    }

    #[test]
    fn search_chats_finds_claude_title() {
        let v = handle_search_chats(
            &fixture_paths(),
            SearchChatsParams {
                query: Some("TanStack".into()),
                source: None,
                page: None,
                page_size: None,
            },
        )
        .expect("ok");
        let items = v.get("items").and_then(|x| x.as_array()).cloned().unwrap();
        assert_eq!(items.len(), 1);
        assert!(v.get("counts").is_none());
    }

    #[test]
    fn search_chats_rejects_unknown_source() {
        let err = handle_search_chats(
            &fixture_paths(),
            SearchChatsParams {
                query: None,
                source: Some("windsurf".into()),
                page: None,
                page_size: None,
            },
        )
        .unwrap_err();
        assert!(err.contains("windsurf"));
    }

    #[test]
    fn list_recent_returns_items() {
        let v = handle_list_recent(
            &fixture_paths(),
            ListRecentParams {
                source: None,
                limit: Some(10),
            },
        )
        .expect("ok");
        assert!(v.get("totalItems").is_some());
        assert!(v.get("items").is_some());
        assert!(v.get("page").is_none());
    }

    #[test]
    fn get_chat_missing_id_errors() {
        let err = handle_get_chat(
            &fixture_paths(),
            GetChatParams {
                chat_id: "grok:does-not-exist".into(),
                offset: None,
                limit: None,
            },
        )
        .unwrap_err();
        assert!(err.contains("grok:does-not-exist"));
        assert!(err.contains("source:sessionId"));
    }

    #[test]
    fn get_chat_returns_page() {
        let v = handle_get_chat(
            &fixture_paths(),
            GetChatParams {
                chat_id: "claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c".into(),
                offset: Some(0),
                limit: Some(2),
            },
        )
        .expect("ok");
        assert_eq!(v.get("hasMore").and_then(|x| x.as_bool()), Some(true));
        assert_eq!(v.get("totalMessages").and_then(|x| x.as_u64()), Some(3));
    }

    #[test]
    fn search_messages_last_resort_finds_body() {
        let v = handle_search_messages(
            &fixture_paths(),
            SearchMessagesParams {
                query: "TanStack".into(),
                source: None,
                max_chats: None,
                max_hits: None,
            },
        )
        .expect("ok");
        let hits = v.get("hits").and_then(|x| x.as_array()).cloned().unwrap();
        assert_eq!(hits.len(), 1);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p ai-chats-mcp`

Expected: FAIL compiling (`handle_search_chats` not found).

- [ ] **Step 3: Implement handlers**

```rust
use crate::compact::{
    clamp_limit, compact_list, compact_recent, paginate_detail, DEFAULT_GET_CHAT_LIMIT,
    DEFAULT_RECENT_LIMIT, DEFAULT_SEARCH_PAGE_SIZE, MAX_GET_CHAT_LIMIT, MAX_PAGE_SIZE,
};
use ai_chats_core::{
    get_chat_detail, get_chats, parse_source_arg, search_chat_messages, ChatListQuery, DataPaths,
    MessageSearchQuery,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct SearchChatsParams {
    pub query: Option<String>,
    pub source: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct ListRecentParams {
    pub source: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SearchMessagesParams {
    pub query: String,
    pub source: Option<String>,
    pub max_chats: Option<u32>,
    pub max_hits: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct GetChatParams {
    pub chat_id: String,
    pub offset: Option<u32>,
    pub limit: Option<u32>,
}

fn require_source(source: Option<String>) -> Result<Option<String>, String> {
    parse_source_arg(source.as_deref())?;
    Ok(source)
}

pub fn handle_search_chats(
    paths: &DataPaths,
    params: SearchChatsParams,
) -> Result<Value, String> {
    let source = require_source(params.source)?;
    let page = params.page.unwrap_or(1).max(1);
    let page_size = clamp_limit(params.page_size, DEFAULT_SEARCH_PAGE_SIZE, MAX_PAGE_SIZE);
    let response = get_chats(
        ChatListQuery {
            page,
            page_size: Some(page_size),
            source,
            query: params.query,
            ..Default::default()
        },
        paths,
    );
    Ok(compact_list(&response))
}

pub fn handle_list_recent(paths: &DataPaths, params: ListRecentParams) -> Result<Value, String> {
    let source = require_source(params.source)?;
    let limit = clamp_limit(params.limit, DEFAULT_RECENT_LIMIT, MAX_PAGE_SIZE);
    let response = get_chats(
        ChatListQuery {
            page: 1,
            page_size: Some(limit),
            source,
            query: None,
            ..Default::default()
        },
        paths,
    );
    Ok(compact_recent(&response))
}

pub fn handle_search_messages(
    paths: &DataPaths,
    params: SearchMessagesParams,
) -> Result<Value, String> {
    let result = search_chat_messages(
        MessageSearchQuery {
            query: params.query,
            source: params.source,
            max_chats: params.max_chats,
            max_hits: params.max_hits,
        },
        paths,
    )
    .map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(result).expect("serialize"))
}

pub fn handle_get_chat(paths: &DataPaths, params: GetChatParams) -> Result<Value, String> {
    let detail = get_chat_detail(&params.chat_id, paths).ok_or_else(|| {
        format!(
            "chat not found: received {:?}, expected an id from search_chats or list_recent_chats (format source:sessionId)",
            params.chat_id
        )
    })?;
    let limit = clamp_limit(params.limit, DEFAULT_GET_CHAT_LIMIT, MAX_GET_CHAT_LIMIT);
    let offset = params.offset.unwrap_or(0);
    let page = paginate_detail(&detail, offset, limit);
    Ok(serde_json::to_value(page).expect("serialize"))
}
```

`main.rs` add `mod handlers;` next to `mod compact;`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p ai-chats-mcp`

Expected: PASS (compact + 6 handler tests).

- [ ] **Step 5: Commit**

```bash
git add crates/ai-chats-mcp/src/handlers.rs crates/ai-chats-mcp/src/main.rs
git commit -m "feat: add MCP chat search handlers"
```

---

### Task 7: stdio MCP server

**Files:**

- Create: `crates/ai-chats-mcp/src/server.rs`
- Modify: `crates/ai-chats-mcp/src/main.rs`

rmcp 3.4 `get_info` returns `ServerConfig`. Tool failures that the model should read use `CallToolResult::error`, not `Err(ErrorData)`.

If `#[tool_router]` requires a `tool_router: ToolRouter<Self>` field, add it. If `ServerConfig::new` / `with_instructions` names differ, match `docs.rs/rmcp/3.4`.

- [ ] **Step 1: Write `server.rs`**

```rust
use crate::handlers::{
    handle_get_chat, handle_list_recent, handle_search_chats, handle_search_messages,
    GetChatParams, ListRecentParams, SearchChatsParams, SearchMessagesParams,
};
use ai_chats_core::DataPaths;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ContentBlock, ServerCapabilities, ServerConfig};
use rmcp::service::ServerHandler;
use rmcp::{tool, tool_handler, tool_router};

const INSTRUCTIONS: &str = "Find coding-agent chats on this machine (Cursor, Grok, Codex, OpenCode, Claude Code, Command Code). Call search_chats first (title, working directory, source, model). If that misses, call list_recent_chats. Call search_chat_messages only when the topic is likely inside message bodies and the first two tools failed. Then call get_chat with a chatId from those results.";

#[derive(Clone)]
pub struct AiChatsMcp {
    paths: DataPaths,
}

impl AiChatsMcp {
    pub fn from_env() -> Self {
        Self {
            paths: DataPaths::from_env(),
        }
    }
}

fn json_ok(value: serde_json::Value) -> CallToolResult {
    CallToolResult::success(vec![ContentBlock::text(
        serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string()),
    )])
}

fn json_err(message: String) -> CallToolResult {
    CallToolResult::error(vec![ContentBlock::text(message)])
}

fn run_blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> T {
    tokio::task::block_in_place(f)
}

#[tool_router]
impl AiChatsMcp {
    #[tool(
        description = "Search chats by title, working directory, source, or model. Use this first."
    )]
    async fn search_chats(
        &self,
        Parameters(params): Parameters<SearchChatsParams>,
    ) -> CallToolResult {
        let paths = self.paths.clone();
        match run_blocking(move || handle_search_chats(&paths, params)) {
            Ok(v) => json_ok(v),
            Err(e) => json_err(e),
        }
    }

    #[tool(
        description = "List the most recently updated chats. Use after search_chats if it missed."
    )]
    async fn list_recent_chats(
        &self,
        Parameters(params): Parameters<ListRecentParams>,
    ) -> CallToolResult {
        let paths = self.paths.clone();
        match run_blocking(move || handle_list_recent(&paths, params)) {
            Ok(v) => json_ok(v),
            Err(e) => json_err(e),
        }
    }

    #[tool(
        description = "Search inside message bodies. Use only after search_chats and list_recent_chats did not find the conversation."
    )]
    async fn search_chat_messages(
        &self,
        Parameters(params): Parameters<SearchMessagesParams>,
    ) -> CallToolResult {
        let paths = self.paths.clone();
        match run_blocking(move || handle_search_messages(&paths, params)) {
            Ok(v) => json_ok(v),
            Err(e) => json_err(e),
        }
    }

    #[tool(description = "Open a chat transcript by id from search_chats, list_recent_chats, or search_chat_messages.")]
    async fn get_chat(&self, Parameters(params): Parameters<GetChatParams>) -> CallToolResult {
        let paths = self.paths.clone();
        match run_blocking(move || handle_get_chat(&paths, params)) {
            Ok(v) => json_ok(v),
            Err(e) => json_err(e),
        }
    }
}

#[tool_handler]
impl ServerHandler for AiChatsMcp {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions(INSTRUCTIONS)
    }
}
```

Param structs must implement `JsonSchema`. Add to each handler params struct:

```rust
#[derive(Debug, Deserialize, rmcp::schemars::JsonSchema)]
```

If `block_in_place` needs the tokio `rt-multi-thread` feature (already in Cargo.toml), keep it. Prefer `tokio::task::spawn_blocking` + `.await` inside the `async fn` tools instead of `block_in_place`:

```rust
let paths = self.paths.clone();
let result = tokio::task::spawn_blocking(move || handle_search_chats(&paths, params))
    .await
    .unwrap_or_else(|e| Err(format!("worker join failed: {e}")));
```

Use `spawn_blocking`. Add tokio feature `rt-multi-thread` only (already listed).

- [ ] **Step 2: Replace stub `main.rs`**

```rust
mod compact;
mod handlers;
mod server;

use rmcp::ServiceExt;
use rmcp::transport::stdio;
use server::AiChatsMcp;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .with_ansi(false)
        .init();

    let service = AiChatsMcp::from_env()
        .serve(stdio())
        .await
        .inspect_err(|e| tracing::error!("serve failed: {e:?}"))?;
    service.waiting().await?;
    Ok(())
}
```

- [ ] **Step 3: Derive JsonSchema on param structs**

In `handlers.rs`, add `rmcp::schemars::JsonSchema` to the four param structs. If the crate needs the `schemars` rmcp feature explicitly, add it to `Cargo.toml` (`features = ["server", "transport-io"]` already pulls schemars via `server`).

- [ ] **Step 4: Compile and test**

Run:

```
cargo test -p ai-chats-core
cargo test -p ai-chats-mcp
cargo build -p ai-chats-mcp
```

Expected: all tests PASS; binary builds. Fix `tool_router` field / `ServerConfig` API against compiler errors — do not change handler behavior.

If `ContentBlock::text` does not exist, use `rmcp::model::Content::text` (or the 3.4 equivalent) for a single text block.

- [ ] **Step 5: Commit**

```bash
git add crates/ai-chats-mcp/src/server.rs crates/ai-chats-mcp/src/main.rs crates/ai-chats-mcp/src/handlers.rs crates/ai-chats-mcp/Cargo.toml Cargo.lock
git commit -m "feat: serve AI Chats search tools over MCP stdio"
```

---

### Task 8: CI, README, AGENTS.md

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: CI**

After the existing `cargo test -p ai-chats-core` step, add:

```yaml
- name: Tests (Rust ai-chats-mcp)
  run: cargo test -p ai-chats-mcp
```

Extend cargo cache `workspaces` with `crates/ai-chats-mcp`.

- [ ] **Step 2: AGENTS.md commands**

Under `## Commands (one-shot)` add:

```
- Tests (Rust MCP): `cargo test -p ai-chats-mcp`
- MCP server: `cargo run -q -p ai-chats-mcp` (stdio; logs on stderr)
```

Under Structure, mention `crates/ai-chats-mcp`.

- [ ] **Step 3: README section** (after Architecture)

````markdown
## MCP server

Local stdio MCP so Grok, Cursor, or Claude can search the same chats as this app.

Tools, in order: `search_chats` (title / cwd / source / model) → `list_recent_chats` → `search_chat_messages` (message bodies, last resort) → `get_chat`.

```bash
cargo build -p ai-chats-mcp --release
grok mcp add ai-chats -- "$PWD/target/release/ai-chats-mcp"
```
````

Dev from this clone:

```bash
cargo run -q -p ai-chats-mcp
```

Same path env vars as the app (`GROK_HOME`, `CLAUDE_HOME`, …). Chat data stays read-only. This does not write your user `~/.grok/config.toml` for you.

```

- [ ] **Step 4: Format and full verification**

```

cargo fmt
cargo test -p ai-chats-core
cargo test -p ai-chats-mcp
npm test

````

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml README.md AGENTS.md
git commit -m "docs: document AI Chats MCP server and test it in CI"
````

---

## Self-review

**Spec coverage**

| Spec item                                            | Task             |
| ---------------------------------------------------- | ---------------- |
| stdio `rmcp` crate                                   | 5, 7             |
| `search_chats`                                       | 6, 7             |
| `list_recent_chats`                                  | 6, 7             |
| `search_chat_messages` last-resort description       | 4, 6, 7          |
| `get_chat` pagination + 2000-char cap                | 5, 6             |
| A → C → B instructions                               | 7                |
| `parse_source_filter` export + invalid source errors | 1, 6             |
| 8s timeout / max_chats / max_hits                    | 4                |
| snippet 80/200                                       | 3                |
| compact list without counts                          | 5, 6             |
| stderr logs                                          | 7                |
| no skills / no HTTP / no auto-install                | 8 documents only |
| CI `cargo test -p ai-chats-mcp`                      | 8                |
| README `grok mcp add`                                | 8                |

**Placeholders:** none. Task 7 says “match docs.rs if `ServerConfig` names differ” because rmcp 3.4 `ServerConfig` helpers are the one compile-time unknown; handler contracts stay fixed.

**Types:** `MessageSearchQuery` / `Hit` / `Response`, `MessageSearchError`, four `*Params` structs, `CompactChatPage` — names match across tasks.
