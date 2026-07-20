use ai_chats_core::{
    aggregate_chats, build_chat_list_response, ChatListQuery, ChatSession, ChatSource, DataPaths,
    CHAT_PAGE_SIZE,
};
use std::path::PathBuf;

fn make_chat(id: &str, source: ChatSource, title: &str, updated_at: &str) -> ChatSession {
    ChatSession {
        id: id.to_string(),
        source,
        title: title.to_string(),
        cwd: Some(format!("/Users/test/{id}")),
        created_at: "2026-06-24T10:00:00Z".into(),
        updated_at: updated_at.to_string(),
        message_count: Some(1),
        model: None,
        storage_path: None,
    }
}

fn grok_chats(n: usize) -> Vec<ChatSession> {
    (0..n)
        .map(|index| {
            let i = index + 1;
            make_chat(
                &format!("grok:{i}"),
                ChatSource::Grok,
                &format!("Chat {i}"),
                &format!("2026-06-24T{:02}:00:00Z", 10 + index),
            )
        })
        .collect()
}

#[test]
fn paginates_with_default_page_size_of_10() {
    let chats = grok_chats(25);
    let result = build_chat_list_response(
        chats,
        ChatListQuery {
            page: 1,
            ..Default::default()
        },
    );

    assert_eq!(CHAT_PAGE_SIZE, 10);
    assert_eq!(result.items.len(), 10);
    assert_eq!(result.page, 1);
    assert_eq!(result.total_items, 25);
    assert_eq!(result.total_pages, 3);
    assert!(result.has_next_page);
    assert!(!result.has_previous_page);
}

#[test]
fn returns_requested_backend_page_slice() {
    let chats = grok_chats(25);

    let page2 = build_chat_list_response(
        chats.clone(),
        ChatListQuery {
            page: 2,
            ..Default::default()
        },
    );
    let page3 = build_chat_list_response(
        chats,
        ChatListQuery {
            page: 3,
            ..Default::default()
        },
    );

    assert_eq!(page2.items.len(), 10);
    assert_eq!(page2.items[0].title, "Chat 11");
    assert_eq!(page2.page, 2);
    assert!(page2.has_previous_page);
    assert!(page2.has_next_page);

    assert_eq!(page3.items.len(), 5);
    assert_eq!(page3.items[0].title, "Chat 21");
    assert_eq!(page3.page, 3);
    assert!(!page3.has_next_page);
}

#[test]
fn filters_by_source_and_query() {
    let mut mixed = grok_chats(3);
    mixed.push(make_chat(
        "codex:1",
        ChatSource::Codex,
        "Codex task",
        "2026-06-24T11:00:00Z",
    ));

    let result = build_chat_list_response(
        mixed,
        ChatListQuery {
            page: 1,
            source: Some("grok".into()),
            query: Some("chat 2".into()),
            ..Default::default()
        },
    );

    assert_eq!(result.total_items, 1);
    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].id, "grok:2");
    assert_eq!(result.counts.codex, 1);
    assert_eq!(result.counts.grok, 3);
    assert_eq!(result.total_chats, 4);
    assert_eq!(result.favorite_count, 0);
}

#[test]
fn favorites_only_and_favorite_count() {
    let chats = grok_chats(25);
    let result = build_chat_list_response(
        chats,
        ChatListQuery {
            page: 1,
            favorites_only: Some(true),
            favorite_ids: Some(vec![
                "grok:1".into(),
                "grok:2".into(),
                "grok:99".into(),
            ]),
            ..Default::default()
        },
    );

    assert_eq!(result.favorite_count, 2);
    assert_eq!(result.total_items, 2);
    assert_eq!(
        result.items.iter().map(|c| c.id.as_str()).collect::<Vec<_>>(),
        vec!["grok:1", "grok:2"]
    );
    assert_eq!(result.total_chats, 25);
}

#[test]
fn filters_by_source_and_paginates() {
    let chats = vec![
        make_chat("grok:1", ChatSource::Grok, "Grok A", "2026-06-24T12:00:00Z"),
        make_chat("grok:2", ChatSource::Grok, "Grok B", "2026-06-24T11:00:00Z"),
        make_chat(
            "codex:1",
            ChatSource::Codex,
            "Codex A",
            "2026-06-24T10:00:00Z",
        ),
    ];

    let result = build_chat_list_response(
        chats,
        ChatListQuery {
            page: 1,
            page_size: Some(1),
            source: Some("grok".into()),
            ..Default::default()
        },
    );

    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].source, ChatSource::Grok);
    assert_eq!(result.total_items, 2);
    assert_eq!(result.total_pages, 2);
    assert!(result.has_next_page);
    assert_eq!(result.counts.grok, 2);
    assert_eq!(result.counts.codex, 1);
    assert_eq!(result.total_chats, 3);
}

fn fixture_paths() -> DataPaths {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    DataPaths {
        cursor_home: root.join("cursor"),
        grok_home: root.join("grok"),
        codex_home: root.join("codex"),
        opencode_data_dir: root.join("opencode"),
        claude_home: root.join("claude"),
    }
}

#[test]
fn aggregate_fixture_roots() {
    let paths = fixture_paths();
    let chats = aggregate_chats(&paths);
    assert!(
        chats.len() >= 1,
        "expected at least one session from fixtures, got {}",
        chats.len()
    );

    // Aggregated list should be sorted by updated_at desc
    for window in chats.windows(2) {
        assert!(
            window[0].updated_at >= window[1].updated_at,
            "not sorted desc: {} then {}",
            window[0].updated_at,
            window[1].updated_at
        );
    }
}
