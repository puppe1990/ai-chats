//! Tauri desktop shell for AI Chats.
//!
//! Chat list/detail are served by Rust (`ai-chats-core`) via Tauri commands.
//! The webview loads the built SPA from `frontendDist` (no Node backend).

use ai_chats_core::{
    get_chat_detail as core_detail, get_chats as core_chats, ChatDetail, ChatListQuery,
    ChatListResponse, DataPaths,
};

#[tauri::command]
fn get_chats(query: ChatListQuery) -> Result<ChatListResponse, String> {
    Ok(core_chats(query, &DataPaths::from_env()))
}

#[tauri::command]
fn get_chat_detail(chat_id: String) -> Result<Option<ChatDetail>, String> {
    Ok(core_detail(&chat_id, &DataPaths::from_env()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_chats, get_chat_detail])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
