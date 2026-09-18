# Sticky Chat Detail Header — Design Spec

**Date:** 2026-09-18
**Status:** Approved for implementation
**Related:** Route `chat/$source/$sessionId` (`src/routes/chat.$source.$sessionId.tsx`)

## Problem

On the chat detail page the header (source badge, date, title, cwd, message count, Export .md) scrolls away with the conversation. When reading a long chat the user loses context and the quick actions.

## Goal

Keep the chat detail header visible while the conversation scrolls, directly below the global app header, on desktop and mobile.

## Decisions (locked)

| Decision        | Choice                                                               |
| --------------- | -------------------------------------------------------------------- |
| Header content  | Full header stays visible (no compact/shrink mode)                   |
| Back link       | `← All chats` scrolls away normally; not part of the sticky area     |
| Offset strategy | Measured global header height exposed as CSS var `--app-header-h`    |
| Layering        | Sticky header `z-index` below the global header (`z-40` vs `z-50`)   |
| Background      | Blur + translucent `--bg-base` so messages don't bleed through       |
| Scope           | Visual/positioning only; no content or layout redesign of the header |

## Behavior

1. `Header` measures its own height with `ResizeObserver` and sets `--app-header-h` on `document.documentElement`.
   - Initial value from `getBoundingClientRect()` on mount.
   - Updates on resize / nav wrap (mobile flex-wrap) / font load.
   - Cleanup removes the observer on unmount.
   - Fallback `0px` when unset (jsdom, non-React consumers).
2. The chat detail header becomes `position: sticky` with `top: var(--app-header-h, 0px)`.
3. Sticky background covers the content column (full-bleed via negative inline margin + padding) with `backdrop-filter: blur` and a bottom border, matching the app's glass language.
4. No change to header content, spacing at rest, or the `ExportMarkdownButton`.

## Non-Goals

- Compact/collapsing sticky bar or scroll-triggered animations
- Sticky `← All chats` link
- Changes to the global `Header` layout or route structure
- Persisting anything (heights are runtime-measured)

## Components

| Unit                        | Responsibility                                                | Location                                 |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| `useHeaderHeightVar` (hook) | Measure element ref height → set `--app-header-h` on `<html>` | `src/lib/use-header-height.ts`           |
| `Header`                    | Attach hook to its `<header>` element                         | `src/components/Header.tsx`              |
| Chat detail route           | Apply sticky class to existing `<header>`                     | `src/routes/chat.$source.$sessionId.tsx` |
| `.chat-detail-header`       | Sticky positioning, blur background, border                   | `src/styles.css`                         |

## Testing (TDD)

Vitest + Testing Library, no layout engine in jsdom:

1. Hook sets `--app-header-h` from `getBoundingClientRect().height` on mount.
2. Hook updates the var when the mocked `ResizeObserver` fires with a new height.
3. Hook disconnects the observer on unmount and leaves the last measured value in place.
4. `Header` renders a `<header>` element and the hook receives it (class/hook smoke test).

Manual verification (desktop app): scroll a long conversation and confirm the header stays below the global header without content bleeding through, in light and dark themes and at mobile width.

## Success Criteria

- [ ] Scrolling a conversation keeps badge/date/title/cwd/count/Export visible
- [ ] Sticky header sits exactly below the global header at all breakpoints
- [ ] Messages do not show through the sticky background
- [ ] `← All chats` scrolls away as before
- [ ] New hook tests pass; lint/format clean
