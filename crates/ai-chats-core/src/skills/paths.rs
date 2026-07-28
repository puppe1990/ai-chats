use std::env;
use std::path::{Path, PathBuf};

use super::types::SkillSource;

#[derive(Debug, Clone)]
pub struct SkillPaths {
    pub grok_skills: PathBuf,
    pub agents_skills: PathBuf,
    pub claude_skills: PathBuf,
    pub codex_skills: PathBuf,
    pub cursor_skills: PathBuf,
}

fn home_dir() -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("/tmp"))
}

impl SkillPaths {
    pub fn from_env() -> Self {
        let home = home_dir();
        let grok_home = env::var_os("GROK_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".grok"));
        let claude_home = env::var_os("CLAUDE_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".claude"));
        let codex_home = env::var_os("CODEX_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".codex"));
        let cursor_home = env::var_os("CURSOR_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".cursor"));

        Self {
            grok_skills: grok_home.join("skills"),
            agents_skills: home.join(".agents/skills"),
            claude_skills: claude_home.join("skills"),
            codex_skills: codex_home.join("skills"),
            cursor_skills: cursor_home.join("skills"),
        }
    }

    pub fn roots(&self) -> Vec<(SkillSource, &Path)> {
        vec![
            (SkillSource::Grok, self.grok_skills.as_path()),
            (SkillSource::Agents, self.agents_skills.as_path()),
            (SkillSource::Claude, self.claude_skills.as_path()),
            (SkillSource::Codex, self.codex_skills.as_path()),
            (SkillSource::Cursor, self.cursor_skills.as_path()),
        ]
    }
}
