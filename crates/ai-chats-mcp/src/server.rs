use crate::handlers::{
    handle_get_chat, handle_list_recent, handle_search_chats, handle_search_messages,
    GetChatParams, ListRecentParams, SearchChatsParams, SearchMessagesParams,
};
use ai_chats_core::DataPaths;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ContentBlock, Implementation, ServerCapabilities, ServerConfig};
use rmcp::{tool, tool_handler, tool_router, ServerHandler};

const INSTRUCTIONS: &str = "Find coding-agent chats on this machine (Cursor, Grok, Codex, OpenCode, Claude Code, Command Code). Call search_chats first (title, working directory, source, model). If that misses, call list_recent_chats. Call search_chat_messages only when the topic is likely inside message bodies and the first two tools failed. Then call get_chat with a chatId from those results.";

#[derive(Clone)]
pub struct AiChatsMcp {
    paths: DataPaths,
}

impl AiChatsMcp {
    pub fn from_env() -> Self {
        Self {
            paths: DataPaths::from_env(),
        }
    }
}

fn json_ok(value: serde_json::Value) -> CallToolResult {
    let text = serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string());
    CallToolResult::success(vec![ContentBlock::text(text)])
}

fn json_err(message: String) -> CallToolResult {
    CallToolResult::error(vec![ContentBlock::text(message)])
}

async fn run_blocking<F>(paths: DataPaths, work: F) -> CallToolResult
where
    F: FnOnce(&DataPaths) -> Result<serde_json::Value, String> + Send + 'static,
{
    let result = tokio::task::spawn_blocking(move || work(&paths))
        .await
        .unwrap_or_else(|e| Err(format!("worker join failed: {e}")));
    match result {
        Ok(value) => json_ok(value),
        Err(message) => json_err(message),
    }
}

#[tool_router]
impl AiChatsMcp {
    #[tool(
        description = "Search chats by title, working directory, source, or model. Use this first."
    )]
    async fn search_chats(
        &self,
        Parameters(params): Parameters<SearchChatsParams>,
    ) -> CallToolResult {
        let paths = self.paths.clone();
        run_blocking(paths, move |paths| handle_search_chats(paths, params)).await
    }

    #[tool(
        description = "List the most recently updated chats. Use after search_chats if it missed."
    )]
    async fn list_recent_chats(
        &self,
        Parameters(params): Parameters<ListRecentParams>,
    ) -> CallToolResult {
        let paths = self.paths.clone();
        run_blocking(paths, move |paths| handle_list_recent(paths, params)).await
    }

    #[tool(
        description = "Search inside message bodies. Use only after search_chats and list_recent_chats did not find the conversation."
    )]
    async fn search_chat_messages(
        &self,
        Parameters(params): Parameters<SearchMessagesParams>,
    ) -> CallToolResult {
        let paths = self.paths.clone();
        run_blocking(paths, move |paths| handle_search_messages(paths, params)).await
    }

    #[tool(
        description = "Open a chat transcript by id from search_chats, list_recent_chats, or search_chat_messages."
    )]
    async fn get_chat(&self, Parameters(params): Parameters<GetChatParams>) -> CallToolResult {
        let paths = self.paths.clone();
        run_blocking(paths, move |paths| handle_get_chat(paths, params)).await
    }
}

#[tool_handler]
impl ServerHandler for AiChatsMcp {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("ai-chats", env!("CARGO_PKG_VERSION")))
            .with_instructions(INSTRUCTIONS)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_info_advertises_ai_chats_name() {
        let info = AiChatsMcp::from_env().get_info();
        assert_eq!(info.server_info.name, "ai-chats");
        assert_eq!(info.server_info.version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn tool_router_lists_search_tools() {
        let names: Vec<String> = AiChatsMcp::tool_router()
            .list_all()
            .into_iter()
            .map(|tool| tool.name.into_owned())
            .collect();
        for expected in [
            "search_chats",
            "list_recent_chats",
            "search_chat_messages",
            "get_chat",
        ] {
            assert!(names.contains(&expected.to_string()), "missing {expected}");
        }
    }
}
