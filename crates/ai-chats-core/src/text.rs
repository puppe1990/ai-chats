use serde_json::Value;

pub fn extract_text_from_parts(parts: &[Value]) -> String {
    let mut out = String::new();
    for part in parts {
        if let Some(t) = part.get("text").and_then(|v| v.as_str()) {
            if !t.trim().is_empty() {
                if !out.is_empty() {
                    out.push('\n');
                }
                out.push_str(t.trim());
            }
        }
    }
    out
}

pub fn strip_user_query_tags(input: &str) -> String {
    let mut s = input.to_string();
    if let Some(start) = s.find("<user_query>") {
        if let Some(end) = s.find("</user_query>") {
            let inner = &s[start + "<user_query>".len()..end];
            s = inner.trim().to_string();
        }
    }
    s.trim().to_string()
}
