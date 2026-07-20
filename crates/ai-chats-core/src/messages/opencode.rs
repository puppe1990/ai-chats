use crate::sqlite_util::open_readonly;
use crate::text::extract_text_from_parts;
use crate::types::{ChatMessage, ChatMessageRole};
use chrono::{TimeZone, Utc};
use serde_json::Value;
use std::path::Path;

fn ms_to_iso(ms: i64) -> String {
    match Utc.timestamp_millis_opt(ms) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
        _ => "1970-01-01T00:00:00.000Z".to_string(),
    }
}

/// Read OpenCode messages + parts for a session id from `opencode.db`.
pub fn fetch_opencode_messages(db_path: &Path, session_id: &str) -> Vec<ChatMessage> {
    let db = match open_readonly(db_path) {
        Ok(db) => db,
        Err(_) => return Vec::new(),
    };

    let mut msg_stmt = match db.prepare(
        "SELECT id, data, time_created
         FROM message
         WHERE session_id = ?
         ORDER BY time_created ASC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let rows = match msg_stmt.query_map([session_id], |row| {
        let id: String = row.get(0)?;
        let data: String = row.get(1)?;
        let time_created: i64 = row.get(2)?;
        Ok((id, data, time_created))
    }) {
        Ok(rows) => rows,
        Err(_) => return Vec::new(),
    };

    let mut parts_stmt = match db.prepare(
        "SELECT data FROM part WHERE message_id = ? ORDER BY time_created ASC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let mut result = Vec::new();

    for row in rows.flatten() {
        let (id, data, time_created) = row;
        let meta: Value = match serde_json::from_str(&data) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let role = match meta.get("role").and_then(|v| v.as_str()) {
            Some("user") => ChatMessageRole::User,
            Some("assistant") => ChatMessageRole::Assistant,
            _ => continue,
        };

        let part_rows = match parts_stmt.query_map([&id], |row| {
            let data: String = row.get(0)?;
            Ok(data)
        }) {
            Ok(rows) => rows,
            Err(_) => continue,
        };

        let mut part_chunks: Vec<Value> = Vec::new();
        for part_row in part_rows.flatten() {
            if let Ok(v) = serde_json::from_str(&part_row) {
                part_chunks.push(v);
            }
        }

        let text = extract_text_from_parts(&part_chunks);
        if text.is_empty() {
            continue;
        }

        let timestamp = meta
            .pointer("/time/created")
            .and_then(|v| v.as_i64())
            .map(ms_to_iso)
            .unwrap_or_else(|| ms_to_iso(time_created));

        result.push(ChatMessage {
            id: format!("opencode-msg-{id}"),
            role,
            content: text,
            timestamp: Some(timestamp),
        });
    }

    result
}
