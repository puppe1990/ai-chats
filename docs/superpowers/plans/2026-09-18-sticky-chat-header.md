# Sticky Chat Detail Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the chat detail header (badge, date, title, cwd, count, Export .md) visible below the global app header while the conversation scrolls.

**Architecture:** `Header` measures its own height with `ResizeObserver` and publishes `--app-header-h` on `<html>`. The chat detail header becomes a focused `ChatDetailHeader` component with a `.chat-detail-header` CSS class using `position: sticky; top: var(--app-header-h)`, a blurred `--bg-base` background, and full-bleed padding so messages never bleed through.

**Tech Stack:** React 19, TanStack Router, Tailwind utility classes + plain CSS in `src/styles.css`, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-18-sticky-chat-header-design.md`

---

## File Structure

| File                                              | Responsibility                                              |
| ------------------------------------------------- | ----------------------------------------------------------- |
| Create `src/test/resize-observer-stub.ts`         | Shared ResizeObserver test double                           |
| Create `src/lib/use-header-height.ts`             | Hook: measure ref height → set `--app-header-h` on `<html>` |
| Create `src/lib/use-header-height.test.tsx`       | Hook unit tests                                             |
| Create `src/components/Header.test.tsx`           | Header wiring smoke test                                    |
| Create `src/components/ChatDetailHeader.tsx`      | Presentational chat detail header (sticky class owner)      |
| Create `src/components/ChatDetailHeader.test.tsx` | Renders session context + sticky class                      |
| Modify `src/components/Header.tsx`                | Attach measuring hook to its `<header>`                     |
| Modify `src/routes/chat.$source.$sessionId.tsx`   | Use `ChatDetailHeader`; drop inline header                  |
| Modify `src/styles.css`                           | Add `.chat-detail-header` sticky rules                      |

---

### Task 1: `useHeaderHeightVar` hook

**Files:**

- Create: `src/test/resize-observer-stub.ts`
- Create: `src/lib/use-header-height.test.tsx`
- Create: `src/lib/use-header-height.ts`

- [ ] **Step 1: Write the shared ResizeObserver stub**

`src/test/resize-observer-stub.ts`:

```ts
import { vi } from 'vitest'

export class ResizeObserverStub {
  static instances: ResizeObserverStub[] = []
  callback: ResizeObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverStub.instances.push(this)
  }
}

export function installResizeObserverStub(): typeof ResizeObserverStub {
  ResizeObserverStub.instances = []
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  return ResizeObserverStub
}
```

- [ ] **Step 2: Write the failing hook tests**

`src/lib/use-header-height.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installResizeObserverStub,
  ResizeObserverStub,
} from '../test/resize-observer-stub'
import { HEADER_HEIGHT_VAR, useHeaderHeightVar } from './use-header-height'

function Probe() {
  const ref = useRef<HTMLElement | null>(null)
  useHeaderHeightVar(ref)
  return <header ref={ref} data-testid="probe" />
}

function mockHeaderHeight(height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    height,
    width: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

function readVar(): string {
  return document.documentElement.style.getPropertyValue(HEADER_HEIGHT_VAR)
}

describe('useHeaderHeightVar', () => {
  beforeEach(() => {
    installResizeObserverStub()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.documentElement.style.removeProperty(HEADER_HEIGHT_VAR)
  })

  it('publishes the measured height on mount', () => {
    mockHeaderHeight(64)

    render(<Probe />)

    expect(readVar()).toBe('64px')
  })

  it('updates the variable when the element resizes', () => {
    mockHeaderHeight(64)
    render(<Probe />)

    mockHeaderHeight(80)
    const observer = ResizeObserverStub.instances[0]
    act(() => observer.callback([], observer as unknown as ResizeObserver))

    expect(readVar()).toBe('80px')
  })

  it('disconnects the observer on unmount', () => {
    mockHeaderHeight(64)
    const { unmount } = render(<Probe />)
    const observer = ResizeObserverStub.instances[0]

    unmount()

    expect(observer.disconnect).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/use-header-height.test.tsx`
Expected: FAIL — cannot resolve `./use-header-height`.

- [ ] **Step 4: Implement the hook**

`src/lib/use-header-height.ts`:

```ts
import { useEffect, type RefObject } from 'react'

export const HEADER_HEIGHT_VAR = '--app-header-h'

/**
 * Publishes the measured height of `ref` as `--app-header-h` on <html>.
 * Usage: const ref = useRef(null); useHeaderHeightVar(ref); <header ref={ref} />
 */
export function useHeaderHeightVar(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const root = document.documentElement
    const publish = () => {
      root.style.setProperty(
        HEADER_HEIGHT_VAR,
        `${element.getBoundingClientRect().height}px`,
      )
    }

    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/use-header-height.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/test/resize-observer-stub.ts src/lib/use-header-height.ts src/lib/use-header-height.test.tsx
git commit -m "feat: publish app header height as CSS var"
```

---

### Task 2: Wire the hook into `Header`

**Files:**

- Create: `src/components/Header.test.tsx`
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Write the failing Header test**

`src/components/Header.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HEADER_HEIGHT_VAR } from '../lib/use-header-height'
import { installResizeObserverStub } from '../test/resize-observer-stub'
import Header from './Header'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: ReactNode; className?: string }) => (
    <a className={props.className}>{props.children}</a>
  ),
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ isLoading: false, matches: [] }),
}))

describe('Header', () => {
  beforeEach(() => {
    installResizeObserverStub()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 72,
      width: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.documentElement.style.removeProperty(HEADER_HEIGHT_VAR)
  })

  it('publishes its height as --app-header-h', () => {
    render(<Header />)

    expect(document.documentElement.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe(
      '72px',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Header.test.tsx`
Expected: FAIL — `--app-header-h` is empty.

- [ ] **Step 3: Wire the hook**

In `src/components/Header.tsx`, add to the imports:

```tsx
import { useRef } from 'react'
import { useHeaderHeightVar } from '../lib/use-header-height'
```

At the top of `Header()`, after `const { t } = useTranslation()`:

```tsx
const headerRef = useRef<HTMLElement | null>(null)
useHeaderHeightVar(headerRef)
```

Change the `<header>` opening tag (line 15) to:

```tsx
<header
  ref={headerRef}
  className="relative sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg"
>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Header.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/Header.test.tsx
git commit -m "feat: sync global header height to CSS var"
```

---

### Task 3: Extract `ChatDetailHeader`

**Files:**

- Create: `src/components/ChatDetailHeader.tsx`
- Create: `src/components/ChatDetailHeader.test.tsx`

- [ ] **Step 1: Write the failing component test**

`src/components/ChatDetailHeader.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChatDetail } from '../lib/types'
import { ChatDetailHeader } from './ChatDetailHeader'

vi.mock('./ExportMarkdownButton', () => ({
  ExportMarkdownButton: ({ detail }: { detail: ChatDetail }) => (
    <button type="button" data-testid="export">
      {detail.session.title}
    </button>
  ),
}))

const detail: ChatDetail = {
  session: {
    id: 'opencode:ses_test',
    source: 'opencode',
    title: 'Test task dispatch (@general subagent)',
    cwd: '/Users/test/projects/gestao-bem-app',
    createdAt: '2026-09-18T00:00:00.000Z',
    updatedAt: '2026-09-18T00:23:02.000Z',
  },
  messages: [],
}

describe('ChatDetailHeader', () => {
  it('renders session context inside the sticky header', () => {
    const { container } = render(<ChatDetailHeader detail={detail} />)

    const header = container.querySelector('header')
    expect(header).toHaveClass('chat-detail-header')
    expect(
      screen.getByRole('heading', { name: detail.session.title }),
    ).toBeInTheDocument()
    expect(screen.getByText('/Users/test/projects/gestao-bem-app')).toBeInTheDocument()
    expect(screen.getByText('0 mensagens')).toBeInTheDocument()
    expect(screen.getByTestId('export')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ChatDetailHeader.test.tsx`
Expected: FAIL — cannot resolve `./ChatDetailHeader`.

- [ ] **Step 3: Implement the component (move markup from the route)**

`src/components/ChatDetailHeader.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { ChatDetail } from '../lib/types'
import { ExportMarkdownButton } from './ExportMarkdownButton'
import { FormattedDate } from './FormattedDate'
import { SourceBadge } from './SourceBadge'

export function ChatDetailHeader({ detail }: { detail: ChatDetail }) {
  const { t } = useTranslation()
  const { session, messages } = detail

  return (
    <header className="chat-detail-header mb-8 border-b border-[var(--line)] pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SourceBadge source={session.source} />
            <FormattedDate
              iso={session.updatedAt}
              className="text-xs text-[var(--sea-ink-soft)]"
            />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{session.title}</h1>
          {session.cwd && (
            <p className="text-sm text-[var(--sea-ink-soft)] mt-1 truncate">
              {session.cwd}
            </p>
          )}
          <p className="text-xs text-[var(--sea-ink-soft)] mt-2 opacity-80">
            {t('chatDetail.messages', { count: messages.length })}
          </p>
        </div>
        <ExportMarkdownButton detail={detail} />
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ChatDetailHeader.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatDetailHeader.tsx src/components/ChatDetailHeader.test.tsx
git commit -m "refactor: extract ChatDetailHeader component"
```

---

### Task 4: Use `ChatDetailHeader` in the route + sticky CSS

**Files:**

- Modify: `src/routes/chat.$source.$sessionId.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Replace the inline header in the route**

In `src/routes/chat.$source.$sessionId.tsx`:

Remove imports `ExportMarkdownButton`, `FormattedDate`, `SourceBadge` (lines 6, 7, 10) and add:

```tsx
import { ChatDetailHeader } from '../components/ChatDetailHeader'
```

In `ChatDetailPage`, change `const { session, messages } = detail` to:

```tsx
const { messages } = detail
```

Delete the whole `<header className="mb-8 border-b border-[var(--line)] pb-6">…</header>` block (lines 69-91) and replace it with:

```tsx
<ChatDetailHeader detail={detail} />
```

- [ ] **Step 2: Add the sticky CSS class**

In `src/styles.css`, immediately after the `.route-transition__label` rule (around line 668), add:

```css
/* Chat detail header sticks below the measured global header height. */
.chat-detail-header {
  position: sticky;
  top: var(--app-header-h, 0px);
  z-index: 40;
  margin-inline: -1.5rem;
  padding-inline: 1.5rem;
  background: color-mix(in oklab, var(--bg-base) 88%, transparent);
  backdrop-filter: blur(12px) saturate(1.1);
}
```

- [ ] **Step 3: Run the full frontend suite**

Run: `npm test`
Expected: all suites pass, including the 3 new files.

- [ ] **Step 4: Lint + format**

Run: `npm run lint && npm run format:check`
Expected: no errors (fix formatting with `npm run format` if needed).

- [ ] **Step 5: Commit**

```bash
git add src/routes/chat.$source.$sessionId.tsx src/styles.css
git commit -m "feat: sticky chat detail header below global header"
```

---

### Task 5: Full verification + desktop rebuild

**Files:** none (verification only)

- [ ] **Step 1: CI parity locally**

```bash
npm run format:check
npm run lint
npm test
cargo test -p ai-chats-core
npm run build
```

Expected: all green.

- [ ] **Step 2: Manual check in the desktop app**

```bash
npm run tauri:build
```

Then install the fresh bundle over the installed app and open it:

```bash
osascript -e 'quit app "AI Chats"' || true
ditto "target/release/bundle/macos/AI Chats.app" "/Applications/AI Chats.app"
open "/Applications/AI Chats.app"
```

Scroll a long conversation and confirm:

- badge/date/title/cwd/count/Export stay visible
- header sits flush below the global header (resize window / narrow width to test wrap)
- messages do not show through the blur
- `← All chats` scrolls away
- works in light and dark themes

---

## Self-Review Notes

- Spec `Testing` items 1-3 → Tasks 1; item 4 (Header smoke test) → Task 2.
- Sticky class + component test → Tasks 3-4; CSS computed behavior is manual-only (jsdom has no layout).
- No placeholders; all code blocks are complete. Names: `HEADER_HEIGHT_VAR`, `useHeaderHeightVar`, `installResizeObserverStub`, `ChatDetailHeader` are used consistently across tasks.
