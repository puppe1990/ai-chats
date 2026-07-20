use crate::text::extract_text_from_parts;
use crate::types::{ChatSession, ChatSource};
use chrono::{DateTime, TimeZone, Utc};
use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

const EPOCH_ISO: &str = "1970-01-01T00:00:00.000Z";

#[derive(Debug, Clone)]
struct ClaudeHistoryEntry {
    display: Option<String>,
    timestamp: Option<f64>,
    project: Option<String>,
}

struct SessionMeta {
    cwd: Option<String>,
    created_at: Option<String>,
    model: Option<String>,
    message_count: u32,
    title: Option<String>,
}

fn uuid_jsonl_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$")
            .expect("uuid jsonl regex")
    })
}

fn parse_user_content(content: &Value) -> String {
    if let Some(s) = content.as_str() {
        return s.trim().to_string();
    }
    if let Some(arr) = content.as_array() {
        return extract_text_from_parts(arr);
    }
    String::new()
}

fn is_slash_command(display: &str) -> bool {
    display.starts_with('/') && !display.contains(' ')
}

fn read_history_index(history_path: &Path) -> HashMap<String, ClaudeHistoryEntry> {
    let mut map = HashMap::new();
    let Ok(content) = fs::read_to_string(history_path) else {
        return map;
    };

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(entry) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let Some(session_id) = entry.get("sessionId").and_then(|v| v.as_str()) else {
            continue;
        };
        let timestamp = entry.get("timestamp").and_then(|v| {
            v.as_f64()
                .or_else(|| v.as_i64().map(|i| i as f64))
                .or_else(|| v.as_u64().map(|u| u as f64))
        });
        let next = ClaudeHistoryEntry {
            display: entry
                .get("display")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            timestamp,
            project: entry
                .get("project")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        };
        let replace = match map.get(session_id) {
            None => true,
            Some(prev) => timestamp.unwrap_or(0.0) >= prev.timestamp.unwrap_or(0.0),
        };
        if replace {
            map.insert(session_id.to_string(), next);
        }
    }
    map
}

fn find_session_files(projects_dir: &Path) -> Vec<PathBuf> {
    let mut results = Vec::new();
    let Ok(projects) = fs::read_dir(projects_dir) else {
        return results;
    };

    for project in projects.flatten() {
        let project_path = project.path();
        if !project_path.is_dir() {
            continue;
        }
        let Ok(entries) = fs::read_dir(&project_path) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if uuid_jsonl_re().is_match(&name) {
                results.push(path);
            }
        }
    }
    results
}

/// Extract title from the first user message in a Claude session file.
pub fn extract_claude_title_from_session(
    session_path: &Path,
    max_lines: usize,
) -> Option<String> {
    let content = fs::read_to_string(session_path).ok()?;
    let mut line_count = 0usize;
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        line_count += 1;
        if line_count > max_lines {
            break;
        }
        let Ok(row) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if row.get("type").and_then(|v| v.as_str()) != Some("user") {
            continue;
        }
        let text = row
            .get("message")
            .and_then(|m| m.get("content"))
            .map(parse_user_content)
            .unwrap_or_default();
        if !text.is_empty() {
            return Some(text.chars().take(120).collect());
        }
    }
    None
}

fn scan_session_metadata(session_path: &Path) -> SessionMeta {
    let mut meta = SessionMeta {
        cwd: None,
        created_at: None,
        model: None,
        message_count: 0,
        title: None,
    };

    let Ok(content) = fs::read_to_string(session_path) else {
        return meta;
    };

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(row) = serde_json::from_str::<Value>(line) else {
            continue;
        };

        if meta.cwd.is_none() {
            meta.cwd = row
                .get("cwd")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }
        if meta.created_at.is_none() {
            meta.created_at = row
                .get("timestamp")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }

        let row_type = row.get("type").and_then(|v| v.as_str());
        if matches!(row_type, Some("user") | Some("assistant")) {
            meta.message_count += 1;
        }
        if row_type == Some("assistant") {
            if let Some(model) = row
                .pointer("/message/model")
                .and_then(|v| v.as_str())
            {
                meta.model = Some(model.to_string());
            }
        }
        if meta.title.is_none() && row_type == Some("user") {
            let text = row
                .get("message")
                .and_then(|m| m.get("content"))
                .map(parse_user_content)
                .unwrap_or_default();
            if !text.is_empty() {
                meta.title = Some(text.chars().take(120).collect());
            }
        }
    }

    meta
}

fn title_from_history(entry: Option<&ClaudeHistoryEntry>) -> Option<String> {
    let display = entry?.display.as_ref()?.trim();
    if display.is_empty() || is_slash_command(display) {
        return None;
    }
    Some(display.chars().take(120).collect())
}

fn history_timestamp_iso(ts: f64) -> String {
    // JS `new Date(number)` treats the value as milliseconds since epoch.
    let millis = ts as i64;
    match Utc.timestamp_millis_opt(millis) {
        chrono::LocalResult::Single(dt) => dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        _ => EPOCH_ISO.to_string(),
    }
}

fn mtime_iso(path: &Path) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let dt: DateTime<Utc> = modified.into();
    Some(dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
}

fn parse_session_file(
    session_path: &Path,
    history: &HashMap<String, ClaudeHistoryEntry>,
) -> Option<ChatSession> {
    let session_id = session_path.file_stem()?.to_string_lossy().into_owned();
    let meta = scan_session_metadata(session_path);
    let history_entry = history.get(&session_id);

    let title = meta
        .title
        .or_else(|| title_from_history(history_entry))
        .unwrap_or_else(|| {
            let prefix: String = session_id.chars().take(8).collect();
            format!("Claude {prefix}")
        });

    let updated_at = mtime_iso(session_path).unwrap_or_else(|| EPOCH_ISO.to_string());
    let cwd = meta
        .cwd
        .or_else(|| history_entry.and_then(|e| e.project.clone()));
    let created_at = meta.created_at.unwrap_or_else(|| {
        history_entry
            .and_then(|e| e.timestamp)
            .map(history_timestamp_iso)
            .unwrap_or_else(|| EPOCH_ISO.to_string())
    });

    Some(ChatSession {
        id: format!("claude:{session_id}"),
        source: ChatSource::Claude,
        title,
        cwd,
        created_at,
        updated_at,
        message_count: if meta.message_count > 0 {
            Some(meta.message_count)
        } else {
            None
        },
        model: meta.model,
        storage_path: Some(session_path.to_string_lossy().into_owned()),
    })
}

/// List Claude Code chat sessions under `claude_home` (`projects/*/*.jsonl`).
/// Missing directories return an empty list (matching the TypeScript provider).
pub fn fetch_claude_chats(claude_home: &Path) -> Result<Vec<ChatSession>, std::io::Error> {
    let projects_dir = claude_home.join("projects");
    let history = read_history_index(&claude_home.join("history.jsonl"));
    let files = find_session_files(&projects_dir);

    let mut sessions = Vec::new();
    for file in files {
        if let Some(session) = parse_session_file(&file, &history) {
            sessions.push(session);
        }
    }
    Ok(sessions)
}
