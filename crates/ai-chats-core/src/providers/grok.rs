use crate::types::{ChatSession, ChatSource};
use serde::Deserialize;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

const EPOCH_ISO: &str = "1970-01-01T00:00:00.000Z";

#[derive(Debug, Deserialize)]
struct GrokSummary {
    info: GrokInfo,
    session_summary: Option<String>,
    generated_title: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    num_messages: Option<u32>,
    current_model_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GrokInfo {
    id: String,
    cwd: Option<String>,
}

/// Walk `sessions_dir` for `summary.json` files and map them to `ChatSession`s.
/// Missing directories return an empty list (matching the TypeScript provider).
pub fn fetch_grok_chats(sessions_dir: &Path) -> Result<Vec<ChatSession>, std::io::Error> {
    if !sessions_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();

    for entry in WalkDir::new(sessions_dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        if entry.file_name() != "summary.json" {
            continue;
        }

        let path = entry.path();
        let Ok(raw) = fs::read_to_string(path) else {
            continue;
        };
        let Ok(data) = serde_json::from_str::<GrokSummary>(&raw) else {
            continue;
        };

        let title = data
            .generated_title
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .or_else(|| {
                data.session_summary
                    .as_deref()
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
            })
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                let prefix: String = data.info.id.chars().take(8).collect();
                format!("Grok {prefix}")
            });

        let created_at = data
            .created_at
            .clone()
            .or_else(|| data.updated_at.clone())
            .unwrap_or_else(|| EPOCH_ISO.to_string());
        let updated_at = data
            .updated_at
            .clone()
            .or_else(|| data.created_at.clone())
            .unwrap_or_else(|| EPOCH_ISO.to_string());

        let storage_path = path
            .parent()
            .map(|p| p.to_string_lossy().into_owned());

        sessions.push(ChatSession {
            id: format!("grok:{}", data.info.id),
            source: ChatSource::Grok,
            title,
            cwd: data.info.cwd,
            created_at,
            updated_at,
            message_count: data.num_messages,
            model: data.current_model_id,
            storage_path,
        });
    }

    Ok(sessions)
}
