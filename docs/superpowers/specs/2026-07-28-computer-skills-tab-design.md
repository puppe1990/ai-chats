# Computer Skills Tab — Design Spec

**Date:** 2026-07-28  
**Status:** Approved for implementation  
**Related:** Rust native data layer (`2026-07-20-rust-native-data-layer-design.md`)

## Problem

Coding agents install **skills** (`SKILL.md` under agent home directories). There is no unified place in AI Chats to list or edit those skills. Users must open scattered folders (`~/.grok/skills`, `~/.agents/skills`, `~/.claude/skills`, etc.) by hand.

## Goal

Add a **Skills** tab that:

1. Lists installed skills from common agent skill directories
2. Shows source (grok / agents / claude / codex / cursor), name, description, path, symlink status
3. Lets the user edit the full `SKILL.md` content in-app and save to disk
4. Follows the existing desktop architecture (Rust core + Tauri invoke + React SPA)
5. Is built with **TDD** (failing tests first for core and UI)

## Decisions (locked)

| Decision      | Choice                                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| Architecture  | Same as chats: `ai-chats-core` + Tauri commands + `desktop-api`              |
| Skill sources | All common: grok, agents, claude, codex, cursor under `$HOME`                |
| Edit model    | Full `SKILL.md` text in app; write to **resolved real path**                 |
| Symlinks      | List appearance under listed path; show `isSymlink`; save via `realPath`     |
| Dedupe        | No dedupe by content — each listed path is a row (may share real path)       |
| Routing       | Single route `/skills` with split view (list + editor)                       |
| ID            | Stable encoding of the **listed skill directory path** (not only real path)  |
| Frontmatter   | Best-effort parse of YAML frontmatter for `name` / `description` display     |
| Non-desktop   | Web without Tauri has no FS access; feature is desktop-first (same as chats) |

## Non-Goals (this delivery)

- Create new skill from the UI
- Delete skill
- Structured form for frontmatter fields only
- Diff / version history / undo beyond dirty-state cancel
- Watching filesystem for live updates
- Bundled / marketplace install of new skills
- Scanning `~/.grok/bundled/skills` or plugin trees (can be a follow-up)

## Skill discovery roots

Relative to home (or env overrides already used for agent homes where applicable):

| Source   | Directory                           |
| -------- | ----------------------------------- |
| `grok`   | `{GROK_HOME\|\|~/.grok}/skills`     |
| `agents` | `~/.agents/skills`                  |
| `claude` | `{CLAUDE_HOME\|\|~/.claude}/skills` |
| `codex`  | `{CODEX_HOME\|\|~/.codex}/skills`   |
| `cursor` | `{CURSOR_HOME\|\|~/.cursor}/skills` |

**Entry rule:** immediate child of a skills root that resolves to a directory containing `SKILL.md` (after following one level of symlink for the child dir if needed). Nested package-only dirs without `SKILL.md` at that level are skipped (e.g. intermediate folders that are not skills themselves).

Optional env for tests: inject custom `SkillPaths` (mirror `DataPaths`) rather than only global HOME.

## Data model

```rust
// serde camelCase to frontend
enum SkillSource { Grok, Agents, Claude, Codex, Cursor, Other }

struct SkillSummary {
  id: String,           // stable id from listed path
  name: String,         // frontmatter name or directory name
  description: String,  // frontmatter description or ""
  source: SkillSource,
  path: String,         // listed absolute path (may be symlink)
  real_path: String,    // canonical/resolved skill dir
  is_symlink: bool,
}

struct SkillDetail {
  // all SkillSummary fields +
  content: String,      // full SKILL.md text
}
```

### ID encoding

Use a URL-safe encoding of the absolute listed path (e.g. base64url of UTF-8 path bytes, or percent-encoding). Must round-trip uniquely for read/write. Prefer something human-debuggable if short enough; base64url of path is fine.

## Core API (`ai-chats-core`)

```rust
pub fn list_skills(paths: &SkillPaths) -> Vec<SkillSummary>;
pub fn get_skill(id: &str, paths: &SkillPaths) -> Result<Option<SkillDetail>, SkillError>;
pub fn save_skill(id: &str, content: &str, paths: &SkillPaths) -> Result<SkillDetail, SkillError>;
```

### Behavior

- **list:** scan roots; sort by `name` case-insensitive, then `source`
- **get:** resolve id → listed path must be under a known root (security); read `SKILL.md` from real path
- **save:** same path confinement; write UTF-8 to `{realPath}/SKILL.md`; re-read and return detail
- **path confinement:** reject ids whose resolved path is outside configured skill roots (after canonicalize of roots and target)

### Errors

Actionable string messages suitable for UI, e.g.:

- skill not found
- cannot read SKILL.md at …
- cannot write SKILL.md at … (permission / missing parent)
- path escapes skill roots

## Tauri commands

```rust
get_skills() -> Result<Vec<SkillSummary>, String>
get_skill(skill_id: String) -> Result<Option<SkillDetail>, String>
save_skill(skill_id: String, content: String) -> Result<SkillDetail, String>
```

Register in `src-tauri` invoke handler.

## Frontend

### Navigation

- Header nav link: **Skills** → `/skills`
- i18n keys in `en.json` + `pt-BR.json`

### Route `/skills`

- Loader: `getSkills()`
- Layout: left list (search + source chips), right editor panel
- Empty state when no selection: prompt to pick a skill
- Empty list: friendly copy when no skills found

### Editor

- Textarea (monospace) bound to `content`
- Dirty when content ≠ loaded original
- **Save** enabled only when dirty; calls `saveSkill`; on success updates original + summary fields if name/description changed
- Optional: discard changes when switching skill if dirty (confirm)

### Types / API

- `src/lib/skills.ts` — types + pure helpers (filter, frontmatter parse for tests if shared)
- `src/lib/desktop-api.ts` — `getSkills`, `getSkill`, `saveSkill` invoke wrappers
- Components: `SkillList`, `SkillEditor` (or single `SkillsPage` with extracted pieces for tests)

## Testing (TDD)

### Rust (`crates/ai-chats-core/tests/`)

Fixtures under temp dirs:

1. Lists skills from multiple roots with correct source labels
2. Parses frontmatter name/description
3. Resolves symlink: `is_symlink=true`, `real_path` points to target
4. `save_skill` writes to real path target, not the symlink path string
5. Rejects path escape / unknown id
6. Missing roots / empty dirs → empty list (not error)

### Frontend (Vitest + Testing Library)

1. `SkillList` renders names and source badges
2. Filter by query and source chip
3. `SkillEditor` shows content; Save disabled until edit
4. Save calls API with id + new content; clears dirty on success
5. Error message displayed on save failure

**Iron law:** write failing test → run → implement minimal → green → refactor.

## UI sketch

```
Header: [AI Chats]  [Skills]              [Refresh] [Lang] [Theme]

┌─ Skills ──────────────────────────────────────────────────────┐
│ Search…          [All] [Grok] [Agents] [Claude] [Codex] …   │
├─────────────────┬─────────────────────────────────────────────┤
│ firecrawl       │ firecrawl · agents · symlink → …            │
│ seo             │ ~/.agents/skills/firecrawl                  │
│ tdd             │ ┌─────────────────────────────────────────┐ │
│ …               │ │ # SKILL.md content                      │ │
│                 │ │ …                                       │ │
│                 │ └─────────────────────────────────────────┘ │
│                 │ [Save]  Unsaved changes                     │
└─────────────────┴─────────────────────────────────────────────┘
```

## Implementation order

1. `SkillPaths` + types in core
2. Frontmatter parse + list (TDD)
3. get + save with path confinement (TDD)
4. Tauri commands + desktop-api
5. Route + list UI (TDD)
6. Editor + save flow (TDD)
7. Header link + i18n

## Risks

| Risk                     | Mitigation                                                        |
| ------------------------ | ----------------------------------------------------------------- |
| Writing over user skills | Clear dirty/save UX; only write when user saves; path confinement |
| Symlink surprises        | Always display realPath; save to real path                        |
| Large SKILL.md           | Textarea is fine for typical sizes; no streaming needed           |
| Duplicate symlink rows   | Accepted; optional “open real path” clarity in UI                 |

## Success criteria

- [ ] Skills from the five roots appear with correct source
- [ ] Selecting a skill loads full SKILL.md
- [ ] Editing and saving persists to disk at real path
- [ ] Symlinked skills save to the target file
- [ ] All new tests pass (Rust + Vitest)
- [ ] Header navigation reaches the tab
- [ ] en + pt-BR strings present

```

```
