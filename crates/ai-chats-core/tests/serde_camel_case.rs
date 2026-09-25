use ai_chats_core::{
    ChatMessage, ChatMessageRole, ChatSession, ChatSource, MessageSearchHit, MessageSearchResponse,
};

#[test]
fn chat_session_serializes_camel_case() {
    let s = ChatSession {
        id: "grok:1".into(),
        source: ChatSource::Grok,
        title: "T".into(),
        cwd: Some("/x".into()),
        created_at: "2026-01-01T00:00:00.000Z".into(),
        updated_at: "2026-01-01T00:00:00.000Z".into(),
        message_count: Some(1),
        model: Some("m".into()),
        storage_path: Some("/p".into()),
    };
    let v = serde_json::to_value(&s).unwrap();
    assert!(v.get("createdAt").is_some());
    assert!(v.get("created_at").is_none());
    assert!(v.get("updatedAt").is_some());
    assert!(v.get("messageCount").is_some());
    assert!(v.get("storagePath").is_some());
    assert_eq!(v.get("source").and_then(|x| x.as_str()), Some("grok"));
}

#[test]
fn commandcode_source_serializes_lowercase_without_underscore() {
    let v = serde_json::to_value(&ChatSource::CommandCode).unwrap();
    assert_eq!(v.as_str(), Some("commandcode"));
}

#[test]
fn chat_message_role_lowercase() {
    let m = ChatMessage {
        id: "1".into(),
        role: ChatMessageRole::Assistant,
        content: "hi".into(),
        timestamp: None,
    };
    let v = serde_json::to_value(&m).unwrap();
    assert_eq!(v.get("role").and_then(|x| x.as_str()), Some("assistant"));
}

#[test]
fn message_search_response_serializes_camel_case() {
    let hit = MessageSearchHit {
        chat_id: "claude:abc".into(),
        title: "T".into(),
        source: ChatSource::Claude,
        updated_at: "2026-01-01T00:00:00.000Z".into(),
        message_id: "m1".into(),
        role: ChatMessageRole::User,
        snippet: "hello".into(),
    };
    let response = MessageSearchResponse {
        query: "hello".into(),
        hits: vec![hit],
        chats_scanned: 1,
        truncated: false,
    };
    let v = serde_json::to_value(&response).unwrap();
    assert!(v.get("chatsScanned").is_some());
    assert!(v.get("chatId").is_none());
    assert_eq!(
        v.get("hits")
            .and_then(|h| h.get(0))
            .and_then(|h| h.get("chatId"))
            .and_then(|x| x.as_str()),
        Some("claude:abc")
    );
}
