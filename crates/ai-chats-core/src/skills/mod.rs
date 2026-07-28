//! Computer skills: list/read/write agent `SKILL.md` files under home roots.
//!
//! Modules:
//! - [`list`] — scan roots
//! - [`io`] — get/save content
//! - [`path_guard`] — confine paths to skill roots
//! - [`id`] — stable hex ids from listed paths
//! - [`frontmatter`] — YAML name/description
//! - [`paths`] / [`types`] — config + DTOs

mod frontmatter;
mod id;
mod io;
mod list;
mod path_guard;
mod paths;
mod types;

pub use id::{decode_skill_id, encode_skill_id};
pub use io::{get_skill, save_skill};
pub use list::list_skills;
pub use paths::SkillPaths;
pub use types::{SkillDetail, SkillSource, SkillSummary};
