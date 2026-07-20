use crate::types::{ChatSession, ChatSource};
use chrono::{DateTime, Utc};
use regex::Regex;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use walkdir::WalkDir;

const EPOCH_ISO: &str = "1970-01-01T00:00:00.000Z";

#[derive(Debug, Deserialize)]
struct CodexIndexEntry {
    id: String,
    thread_name: Option<String>,
    updated_at: Option<String>,
}

fn rollout_uuid_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$")
            .expect("rollout uuid regex")
    })
}

fn rollout_ts_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-")
            .expect("rollout ts regex")
    })
}

fn parse_rollout_timestamp(filename: &str) -> Option<String> {
    let caps = rollout_ts_re().captures(filename)?;
    let raw = caps.get(1)?.as_str();
    // Convert YYYY-MM-DDTHH-MM-SS → YYYY-MM-DDTHH:MM:SS.000Z
    // Match TS: /(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})/ → '$1$2:$3:$4'
    if raw.len() != 19 {
        return None;
    }
    let date_t = &raw[..11]; // "YYYY-MM-DDT"
    let h = &raw[11..13];
    let m = &raw[14..16];
    let s = &raw[17..19];
    Some(format!("{date_t}{h}:{m}:{s}.000Z"))
}

fn parse_rollout_id(filename: &str) -> Option<String> {
    rollout_uuid_re()
        .captures(filename)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

fn read_index(index_path: &Path) -> HashMap<String, CodexIndexEntry> {
    let mut map = HashMap::new();
    let Ok(content) = fs::read_to_string(index_path) else {
        return map;
    };
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(entry) = serde_json::from_str::<CodexIndexEntry>(line) else {
            continue;
        };
        map.insert(entry.id.clone(), entry);
    }
    map
}

fn find_rollout_files(codex_home: &Path) -> Vec<PathBuf> {
    let dirs = [
        codex_home.join("sessions"),
        codex_home.join("archived_sessions"),
    ];
    let mut results = Vec::new();

    for dir in &dirs {
        if !dir.is_dir() {
            continue;
        }
        for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
            if !entry.file_type().is_file() {
                continue;
            }
            let name = entry.file_name().to_string_lossy();
            if name.starts_with("rollout-") && name.ends_with(".jsonl") {
                results.push(entry.path().to_path_buf());
            }
        }
    }
    results
}

/// Extract title from the first user message in a Codex rollout file.
pub fn extract_codex_title_from_rollout(
    file_path: &Path,
    max_lines: usize,
) -> Option<String> {
    let content = fs::read_to_string(file_path).ok()?;
    for line in content.lines().take(max_lines) {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(event) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if event.get("type").and_then(|v| v.as_str()) != Some("response_item") {
            continue;
        }
        let Some(payload) = event.get("payload") else {
            continue;
        };
        if payload.get("role").and_then(|v| v.as_str()) != Some("user") {
            continue;
        }
        let Some(parts) = payload.get("content").and_then(|v| v.as_array()) else {
            continue;
        };
        for part in parts {
            let text = part
                .get("text")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|t| !t.is_empty());
            let part_type = part.get("type").and_then(|v| v.as_str());
            if let Some(text) = text {
                if part_type != Some("tool_use") {
                    if text.chars().count() > 120 {
                        let truncated: String = text.chars().take(117).collect();
                        return Some(format!("{truncated}..."));
                    }
                    return Some(text.to_string());
                }
            }
        }
    }
    None
}

fn mtime_iso(path: &Path) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let dt: DateTime<Utc> = modified.into();
    Some(dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
}

fn to_session(
    id: &str,
    title: String,
    updated_at: String,
    storage_path: String,
    cwd: Option<String>,
    created_at: Option<String>,
) -> ChatSession {
    let created = created_at.unwrap_or_else(|| updated_at.clone());
    ChatSession {
        id: format!("codex:{id}"),
        source: ChatSource::Codex,
        title,
        cwd,
        created_at: created,
        updated_at,
        message_count: None,
        model: None,
        storage_path: Some(storage_path),
    }
}

fn parse_first_line_cwd(file_path: &Path) -> Option<String> {
    let content = fs::read_to_string(file_path).ok()?;
    let first_line = content.lines().next()?;
    let meta: Value = serde_json::from_str(first_line).ok()?;
    meta.pointer("/payload/cwd")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// List Codex chat sessions from `session_index.jsonl` plus rollout files.
/// Missing directories return an empty list (matching the TypeScript provider).
pub fn fetch_codex_chats(codex_home: &Path) -> Result<Vec<ChatSession>, std::io::Error> {
    let index_path = codex_home.join("session_index.jsonl");
    let index = read_index(&index_path);
    let rollouts = find_rollout_files(codex_home);
    let mut by_id: HashMap<String, ChatSession> = HashMap::new();

    for (id, entry) in index {
        let updated_at = entry
            .updated_at
            .clone()
            .unwrap_or_else(|| EPOCH_ISO.to_string());
        let title = entry
            .thread_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                let prefix: String = id.chars().take(8).collect();
                format!("Codex {prefix}")
            });
        by_id.insert(
            id.clone(),
            to_session(
                &id,
                title,
                updated_at,
                index_path.to_string_lossy().into_owned(),
                None,
                None,
            ),
        );
    }

    for file_path in rollouts {
        let filename = file_path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let Some(id) = parse_rollout_id(&filename) else {
            continue;
        };

        let file_updated_at = parse_rollout_timestamp(&filename)
            .or_else(|| mtime_iso(&file_path))
            .unwrap_or_else(|| EPOCH_ISO.to_string());

        if let Some(existing) = by_id.get_mut(&id) {
            // Prefer the later timestamp when both exist.
            if file_updated_at > existing.updated_at {
                existing.updated_at = file_updated_at;
            }
            existing.storage_path = Some(file_path.to_string_lossy().into_owned());
            continue;
        }

        let title = extract_codex_title_from_rollout(&file_path, 50).unwrap_or_else(|| {
            let prefix: String = id.chars().take(8).collect();
            format!("Codex {prefix}")
        });
        let cwd = parse_first_line_cwd(&file_path);

        by_id.insert(
            id.clone(),
            to_session(
                &id,
                title,
                file_updated_at.clone(),
                file_path.to_string_lossy().into_owned(),
                cwd,
                Some(file_updated_at),
            ),
        );
    }

    Ok(by_id.into_values().collect())
}
