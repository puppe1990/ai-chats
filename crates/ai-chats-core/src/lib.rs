pub mod aggregate;
pub mod list;
pub mod messages;
pub mod paths;
pub mod providers;
pub mod skills;
mod sqlite_util;
pub mod text;
pub mod types;

pub use aggregate::{aggregate_chats, PROVIDER_TIMEOUT_MS};
pub use list::{build_chat_list_response, CHAT_PAGE_SIZE};
pub use paths::DataPaths;
pub use skills::{
    encode_skill_id, get_skill, list_skills, save_skill, SkillDetail, SkillPaths, SkillSource,
    SkillSummary,
};
pub use types::*;

/// Aggregate all providers and build a filtered/paginated list response.
pub fn get_chats(query: ChatListQuery, paths: &DataPaths) -> ChatListResponse {
    let chats = aggregate_chats(paths);
    build_chat_list_response(chats, query)
}

/// Aggregate providers, find the session by id, and load message detail.
pub fn get_chat_detail(chat_id: &str, paths: &DataPaths) -> Option<ChatDetail> {
    let chats = aggregate_chats(paths);
    let session = chats.into_iter().find(|c| c.id == chat_id)?;
    messages::fetch_chat_detail(chat_id, &session, paths)
}
