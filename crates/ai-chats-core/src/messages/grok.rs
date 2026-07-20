use crate::text::{extract_text_from_parts, strip_user_query_tags};
use crate::types::{ChatMessage, ChatMessageRole};
use serde_json::Value;
use std::fs;
use std::path::Path;

fn parse_grok_content(content: &Value) -> String {
    if let Some(s) = content.as_str() {
        return strip_user_query_tags(s);
    }
    if let Some(arr) = content.as_array() {
        return strip_user_query_tags(&extract_text_from_parts(arr));
    }
    String::new()
}

/// Parse Grok `chat_history.jsonl` inside a session directory.
pub fn fetch_grok_messages(session_dir: &Path) -> Vec<ChatMessage> {
    let history_path = session_dir.join("chat_history.jsonl");
    let content = match fs::read_to_string(&history_path) {
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

        let role = match row.get("role").and_then(|v| v.as_str()) {
            Some("user") => ChatMessageRole::User,
            Some("assistant") => ChatMessageRole::Assistant,
            Some(_) => continue,
            None => match row.get("type").and_then(|v| v.as_str()) {
                Some("user") => ChatMessageRole::User,
                Some("assistant") => ChatMessageRole::Assistant,
                _ => continue,
            },
        };

        let text = row
            .get("content")
            .map(parse_grok_content)
            .unwrap_or_default();
        if text.is_empty() {
            continue;
        }

        messages.push(ChatMessage {
            id: format!("grok-msg-{index}"),
            role,
            content: text,
            timestamp: None,
        });
        index += 1;
    }

    messages
}
