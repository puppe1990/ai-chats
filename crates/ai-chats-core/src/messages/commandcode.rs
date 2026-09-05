use crate::text::extract_text_from_parts;
use crate::types::{ChatMessage, ChatMessageRole};
use serde_json::Value;
use std::fs;
use std::path::Path;

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

fn format_tool_use(part: &Value) -> String {
    let name = part
        .get("name")
        .or_else(|| part.get("toolName"))
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

fn parse_entry(row: &Value) -> Option<(String, Value, Option<String>)> {
    let timestamp = nonempty_string(row.get("timestamp"));
    if row.get("type").and_then(|v| v.as_str()) == Some("message") {
        let message = row.get("message")?;
        return Some((
            nonempty_string(message.get("role"))?,
            message.get("content").cloned().unwrap_or(Value::Null),
            timestamp,
        ));
    }
    Some((
        nonempty_string(row.get("role"))?,
        row.get("content").cloned().unwrap_or(Value::Null),
        timestamp,
    ))
}

fn assistant_parts(content: &Value) -> Vec<(ChatMessageRole, String)> {
    if let Some(s) = content.as_str() {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            return Vec::new();
        }
        return vec![(ChatMessageRole::Assistant, trimmed.to_string())];
    }
    let Some(parts) = content.as_array() else {
        return Vec::new();
    };
    let mut messages = Vec::new();
    for part in parts {
        push_assistant_part(part, &mut messages);
    }
    messages
}

fn push_assistant_part(part: &Value, messages: &mut Vec<(ChatMessageRole, String)>) {
    let part_type = part.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if part_type == "text" {
        if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                messages.push((ChatMessageRole::Assistant, trimmed.to_string()));
            }
        }
        return;
    }
    if part_type == "tool_use" || part_type == "tool-call" {
        messages.push((ChatMessageRole::Tool, format_tool_use(part)));
    }
}

fn push_message(
    messages: &mut Vec<ChatMessage>,
    index: &mut u32,
    role: ChatMessageRole,
    content: String,
    timestamp: Option<String>,
) {
    messages.push(ChatMessage {
        id: format!("commandcode-msg-{index}"),
        role,
        content,
        timestamp,
    });
    *index += 1;
}

/// Parse Command Code session `.jsonl` (v3 header+message or legacy v2 rows).
pub fn fetch_commandcode_messages(session_path: &Path) -> Vec<ChatMessage> {
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
        let Ok(row) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let Some((role, content, timestamp)) = parse_entry(&row) else {
            continue;
        };
        append_entry(&mut messages, &mut index, &role, &content, timestamp);
    }
    messages
}

fn append_entry(
    messages: &mut Vec<ChatMessage>,
    index: &mut u32,
    role: &str,
    content: &Value,
    timestamp: Option<String>,
) {
    if role == "user" {
        let text = text_from_content(content);
        if text.is_empty() {
            return;
        }
        push_message(messages, index, ChatMessageRole::User, text, timestamp);
        return;
    }
    if role != "assistant" {
        return;
    }
    for (part_role, part_content) in assistant_parts(content) {
        push_message(messages, index, part_role, part_content, timestamp.clone());
    }
}
