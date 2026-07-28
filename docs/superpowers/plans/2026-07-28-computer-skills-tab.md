# Computer Skills Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Skills tab that lists agent skills from common home directories and allows editing `SKILL.md` in-app via Rust core + Tauri.

**Architecture:** Extend `ai-chats-core` with `skills` module (`list` / `get` / `save` + path confinement). Expose Tauri commands. Frontend route `/skills` with list + editor, header nav link, i18n.

**Tech Stack:** Rust 2021, serde, Tauri 2, React 19, TanStack Router, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-28-computer-skills-tab-design.md`

---

## File structure

```
crates/ai-chats-core/src/
  skills/
    mod.rs          # list_skills, get_skill, save_skill
    paths.rs        # SkillPaths
    types.rs        # SkillSource, SkillSummary, SkillDetail
    frontmatter.rs  # parse name/description
    id.rs           # encode/decode skill id from listed path
src-tauri/src/lib.rs
src/lib/desktop-api.ts
src/lib/skills.ts
src/lib/skills.test.ts
src/components/SkillList.tsx
src/components/SkillList.test.tsx
src/components/SkillEditor.tsx
src/components/SkillEditor.test.tsx
src/routes/skills.tsx
src/components/Header.tsx
src/i18n/locales/{en,pt-BR}.json
crates/ai-chats-core/tests/skills.rs
```

---

### Task 1: Types + SkillPaths + frontmatter + list (TDD)

**Files:**

- Create: `crates/ai-chats-core/src/skills/{mod,paths,types,frontmatter,id}.rs`
- Create: `crates/ai-chats-core/tests/skills.rs`
- Modify: `crates/ai-chats-core/src/lib.rs`

- [x] Write failing integration tests for list + frontmatter + empty roots
- [x] Implement minimal types/paths/frontmatter/list
- [x] `cargo test -p ai-chats-core --test skills` green

### Task 2: get + save + symlink + confinement (TDD)

- [x] Failing tests: get content, save to real path via symlink, reject escape
- [x] Implement get_skill / save_skill
- [x] Tests green

### Task 3: Tauri commands + desktop-api

- [x] Register `get_skills`, `get_skill`, `save_skill`
- [x] TypeScript wrappers + shared frontend types in `src/lib/skills.ts`

### Task 4: UI components (TDD)

- [x] SkillList filter tests → implement
- [x] SkillEditor dirty/save tests → implement

### Task 5: Route, header, i18n

- [x] `src/routes/skills.tsx` + regenerate routes if needed
- [x] Header link + en/pt-BR strings
- [x] Full test suite pass

---

## Success criteria (from spec)

- Skills from five roots with correct source
- Load + save SKILL.md at real path
- Symlink save targets real file
- Rust + Vitest tests pass
- Header navigation works
- en + pt-BR present
