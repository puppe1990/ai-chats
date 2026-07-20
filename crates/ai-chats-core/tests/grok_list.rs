use ai_chats_core::providers::grok::fetch_grok_chats;
use ai_chats_core::ChatSource;
use std::path::PathBuf;

fn fixture_sessions() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/grok/sessions")
}

#[test]
fn parses_summary_json_into_session() {
    let sessions = fetch_grok_chats(&fixture_sessions()).expect("ok");
    assert_eq!(sessions.len(), 1);
    let s = &sessions[0];
    assert_eq!(s.id, "grok:019efae4-e451-7d22-b51f-ee6b3cee0f95");
    assert_eq!(s.source, ChatSource::Grok);
    assert_eq!(s.title, "Build chat aggregator");
    assert_eq!(s.cwd.as_deref(), Some("/test/project"));
    assert_eq!(s.updated_at, "2026-06-24T15:30:00.000Z");
    assert_eq!(s.message_count, Some(42));
    assert_eq!(s.model.as_deref(), Some("grok-composer-2.5-fast"));
    assert!(s.storage_path.is_some());
}

#[test]
fn missing_dir_returns_empty() {
    let sessions =
        fetch_grok_chats(std::path::Path::new("/nonexistent/grok-sessions")).expect("ok");
    assert!(sessions.is_empty());
}
