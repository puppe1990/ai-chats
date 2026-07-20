pub mod claude;
pub mod codex;
pub mod cursor;
pub mod grok;
pub mod opencode;

use crate::paths::DataPaths;
use crate::types::{ChatDetail, ChatMessage, ChatSession, ChatSource};
use std::path::Path;

pub use claude::fetch_claude_messages;
pub use codex::{fetch_codex_messages, find_codex_rollout_by_id};
pub use cursor::fetch_cursor_messages;
pub use grok::fetch_grok_messages;
pub use opencode::fetch_opencode_messages;

fn parse_chat_id(chat_id: &str) -> Option<(&str, &str)> {
    let idx = chat_id.find(':')?;
    Some((&chat_id[..idx], &chat_id[idx + 1..]))
}

fn source_str(source: ChatSource) -> &'static str {
    match source {
        ChatSource::Cursor => "cursor",
        ChatSource::Grok => "grok",
        ChatSource::Codex => "codex",
        ChatSource::Opencode => "opencode",
        ChatSource::Claude => "claude",
    }
}

fn load_messages(session: &ChatSession, paths: &DataPaths) -> Vec<ChatMessage> {
    let storage_path = match session.storage_path.as_deref() {
        Some(p) => p,
        None => return Vec::new(),
    };
    let storage = Path::new(storage_path);

    match session.source {
        ChatSource::Codex => {
            let mut rollout_path = storage_path.to_string();
            if !rollout_path.ends_with(".jsonl") {
                let raw_id = session.id.strip_prefix("codex:").unwrap_or(&session.id);
                rollout_path = match find_codex_rollout_by_id(&paths.codex_home, raw_id) {
                    Some(p) => p.to_string_lossy().into_owned(),
                    None => return Vec::new(),
                };
            }
            fetch_codex_messages(Path::new(&rollout_path))
        }
        ChatSource::Grok => fetch_grok_messages(storage),
        ChatSource::Cursor => fetch_cursor_messages(storage),
        ChatSource::Opencode => {
            let raw_id = session.id.strip_prefix("opencode:").unwrap_or(&session.id);
            fetch_opencode_messages(storage, raw_id)
        }
        ChatSource::Claude => fetch_claude_messages(storage),
    }
}

/// Load chat detail for `chat_id` when it matches `session`.
/// Returns `None` on id/source mismatch.
pub fn fetch_chat_detail(
    chat_id: &str,
    session: &ChatSession,
    paths: &DataPaths,
) -> Option<ChatDetail> {
    let (source, _raw_id) = parse_chat_id(chat_id)?;
    if source != source_str(session.source) || session.id != chat_id {
        return None;
    }

    let messages = load_messages(session, paths);
    Some(ChatDetail {
        session: session.clone(),
        messages,
    })
}
