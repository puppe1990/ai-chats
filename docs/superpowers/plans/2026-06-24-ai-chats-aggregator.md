# AI Chats Aggregator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App local TanStack Start + Tailwind que agrega chats de Cursor, Grok, Codex e OpenCode, listando por mais recente.

**Architecture:** Server function `getChats` chama 4 providers isolados que leem dados locais (SQLite/JSON/JSONL), normalizam para `ChatSession`, e o aggregator ordena por `updatedAt` desc. UI React com filtros por source.

**Tech Stack:** TanStack Start, React 19, Tailwind v4, Vitest, better-sqlite3, TypeScript

**Spec:** `docs/superpowers/specs/2026-06-24-ai-chats-aggregator-design.md`

---

### Task 1: Scaffold TanStack Start + Tailwind + Vitest

**Files:**

- Create: project root via CLI
- Modify: `package.json`, `vite.config.ts`, `vitest.config.ts`

- [ ] **Step 1: Scaffold project**

```bash
cd /Users/matheuspuppe/Desktop/Projetos/db-code-harness
npx @tanstack/cli@latest create . --framework react --tailwind --toolchain vite --package-manager npm --no-git
```

Se o CLI pedir interação, usar:

```bash
npx gitpick TanStack/router/tree/main/examples/react/start-basic .
npm install
```

- [ ] **Step 2: Add dev dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Add test script to package.json**

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Verify scaffold**

Run: `npm run dev` (background) + `npm run build`  
Expected: build succeeds

- [ ] **Step 6: Init git and commit**

```bash
git init
git add .
git commit -m "chore: scaffold tanstack start with tailwind and vitest"
```

---

### Task 2: Core Types + Sort (TDD)

**Files:**

- Create: `src/lib/types.ts`
- Create: `src/lib/sort.ts`
- Create: `src/lib/sort.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/sort.test.ts
import { describe, it, expect } from 'vitest'
import { sortByUpdatedAt } from './sort'
import type { ChatSession } from './types'

const make = (id: string, updatedAt: string): ChatSession => ({
  id,
  source: 'grok',
  title: id,
  createdAt: updatedAt,
  updatedAt,
})

describe('sortByUpdatedAt', () => {
  it('sorts sessions by updatedAt descending', () => {
    const sessions = [
      make('old', '2026-06-20T10:00:00.000Z'),
      make('new', '2026-06-24T15:00:00.000Z'),
      make('mid', '2026-06-22T12:00:00.000Z'),
    ]
    const sorted = sortByUpdatedAt(sessions)
    expect(sorted.map((s) => s.id)).toEqual(['new', 'mid', 'old'])
  })

  it('returns empty array for empty input', () => {
    expect(sortByUpdatedAt([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/sort.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/types.ts
export type ChatSource = 'cursor' | 'grok' | 'codex' | 'opencode'

export interface ChatSession {
  id: string
  source: ChatSource
  title: string
  cwd?: string
  createdAt: string
  updatedAt: string
  messageCount?: number
  model?: string
}

export const SOURCE_LABELS: Record<ChatSource, string> = {
  cursor: 'Cursor',
  grok: 'Grok',
  codex: 'Codex',
  opencode: 'OpenCode',
}
```

```typescript
// src/lib/sort.ts
import type { ChatSession } from './types'

export function sortByUpdatedAt(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/sort.test.ts`  
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/
git commit -m "feat: add ChatSession type and sortByUpdatedAt"
```

---

### Task 3: Config Module (TDD)

**Files:**

- Create: `src/lib/config.ts`
- Create: `src/lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDataPaths } from './config'

describe('getDataPaths', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, HOME: '/Users/test' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns default paths based on HOME', () => {
    const paths = getDataPaths()
    expect(paths.cursorHome).toBe('/Users/test/.cursor')
    expect(paths.grokHome).toBe('/Users/test/.grok')
    expect(paths.codexHome).toBe('/Users/test/.codex')
    expect(paths.opencodeDataDir).toBe('/Users/test/.local/share/opencode')
  })

  it('respects env overrides', () => {
    process.env.GROK_HOME = '/custom/grok'
    const paths = getDataPaths()
    expect(paths.grokHome).toBe('/custom/grok')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/config.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/config.ts
import os from 'node:os'
import path from 'node:path'

export interface DataPaths {
  cursorHome: string
  grokHome: string
  codexHome: string
  opencodeDataDir: string
}

export function getDataPaths(): DataPaths {
  const home = process.env.HOME ?? os.homedir()
  return {
    cursorHome: process.env.CURSOR_HOME ?? path.join(home, '.cursor'),
    grokHome: process.env.GROK_HOME ?? path.join(home, '.grok'),
    codexHome: process.env.CODEX_HOME ?? path.join(home, '.codex'),
    opencodeDataDir:
      process.env.OPENCODE_DATA_DIR ?? path.join(home, '.local', 'share', 'opencode'),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/config.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts src/lib/config.test.ts
git commit -m "feat: add configurable data paths"
```

---

### Task 4: Grok Provider (TDD)

**Files:**

- Create: `src/lib/providers/grok.ts`
- Create: `src/lib/providers/grok.test.ts`
- Create: `src/lib/providers/__fixtures__/grok/sessions/%2Ftest%2Fproject/session-1/summary.json`

- [ ] **Step 1: Create fixture**

```json
{
  "info": {
    "id": "019efae4-e451-7d22-b51f-ee6b3cee0f95",
    "cwd": "/test/project"
  },
  "session_summary": "Build chat aggregator",
  "created_at": "2026-06-24T10:00:00.000Z",
  "updated_at": "2026-06-24T15:30:00.000Z",
  "num_messages": 42,
  "current_model_id": "grok-composer-2.5-fast",
  "generated_title": "Build chat aggregator"
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/providers/grok.test.ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchGrokChats } from './grok'

const FIXTURE_ROOT = path.join(__dirname, '__fixtures__/grok')

describe('fetchGrokChats', () => {
  it('parses summary.json files into ChatSession', async () => {
    const sessions = await fetchGrokChats(path.join(FIXTURE_ROOT, 'sessions'))
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      id: 'grok:019efae4-e451-7d22-b51f-ee6b3cee0f95',
      source: 'grok',
      title: 'Build chat aggregator',
      cwd: '/test/project',
      updatedAt: '2026-06-24T15:30:00.000Z',
      messageCount: 42,
      model: 'grok-composer-2.5-fast',
    })
  })

  it('returns empty array for missing directory', async () => {
    expect(await fetchGrokChats('/nonexistent')).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/providers/grok.test.ts`  
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/lib/providers/grok.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ChatSession } from '../types'

interface GrokSummary {
  info: { id: string; cwd?: string }
  session_summary?: string
  generated_title?: string
  created_at?: string
  updated_at?: string
  num_messages?: number
  current_model_id?: string
}

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...(await walkDir(full)))
      } else if (entry.name === 'summary.json') {
        results.push(full)
      }
    }
  } catch {
    return []
  }
  return results
}

export async function fetchGrokChats(sessionsDir: string): Promise<ChatSession[]> {
  const files = await walkDir(sessionsDir)
  const sessions: ChatSession[] = []

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, 'utf-8')
      const data: GrokSummary = JSON.parse(raw)
      const title =
        data.generated_title?.trim() ||
        data.session_summary?.trim() ||
        `Grok ${data.info.id.slice(0, 8)}`

      sessions.push({
        id: `grok:${data.info.id}`,
        source: 'grok',
        title,
        cwd: data.info.cwd,
        createdAt: data.created_at ?? data.updated_at ?? new Date(0).toISOString(),
        updatedAt: data.updated_at ?? data.created_at ?? new Date(0).toISOString(),
        messageCount: data.num_messages,
        model: data.current_model_id,
      })
    } catch {
      // skip malformed
    }
  }

  return sessions
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/providers/grok.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/grok.ts src/lib/providers/grok.test.ts src/lib/providers/__fixtures__/
git commit -m "feat: add grok chat provider"
```

---

### Task 5: OpenCode Provider (TDD)

**Files:**

- Create: `src/lib/providers/opencode.ts`
- Create: `src/lib/providers/opencode.test.ts`
- Create: `src/lib/providers/__fixtures__/opencode/opencode.db` (copy minimal schema + 2 rows)

- [ ] **Step 1: Create fixture DB**

```bash
sqlite3 src/lib/providers/__fixtures__/opencode/opencode.db <<'SQL'
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  directory TEXT NOT NULL,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  model TEXT
);
INSERT INTO session VALUES (
  'ses_test1', 'proj1', 'test', '/test/opencode-project',
  'Fix login bug', '1', 1719000000000, 1719100000000, 'claude-sonnet'
);
INSERT INTO session VALUES (
  'ses_test2', 'proj1', 'test2', '/test/other',
  'Add dark mode', '1', 1719200000000, 1719300000000, NULL
);
SQL
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/providers/opencode.test.ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchOpenCodeChats } from './opencode'

const DB_PATH = path.join(__dirname, '__fixtures__/opencode/opencode.db')

describe('fetchOpenCodeChats', () => {
  it('reads sessions from opencode.db', () => {
    const sessions = fetchOpenCodeChats(DB_PATH)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({
      id: 'opencode:ses_test2',
      source: 'opencode',
      title: 'Add dark mode',
      cwd: '/test/other',
    })
    // sorted by time_updated desc within provider is aggregator's job
    expect(sessions.find((s) => s.id === 'opencode:ses_test1')).toMatchObject({
      title: 'Fix login bug',
      model: 'claude-sonnet',
    })
  })

  it('returns empty array for missing db', () => {
    expect(fetchOpenCodeChats('/nonexistent.db')).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/providers/opencode.test.ts`  
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/lib/providers/opencode.ts
import Database from 'better-sqlite3'
import type { ChatSession } from '../types'

interface OpenCodeRow {
  id: string
  title: string
  directory: string
  time_created: number
  time_updated: number
  model: string | null
}

export function fetchOpenCodeChats(dbPath: string): ChatSession[] {
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })
    const rows = db
      .prepare(
        `SELECT id, title, directory, time_created, time_updated, model
         FROM session ORDER BY time_updated DESC`,
      )
      .all() as OpenCodeRow[]
    db.close()

    return rows.map((row) => ({
      id: `opencode:${row.id}`,
      source: 'opencode' as const,
      title: row.title || `OpenCode ${row.id.slice(0, 8)}`,
      cwd: row.directory,
      createdAt: new Date(row.time_created).toISOString(),
      updatedAt: new Date(row.time_updated).toISOString(),
      model: row.model ?? undefined,
    }))
  } catch {
    return []
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/providers/opencode.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/opencode.ts src/lib/providers/opencode.test.ts src/lib/providers/__fixtures__/opencode/
git commit -m "feat: add opencode chat provider"
```

---

### Task 6: Codex Provider (TDD)

**Files:**

- Create: `src/lib/providers/codex.ts`
- Create: `src/lib/providers/codex.test.ts`
- Create: `src/lib/providers/__fixtures__/codex/session_index.jsonl`

- [ ] **Step 1: Create fixture**

```jsonl
{"id":"019e45c9-4c4c-7783-a976-c0eec1cc306b","thread_name":"Limpar HD com script","updated_at":"2026-05-20T14:28:22.699524Z"}
{"id":"019c4c17-6d3e-76d3-8422-c7d2489ff693","thread_name":"Add opção de trial por time","updated_at":"2026-03-05T21:59:34.610897Z"}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/providers/codex.test.ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchCodexChats } from './codex'

const FIXTURE_DIR = path.join(__dirname, '__fixtures__/codex')

describe('fetchCodexChats', () => {
  it('parses session_index.jsonl', async () => {
    const sessions = await fetchCodexChats(FIXTURE_DIR)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({
      id: 'codex:019e45c9-4c4c-7783-a976-c0eec1cc306b',
      source: 'codex',
      title: 'Limpar HD com script',
      updatedAt: '2026-05-20T14:28:22.699524Z',
    })
  })

  it('returns empty array for missing index', async () => {
    expect(await fetchCodexChats('/nonexistent')).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/providers/codex.test.ts`  
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/lib/providers/codex.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ChatSession } from '../types'

interface CodexIndexEntry {
  id: string
  thread_name?: string
  updated_at?: string
}

export async function fetchCodexChats(codexHome: string): Promise<ChatSession[]> {
  const indexPath = path.join(codexHome, 'session_index.jsonl')
  try {
    const content = await fs.readFile(indexPath, 'utf-8')
    const sessions: ChatSession[] = []

    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const entry: CodexIndexEntry = JSON.parse(line)
        sessions.push({
          id: `codex:${entry.id}`,
          source: 'codex',
          title: entry.thread_name?.trim() || `Codex ${entry.id.slice(0, 8)}`,
          createdAt: entry.updated_at ?? new Date(0).toISOString(),
          updatedAt: entry.updated_at ?? new Date(0).toISOString(),
        })
      } catch {
        // skip malformed line
      }
    }

    return sessions
  } catch {
    return []
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/providers/codex.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/codex.ts src/lib/providers/codex.test.ts src/lib/providers/__fixtures__/codex/
git commit -m "feat: add codex chat provider"
```

---

### Task 7: Cursor Provider (TDD)

**Files:**

- Create: `src/lib/providers/cursor.ts`
- Create: `src/lib/providers/cursor.test.ts`
- Create: `src/lib/providers/__fixtures__/cursor/chats/workspace1/chat1/store.db`

- [ ] **Step 1: Create fixture DB**

```bash
mkdir -p src/lib/providers/__fixtures__/cursor/chats/workspace1/chat1
python3 <<'PY'
import sqlite3, json, binascii, os
db_path = "src/lib/providers/__fixtures__/cursor/chats/workspace1/chat1/store.db"
os.makedirs(os.path.dirname(db_path), exist_ok=True)
meta = {
    "agentId": "b76b26e9-09db-4a76-98ee-49ff46b09bad",
    "name": "Sentiment Analyzer",
    "createdAt": 1719000000000,
    "mode": "default"
}
hex_val = binascii.hexlify(json.dumps(meta).encode()).decode()
conn = sqlite3.connect(db_path)
conn.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)")
conn.execute("INSERT INTO meta VALUES ('0', ?)", (hex_val,))
conn.commit()
conn.close()
PY
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/providers/cursor.test.ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fetchCursorChats } from './cursor'

const FIXTURE_ROOT = path.join(__dirname, '__fixtures__/cursor')

describe('fetchCursorChats', () => {
  it('parses store.db meta into ChatSession', async () => {
    const sessions = await fetchCursorChats(path.join(FIXTURE_ROOT, 'chats'))
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      id: 'cursor:b76b26e9-09db-4a76-98ee-49ff46b09bad',
      source: 'cursor',
      title: 'Sentiment Analyzer',
      createdAt: '2024-06-21T19:20:00.000Z',
    })
    expect(sessions[0].updatedAt).toBeTruthy()
  })

  it('returns empty array for missing directory', async () => {
    expect(await fetchCursorChats('/nonexistent')).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/providers/cursor.test.ts`  
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/lib/providers/cursor.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { ChatSession } from '../types'

interface CursorMeta {
  agentId: string
  name?: string
  createdAt?: number
}

async function findStoreDbs(chatsDir: string): Promise<string[]> {
  const results: string[] = []
  try {
    const workspaces = await fs.readdir(chatsDir, { withFileTypes: true })
    for (const ws of workspaces) {
      if (!ws.isDirectory()) continue
      const wsPath = path.join(chatsDir, ws.name)
      const chats = await fs.readdir(wsPath, { withFileTypes: true })
      for (const chat of chats) {
        if (!chat.isDirectory()) continue
        const dbPath = path.join(wsPath, chat.name, 'store.db')
        try {
          await fs.access(dbPath)
          results.push(dbPath)
        } catch {
          // skip
        }
      }
    }
  } catch {
    return []
  }
  return results
}

function parseStoreDb(dbPath: string): ChatSession | null {
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })
    const row = db.prepare("SELECT value FROM meta WHERE key = '0'").get() as
      | { value: string }
      | undefined
    db.close()
    if (!row) return null

    const meta: CursorMeta = JSON.parse(Buffer.from(row.value, 'hex').toString('utf-8'))
    const stat = require('node:fs').statSync(dbPath)

    return {
      id: `cursor:${meta.agentId}`,
      source: 'cursor',
      title: meta.name?.trim() || `Cursor ${meta.agentId.slice(0, 8)}`,
      createdAt: new Date(meta.createdAt ?? 0).toISOString(),
      updatedAt: new Date(stat.mtimeMs).toISOString(),
    }
  } catch {
    return null
  }
}

export async function fetchCursorChats(chatsDir: string): Promise<ChatSession[]> {
  const dbs = await findStoreDbs(chatsDir)
  return dbs.map(parseStoreDb).filter((s): s is ChatSession => s !== null)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/providers/cursor.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/cursor.ts src/lib/providers/cursor.test.ts src/lib/providers/__fixtures__/cursor/
git commit -m "feat: add cursor chat provider"
```

---

### Task 8: Aggregator (TDD)

**Files:**

- Create: `src/lib/aggregator.ts`
- Create: `src/lib/aggregator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/aggregator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aggregateChats } from './aggregator'
import type { ChatSession } from './types'

vi.mock('./providers/grok', () => ({
  fetchGrokChats: vi.fn().mockResolvedValue([
    {
      id: 'grok:1',
      source: 'grok',
      title: 'Grok chat',
      createdAt: '2026-06-24T10:00:00Z',
      updatedAt: '2026-06-24T12:00:00Z',
    },
  ] satisfies ChatSession[]),
}))
vi.mock('./providers/codex', () => ({
  fetchCodexChats: vi.fn().mockResolvedValue([
    {
      id: 'codex:1',
      source: 'codex',
      title: 'Codex chat',
      createdAt: '2026-06-24T08:00:00Z',
      updatedAt: '2026-06-24T14:00:00Z',
    },
  ] satisfies ChatSession[]),
}))
vi.mock('./providers/opencode', () => ({
  fetchOpenCodeChats: vi.fn().mockReturnValue([]),
}))
vi.mock('./providers/cursor', () => ({
  fetchCursorChats: vi.fn().mockResolvedValue([
    {
      id: 'cursor:1',
      source: 'cursor',
      title: 'Cursor chat',
      createdAt: '2026-06-24T06:00:00Z',
      updatedAt: '2026-06-24T11:00:00Z',
    },
  ] satisfies ChatSession[]),
}))

describe('aggregateChats', () => {
  it('merges all providers and sorts by updatedAt desc', async () => {
    const result = await aggregateChats({
      cursorHome: '/c',
      grokHome: '/g',
      codexHome: '/x',
      opencodeDataDir: '/o',
    })
    expect(result).toHaveLength(3)
    expect(result.map((s) => s.source)).toEqual(['codex', 'grok', 'cursor'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/aggregator.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/aggregator.ts
import path from 'node:path'
import type { DataPaths } from './config'
import { sortByUpdatedAt } from './sort'
import type { ChatSession } from './types'
import { fetchCodexChats } from './providers/codex'
import { fetchCursorChats } from './providers/cursor'
import { fetchGrokChats } from './providers/grok'
import { fetchOpenCodeChats } from './providers/opencode'

export async function aggregateChats(paths: DataPaths): Promise<ChatSession[]> {
  const [grok, codex, cursor] = await Promise.all([
    fetchGrokChats(path.join(paths.grokHome, 'sessions')),
    fetchCodexChats(paths.codexHome),
    fetchCursorChats(path.join(paths.cursorHome, 'chats')),
  ])

  const opencode = fetchOpenCodeChats(path.join(paths.opencodeDataDir, 'opencode.db'))

  return sortByUpdatedAt([...grok, ...codex, ...cursor, ...opencode])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/aggregator.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/aggregator.ts src/lib/aggregator.test.ts
git commit -m "feat: add chat aggregator"
```

---

### Task 9: Server Function

**Files:**

- Create: `src/server/chats.ts`

- [ ] **Step 1: Write server function**

```typescript
// src/server/chats.ts
import { createServerFn } from '@tanstack/react-start'
import { getDataPaths } from '../lib/config'
import { aggregateChats } from '../lib/aggregator'

export const getChats = createServerFn({ method: 'GET' }).handler(async () => {
  const paths = getDataPaths()
  return aggregateChats(paths)
})
```

- [ ] **Step 2: Verify against real data (manual smoke)**

Run: `npm run dev`  
Navigate to `http://localhost:3000`  
Expected: page loads (UI wired in Task 10)

- [ ] **Step 3: Commit**

```bash
git add src/server/chats.ts
git commit -m "feat: add getChats server function"
```

---

### Task 10: UI Components

**Files:**

- Create: `src/components/SourceBadge.tsx`
- Create: `src/components/ChatItem.tsx`
- Create: `src/components/ChatList.tsx`
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: SourceBadge**

```tsx
// src/components/SourceBadge.tsx
import type { ChatSource } from '../lib/types'
import { SOURCE_LABELS } from '../lib/types'

const COLORS: Record<ChatSource, string> = {
  cursor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  grok: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  codex: 'bg-green-500/20 text-green-300 border-green-500/30',
  opencode: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
}

export function SourceBadge({ source }: { source: ChatSource }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${COLORS[source]}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  )
}
```

- [ ] **Step 2: ChatItem**

```tsx
// src/components/ChatItem.tsx
import type { ChatSession } from '../lib/types'
import { SourceBadge } from './SourceBadge'

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ChatItem({ chat }: { chat: ChatSession }) {
  return (
    <li className="group flex items-start gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 transition hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SourceBadge source={chat.source} />
          <span className="text-xs text-zinc-500">
            {formatRelative(chat.updatedAt)}
          </span>
        </div>
        <p className="font-medium text-zinc-100 truncate">{chat.title}</p>
        {chat.cwd && (
          <p className="text-xs text-zinc-500 truncate mt-0.5">{chat.cwd}</p>
        )}
      </div>
      {chat.messageCount != null && (
        <span className="text-xs text-zinc-600 tabular-nums">
          {chat.messageCount} msgs
        </span>
      )}
    </li>
  )
}
```

- [ ] **Step 3: ChatList with source filter**

```tsx
// src/components/ChatList.tsx
'use client'
import { useState, useMemo } from 'react'
import type { ChatSession, ChatSource } from '../lib/types'
import { SOURCE_LABELS } from '../lib/types'
import { ChatItem } from './ChatItem'

const ALL_SOURCES: ChatSource[] = ['cursor', 'grok', 'codex', 'opencode']

export function ChatList({ chats }: { chats: ChatSession[] }) {
  const [filter, setFilter] = useState<ChatSource | 'all'>('all')

  const filtered = useMemo(
    () => (filter === 'all' ? chats : chats.filter((c) => c.source === filter)),
    [chats, filter],
  )

  const counts = useMemo(() => {
    const map = Object.fromEntries(ALL_SOURCES.map((s) => [s, 0])) as Record<
      ChatSource,
      number
    >
    for (const c of chats) map[c.source]++
    return map
  }, [chats])

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1 text-sm ${filter === 'all' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
        >
          All ({chats.length})
        </button>
        {ALL_SOURCES.map((source) => (
          <button
            key={source}
            onClick={() => setFilter(source)}
            className={`rounded-full px-3 py-1 text-sm ${filter === source ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
          >
            {SOURCE_LABELS[source]} ({counts[source]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-zinc-500 text-center py-12">No chats found</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((chat) => (
            <ChatItem key={chat.id} chat={chat} />
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire index route**

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { getChats } from '../server/chats'
import { ChatList } from '../components/ChatList'

export const Route = createFileRoute('/')({
  loader: () => getChats(),
  component: Home,
})

function Home() {
  const chats = Route.useLoaderData()
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">AI Chats</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Cursor, Grok, Codex & OpenCode — sorted by most recent
          </p>
        </header>
        <ChatList chats={chats} />
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Verify UI**

Run: `npm run dev`  
Expected: lista com chats reais das 4 fontes, ordenados por recência

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/routes/index.tsx
git commit -m "feat: add chat list UI with source filters"
```

---

### Task 11: Full Test Suite + Build

- [ ] **Step 1: Run all tests**

Run: `npm test`  
Expected: all tests PASS

- [ ] **Step 2: Production build**

Run: `npm run build`  
Expected: build succeeds

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore: verify full test suite and production build"
```

---

## Self-Review Checklist

| Requirement             | Task                              |
| ----------------------- | --------------------------------- |
| TanStack Start          | Task 1                            |
| Tailwind                | Task 1                            |
| Cursor chats            | Task 7                            |
| Grok chats              | Task 4                            |
| Codex chats             | Task 6                            |
| OpenCode chats          | Task 5                            |
| Sort by newest          | Task 2 + Task 8                   |
| TDD (tests before impl) | All provider tasks                |
| Local app               | Task 9 (server fn reads local FS) |

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-06-24-ai-chats-aggregator.md`.**

**1. Subagent-Driven (recommended)** — subagent por task, review entre tasks

**2. Inline Execution** — executar tasks nesta sessão com checkpoints

Qual abordagem prefere?
