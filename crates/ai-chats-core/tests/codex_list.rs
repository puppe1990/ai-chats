use ai_chats_core::providers::codex::{extract_codex_title_from_rollout, fetch_codex_chats};
use ai_chats_core::ChatSource;
use std::path::PathBuf;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/codex")
}

#[test]
fn parses_session_index_jsonl() {
    let sessions = fetch_codex_chats(&fixture_root()).expect("ok");
    let indexed = sessions
        .iter()
        .find(|s| s.id == "codex:019e45c9-4c4c-7783-a976-c0eec1cc306b")
        .expect("indexed session");
    assert_eq!(indexed.source, ChatSource::Codex);
    assert_eq!(indexed.title, "Limpar HD com script");
    assert_eq!(indexed.updated_at, "2026-05-20T14:28:22.699524Z");
}

#[test]
fn includes_rollout_files_not_in_session_index() {
    let sessions = fetch_codex_chats(&fixture_root()).expect("ok");
    let disk_only = sessions
        .iter()
        .find(|s| s.id == "codex:019d49e0-9893-76c0-b51e-094cae8d855c")
        .expect("disk-only session");
    assert_eq!(disk_only.source, ChatSource::Codex);
    assert_eq!(disk_only.title, "Sessão só no disco do Codex");
    assert_eq!(disk_only.cwd.as_deref(), Some("/test/only-on-disk"));
    assert_eq!(disk_only.updated_at, "2026-04-01T13:29:09.000Z");
    let storage = disk_only.storage_path.as_deref().expect("storage_path");
    assert!(
        storage.contains("rollout-2026-04-01"),
        "storage_path was {storage}"
    );
}

#[test]
fn missing_dir_returns_empty() {
    let sessions =
        fetch_codex_chats(std::path::Path::new("/nonexistent/codex-home")).expect("ok");
    assert!(sessions.is_empty());
}

#[test]
fn extract_codex_title_from_archived_rollout() {
    let rollout = fixture_root().join(
        "archived_sessions/rollout-2026-04-01T13-29-09-019d49e0-9893-76c0-b51e-094cae8d855c.jsonl",
    );
    let title = extract_codex_title_from_rollout(&rollout, 50);
    assert_eq!(title.as_deref(), Some("Sessão só no disco do Codex"));
}
