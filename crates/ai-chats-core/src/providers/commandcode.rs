use crate::text::extract_text_from_parts;
use crate::types::{ChatSession, ChatSource};
use chrono::{DateTime, Utc};
use regex::Regex;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

const EPOCH_ISO: &str = "1970-01-01T00:00:00.000Z";

struct SidecarMeta {
    title: Option<String>,
    model: Option<String>,
}

struct SessionScan {
    cwd: Option<String>,
    created_at: Option<String>,
    model: Option<String>,
    message_count: u32,
    title: Option<String>,
}

struct TranscriptEntry {
    role: String,
    content: Value,
    timestamp: Option<String>,
    model: Option<String>,
}

fn uuid_jsonl_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$")
            .expect("uuid jsonl regex")
    })
}

fn nonempty_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn text_from_content(content: &Value) -> String {
    if let Some(s) = content.as_str() {
        return s.trim().to_string();
    }
    if let Some(arr) = content.as_array() {
        return extract_text_from_parts(arr);
    }
    String::new()
}

fn find_session_files(projects_dir: &Path) -> Vec<PathBuf> {
    let mut results = Vec::new();
    let Ok(projects) = fs::read_dir(projects_dir) else {
        return results;
    };
    for project in projects.flatten() {
        collect_uuid_jsonl(&project.path(), &mut results);
    }
    results
}

fn collect_uuid_jsonl(project_path: &Path, results: &mut Vec<PathBuf>) {
    if !project_path.is_dir() {
        return;
    }
    let Ok(entries) = fs::read_dir(project_path) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = entry.file_name();
        if uuid_jsonl_re().is_match(&name.to_string_lossy()) {
            results.push(path);
        }
    }
}

fn read_sidecar_meta(session_path: &Path) -> SidecarMeta {
    let meta_path = session_path.with_extension("meta.json");
    let Ok(raw) = fs::read_to_string(meta_path) else {
        return SidecarMeta {
            title: None,
            model: None,
        };
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw) else {
        return SidecarMeta {
            title: None,
            model: None,
        };
    };
    SidecarMeta {
        title: nonempty_string(value.get("title")),
        model: nonempty_string(value.get("model")),
    }
}

fn parse_entry(row: &Value) -> Option<TranscriptEntry> {
    let timestamp = nonempty_string(row.get("timestamp"));
    if row.get("type").and_then(|v| v.as_str()) == Some("message") {
        let message = row.get("message")?;
        return Some(TranscriptEntry {
            role: nonempty_string(message.get("role"))?,
            content: message.get("content").cloned().unwrap_or(Value::Null),
            timestamp,
            model: nonempty_string(row.get("model")),
        });
    }
    Some(TranscriptEntry {
        role: nonempty_string(row.get("role"))?,
        content: row.get("content").cloned().unwrap_or(Value::Null),
        timestamp,
        model: nonempty_string(row.get("model")),
    })
}

fn apply_session_header(row: &Value, scan: &mut SessionScan) {
    if row.get("type").and_then(|v| v.as_str()) != Some("session") {
        return;
    }
    if scan.cwd.is_none() {
        scan.cwd = nonempty_string(row.get("cwd"));
    }
    if scan.created_at.is_none() {
        scan.created_at = nonempty_string(row.get("timestamp"));
    }
}

fn apply_model_change(row: &Value, scan: &mut SessionScan) {
    if row.get("type").and_then(|v| v.as_str()) != Some("model_change") {
        return;
    }
    if let Some(model) = nonempty_string(row.get("model")) {
        scan.model = Some(model);
    }
}

fn apply_entry(entry: TranscriptEntry, scan: &mut SessionScan) {
    if scan.created_at.is_none() {
        scan.created_at = entry.timestamp;
    }
    if entry.role == "assistant" {
        if let Some(model) = entry.model {
            scan.model = Some(model);
        }
    }
    if !matches!(entry.role.as_str(), "user" | "assistant") {
        return;
    }
    if entry.role == "user" && text_from_content(&entry.content).is_empty() {
        return;
    }
    scan.message_count += 1;
    if scan.title.is_none() && entry.role == "user" {
        let text = text_from_content(&entry.content);
        if !text.is_empty() {
            scan.title = Some(text.chars().take(120).collect());
        }
    }
}

fn scan_session_file(path: &Path) -> SessionScan {
    let mut scan = SessionScan {
        cwd: None,
        created_at: None,
        model: None,
        message_count: 0,
        title: None,
    };
    let Ok(content) = fs::read_to_string(path) else {
        return scan;
    };
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(row) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        apply_session_header(&row, &mut scan);
        apply_model_change(&row, &mut scan);
        if let Some(entry) = parse_entry(&row) {
            apply_entry(entry, &mut scan);
        }
    }
    scan
}

fn mtime_iso(path: &Path) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let dt: DateTime<Utc> = modified.into();
    Some(dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
}

fn fallback_title(session_id: &str) -> String {
    let prefix: String = session_id.chars().take(8).collect();
    format!("Command Code {prefix}")
}

fn parse_session_file(session_path: &Path) -> Option<ChatSession> {
    let session_id = session_path.file_stem()?.to_string_lossy().into_owned();
    let sidecar = read_sidecar_meta(session_path);
    let scan = scan_session_file(session_path);
    Some(chat_from_scan(session_path, session_id, sidecar, scan))
}

fn chat_from_scan(
    session_path: &Path,
    session_id: String,
    sidecar: SidecarMeta,
    scan: SessionScan,
) -> ChatSession {
    let title = sidecar
        .title
        .or(scan.title)
        .unwrap_or_else(|| fallback_title(&session_id));
    ChatSession {
        id: format!("commandcode:{session_id}"),
        source: ChatSource::CommandCode,
        title,
        cwd: scan.cwd,
        created_at: scan.created_at.unwrap_or_else(|| EPOCH_ISO.to_string()),
        updated_at: mtime_iso(session_path).unwrap_or_else(|| EPOCH_ISO.to_string()),
        message_count: (scan.message_count > 0).then_some(scan.message_count),
        model: sidecar.model.or(scan.model),
        storage_path: Some(session_path.to_string_lossy().into_owned()),
    }
}

/// List Command Code sessions under `commandcode_home` (`projects/*/*.jsonl`).
/// Missing directories return an empty list.
pub fn fetch_commandcode_chats(
    commandcode_home: &Path,
) -> Result<Vec<ChatSession>, std::io::Error> {
    let files = find_session_files(&commandcode_home.join("projects"));
    Ok(files
        .iter()
        .filter_map(|file| parse_session_file(file))
        .collect())
}
