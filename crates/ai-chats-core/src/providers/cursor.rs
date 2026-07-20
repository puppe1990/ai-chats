use crate::sqlite_util::open_readonly;
use crate::types::{ChatSession, ChatSource};
use chrono::{TimeZone, Utc};
use serde::Deserialize;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CursorMeta {
    agent_id: String,
    name: Option<String>,
    created_at: Option<i64>,
}

fn ms_to_iso(ms: i64) -> String {
    match Utc.timestamp_millis_opt(ms) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
        _ => "1970-01-01T00:00:00.000Z".to_string(),
    }
}

fn system_time_to_iso(t: SystemTime) -> String {
    match t.duration_since(SystemTime::UNIX_EPOCH) {
        Ok(d) => {
            let ms = d.as_millis() as i64;
            ms_to_iso(ms)
        }
        Err(_) => "1970-01-01T00:00:00.000Z".to_string(),
    }
}

fn find_store_dbs(chats_dir: &Path) -> Vec<std::path::PathBuf> {
    let mut results = Vec::new();
    let Ok(workspaces) = fs::read_dir(chats_dir) else {
        return results;
    };

    for ws in workspaces.flatten() {
        let ws_path = ws.path();
        if !ws_path.is_dir() {
            continue;
        }
        let Ok(chats) = fs::read_dir(&ws_path) else {
            continue;
        };
        for chat in chats.flatten() {
            let chat_path = chat.path();
            if !chat_path.is_dir() {
                continue;
            }
            let db_path = chat_path.join("store.db");
            if db_path.is_file() {
                results.push(db_path);
            }
        }
    }

    results
}

fn parse_store_db(db_path: &Path) -> Option<ChatSession> {
    let chat_id = db_path.parent()?.file_name()?.to_string_lossy().into_owned();

    let db = open_readonly(db_path).ok()?;
    let value: String = db
        .query_row("SELECT value FROM meta WHERE key = '0'", [], |row| row.get(0))
        .ok()?;

    let bytes = hex_decode(&value)?;
    let meta: CursorMeta = serde_json::from_slice(&bytes).ok()?;

    let title = meta
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            let prefix: String = meta.agent_id.chars().take(8).collect();
            format!("Cursor {prefix}")
        });

    let created_at = ms_to_iso(meta.created_at.unwrap_or(0));
    let updated_at = fs::metadata(db_path)
        .and_then(|m| m.modified())
        .map(system_time_to_iso)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    Some(ChatSession {
        id: format!("cursor:{chat_id}"),
        source: ChatSource::Cursor,
        title,
        cwd: None,
        created_at,
        updated_at,
        message_count: None,
        model: None,
        storage_path: Some(db_path.to_string_lossy().into_owned()),
    })
}

fn hex_decode(s: &str) -> Option<Vec<u8>> {
    let s = s.trim();
    if s.len() % 2 != 0 {
        return None;
    }
    let mut out = Vec::with_capacity(s.len() / 2);
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let hi = from_hex_digit(bytes[i])?;
        let lo = from_hex_digit(bytes[i + 1])?;
        out.push((hi << 4) | lo);
        i += 2;
    }
    Some(out)
}

fn from_hex_digit(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

/// Walk `chats/*/*/store.db` and map Cursor meta into sessions. Missing dir → [].
pub fn fetch_cursor_chats(chats_dir: &Path) -> Vec<ChatSession> {
    find_store_dbs(chats_dir)
        .into_iter()
        .filter_map(|p| parse_store_db(&p))
        .collect()
}
