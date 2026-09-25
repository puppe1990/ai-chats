use crate::compact::{
    clamp_limit, compact_list, compact_recent, paginate_detail, DEFAULT_GET_CHAT_LIMIT,
    DEFAULT_RECENT_LIMIT, DEFAULT_SEARCH_PAGE_SIZE, MAX_GET_CHAT_LIMIT, MAX_PAGE_SIZE,
};
use ai_chats_core::list::source_key;
use ai_chats_core::{
    get_chat_detail, get_chats, parse_source_arg, search_chat_messages, ChatListQuery, DataPaths,
    MessageSearchQuery, MessageSearchResponse,
};
use rmcp::schemars::{self, JsonSchema};
use serde::Deserialize;
use serde_json::Value;
use std::time::{Duration, Instant};

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SearchChatsParams {
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub page_size: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ListRecentParams {
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SearchMessagesParams {
    pub query: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub max_chats: Option<u32>,
    #[serde(default)]
    pub max_hits: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct GetChatParams {
    pub chat_id: String,
    #[serde(default)]
    pub offset: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

fn require_source(source: Option<String>) -> Result<Option<String>, String> {
    Ok(parse_source_arg(source.as_deref())?
        .map(source_key)
        .map(str::to_string))
}

pub fn handle_search_chats(paths: &DataPaths, params: SearchChatsParams) -> Result<Value, String> {
    let source = require_source(params.source)?;
    let page = params.page.unwrap_or(1).max(1);
    let page_size = clamp_limit(params.page_size, DEFAULT_SEARCH_PAGE_SIZE, MAX_PAGE_SIZE);
    let response = get_chats(
        ChatListQuery {
            page,
            page_size: Some(page_size),
            source,
            query: params.query,
            ..Default::default()
        },
        paths,
    );
    Ok(compact_list(&response))
}

pub fn handle_list_recent(paths: &DataPaths, params: ListRecentParams) -> Result<Value, String> {
    let source = require_source(params.source)?;
    let limit = clamp_limit(params.limit, DEFAULT_RECENT_LIMIT, MAX_PAGE_SIZE);
    let response = get_chats(
        ChatListQuery {
            page: 1,
            page_size: Some(limit),
            source,
            query: None,
            ..Default::default()
        },
        paths,
    );
    Ok(compact_recent(&response))
}

fn log_scan_b(result: &MessageSearchResponse, elapsed: Duration) {
    tracing::info!(
        query = %result.query,
        chatsScanned = result.chats_scanned,
        hits = result.hits.len(),
        truncated = result.truncated,
        elapsed = ?elapsed,
        "search_chat_messages"
    );
}

pub fn handle_search_messages(
    paths: &DataPaths,
    params: SearchMessagesParams,
) -> Result<Value, String> {
    let started = Instant::now();
    let result = search_chat_messages(
        MessageSearchQuery {
            query: params.query,
            source: params.source,
            max_chats: params.max_chats,
            max_hits: params.max_hits,
        },
        paths,
    )
    .map_err(|e| e.to_string())?;
    log_scan_b(&result, started.elapsed());
    Ok(serde_json::to_value(result).expect("serialize"))
}

fn missing_chat_id_error(chat_id: &str) -> String {
    format!(
        "chat not found: received {chat_id:?}, expected an id from search_chats or list_recent_chats (format source:sessionId)"
    )
}

pub fn handle_get_chat(paths: &DataPaths, params: GetChatParams) -> Result<Value, String> {
    let detail = get_chat_detail(&params.chat_id, paths)
        .ok_or_else(|| missing_chat_id_error(&params.chat_id))?;
    let limit = clamp_limit(params.limit, DEFAULT_GET_CHAT_LIMIT, MAX_GET_CHAT_LIMIT);
    let offset = params.offset.unwrap_or(0);
    let page = paginate_detail(&detail, offset, limit);
    Ok(serde_json::to_value(page).expect("serialize"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ai_chats_core::DataPaths;
    use std::path::PathBuf;

    fn fixture_paths() -> DataPaths {
        let root =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ai-chats-core/tests/fixtures");
        DataPaths {
            cursor_home: PathBuf::from("/tmp/ai-chats-missing-provider-root"),
            grok_home: root.join("grok"),
            codex_home: PathBuf::from("/tmp/ai-chats-missing-provider-root"),
            opencode_data_dir: PathBuf::from("/tmp/ai-chats-missing-provider-root"),
            claude_home: root.join("claude"),
            commandcode_home: PathBuf::from("/tmp/ai-chats-missing-provider-root"),
        }
    }

    #[test]
    fn search_chats_finds_claude_title() {
        let v = handle_search_chats(
            &fixture_paths(),
            SearchChatsParams {
                query: Some("TanStack".into()),
                source: None,
                page: None,
                page_size: None,
            },
        )
        .expect("ok");
        let items = v.get("items").and_then(|x| x.as_array()).cloned().unwrap();
        assert_eq!(items.len(), 1);
        assert!(v.get("counts").is_none());
    }

    #[test]
    fn search_chats_rejects_unknown_source() {
        let err = handle_search_chats(
            &fixture_paths(),
            SearchChatsParams {
                query: None,
                source: Some("windsurf".into()),
                page: None,
                page_size: None,
            },
        )
        .unwrap_err();
        assert!(err.contains("windsurf"));
    }

    #[test]
    fn list_recent_returns_items() {
        let v = handle_list_recent(
            &fixture_paths(),
            ListRecentParams {
                source: None,
                limit: Some(10),
            },
        )
        .expect("ok");
        assert!(v.get("totalItems").is_some());
        assert!(v.get("items").is_some());
        assert!(v.get("page").is_none());
    }

    #[test]
    fn get_chat_missing_id_errors() {
        let err = handle_get_chat(
            &fixture_paths(),
            GetChatParams {
                chat_id: "grok:does-not-exist".into(),
                offset: None,
                limit: None,
            },
        )
        .unwrap_err();
        assert!(err.contains("grok:does-not-exist"));
        assert!(err.contains("source:sessionId"));
    }

    #[test]
    fn get_chat_returns_page() {
        let v = handle_get_chat(
            &fixture_paths(),
            GetChatParams {
                chat_id: "claude:7a176d05-ee9d-42f2-81ee-72b9ac9c800c".into(),
                offset: Some(0),
                limit: Some(2),
            },
        )
        .expect("ok");
        assert_eq!(v.get("hasMore").and_then(|x| x.as_bool()), Some(true));
        assert_eq!(v.get("totalMessages").and_then(|x| x.as_u64()), Some(3));
    }

    #[test]
    fn search_messages_last_resort_finds_body() {
        let v = handle_search_messages(
            &fixture_paths(),
            SearchMessagesParams {
                query: "TanStack".into(),
                source: None,
                max_chats: None,
                max_hits: None,
            },
        )
        .expect("ok");
        let hits = v.get("hits").and_then(|x| x.as_array()).cloned().unwrap();
        assert_eq!(hits.len(), 1);
    }

    #[test]
    fn search_chats_source_grok_excludes_claude_title() {
        let v = handle_search_chats(
            &fixture_paths(),
            SearchChatsParams {
                query: Some("TanStack".into()),
                source: Some("grok".into()),
                page: None,
                page_size: None,
            },
        )
        .expect("ok");
        let items = v.get("items").and_then(|x| x.as_array()).cloned().unwrap();
        assert!(items.is_empty());
    }

    #[test]
    fn search_chats_trimmed_source_canonicalizes() {
        let v = handle_search_chats(
            &fixture_paths(),
            SearchChatsParams {
                query: None,
                source: Some(" claude".into()),
                page: None,
                page_size: None,
            },
        )
        .expect("ok");
        let items = v.get("items").and_then(|x| x.as_array()).cloned().unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(
            items[0].get("source").and_then(|x| x.as_str()),
            Some("claude")
        );
    }

    #[test]
    fn search_messages_empty_query_errors() {
        let err = handle_search_messages(
            &fixture_paths(),
            SearchMessagesParams {
                query: "   ".into(),
                source: None,
                max_chats: None,
                max_hits: None,
            },
        )
        .unwrap_err();
        assert!(err.contains("   "));
        assert!(err.contains("empty query"));
    }

    fn from_json<T: serde::de::DeserializeOwned>(json: &str) -> T {
        serde_json::from_str(json).expect("params json")
    }

    #[test]
    fn optional_tool_params_default_when_omitted() {
        let search = from_json::<SearchChatsParams>(r#"{"query":"q"}"#);
        assert!(search.source.is_none() && search.page.is_none() && search.page_size.is_none());
        let recent = from_json::<ListRecentParams>("{}");
        assert!(recent.source.is_none() && recent.limit.is_none());
        let messages = from_json::<SearchMessagesParams>(r#"{"query":"x"}"#);
        assert!(messages.source.is_none() && messages.max_chats.is_none());
        assert!(messages.max_hits.is_none());
        let get = from_json::<GetChatParams>(r#"{"chat_id":"grok:1"}"#);
        assert!(get.offset.is_none() && get.limit.is_none());
    }
}
