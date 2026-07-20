use crate::sqlite_util::open_readonly;
use crate::text::{extract_text_from_parts, strip_user_query_tags};
use crate::types::{ChatMessage, ChatMessageRole};
use serde_json::Value;
use std::path::Path;

/// Read Cursor `store.db` blobs and extract user/assistant messages.
pub fn fetch_cursor_messages(store_db_path: &Path) -> Vec<ChatMessage> {
    let db = match open_readonly(store_db_path) {
        Ok(db) => db,
        Err(_) => return Vec::new(),
    };

    let mut stmt = match db.prepare("SELECT id, data FROM blobs") {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let rows = match stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let data: Vec<u8> = row.get(1)?;
        Ok((id, data))
    }) {
        Ok(rows) => rows,
        Err(_) => return Vec::new(),
    };

    let mut messages = Vec::new();
    let mut index: u32 = 0;

    for row in rows.flatten() {
        let (id, data) = row;
        let payload: Value = match serde_json::from_slice(&data) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let role = match payload.get("role").and_then(|v| v.as_str()) {
            Some("user") => ChatMessageRole::User,
            Some("assistant") => ChatMessageRole::Assistant,
            _ => continue,
        };

        let parts = payload
            .get("content")
            .and_then(|v| v.as_array())
            .map(|a| a.as_slice())
            .unwrap_or(&[]);
        let text = strip_user_query_tags(&extract_text_from_parts(parts));
        if text.is_empty() {
            continue;
        }

        let id_prefix: String = id.chars().take(8).collect();
        messages.push(ChatMessage {
            id: format!("cursor-msg-{id_prefix}-{index}"),
            role,
            content: text,
            timestamp: None,
        });
        index += 1;
    }

    messages
}
