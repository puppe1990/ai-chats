//! Tauri desktop shell for AI Chats.
//!
//! The product data path stays on the Node/TanStack Start server
//! (`createServerFn` + providers reading local agent stores). Tauri only
//! provides the native window and, in release builds, starts/stops that
//! local backend on `http://127.0.0.1:3847`.
//!
//! Window creation is deferred (`create: false` in tauri.conf.json) so the
//! webview is only built *after* the Node backend is ready in release mode —
//! otherwise a cold start loads connection-refused and never recovers.

use std::process::Child;
use std::sync::Mutex;

use tauri::{Manager, RunEvent, WebviewWindowBuilder};

#[cfg(not(debug_assertions))]
mod backend {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::path::PathBuf;
    use std::process::{Child, Command, Stdio};
    use std::thread;
    use std::time::Duration;

    pub const HOST: &str = "127.0.0.1";
    pub const PORT: u16 = 3847;

    pub fn project_root() -> PathBuf {
        if let Ok(root) = std::env::var("AI_CHATS_ROOT") {
            return PathBuf::from(root);
        }
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("src-tauri must live inside the project root")
            .to_path_buf()
    }

    /// Resolve `npm` for GUI launches (Finder PATH is minimal).
    fn resolve_npm() -> PathBuf {
        if let Ok(from_env) = std::env::var("NPM_PATH") {
            let p = PathBuf::from(from_env);
            if p.is_file() {
                return p;
            }
        }
        let candidates = [
            "/opt/homebrew/bin/npm",
            "/usr/local/bin/npm",
            "/usr/bin/npm",
        ];
        for c in candidates {
            let p = PathBuf::from(c);
            if p.is_file() {
                return p;
            }
        }
        // Last resort: hope PATH is usable (dev shells, launch scripts).
        PathBuf::from("npm")
    }

    fn npm_command() -> Command {
        let npm = resolve_npm();
        let mut cmd = Command::new(&npm);
        // Ensure Homebrew / common Node dirs are present for `node` child of npm.
        let mut path = std::env::var("PATH").unwrap_or_default();
        for extra in [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
        ] {
            if !path.split(':').any(|p| p == extra) {
                path = format!("{extra}:{path}");
            }
        }
        cmd.env("PATH", path);
        cmd
    }

    pub fn server_responds_ok() -> bool {
        let mut stream = match TcpStream::connect((HOST, PORT)) {
            Ok(s) => s,
            Err(_) => return false,
        };
        let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));

        let request = format!(
            "GET / HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\n\r\n"
        );
        if stream.write_all(request.as_bytes()).is_err() {
            return false;
        }

        let mut body = String::new();
        let _ = stream.read_to_string(&mut body);
        body.contains("AI Chats")
    }

    fn ensure_production_build(root: &std::path::Path) -> Result<(), String> {
        let server_js = root.join("dist/server/server.js");
        if server_js.exists() {
            return Ok(());
        }

        let status = npm_command()
            .args(["run", "build"])
            .current_dir(root)
            .status()
            .map_err(|e| format!("failed to run npm run build: {e}"))?;

        if !status.success() {
            return Err("npm run build failed — cannot start desktop backend".into());
        }
        if !server_js.exists() {
            return Err("npm run build finished but dist/server/server.js is missing".into());
        }
        Ok(())
    }

    /// Starts the Node production server if nothing is already serving AI Chats.
    /// Returns the child process when we spawned it (caller must kill on exit).
    pub fn start_backend() -> Result<Option<Child>, String> {
        if server_responds_ok() {
            log::info!("AI Chats server already running on {HOST}:{PORT}");
            return Ok(None);
        }

        let root = project_root();
        ensure_production_build(&root)?;

        log::info!("Starting AI Chats server from {}", root.display());
        let child = npm_command()
            .args([
                "run",
                "preview",
                "--",
                "--host",
                HOST,
                "--port",
                &PORT.to_string(),
            ])
            .current_dir(&root)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| {
                format!("failed to start AI Chats server (is Node/npm on PATH?): {e}")
            })?;

        for _ in 0..120 {
            if server_responds_ok() {
                log::info!("AI Chats server ready on http://{HOST}:{PORT}/");
                return Ok(Some(child));
            }
            thread::sleep(Duration::from_millis(500));
        }

        let mut child = child;
        let _ = child.kill();
        Err(format!(
            "timed out waiting for AI Chats server at http://{HOST}:{PORT}/"
        ))
    }
}

struct BackendState {
    child: Mutex<Option<Child>>,
}

fn stop_backend(state: &BackendState) {
    if let Ok(mut guard) = state.child.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
            log::info!("Stopped AI Chats backend process");
        }
    }
}

/// Create the main webview from tauri.conf.json only after setup work is done.
/// Config has `"create": false` so Tauri does not navigate before the backend is up.
fn create_main_window(app: &tauri::App) -> tauri::Result<()> {
    let conf = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .cloned()
        .or_else(|| app.config().app.windows.first().cloned())
        .expect("tauri.conf.json must define at least one window");

    let window = WebviewWindowBuilder::from_config(app.handle(), &conf)?.build()?;
    window.show()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // Release: start Node backend *before* building the webview so the
            // first navigation hits a live server (no connection-refused flash).
            #[cfg(not(debug_assertions))]
            {
                let child = backend::start_backend().map_err(|e| {
                    log::error!("{e}");
                    e
                })?;
                app.manage(BackendState {
                    child: Mutex::new(child),
                });
            }

            // Dev: beforeDevCommand already waited for devUrl; still create here
            // because config uses create:false for a single code path.
            create_main_window(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<BackendState>() {
                stop_backend(&state);
            }
        }
    });
}
