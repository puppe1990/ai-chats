use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SkillSource {
    Grok,
    Agents,
    Claude,
    Codex,
    Cursor,
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source: SkillSource,
    pub path: String,
    pub real_path: String,
    pub is_symlink: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDetail {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source: SkillSource,
    pub path: String,
    pub real_path: String,
    pub is_symlink: bool,
    pub content: String,
}

impl SkillDetail {
    pub fn from_summary(summary: SkillSummary, content: String) -> Self {
        Self {
            id: summary.id,
            name: summary.name,
            description: summary.description,
            source: summary.source,
            path: summary.path,
            real_path: summary.real_path,
            is_symlink: summary.is_symlink,
            content,
        }
    }
}
