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
    let len = haystack.len();
    let mut to_b = to.min(len);
    while to_b < len && !haystack.is_char_boundary(to_b) {
        to_b += 1;
    }
    let mut from_b = from.min(len);
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
    cap_snippet(slice)
}

fn cap_snippet(slice: String) -> String {
    if slice.chars().count() <= SNIPPET_MAX {
        return slice;
    }
    let mut clipped: String = slice.chars().take(SNIPPET_MAX - 1).collect();
    clipped.push('…');
    clipped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clip_char_range_clamps_to_haystack_len() {
        assert_eq!(clip_char_range("hello", 0, 99), (0, 5));
        assert_eq!(clip_char_range("hello", 99, 99), (5, 5));
    }
}
