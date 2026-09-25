use crate::aggregate_chats;
use crate::list::parse_source_arg;
use crate::messages::fetch_chat_detail;
use crate::paths::DataPaths;
use crate::types::{
    ChatMessage, ChatSession, MessageSearchHit, MessageSearchQuery, MessageSearchResponse,
};
use std::time::{Duration, Instant};

const SNIPPET_RADIUS: usize = 80;
const SNIPPET_MAX: usize = 200;

pub const MESSAGE_SEARCH_TIMEOUT_MS: u64 = 8000;
pub const DEFAULT_MAX_CHATS: u32 = 40;
pub const MAX_MAX_CHATS: u32 = 80;
pub const DEFAULT_MAX_HITS: u32 = 10;
pub const MAX_MAX_HITS: u32 = 25;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MessageSearchError {
    EmptyQuery { received: String },
    InvalidSource { received: String },
}

impl std::fmt::Display for MessageSearchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyQuery { received } => write!(
                f,
                "empty query: received {received:?}, expected a non-empty search string"
            ),
            Self::InvalidSource { received } => write!(
                f,
                "invalid source: received {received:?}, expected one of {}",
                crate::SOURCE_KEYS
            ),
        }
    }
}

impl std::error::Error for MessageSearchError {}

fn clamp(value: Option<u32>, default: u32, max: u32) -> u32 {
    match value {
        Some(0) | None => default,
        Some(n) => n.min(max).max(1),
    }
}

fn require_needle(query: &str) -> Result<String, MessageSearchError> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Err(MessageSearchError::EmptyQuery {
            received: query.to_string(),
        });
    }
    Ok(needle)
}

fn require_source(source: Option<String>) -> Result<Option<crate::ChatSource>, MessageSearchError> {
    match parse_source_arg(source.as_deref()) {
        Ok(parsed) => Ok(parsed),
        Err(_) => Err(MessageSearchError::InvalidSource {
            received: source.unwrap_or_default(),
        }),
    }
}

fn hit_from(chat: &ChatSession, message: ChatMessage, snippet: String) -> MessageSearchHit {
    MessageSearchHit {
        chat_id: chat.id.clone(),
        title: chat.title.clone(),
        source: chat.source,
        updated_at: chat.updated_at.clone(),
        message_id: message.id,
        role: message.role,
        snippet,
    }
}

fn leftover_unscanned(scanned: u32, total: usize) -> bool {
    scanned < total as u32
}

fn collect_hits_for_chat(
    chat: &ChatSession,
    messages: Vec<ChatMessage>,
    needle: &str,
    hits: &mut Vec<MessageSearchHit>,
    max_hits: u32,
) -> bool {
    for message in messages {
        let Some(snippet) = snippet_around(&message.content, needle) else {
            continue;
        };
        hits.push(hit_from(chat, message, snippet));
        if hits.len() as u32 >= max_hits {
            return true;
        }
    }
    false
}

pub fn scan_chat_messages<F>(
    chats: &[ChatSession],
    needle: &str,
    max_chats: u32,
    max_hits: u32,
    deadline: Instant,
    mut load_messages: F,
) -> (Vec<MessageSearchHit>, u32, bool)
where
    F: FnMut(&ChatSession) -> Vec<ChatMessage>,
{
    let mut hits = Vec::new();
    let mut scanned = 0u32;
    let cap = max_chats.min(chats.len() as u32);
    for chat in chats.iter().take(cap as usize) {
        if Instant::now() >= deadline {
            return (hits, scanned, true);
        }
        scanned += 1;
        let filled = collect_hits_for_chat(chat, load_messages(chat), needle, &mut hits, max_hits);
        if filled {
            return (hits, scanned, leftover_unscanned(scanned, chats.len()));
        }
    }
    (hits, scanned, leftover_unscanned(scanned, chats.len()))
}

fn chats_matching_source(paths: &DataPaths, source: Option<crate::ChatSource>) -> Vec<ChatSession> {
    let mut chats = aggregate_chats(paths);
    if let Some(want) = source {
        chats.retain(|c| c.source == want);
    }
    chats
}

fn messages_for_session(session: &ChatSession, paths: &DataPaths) -> Vec<ChatMessage> {
    fetch_chat_detail(&session.id, session, paths)
        .map(|detail| detail.messages)
        .unwrap_or_default()
}

fn search_caps(query: &MessageSearchQuery) -> (u32, u32) {
    (
        clamp(query.max_chats, DEFAULT_MAX_CHATS, MAX_MAX_CHATS),
        clamp(query.max_hits, DEFAULT_MAX_HITS, MAX_MAX_HITS),
    )
}

fn scan_until_deadline(
    chats: &[ChatSession],
    needle: &str,
    max_chats: u32,
    max_hits: u32,
    paths: &DataPaths,
) -> (Vec<MessageSearchHit>, u32, bool) {
    let deadline = Instant::now() + Duration::from_millis(MESSAGE_SEARCH_TIMEOUT_MS);
    scan_chat_messages(chats, needle, max_chats, max_hits, deadline, |session| {
        messages_for_session(session, paths)
    })
}

pub fn search_chat_messages(
    query: MessageSearchQuery,
    paths: &DataPaths,
) -> Result<MessageSearchResponse, MessageSearchError> {
    let received = query.query.clone();
    let needle = require_needle(&query.query)?;
    let (max_chats, max_hits) = search_caps(&query);
    let source = require_source(query.source)?;
    let chats = chats_matching_source(paths, source);
    let (hits, chats_scanned, truncated) =
        scan_until_deadline(&chats, &needle, max_chats, max_hits, paths);
    Ok(MessageSearchResponse {
        query: received,
        hits,
        chats_scanned,
        truncated,
    })
}

pub fn snippet_around(haystack: &str, needle: &str) -> Option<String> {
    let lower = haystack.to_lowercase();
    let needle_l = needle.to_lowercase();
    let start = lower.find(&needle_l)?;
    let end = start + needle_l.len();
    let from = start.saturating_sub(SNIPPET_RADIUS);
    let to = (end + SNIPPET_RADIUS).min(haystack.len());
    let (from_b, to_b) = clip_char_range(haystack, from, to);
    Some(format_snippet(haystack, from_b, to_b))
}

fn clip_char_range(haystack: &str, from: usize, to: usize) -> (usize, usize) {
    let len = haystack.len();
    let mut to_b = to.min(len);
    while to_b < len && !haystack.is_char_boundary(to_b) {
        to_b += 1;
    }
    let mut from_b = from.min(len);
    while from_b > 0 && !haystack.is_char_boundary(from_b) {
        from_b -= 1;
    }
    (from_b, to_b)
}

fn format_snippet(haystack: &str, from_b: usize, to: usize) -> String {
    let mut slice = haystack[from_b..to].replace(['\n', '\r'], " ");
    if from_b > 0 {
        slice.insert(0, '…');
    }
    if to < haystack.len() {
        slice.push('…');
    }
    cap_snippet(slice)
}

fn cap_snippet(slice: String) -> String {
    if slice.chars().count() <= SNIPPET_MAX {
        return slice;
    }
    let mut clipped: String = slice.chars().take(SNIPPET_MAX - 1).collect();
    clipped.push('…');
    clipped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clip_char_range_clamps_to_haystack_len() {
        assert_eq!(clip_char_range("hello", 0, 99), (0, 5));
        assert_eq!(clip_char_range("hello", 99, 99), (5, 5));
    }
}
