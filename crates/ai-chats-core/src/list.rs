use crate::types::{ChatListQuery, ChatListResponse, ChatSession, ChatSource, SourceCounts};
use std::collections::{HashMap, HashSet};

pub const CHAT_PAGE_SIZE: u32 = 10;

/// Normalized list query with defaults applied.
#[derive(Debug, Clone)]
pub struct NormalizedChatListQuery {
    pub page: u32,
    pub page_size: u32,
    pub source: String,
    pub query: String,
    pub order: Vec<String>,
    pub favorite_ids: Vec<String>,
    pub favorites_only: bool,
}

pub fn source_label(source: ChatSource) -> &'static str {
    match source {
        ChatSource::Cursor => "Cursor",
        ChatSource::Grok => "Grok",
        ChatSource::Codex => "Codex",
        ChatSource::Opencode => "OpenCode",
        ChatSource::Claude => "Claude Code",
    }
}

pub fn source_key(source: ChatSource) -> &'static str {
    match source {
        ChatSource::Cursor => "cursor",
        ChatSource::Grok => "grok",
        ChatSource::Codex => "codex",
        ChatSource::Opencode => "opencode",
        ChatSource::Claude => "claude",
    }
}

fn parse_source_filter(source: &str) -> Option<ChatSource> {
    match source {
        "cursor" => Some(ChatSource::Cursor),
        "grok" => Some(ChatSource::Grok),
        "codex" => Some(ChatSource::Codex),
        "opencode" => Some(ChatSource::Opencode),
        "claude" => Some(ChatSource::Claude),
        _ => None,
    }
}

pub fn normalize_chat_list_query(input: &ChatListQuery) -> NormalizedChatListQuery {
    let page = if input.page == 0 { 1 } else { input.page };
    let page_size = match input.page_size {
        Some(0) | None => CHAT_PAGE_SIZE,
        Some(n) => n.max(1),
    };
    let source = input
        .source
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("all")
        .to_string();
    let query = input.query.clone().unwrap_or_default();
    let order = input.order.clone().unwrap_or_default();
    let favorite_ids = input
        .favorite_ids
        .clone()
        .unwrap_or_default()
        .into_iter()
        .filter(|id| !id.is_empty())
        .collect();
    let favorites_only = input.favorites_only.unwrap_or(false);

    NormalizedChatListQuery {
        page: page.max(1),
        page_size,
        source,
        query,
        order,
        favorite_ids,
        favorites_only,
    }
}

pub fn filter_chats(
    chats: &[ChatSession],
    source: &str,
    query: &str,
    favorite_ids: &[String],
    favorites_only: bool,
) -> Vec<ChatSession> {
    let normalized_query = query.trim().to_lowercase();
    let favorite_set: Option<HashSet<&str>> = if favorites_only {
        Some(favorite_ids.iter().map(|s| s.as_str()).collect())
    } else {
        None
    };
    let source_filter = if source == "all" || source.is_empty() {
        None
    } else {
        parse_source_filter(source)
    };

    chats
        .iter()
        .filter(|chat| {
            if let Some(want) = source_filter {
                if chat.source != want {
                    return false;
                }
            }

            if let Some(ref set) = favorite_set {
                if !set.contains(chat.id.as_str()) {
                    return false;
                }
            }

            if normalized_query.is_empty() {
                return true;
            }

            let haystack = [
                chat.title.as_str(),
                chat.cwd.as_deref().unwrap_or(""),
                chat.model.as_deref().unwrap_or(""),
                source_label(chat.source),
                source_key(chat.source),
            ]
            .join(" ")
            .to_lowercase();

            haystack.contains(&normalized_query)
        })
        .cloned()
        .collect()
}

#[derive(Debug, Clone)]
pub struct PaginateResult<T> {
    pub items: Vec<T>,
    pub page: u32,
    pub page_size: u32,
    pub total_items: u32,
    pub total_pages: u32,
    pub start_index: u32,
    pub end_index: u32,
    pub has_previous_page: bool,
    pub has_next_page: bool,
}

pub fn paginate<T: Clone>(items: &[T], page: u32, page_size: u32) -> PaginateResult<T> {
    let safe_page_size = page_size.max(1);
    let total_items = items.len() as u32;
    let total_pages = ((total_items as f64) / (safe_page_size as f64))
        .ceil()
        .max(1.0) as u32;
    let normalized_page = page.max(1).min(total_pages);
    let start = ((normalized_page - 1) * safe_page_size) as usize;
    let end = (start + safe_page_size as usize).min(items.len());
    let slice = if start < items.len() {
        items[start..end].to_vec()
    } else {
        Vec::new()
    };
    let end_index = if total_items == 0 {
        0
    } else {
        (start + slice.len()) as u32
    };

    PaginateResult {
        items: slice,
        page: normalized_page,
        page_size: safe_page_size,
        total_items,
        total_pages,
        start_index: if total_items == 0 {
            0
        } else {
            start as u32 + 1
        },
        end_index,
        has_previous_page: normalized_page > 1,
        has_next_page: normalized_page < total_pages,
    }
}

pub fn merge_chat_order(stored: &[String], chats: &[ChatSession]) -> Vec<String> {
    let valid_ids: HashSet<&str> = chats.iter().map(|c| c.id.as_str()).collect();
    let mut seen = HashSet::new();
    let mut merged = Vec::new();

    for id in stored {
        if !valid_ids.contains(id.as_str()) || !seen.insert(id.clone()) {
            continue;
        }
        merged.push(id.clone());
    }

    for chat in chats {
        if seen.insert(chat.id.clone()) {
            merged.push(chat.id.clone());
        }
    }

    merged
}

pub fn sort_chats_by_custom_order(chats: Vec<ChatSession>, order: &[String]) -> Vec<ChatSession> {
    if order.is_empty() {
        return chats;
    }

    let rank: HashMap<&str, usize> = order
        .iter()
        .enumerate()
        .map(|(i, id)| (id.as_str(), i))
        .collect();

    let mut ordered = chats;
    ordered.sort_by(|a, b| {
        let rank_a = rank.get(a.id.as_str());
        let rank_b = rank.get(b.id.as_str());

        match (rank_a, rank_b) {
            (Some(ra), Some(rb)) if ra != rb => ra.cmp(rb),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            _ => b.updated_at.cmp(&a.updated_at),
        }
    });
    ordered
}

fn count_sources(chats: &[ChatSession]) -> SourceCounts {
    let mut counts = SourceCounts::default();
    for chat in chats {
        match chat.source {
            ChatSource::Cursor => counts.cursor += 1,
            ChatSource::Grok => counts.grok += 1,
            ChatSource::Codex => counts.codex += 1,
            ChatSource::Opencode => counts.opencode += 1,
            ChatSource::Claude => counts.claude += 1,
        }
    }
    counts
}

pub fn build_chat_list_response(chats: Vec<ChatSession>, raw_query: ChatListQuery) -> ChatListResponse {
    let query = normalize_chat_list_query(&raw_query);

    let counts = count_sources(&chats);
    let total_chats = chats.len() as u32;

    let favorite_set: HashSet<&str> = query.favorite_ids.iter().map(|s| s.as_str()).collect();
    let favorite_count = chats
        .iter()
        .filter(|c| favorite_set.contains(c.id.as_str()))
        .count() as u32;

    let merged_order = merge_chat_order(&query.order, &chats);
    let filtered = filter_chats(
        &chats,
        &query.source,
        &query.query,
        &query.favorite_ids,
        query.favorites_only,
    );
    let ordered = sort_chats_by_custom_order(filtered, &merged_order);
    let pagination = paginate(&ordered, query.page, query.page_size);

    ChatListResponse {
        items: pagination.items,
        page: pagination.page,
        page_size: pagination.page_size,
        total_items: pagination.total_items,
        total_pages: pagination.total_pages,
        start_index: pagination.start_index,
        end_index: pagination.end_index,
        has_previous_page: pagination.has_previous_page,
        has_next_page: pagination.has_next_page,
        counts,
        total_chats,
        favorite_count,
    }
}
