use ai_chats_core::providers::claude::fetch_claude_chats;
use ai_chats_core::ChatSource;
use std::path::PathBuf;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/claude")
}

#[test]
fn parses_project_session_jsonl_into_chat_session() {
    let sessions = fetch_claude_chats(&fixture_root()).expect("ok");
    assert_eq!(sessions.len(), 1);
    let s = &sessions[0];
    assert_eq!(s.id, "claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c");
    assert_eq!(s.source, ChatSource::Claude);
    assert_eq!(s.title, "Build chat aggregator with TanStack Start");
    assert_eq!(s.cwd.as_deref(), Some("/test/project"));
    assert_eq!(s.created_at, "2026-06-24T10:00:00.000Z");
    assert_eq!(s.message_count, Some(3));
    assert_eq!(s.model.as_deref(), Some("claude-sonnet-4-6"));
    let storage = s.storage_path.as_deref().expect("storage_path");
    assert!(
        storage.ends_with(
            "projects/-test-project/7a176d05-ee9d-42f2-81ee-72b9ac9c800c.jsonl"
        ),
        "storage_path was {storage}"
    );
    assert!(!s.updated_at.is_empty());
}

#[test]
fn missing_dir_returns_empty() {
    let sessions =
        fetch_claude_chats(std::path::Path::new("/nonexistent/claude-home")).expect("ok");
    assert!(sessions.is_empty());
}
