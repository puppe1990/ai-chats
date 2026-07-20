use ai_chats_core::messages::{
    fetch_chat_detail, fetch_claude_messages, fetch_codex_messages, fetch_cursor_messages,
    fetch_grok_messages, fetch_opencode_messages, find_codex_rollout_by_id,
};
use ai_chats_core::{ChatMessageRole, ChatSession, ChatSource, DataPaths};
use std::path::{Path, PathBuf};

fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn dummy_paths() -> DataPaths {
    DataPaths {
        cursor_home: PathBuf::from("/tmp"),
        grok_home: PathBuf::from("/tmp"),
        codex_home: fixtures().join("codex"),
        opencode_data_dir: PathBuf::from("/tmp"),
        claude_home: PathBuf::from("/tmp"),
    }
}

fn session(
    id: &str,
    source: ChatSource,
    storage_path: Option<impl Into<String>>,
) -> ChatSession {
    ChatSession {
        id: id.to_string(),
        source,
        title: "test".into(),
        cwd: None,
        created_at: "2026-01-01T00:00:00.000Z".into(),
        updated_at: "2026-01-01T00:00:00.000Z".into(),
        message_count: None,
        model: None,
        storage_path: storage_path.map(|s| s.into()),
    }
}

#[test]
fn claude_parses_user_assistant_and_tool_messages() {
    let path = fixtures().join(
        "claude/projects/-test-project/7a176d05-ee9d-42f2-81ee-72b9ac9c800c.jsonl",
    );
    let messages = fetch_claude_messages(&path);
    assert_eq!(messages.len(), 3);

    assert_eq!(messages[0].role, ChatMessageRole::User);
    assert_eq!(
        messages[0].content,
        "Build chat aggregator with TanStack Start"
    );
    assert_eq!(
        messages[0].timestamp.as_deref(),
        Some("2026-06-24T10:00:00.000Z")
    );

    assert_eq!(messages[1].role, ChatMessageRole::Assistant);
    assert_eq!(messages[1].content, "I'll help you build the aggregator.");
    assert_eq!(
        messages[1].timestamp.as_deref(),
        Some("2026-06-24T10:00:05.000Z")
    );

    assert_eq!(messages[2].role, ChatMessageRole::Tool);
    assert!(
        messages[2].content.contains("Read"),
        "tool content was: {}",
        messages[2].content
    );
}

#[test]
fn claude_missing_file_returns_empty() {
    assert!(fetch_claude_messages(Path::new("/nonexistent.jsonl")).is_empty());
}

#[test]
fn codex_extracts_user_and_assistant_from_rollout() {
    let path = fixtures().join(
        "codex/archived_sessions/rollout-2026-04-01T13-29-09-019d49e0-9893-76c0-b51e-094cae8d855c.jsonl",
    );
    let messages = fetch_codex_messages(&path);
    assert_eq!(messages.len(), 2);
    assert_eq!(messages[0].role, ChatMessageRole::User);
    assert_eq!(messages[0].content, "Sessão só no disco do Codex");
    assert_eq!(messages[1].role, ChatMessageRole::Assistant);
    assert_eq!(messages[1].content, "Entendido, vou ajudar.");
}

#[test]
fn codex_find_rollout_by_id_under_archived_sessions() {
    let codex_home = fixtures().join("codex");
    let found = find_codex_rollout_by_id(&codex_home, "019d49e0-9893-76c0-b51e-094cae8d855c")
        .expect("rollout found");
    assert!(found.to_string_lossy().ends_with(".jsonl"));
    assert!(found
        .file_name()
        .unwrap()
        .to_string_lossy()
        .contains("019d49e0-9893-76c0-b51e-094cae8d855c"));
}

#[test]
fn codex_non_jsonl_path_returns_empty() {
    assert!(fetch_codex_messages(Path::new("/tmp/not-a-rollout")).is_empty());
}

#[test]
fn grok_parses_chat_history_jsonl() {
    let session_dir = fixtures().join("messages/grok");
    let messages = fetch_grok_messages(&session_dir);
    assert_eq!(messages.len(), 2);
    assert_eq!(messages[0].role, ChatMessageRole::User);
    assert_eq!(messages[0].content, "Olá Grok");
    assert_eq!(messages[1].role, ChatMessageRole::Assistant);
    assert_eq!(messages[1].content, "Olá! Como posso ajudar?");
}

#[test]
fn cursor_parses_store_db_blobs() {
    let path = fixtures().join("cursor/chats/workspace1/chat1/store.db");
    let messages = fetch_cursor_messages(&path);
    // Fixture was extended with blobs (user + assistant). List-meta fixture originally
    // only had `meta`; message rows assert parser matches TS blob-scan behavior.
    assert!(
        messages.len() >= 2,
        "expected ≥2 messages from blobs, got {}",
        messages.len()
    );

    let user = messages
        .iter()
        .find(|m| m.role == ChatMessageRole::User)
        .expect("user message");
    assert_eq!(user.content, "Build a sentiment analyzer");

    let assistant = messages
        .iter()
        .find(|m| m.role == ChatMessageRole::Assistant)
        .expect("assistant message");
    assert_eq!(
        assistant.content,
        "I'll help you build a sentiment analyzer."
    );
}

#[test]
fn opencode_parses_messages_and_parts_for_session() {
    let db = fixtures().join("opencode/opencode.db");
    let messages = fetch_opencode_messages(&db, "ses_test1");
    assert_eq!(messages.len(), 2);
    assert_eq!(messages[0].role, ChatMessageRole::User);
    assert_eq!(messages[0].content, "How do I fix the login bug?");
    assert_eq!(messages[1].role, ChatMessageRole::Assistant);
    assert_eq!(messages[1].content, "Check the auth middleware first.");
}

#[test]
fn opencode_unknown_session_returns_empty() {
    let db = fixtures().join("opencode/opencode.db");
    assert!(fetch_opencode_messages(&db, "ses_missing").is_empty());
}

#[test]
fn fetch_chat_detail_returns_messages_when_id_matches() {
    let path = fixtures()
        .join("claude/projects/-test-project/7a176d05-ee9d-42f2-81ee-72b9ac9c800c.jsonl");
    let chat_id = "claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c";
    let s = session(chat_id, ChatSource::Claude, Some(path.to_string_lossy()));
    let detail = fetch_chat_detail(chat_id, &s, &dummy_paths()).expect("Some");
    assert_eq!(detail.session.id, chat_id);
    assert_eq!(detail.messages.len(), 3);
    assert_eq!(detail.messages[0].role, ChatMessageRole::User);
}

#[test]
fn fetch_chat_detail_none_on_id_mismatch() {
    let path = fixtures()
        .join("claude/projects/-test-project/7a176d05-ee9d-42f2-81ee-72b9ac9c800c.jsonl");
    let s = session(
        "claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c",
        ChatSource::Claude,
        Some(path.to_string_lossy()),
    );
    assert!(fetch_chat_detail("claude:other-id", &s, &dummy_paths()).is_none());
    assert!(fetch_chat_detail("codex:foo", &s, &dummy_paths()).is_none());
    assert!(fetch_chat_detail("nocolon", &s, &dummy_paths()).is_none());
}

#[test]
fn fetch_chat_detail_codex_resolves_rollout_by_id() {
    // storage_path is not a .jsonl file → find under codex_home
    let chat_id = "codex:019d49e0-9893-76c0-b51e-094cae8d855c";
    let s = session(chat_id, ChatSource::Codex, Some("/tmp/index-only"));
    let detail = fetch_chat_detail(chat_id, &s, &dummy_paths()).expect("Some");
    assert_eq!(detail.messages.len(), 2);
    assert_eq!(detail.messages[0].content, "Sessão só no disco do Codex");
}

#[test]
fn fetch_chat_detail_opencode_and_cursor() {
    let paths = dummy_paths();

    let oc_db = fixtures().join("opencode/opencode.db");
    let oc_id = "opencode:ses_test1";
    let oc = session(oc_id, ChatSource::Opencode, Some(oc_db.to_string_lossy()));
    let detail = fetch_chat_detail(oc_id, &oc, &paths).expect("Some");
    assert!(detail.messages.len() >= 2);

    let cur_db = fixtures().join("cursor/chats/workspace1/chat1/store.db");
    let cur_id = "cursor:chat1";
    let cur = session(cur_id, ChatSource::Cursor, Some(cur_db.to_string_lossy()));
    let detail = fetch_chat_detail(cur_id, &cur, &paths).expect("Some");
    assert!(detail.messages.len() >= 2);
}
