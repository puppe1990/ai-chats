const SNIPPET_RADIUS: usize = 80;
const SNIPPET_MAX: usize = 200;

pub fn snippet_around(haystack: &str, needle: &str) -> Option<String> {
    let lower = haystack.to_lowercase();
    let needle_l = needle.to_lowercase();
    let start = lower.find(&needle_l)?;
    let end = start + needle_l.len();
    let from = start.saturating_sub(SNIPPET_RADIUS);
    let to = (end + SNIPPET_RADIUS).min(haystack.len());
    let (from_b, to_b) = clip_char_range(haystack, from, to);
    Some(format_snippet(haystack, from_b, to_b))
}

fn clip_char_range(haystack: &str, from: usize, to: usize) -> (usize, usize) {
    let mut to_b = to;
    while to_b < haystack.len() && !haystack.is_char_boundary(to_b) {
        to_b += 1;
    }
    let mut from_b = from;
    while from_b > 0 && !haystack.is_char_boundary(from_b) {
        from_b -= 1;
    }
    (from_b, to_b)
}

fn format_snippet(haystack: &str, from_b: usize, to: usize) -> String {
    let mut slice = haystack[from_b..to].replace(['\n', '\r'], " ");
    if from_b > 0 {
        slice.insert(0, '…');
    }
    if to < haystack.len() {
        slice.push('…');
    }
    if slice.chars().count() > SNIPPET_MAX {
        slice = slice.chars().take(SNIPPET_MAX).collect();
    }
    slice
}
