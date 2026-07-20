use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct DataPaths {
    pub cursor_home: PathBuf,
    pub grok_home: PathBuf,
    pub codex_home: PathBuf,
    pub opencode_data_dir: PathBuf,
    pub claude_home: PathBuf,
}

fn home_dir() -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("/tmp"))
}

impl DataPaths {
    pub fn from_env() -> Self {
        let home = home_dir();
        Self {
            cursor_home: env::var_os("CURSOR_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".cursor")),
            grok_home: env::var_os("GROK_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".grok")),
            codex_home: env::var_os("CODEX_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".codex")),
            opencode_data_dir: env::var_os("OPENCODE_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".local/share/opencode")),
            claude_home: env::var_os("CLAUDE_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".claude")),
        }
    }
}
