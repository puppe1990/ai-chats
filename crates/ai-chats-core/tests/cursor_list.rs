use ai_chats_core::providers::cursor::fetch_cursor_chats;
use ai_chats_core::ChatSource;
use std::path::PathBuf;

fn fixture_chats() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/cursor/chats")
}

#[test]
fn parses_store_db_meta_into_session() {
    let sessions = fetch_cursor_chats(&fixture_chats());
    assert_eq!(sessions.len(), 1);

    let s = &sessions[0];
    assert_eq!(s.id, "cursor:chat1");
    assert_eq!(s.source, ChatSource::Cursor);
    assert_eq!(s.title, "Sentiment Analyzer");
    assert_eq!(s.created_at, "2024-06-21T20:00:00.000Z");
    assert!(!s.updated_at.is_empty());
    assert!(s.storage_path.is_some());
}

#[test]
fn missing_dir_returns_empty() {
    let sessions = fetch_cursor_chats(std::path::Path::new("/nonexistent"));
    assert!(sessions.is_empty());
}
