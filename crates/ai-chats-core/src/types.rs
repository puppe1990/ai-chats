use serde::{Deserialize, Serialize};

/// Sentinel for the "chats without a cwd" folder bucket — never a real folder path.
pub const NO_FOLDER_FILTER: &str = "__no_folder__";

/// Sentinel meaning "do not filter by folder".
pub const ALL_FOLDERS: &str = "all";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatSource {
    Cursor,
    Grok,
    Codex,
    Opencode,
    Claude,
    CommandCode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
    pub id: String,
    pub source: ChatSource,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_path: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatMessageRole {
    User,
    Assistant,
    System,
    Tool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: ChatMessageRole,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatDetail {
    pub session: ChatSession,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatListQuery {
    pub page: u32,
    #[serde(default)]
    pub page_size: Option<u32>,
    #[serde(default)]
    pub source: Option<String>,
    /// Exact cwd to keep, or NO_FOLDER_FILTER for chats without one.
    #[serde(default)]
    pub folder: Option<String>,
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub order: Option<Vec<String>>,
    #[serde(default)]
    pub favorite_ids: Option<Vec<String>>,
    #[serde(default)]
    pub favorites_only: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatListResponse {
    pub items: Vec<ChatSession>,
    pub page: u32,
    pub page_size: u32,
    pub total_items: u32,
    pub total_pages: u32,
    pub start_index: u32,
    pub end_index: u32,
    pub has_previous_page: bool,
    pub has_next_page: bool,
    pub counts: SourceCounts,
    pub folders: Vec<FolderCount>,
    pub total_chats: u32,
    pub favorite_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderCount {
    /// Absolute working directory, or NO_FOLDER_FILTER for chats without one.
    pub path: String,
    pub count: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub struct SourceCounts {
    pub cursor: u32,
    pub grok: u32,
    pub codex: u32,
    pub opencode: u32,
    pub claude: u32,
    pub commandcode: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSearchQuery {
    pub query: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub max_chats: Option<u32>,
    #[serde(default)]
    pub max_hits: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSearchHit {
    pub chat_id: String,
    pub title: String,
    pub source: ChatSource,
    pub updated_at: String,
    pub message_id: String,
    pub role: ChatMessageRole,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSearchResponse {
    pub query: String,
    pub hits: Vec<MessageSearchHit>,
    pub chats_scanned: u32,
    pub truncated: bool,
}
