//! Scan skill roots and build summaries (no full content load beyond frontmatter).

use super::frontmatter::parse_frontmatter;
use super::id::encode_skill_id;
use super::path_guard::resolve_listed_skill_dir;
use super::paths::SkillPaths;
use super::types::{SkillSource, SkillSummary};
use std::fs;
use std::path::Path;

/// List installed skills under configured roots, sorted by name then source.
///
/// ```ignore
/// let skills = list_skills(&SkillPaths::from_env());
/// ```
pub fn list_skills(paths: &SkillPaths) -> Vec<SkillSummary> {
    let mut skills = Vec::new();

    for (source, root) in paths.roots() {
        let Ok(entries) = fs::read_dir(root) else {
            continue;
        };
        for entry in entries.flatten() {
            if let Some(summary) = skill_summary_from_listed_path(source, &entry.path()) {
                skills.push(summary);
            }
        }
    }

    sort_skill_summaries(&mut skills);
    skills
}

pub fn find_summary_for_listed_path(listed: &Path, paths: &SkillPaths) -> Option<SkillSummary> {
    // Re-scan so source/symlink flags match what the UI listed (not only real path).
    list_skills(paths)
        .into_iter()
        .find(|summary| Path::new(&summary.path) == listed)
}

fn sort_skill_summaries(skills: &mut [SkillSummary]) {
    skills.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then_with(|| format!("{:?}", a.source).cmp(&format!("{:?}", b.source)))
    });
}

fn skill_summary_from_listed_path(source: SkillSource, listed_path: &Path) -> Option<SkillSummary> {
    let (real_path, is_symlink) = resolve_listed_skill_dir(listed_path)?;
    let skill_md = real_path.join("SKILL.md");
    if !skill_md.is_file() {
        return None;
    }

    let content = fs::read_to_string(&skill_md).unwrap_or_default();
    let (frontmatter_name, frontmatter_description) = parse_frontmatter(&content);
    let directory_name = listed_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("skill")
        .to_string();

    Some(SkillSummary {
        id: encode_skill_id(listed_path),
        name: frontmatter_name.unwrap_or(directory_name),
        description: frontmatter_description.unwrap_or_default(),
        source,
        path: listed_path.to_string_lossy().into_owned(),
        real_path: real_path.to_string_lossy().into_owned(),
        is_symlink,
    })
}
