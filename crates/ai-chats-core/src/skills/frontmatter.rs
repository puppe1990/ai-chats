/// Best-effort parse of YAML frontmatter `name` and `description` from SKILL.md.
pub fn parse_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    let trimmed = content.trim_start_matches('\u{feff}');
    let Some(rest) = trimmed.strip_prefix("---") else {
        return (None, None);
    };
    let rest = rest
        .strip_prefix('\n')
        .or_else(|| rest.strip_prefix("\r\n"))
        .unwrap_or(rest);

    let end = rest.find("\n---").or_else(|| rest.find("\r\n---"));
    let Some(end) = end else {
        return (None, None);
    };
    let block = &rest[..end];

    let mut name = None;
    let mut description = None;
    for line in block.lines() {
        let line = line.trim();
        if let Some(value) = line.strip_prefix("name:") {
            name = Some(unquote(value.trim()));
        } else if let Some(value) = line.strip_prefix("description:") {
            description = Some(unquote(value.trim()));
        }
    }
    (name, description)
}

fn unquote(value: &str) -> String {
    let v = value.trim();
    if (v.starts_with('"') && v.ends_with('"') && v.len() >= 2)
        || (v.starts_with('\'') && v.ends_with('\'') && v.len() >= 2)
    {
        v[1..v.len() - 1].to_string()
    } else {
        v.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_name_and_description() {
        let content = "---\nname: firecrawl\ndescription: Scrape the web\n---\n\nBody\n";
        let (name, desc) = parse_frontmatter(content);
        assert_eq!(name.as_deref(), Some("firecrawl"));
        assert_eq!(desc.as_deref(), Some("Scrape the web"));
    }

    #[test]
    fn returns_none_without_frontmatter() {
        let (name, desc) = parse_frontmatter("# Title\n");
        assert_eq!(name, None);
        assert_eq!(desc, None);
    }
}
