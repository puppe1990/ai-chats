use crate::text::extract_text_from_parts;
use crate::types::{ChatMessage, ChatMessageRole};
use serde_json::Value;
use std::fs;
use std::path::Path;

fn parse_user_content(content: &Value) -> String {
    if let Some(s) = content.as_str() {
        return s.trim().to_string();
    }
    if let Some(arr) = content.as_array() {
        return extract_text_from_parts(arr);
    }
    String::new()
}

fn format_tool_use(part: &Value) -> String {
    let name = part
        .get("name")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("tool");

    let input = part.get("input").filter(|v| v.is_object());
    match input {
        Some(obj) => match serde_json::to_string_pretty(obj) {
            Ok(pretty) => format!("{name}\n{pretty}"),
            Err(_) => name.to_string(),
        },
        None => name.to_string(),
    }
}

fn parse_assistant_content(content: &[Value]) -> Vec<(ChatMessageRole, String)> {
    let mut messages = Vec::new();
    for part in content {
        let part_type = part.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if part_type == "text" {
            if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    messages.push((ChatMessageRole::Assistant, trimmed.to_string()));
                }
            }
            continue;
        }
        if part_type == "tool_use" {
            messages.push((ChatMessageRole::Tool, format_tool_use(part)));
        }
    }
    messages
}

/// Parse Claude session `.jsonl` into chat messages.
pub fn fetch_claude_messages(session_path: &Path) -> Vec<ChatMessage> {
    let content = match fs::read_to_string(session_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut messages = Vec::new();
    let mut index: u32 = 0;

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let row: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let row_type = row.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let timestamp = row
            .get("timestamp")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        if row_type == "user" {
            let content = row
                .pointer("/message/content")
                .map(parse_user_content)
                .unwrap_or_default();
            if content.is_empty() {
                continue;
            }
            messages.push(ChatMessage {
                id: format!("claude-msg-{index}"),
                role: ChatMessageRole::User,
                content,
                timestamp,
            });
            index += 1;
            continue;
        }

        if row_type == "assistant" {
            let parts = row
                .pointer("/message/content")
                .and_then(|v| v.as_array())
                .map(|a| parse_assistant_content(a))
                .unwrap_or_default();
            for (role, content) in parts {
                messages.push(ChatMessage {
                    id: format!("claude-msg-{index}"),
                    role,
                    content,
                    timestamp: timestamp.clone(),
                });
                index += 1;
            }
        }
    }

    messages
}
