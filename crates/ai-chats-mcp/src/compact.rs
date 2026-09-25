// Limit defaults and list compactors are for MCP tool handlers in later tasks.
#![allow(dead_code)]

use ai_chats_core::{
    ChatDetail, ChatListResponse, ChatMessage, ChatMessageRole, ChatSession, ChatSource,
};
use serde::Serialize;
use serde_json::{json, Value};

pub const MESSAGE_CONTENT_CAP: usize = 2000;
pub const DEFAULT_GET_CHAT_LIMIT: u32 = 20;
pub const MAX_GET_CHAT_LIMIT: u32 = 40;
pub const DEFAULT_SEARCH_PAGE_SIZE: u32 = 10;
pub const MAX_PAGE_SIZE: u32 = 50;
pub const DEFAULT_RECENT_LIMIT: u32 = 15;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompactSession<'a> {
    id: &'a str,
    source: ChatSource,
    title: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    cwd: Option<&'a str>,
    updated_at: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    message_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactChatMessage {
    pub id: String,
    pub role: ChatMessageRole,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    pub content_truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactChatPage {
    pub session: Value,
    pub messages: Vec<CompactChatMessage>,
    pub offset: u32,
    pub limit: u32,
    pub total_messages: usize,
    pub has_more: bool,
}

impl<'a> From<&'a ChatSession> for CompactSession<'a> {
    fn from(session: &'a ChatSession) -> Self {
        Self {
            id: &session.id,
            source: session.source,
            title: &session.title,
            cwd: session.cwd.as_deref(),
            updated_at: &session.updated_at,
            message_count: session.message_count,
            model: session.model.as_deref(),
        }
    }
}

pub fn clamp_limit(value: Option<u32>, default: u32, max: u32) -> u32 {
    match value {
        None | Some(0) => default,
        Some(n) => n.min(max).max(1),
    }
}

pub fn compact_session(session: &ChatSession) -> Value {
    serde_json::to_value(CompactSession::from(session))
        .expect("CompactSession is always serializable")
}

pub fn compact_list(response: &ChatListResponse) -> Value {
    json!({
        "page": response.page,
        "pageSize": response.page_size,
        "totalItems": response.total_items,
        "hasNextPage": response.has_next_page,
        "items": response.items.iter().map(compact_session).collect::<Vec<_>>(),
    })
}

pub fn compact_recent(response: &ChatListResponse) -> Value {
    json!({
        "totalItems": response.total_items,
        "items": response.items.iter().map(compact_session).collect::<Vec<_>>(),
    })
}

fn cap_content(content: &str) -> (String, bool) {
    let truncated = content.chars().count() > MESSAGE_CONTENT_CAP;
    if !truncated {
        return (content.to_string(), false);
    }
    (content.chars().take(MESSAGE_CONTENT_CAP).collect(), true)
}

pub fn cap_message(message: &ChatMessage) -> CompactChatMessage {
    let (content, content_truncated) = cap_content(&message.content);
    CompactChatMessage {
        id: message.id.clone(),
        role: message.role,
        content,
        timestamp: message.timestamp.clone(),
        content_truncated,
    }
}

pub fn paginate_detail(detail: &ChatDetail, offset: u32, limit: u32) -> CompactChatPage {
    let total = detail.messages.len();
    let start = (offset as usize).min(total);
    let end = start.saturating_add(limit as usize).min(total);
    let messages = detail.messages[start..end]
        .iter()
        .map(cap_message)
        .collect();
    CompactChatPage {
        session: compact_session(&detail.session),
        messages,
        offset,
        limit,
        total_messages: total,
        has_more: end < total,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ai_chats_core::{ChatDetail, ChatMessage, ChatMessageRole, ChatSession, ChatSource};

    fn session() -> ChatSession {
        ChatSession {
            id: "grok:1".into(),
            source: ChatSource::Grok,
            title: "T".into(),
            cwd: Some("/x".into()),
            created_at: "2026-01-01T00:00:00.000Z".into(),
            updated_at: "2026-01-01T00:00:00.000Z".into(),
            message_count: Some(2),
            model: Some("m".into()),
            storage_path: Some("/secret".into()),
        }
    }

    fn message(content: &str) -> ChatMessage {
        ChatMessage {
            id: "1".into(),
            role: ChatMessageRole::User,
            content: content.into(),
            timestamp: None,
        }
    }

    #[test]
    fn list_item_omits_storage_path() {
        let v = compact_session(&session());
        assert!(v.get("storagePath").is_none());
        assert_eq!(v.get("id").and_then(|x| x.as_str()), Some("grok:1"));
        assert_eq!(v.get("cwd").and_then(|x| x.as_str()), Some("/x"));
    }

    #[test]
    fn paginate_sets_has_more() {
        let detail = ChatDetail {
            session: session(),
            messages: vec![message("a"), message("b"), message("c")],
        };
        let page = paginate_detail(&detail, 0, 2);
        assert_eq!(page.messages.len(), 2);
        assert_eq!(page.total_messages, 3);
        assert!(page.has_more);
        assert_eq!(page.offset, 0);
        assert_eq!(page.limit, 2);
    }

    #[test]
    fn content_over_2000_is_flagged() {
        let long = "x".repeat(2001);
        let detail = ChatDetail {
            session: session(),
            messages: vec![message(&long)],
        };
        let page = paginate_detail(&detail, 0, 20);
        assert!(page.messages[0].content_truncated);
        assert_eq!(page.messages[0].content.len(), 2000);
    }
}
