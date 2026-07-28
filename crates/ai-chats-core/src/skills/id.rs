use std::path::{Path, PathBuf};

/// Encode a listed skill directory path as a stable, opaque id (hex of UTF-8 path).
pub fn encode_skill_id(path: &Path) -> String {
    path.to_string_lossy()
        .as_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// Decode a skill id back to a path. Returns None if the hex is invalid.
pub fn decode_skill_id(id: &str) -> Option<PathBuf> {
    if id.len() % 2 != 0 || id.is_empty() {
        return None;
    }
    let mut bytes = Vec::with_capacity(id.len() / 2);
    let chars: Vec<char> = id.chars().collect();
    for chunk in chars.chunks(2) {
        let hex: String = chunk.iter().collect();
        let byte = u8::from_str_radix(&hex, 16).ok()?;
        bytes.push(byte);
    }
    let s = String::from_utf8(bytes).ok()?;
    Some(PathBuf::from(s))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn round_trips_path() {
        let path = PathBuf::from("/Users/test/.agents/skills/firecrawl");
        let id = encode_skill_id(&path);
        assert_eq!(decode_skill_id(&id), Some(path));
    }
}
