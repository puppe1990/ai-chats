use crate::sqlite_util::open_readonly;
use crate::types::{ChatSession, ChatSource};
use chrono::{TimeZone, Utc};
use std::path::Path;

fn ms_to_iso(ms: i64) -> String {
    match Utc.timestamp_millis_opt(ms) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
        _ => Utc
            .timestamp_millis_opt(0)
            .single()
            .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string())
            .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
    }
}

/// Read OpenCode sessions from `opencode.db`. Returns empty on missing/invalid DB.
pub fn fetch_opencode_chats(db_path: &Path) -> Vec<ChatSession> {
    let db = match open_readonly(db_path) {
        Ok(db) => db,
        Err(_) => return Vec::new(),
    };

    let mut stmt = match db.prepare(
        "SELECT id, title, directory, time_created, time_updated, model
         FROM session ORDER BY time_updated DESC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let storage_path = db_path.to_string_lossy().into_owned();
    let rows = match stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let title: Option<String> = row.get(1)?;
        let directory: Option<String> = row.get(2)?;
        let time_created: i64 = row.get(3)?;
        let time_updated: i64 = row.get(4)?;
        let model: Option<String> = row.get(5)?;
        Ok((id, title, directory, time_created, time_updated, model))
    }) {
        Ok(rows) => rows,
        Err(_) => return Vec::new(),
    };

    let mut sessions = Vec::new();
    for row in rows.flatten() {
        let (id, title, directory, time_created, time_updated, model) = row;
        let title = title
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                let prefix: String = id.chars().take(8).collect();
                format!("OpenCode {prefix}")
            });

        sessions.push(ChatSession {
            id: format!("opencode:{id}"),
            source: ChatSource::Opencode,
            title,
            cwd: directory,
            created_at: ms_to_iso(time_created),
            updated_at: ms_to_iso(time_updated),
            message_count: None,
            model,
            storage_path: Some(storage_path.clone()),
        });
    }

    sessions
}
