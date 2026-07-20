import os from 'node:os'
import path from 'node:path'

export interface DataPaths {
  cursorHome: string
  grokHome: string
  codexHome: string
  opencodeDataDir: string
  claudeHome: string
}

export function getDataPaths(): DataPaths {
  const home = process.env.HOME ?? os.homedir()
  return {
    cursorHome: process.env.CURSOR_HOME ?? path.join(home, '.cursor'),
    grokHome: process.env.GROK_HOME ?? path.join(home, '.grok'),
    codexHome: process.env.CODEX_HOME ?? path.join(home, '.codex'),
    opencodeDataDir:
      process.env.OPENCODE_DATA_DIR ?? path.join(home, '.local', 'share', 'opencode'),
    claudeHome: process.env.CLAUDE_HOME ?? path.join(home, '.claude'),
  }
}
