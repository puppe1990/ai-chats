use ai_chats_core::{parse_source_arg, ChatSource};

#[test]
fn missing_empty_and_all_mean_no_filter() {
    assert_eq!(parse_source_arg(None).unwrap(), None);
    assert_eq!(parse_source_arg(Some("")).unwrap(), None);
    assert_eq!(parse_source_arg(Some("  ")).unwrap(), None);
    assert_eq!(parse_source_arg(Some("all")).unwrap(), None);
}

#[test]
fn known_source_maps_to_enum() {
    assert_eq!(
        parse_source_arg(Some("claude")).unwrap(),
        Some(ChatSource::Claude)
    );
    assert_eq!(
        parse_source_arg(Some("commandcode")).unwrap(),
        Some(ChatSource::CommandCode)
    );
}

#[test]
fn unknown_source_errors_with_received_value() {
    let err = parse_source_arg(Some("windsurf")).unwrap_err();
    assert!(err.contains("windsurf"), "error was {err}");
    assert!(err.contains("cursor"), "error was {err}");
}
