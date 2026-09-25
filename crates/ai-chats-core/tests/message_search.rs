use ai_chats_core::snippet_around;

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
