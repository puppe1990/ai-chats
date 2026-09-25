use ai_chats_core::{
    scan_chat_messages, search_chat_messages, snippet_around, ChatMessage, ChatMessageRole,
    ChatSession, ChatSource, DataPaths, MessageSearchError, MessageSearchQuery,
};
use std::path::PathBuf;
use std::time::{Duration, Instant};

#[test]
fn snippet_includes_needle_and_collapses_newlines() {
    let hay = "aaa\npath_guard\nbbb";
    let snippet = snippet_around(hay, "PATH_GUARD").expect("hit");
    assert!(snippet.to_lowercase().contains("path_guard"));
    assert!(!snippet.contains('\n'));
}

#[test]
fn snippet_adds_ellipsis_when_clipped() {
    let hay = format!("{}NEEDLE{}", "a".repeat(100), "b".repeat(100));
    let snippet = snippet_around(&hay, "needle").expect("hit");
    assert!(snippet.starts_with('…'));
    assert!(snippet.ends_with('…'));
    assert!(snippet.chars().count() <= 200);
}

#[test]
fn snippet_none_when_missing() {
    assert!(snippet_around("hello", "xyz").is_none());
}

#[test]
fn snippet_handles_multibyte_chars_around_needle() {
    let hay = format!("{}NEEDLE{}", "€".repeat(40), "é".repeat(50));
    let snippet = snippet_around(&hay, "needle").expect("hit");
    assert!(snippet.contains("NEEDLE"), "snippet={snippet}");
}

#[test]
fn snippet_caps_at_max_and_keeps_trailing_ellipsis() {
    let needle = "N".repeat(50);
    let hay = format!("{}{needle}{}", "a".repeat(100), "b".repeat(100));
    let snippet = snippet_around(&hay, &needle).expect("hit");
    assert!(snippet.contains(&needle), "snippet={snippet}");
    assert!(snippet.ends_with('…'), "snippet={snippet}");
    assert!(
        snippet.chars().count() <= 200,
        "len={}",
        snippet.chars().count()
    );
}

fn missing() -> PathBuf {
    PathBuf::from("/tmp/ai-chats-missing-provider-root")
}

fn fixture_paths() -> DataPaths {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    DataPaths {
        cursor_home: missing(),
        grok_home: root.join("grok"),
        codex_home: missing(),
        opencode_data_dir: missing(),
        claude_home: root.join("claude"),
        commandcode_home: missing(),
    }
}

fn session(id: &str, source: ChatSource) -> ChatSession {
    ChatSession {
        id: id.into(),
        source,
        title: id.into(),
        cwd: None,
        created_at: "2026-01-01T00:00:00.000Z".into(),
        updated_at: "2026-01-01T00:00:00.000Z".into(),
        message_count: None,
        model: None,
        storage_path: None,
    }
}

fn msg(id: &str, content: &str) -> ChatMessage {
    ChatMessage {
        id: id.into(),
        role: ChatMessageRole::User,
        content: content.into(),
        timestamp: None,
    }
}

#[test]
fn empty_query_is_an_error_with_received_value() {
    let err = search_chat_messages(
        MessageSearchQuery {
            query: "   ".into(),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .unwrap_err();
    match err {
        MessageSearchError::EmptyQuery { received } => assert_eq!(received, "   "),
        other => panic!("unexpected {other:?}"),
    }
}

#[test]
fn finds_claude_fixture_message() {
    let result = search_chat_messages(
        MessageSearchQuery {
            query: "TanStack".into(),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .expect("search");
    assert_eq!(result.hits.len(), 1);
    assert_eq!(
        result.hits[0].chat_id,
        "claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c"
    );
    assert_eq!(result.hits[0].role, ChatMessageRole::User);
    assert!(result.hits[0].snippet.contains("TanStack"));
}

#[test]
fn source_filter_skips_other_providers() {
    let result = search_chat_messages(
        MessageSearchQuery {
            query: "TanStack".into(),
            source: Some("grok".into()),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .expect("search");
    assert!(result.hits.is_empty());
}

#[test]
fn max_hits_stops_early() {
    let chats = vec![session("claude:1", ChatSource::Claude)];
    let (hits, scanned, _truncated) = scan_chat_messages(
        &chats,
        "hit",
        40,
        1,
        Instant::now() + Duration::from_secs(8),
        |_| vec![msg("a", "hit one"), msg("b", "hit two")],
    );
    assert_eq!(hits.len(), 1);
    assert_eq!(scanned, 1);
}

#[test]
fn max_chats_sets_truncated() {
    let chats = vec![
        session("claude:1", ChatSource::Claude),
        session("claude:2", ChatSource::Claude),
    ];
    let (_hits, scanned, truncated) = scan_chat_messages(
        &chats,
        "nope",
        1,
        10,
        Instant::now() + Duration::from_secs(8),
        |_| vec![msg("a", "nothing")],
    );
    assert_eq!(scanned, 1);
    assert!(truncated);
}

#[test]
fn no_match_returns_empty_hits() {
    let result = search_chat_messages(
        MessageSearchQuery {
            query: "zzzz-not-in-fixtures".into(),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .expect("search");
    assert!(result.hits.is_empty());
}

#[test]
fn expired_deadline_skips_load_and_truncates() {
    let chats = vec![session("claude:1", ChatSource::Claude)];
    let (hits, scanned, truncated) =
        scan_chat_messages(&chats, "hit", 40, 10, Instant::now(), |_| {
            panic!("must not load chats after deadline")
        });
    assert!(hits.is_empty());
    assert_eq!(scanned, 0);
    assert!(truncated);
}

#[test]
fn invalid_source_is_an_error_with_received_value() {
    let err = search_chat_messages(
        MessageSearchQuery {
            query: "TanStack".into(),
            source: Some("windsurf".into()),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .unwrap_err();
    match err {
        MessageSearchError::InvalidSource { received } => assert_eq!(received, "windsurf"),
        other => panic!("unexpected {other:?}"),
    }
}

#[test]
fn finds_grok_fixture_message() {
    let result = search_chat_messages(
        MessageSearchQuery {
            query: "Olá Grok".into(),
            ..Default::default()
        },
        &fixture_paths(),
    )
    .expect("search");
    assert_eq!(result.hits.len(), 1);
    assert!(
        result.hits[0].chat_id.starts_with("grok:"),
        "chat_id={}",
        result.hits[0].chat_id
    );
}

#[test]
fn deadline_after_load_skips_hits_and_truncates() {
    let chats = vec![session("claude:1", ChatSource::Claude)];
    let (hits, scanned, truncated) = scan_chat_messages(
        &chats,
        "hit",
        40,
        10,
        Instant::now() + Duration::from_millis(30),
        |_| {
            std::thread::sleep(Duration::from_millis(80));
            vec![msg("a", "hit one")]
        },
    );
    assert!(hits.is_empty(), "overrun load must not contribute hits");
    assert_eq!(scanned, 1);
    assert!(truncated);
}
