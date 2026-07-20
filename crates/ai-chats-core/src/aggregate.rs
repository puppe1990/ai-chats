use crate::paths::DataPaths;
use crate::providers::{claude, codex, cursor, grok, opencode};
use crate::types::ChatSession;
use std::sync::mpsc;
use std::time::Duration;

/// Prevent a single slow/locked agent store from freezing the whole UI.
pub const PROVIDER_TIMEOUT_MS: u64 = 3500;

fn spawn_fetch<F>(name: &'static str, f: F) -> mpsc::Receiver<Result<Vec<ChatSession>, ()>>
where
    F: FnOnce() -> Vec<ChatSession> + Send + 'static,
{
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f));
        match result {
            Ok(v) => {
                let _ = tx.send(Ok(v));
            }
            Err(_) => {
                eprintln!("[aggregate_chats] {name} provider panicked");
                let _ = tx.send(Err(()));
            }
        }
    });
    rx
}

fn recv_fetch(name: &str, rx: mpsc::Receiver<Result<Vec<ChatSession>, ()>>) -> Vec<ChatSession> {
    match rx.recv_timeout(Duration::from_millis(PROVIDER_TIMEOUT_MS)) {
        Ok(Ok(v)) => v,
        Ok(Err(())) | Err(_) => {
            eprintln!("[aggregate_chats] {name} timed out or failed");
            vec![]
        }
    }
}

/// Fetch chats from all providers in parallel with per-provider timeouts.
/// Results are sorted by `updated_at` descending (ISO string order).
pub fn aggregate_chats(paths: &DataPaths) -> Vec<ChatSession> {
    let grok_sessions = paths.grok_home.join("sessions");
    let codex_home = paths.codex_home.clone();
    let cursor_chats = paths.cursor_home.join("chats");
    let opencode_db = paths.opencode_data_dir.join("opencode.db");
    let claude_home = paths.claude_home.clone();

    let grok_rx = spawn_fetch("grok", move || {
        grok::fetch_grok_chats(&grok_sessions).unwrap_or_else(|err| {
            eprintln!("[aggregate_chats] grok provider failed: {err}");
            vec![]
        })
    });
    let codex_rx = spawn_fetch("codex", move || {
        codex::fetch_codex_chats(&codex_home).unwrap_or_else(|err| {
            eprintln!("[aggregate_chats] codex provider failed: {err}");
            vec![]
        })
    });
    let cursor_rx = spawn_fetch("cursor", move || cursor::fetch_cursor_chats(&cursor_chats));
    let opencode_rx =
        spawn_fetch("opencode", move || opencode::fetch_opencode_chats(&opencode_db));
    let claude_rx = spawn_fetch("claude", move || {
        claude::fetch_claude_chats(&claude_home).unwrap_or_else(|err| {
            eprintln!("[aggregate_chats] claude provider failed: {err}");
            vec![]
        })
    });

    let grok = recv_fetch("grok", grok_rx);
    let codex = recv_fetch("codex", codex_rx);
    let cursor = recv_fetch("cursor", cursor_rx);
    let opencode = recv_fetch("opencode", opencode_rx);
    let claude = recv_fetch("claude", claude_rx);

    let mut all = Vec::with_capacity(
        grok.len() + codex.len() + cursor.len() + opencode.len() + claude.len(),
    );
    all.extend(grok);
    all.extend(codex);
    all.extend(cursor);
    all.extend(opencode);
    all.extend(claude);

    all.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    all
}
