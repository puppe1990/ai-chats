use ai_chats_core::providers::commandcode::fetch_commandcode_chats;
use ai_chats_core::ChatSource;
use std::path::PathBuf;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/commandcode")
}

fn session_by_id<'a>(
    sessions: &'a [ai_chats_core::ChatSession],
    id: &str,
) -> &'a ai_chats_core::ChatSession {
    sessions
        .iter()
        .find(|s| s.id == id)
        .unwrap_or_else(|| panic!("missing session {id}"))
}

#[test]
fn parses_v3_session_jsonl_and_sidecar_meta() {
    let sessions = fetch_commandcode_chats(&fixture_root()).expect("ok");
    let s = session_by_id(
        &sessions,
        "commandcode:7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e",
    );
    assert_eq!(s.source, ChatSource::CommandCode);
    assert_eq!(s.title, "Command Code History");
    assert_eq!(s.cwd.as_deref(), Some("/test/commandcode-project"));
    assert_eq!(s.created_at, "2026-09-03T16:10:47.946Z");
    assert_eq!(s.message_count, Some(2));
    assert_eq!(s.model.as_deref(), Some("deepseek/deepseek-v4-flash"));
    let storage = s.storage_path.as_deref().expect("storage_path");
    assert!(
        storage.ends_with("projects/-test-project/7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e.jsonl"),
        "storage_path was {storage}"
    );
    assert!(!s.updated_at.is_empty());
}

#[test]
fn parses_legacy_v2_session_without_header() {
    let sessions = fetch_commandcode_chats(&fixture_root()).expect("ok");
    let s = session_by_id(
        &sessions,
        "commandcode:8c9d0e1f-2a3b-4c5d-6e7f-8a9b0c1d2e3f",
    );
    assert_eq!(s.source, ChatSource::CommandCode);
    assert_eq!(s.title, "Legacy Command Code session");
    assert_eq!(s.cwd, None);
    assert_eq!(s.created_at, "2026-07-15T11:58:26.522Z");
    assert_eq!(s.message_count, Some(2));
}

#[test]
fn ignores_checkpoint_sidecars_and_lists_two_sessions() {
    let sessions = fetch_commandcode_chats(&fixture_root()).expect("ok");
    assert_eq!(sessions.len(), 2);
}

#[test]
fn missing_dir_returns_empty() {
    let sessions =
        fetch_commandcode_chats(std::path::Path::new("/nonexistent/commandcode-home")).expect("ok");
    assert!(sessions.is_empty());
}
