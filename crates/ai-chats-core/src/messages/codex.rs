use crate::text::extract_text_from_parts;
use crate::types::{ChatMessage, ChatMessageRole};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Parse Codex rollout `.jsonl` into user/assistant chat messages.
pub fn fetch_codex_messages(storage_path: &Path) -> Vec<ChatMessage> {
    // Match TS: storagePath.endsWith('.jsonl')
    if !storage_path.to_string_lossy().ends_with(".jsonl") {
        return Vec::new();
    }

    let content = match fs::read_to_string(storage_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut messages = Vec::new();
    let mut index: u32 = 0;

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let event: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if event.get("type").and_then(|v| v.as_str()) != Some("response_item") {
            continue;
        }

        let payload = match event.get("payload") {
            Some(p) => p,
            None => continue,
        };

        let role = match payload.get("role").and_then(|v| v.as_str()) {
            Some("user") => ChatMessageRole::User,
            Some("assistant") => ChatMessageRole::Assistant,
            _ => continue,
        };

        let text = payload
            .get("content")
            .and_then(|v| v.as_array())
            .map(|a| extract_text_from_parts(a))
            .unwrap_or_default();
        if text.is_empty() {
            continue;
        }

        let timestamp = event
            .get("timestamp")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        messages.push(ChatMessage {
            id: format!("codex-msg-{index}"),
            role,
            content: text,
            timestamp,
        });
        index += 1;
    }

    messages
}

/// Walk `sessions/` and `archived_sessions/` under codex home for a rollout
/// file whose name contains `session_id`.
pub fn find_codex_rollout_by_id(codex_home: &Path, session_id: &str) -> Option<PathBuf> {
    let dirs = [
        codex_home.join("sessions"),
        codex_home.join("archived_sessions"),
    ];

    for dir in &dirs {
        if let Some(found) = walk_for_rollout(dir, session_id) {
            return Some(found);
        }
    }
    None
}

fn walk_for_rollout(dir: &Path, session_id: &str) -> Option<PathBuf> {
    if !dir.is_dir() {
        return None;
    }
    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name.contains(session_id) && name.ends_with(".jsonl") {
            return Some(path.to_path_buf());
        }
    }
    None
}
