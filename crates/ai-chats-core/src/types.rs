use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatSource {
    Cursor,
    Grok,
    Codex,
    Opencode,
    Claude,
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
    pub total_chats: u32,
    pub favorite_count: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub struct SourceCounts {
    pub cursor: u32,
    pub grok: u32,
    pub codex: u32,
    pub opencode: u32,
    pub claude: u32,
}
