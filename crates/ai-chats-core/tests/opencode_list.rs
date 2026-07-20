use ai_chats_core::providers::opencode::fetch_opencode_chats;
use ai_chats_core::ChatSource;
use std::path::PathBuf;

fn fixture_db() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/opencode/opencode.db")
}

#[test]
fn reads_sessions_from_opencode_db() {
    let sessions = fetch_opencode_chats(&fixture_db());
    assert_eq!(sessions.len(), 2);

    assert_eq!(sessions[0].id, "opencode:ses_test2");
    assert_eq!(sessions[0].source, ChatSource::Opencode);
    assert_eq!(sessions[0].title, "Add dark mode");
    assert_eq!(sessions[0].cwd.as_deref(), Some("/test/other"));
    assert!(sessions[0].storage_path.is_some());

    let ses1 = sessions
        .iter()
        .find(|s| s.id == "opencode:ses_test1")
        .expect("ses_test1 present");
    assert_eq!(ses1.title, "Fix login bug");
    assert_eq!(ses1.model.as_deref(), Some("claude-sonnet"));
}

#[test]
fn missing_db_returns_empty() {
    let sessions = fetch_opencode_chats(std::path::Path::new("/nonexistent.db"));
    assert!(sessions.is_empty());
}
