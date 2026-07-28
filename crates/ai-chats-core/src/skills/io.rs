//! Read and write SKILL.md for a skill id.

use super::frontmatter::parse_frontmatter;
use super::id::decode_skill_id;
use super::list::find_summary_for_listed_path;
use super::path_guard::listed_path_is_under_skill_roots;
use super::paths::SkillPaths;
use super::types::SkillDetail;
use std::fs;
use std::path::PathBuf;

/// Load full SKILL.md. `Ok(None)` if id is unknown or skill is gone.
///
/// Escape attempts (path outside roots) also return `None` on get;
/// [`save_skill`] rejects them with an error instead.
pub fn get_skill(id: &str, paths: &SkillPaths) -> Result<Option<SkillDetail>, String> {
    let Some(listed) = decode_skill_id(id) else {
        return Ok(None);
    };
    let Some(summary) = find_summary_for_listed_path(&listed, paths) else {
        return Ok(None);
    };

    let skill_md = PathBuf::from(&summary.real_path).join("SKILL.md");
    let content = fs::read_to_string(&skill_md).map_err(|error| {
        format!(
            "Cannot read SKILL.md at path={} error={error}",
            skill_md.display()
        )
    })?;

    Ok(Some(detail_from_summary_and_content(summary, content)))
}

/// Write SKILL.md to the resolved real path, then re-read.
pub fn save_skill(id: &str, content: &str, paths: &SkillPaths) -> Result<SkillDetail, String> {
    let listed = decode_skill_id(id).ok_or_else(|| {
        format!(
            "Skill not found: invalid id (expected hex-encoded absolute path), received id={id:?}"
        )
    })?;

    if !listed_path_is_under_skill_roots(&listed, paths) {
        return Err(format!(
            "Path escapes skill roots (not under configured skill directories): path={}",
            listed.display()
        ));
    }

    let summary = find_summary_for_listed_path(&listed, paths).ok_or_else(|| {
        format!(
            "Skill not found under roots: path={} id={id:?}",
            listed.display()
        )
    })?;

    let skill_md = PathBuf::from(&summary.real_path).join("SKILL.md");
    fs::write(&skill_md, content).map_err(|error| {
        format!(
            "Cannot write SKILL.md at path={} error={error}",
            skill_md.display()
        )
    })?;

    get_skill(id, paths)?.ok_or_else(|| {
        format!(
            "Skill disappeared after save: path={} id={id:?}",
            listed.display()
        )
    })
}

fn detail_from_summary_and_content(
    summary: super::types::SkillSummary,
    content: String,
) -> SkillDetail {
    let (frontmatter_name, frontmatter_description) = parse_frontmatter(&content);
    let mut detail = SkillDetail::from_summary(summary, content);
    if let Some(name) = frontmatter_name {
        detail.name = name;
    }
    if let Some(description) = frontmatter_description {
        detail.description = description;
    }
    detail
}
