//! Path confinement for skill roots.
//!
//! WHY: save/get must never write outside configured skill directories
//! even if an id decodes to an absolute path elsewhere on disk.

use super::paths::SkillPaths;
use std::path::{Path, PathBuf};

/// True when `path` is under any configured skill root (listed path, not real path).
pub fn listed_path_is_under_skill_roots(path: &Path, paths: &SkillPaths) -> bool {
    paths
        .roots()
        .into_iter()
        .any(|(_, root)| path_is_under_root(path, root))
}

pub fn path_is_under_root(path: &Path, root: &Path) -> bool {
    let path_canon = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let root_canon = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());

    path_canon.starts_with(&root_canon)
        || path.starts_with(root)
        || path_string_prefix_under(path, root)
}

fn path_string_prefix_under(path: &Path, root: &Path) -> bool {
    let path_str = path.to_string_lossy();
    let root_str = root.to_string_lossy();
    path_str == root_str
        || path_str.starts_with(&format!("{root_str}/"))
        || path_str.starts_with(&format!("{root_str}\\"))
}

/// Resolve a listed skill entry to its real directory (follows one symlink level).
pub fn resolve_listed_skill_dir(listed_path: &Path) -> Option<(PathBuf, bool)> {
    let meta = std::fs::symlink_metadata(listed_path).ok()?;
    let is_symlink = meta.file_type().is_symlink();

    let real_path = if is_symlink {
        resolve_symlink_target(listed_path)?
    } else if meta.is_dir() {
        listed_path
            .canonicalize()
            .unwrap_or_else(|_| listed_path.to_path_buf())
    } else {
        return None;
    };

    if !real_path.is_dir() {
        return None;
    }
    Some((real_path, is_symlink))
}

fn resolve_symlink_target(listed_path: &Path) -> Option<PathBuf> {
    let target = std::fs::read_link(listed_path).ok()?;
    let absolute = if target.is_absolute() {
        target
    } else {
        listed_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join(target)
    };
    Some(absolute.canonicalize().unwrap_or(absolute))
}
