use ai_chats_core::{get_skill, list_skills, save_skill, SkillPaths, SkillSource};
use std::fs;
use std::path::{Path, PathBuf};

fn write_skill(dir: &Path, name: &str, content: &str) -> PathBuf {
    let skill_dir = dir.join(name);
    fs::create_dir_all(&skill_dir).unwrap();
    fs::write(skill_dir.join("SKILL.md"), content).unwrap();
    skill_dir
}

fn make_paths(root: &Path) -> SkillPaths {
    SkillPaths {
        grok_skills: root.join("grok/skills"),
        agents_skills: root.join("agents/skills"),
        claude_skills: root.join("claude/skills"),
        codex_skills: root.join("codex/skills"),
        cursor_skills: root.join("cursor/skills"),
    }
}

#[test]
fn list_skills_returns_empty_when_roots_missing() {
    let tmp = tempfile_dir("empty-roots");
    let paths = make_paths(&tmp);
    let skills = list_skills(&paths);
    assert!(skills.is_empty());
}

#[test]
fn list_skills_finds_skills_with_source_and_frontmatter() {
    let tmp = tempfile_dir("list-multi");
    let paths = make_paths(&tmp);

    fs::create_dir_all(&paths.grok_skills).unwrap();
    fs::create_dir_all(&paths.agents_skills).unwrap();

    write_skill(
        &paths.grok_skills,
        "check-work",
        "---\nname: check-work\ndescription: Verify your changes\n---\n\n# Body\n",
    );
    write_skill(
        &paths.agents_skills,
        "firecrawl",
        "---\nname: firecrawl\ndescription: Scrape the web\n---\n\nUse firecrawl.\n",
    );
    // Directory without SKILL.md must be ignored
    fs::create_dir_all(paths.agents_skills.join("not-a-skill")).unwrap();

    let skills = list_skills(&paths);
    assert_eq!(skills.len(), 2);

    let check = skills
        .iter()
        .find(|s| s.name == "check-work")
        .expect("check-work");
    assert_eq!(check.source, SkillSource::Grok);
    assert_eq!(check.description, "Verify your changes");
    assert!(!check.is_symlink);
    assert!(check.path.ends_with("grok/skills/check-work"));

    let fire = skills
        .iter()
        .find(|s| s.name == "firecrawl")
        .expect("firecrawl");
    assert_eq!(fire.source, SkillSource::Agents);
    assert_eq!(fire.description, "Scrape the web");
}

#[test]
fn list_skills_uses_directory_name_when_no_frontmatter_name() {
    let tmp = tempfile_dir("no-frontmatter");
    let paths = make_paths(&tmp);
    fs::create_dir_all(&paths.claude_skills).unwrap();
    write_skill(
        &paths.claude_skills,
        "seo-audit",
        "# SEO Audit\n\nDo the audit.\n",
    );

    let skills = list_skills(&paths);
    assert_eq!(skills.len(), 1);
    assert_eq!(skills[0].name, "seo-audit");
    assert_eq!(skills[0].source, SkillSource::Claude);
    assert_eq!(skills[0].description, "");
}

#[test]
fn list_skills_sorts_by_name_case_insensitive() {
    let tmp = tempfile_dir("sort");
    let paths = make_paths(&tmp);
    fs::create_dir_all(&paths.codex_skills).unwrap();
    write_skill(&paths.codex_skills, "Zebra", "# Z\n");
    write_skill(&paths.codex_skills, "alpha", "# A\n");
    write_skill(&paths.codex_skills, "Beta", "# B\n");

    let names: Vec<_> = list_skills(&paths).into_iter().map(|s| s.name).collect();
    assert_eq!(names, vec!["alpha", "Beta", "Zebra"]);
}

#[test]
fn list_skills_resolves_symlink_flags() {
    let tmp = tempfile_dir("symlink-list");
    let paths = make_paths(&tmp);
    fs::create_dir_all(&paths.agents_skills).unwrap();
    fs::create_dir_all(&paths.claude_skills).unwrap();

    let real = write_skill(
        &paths.agents_skills,
        "shared-skill",
        "---\nname: shared-skill\ndescription: Shared\n---\n\nBody\n",
    );
    let link = paths.claude_skills.join("shared-skill");
    std::os::unix::fs::symlink(&real, &link).unwrap();

    let skills = list_skills(&paths);
    assert_eq!(skills.len(), 2);

    let linked = skills
        .iter()
        .find(|s| s.source == SkillSource::Claude)
        .expect("claude entry");
    assert!(linked.is_symlink);
    assert_eq!(
        PathBuf::from(&linked.real_path).canonicalize().unwrap(),
        real.canonicalize().unwrap()
    );
}

#[test]
fn get_skill_returns_full_content() {
    let tmp = tempfile_dir("get");
    let paths = make_paths(&tmp);
    fs::create_dir_all(&paths.cursor_skills).unwrap();
    let content = "---\nname: helper\ndescription: Helps\n---\n\n# Helper\n";
    write_skill(&paths.cursor_skills, "helper", content);

    let listed = list_skills(&paths);
    assert_eq!(listed.len(), 1);
    let detail = get_skill(&listed[0].id, &paths)
        .unwrap()
        .expect("skill detail");
    assert_eq!(detail.content, content);
    assert_eq!(detail.name, "helper");
    assert_eq!(detail.source, SkillSource::Cursor);
}

#[test]
fn get_skill_returns_none_for_unknown_id() {
    let tmp = tempfile_dir("get-missing");
    let paths = make_paths(&tmp);
    let result = get_skill("not-a-real-id", &paths).unwrap();
    assert!(result.is_none());
}

#[test]
fn save_skill_writes_to_real_path_through_symlink() {
    let tmp = tempfile_dir("save-symlink");
    let paths = make_paths(&tmp);
    fs::create_dir_all(&paths.agents_skills).unwrap();
    fs::create_dir_all(&paths.claude_skills).unwrap();

    let real = write_skill(
        &paths.agents_skills,
        "editable",
        "---\nname: editable\ndescription: Old\n---\n\nOld body\n",
    );
    let link = paths.claude_skills.join("editable");
    std::os::unix::fs::symlink(&real, &link).unwrap();

    let linked = list_skills(&paths)
        .into_iter()
        .find(|s| s.source == SkillSource::Claude)
        .expect("linked skill");

    let new_content = "---\nname: editable\ndescription: New\n---\n\nNew body\n";
    let saved = save_skill(&linked.id, new_content, &paths).unwrap();
    assert_eq!(saved.content, new_content);
    assert_eq!(saved.description, "New");

    let on_disk = fs::read_to_string(real.join("SKILL.md")).unwrap();
    assert_eq!(on_disk, new_content);
}

#[test]
fn save_skill_rejects_path_escape() {
    let tmp = tempfile_dir("escape");
    let paths = make_paths(&tmp);
    // Craft an id that decodes to a path outside skill roots
    let outside = tmp.join("outside/evil");
    fs::create_dir_all(&outside).unwrap();
    fs::write(outside.join("SKILL.md"), "hack").unwrap();

    let evil_id = ai_chats_core::encode_skill_id(&outside);
    let err = save_skill(&evil_id, "nope", &paths).unwrap_err();
    assert!(
        err.to_lowercase().contains("escape")
            || err.to_lowercase().contains("outside")
            || err.to_lowercase().contains("not under"),
        "unexpected error: {err}"
    );
}

/// Temp dir under the system temp folder (no extra crate).
fn tempfile_dir(name: &str) -> PathBuf {
    let base = std::env::temp_dir()
        .join("ai-chats-core-skills-tests")
        .join(name);
    let _ = fs::remove_dir_all(&base);
    fs::create_dir_all(&base).unwrap();
    base
}
