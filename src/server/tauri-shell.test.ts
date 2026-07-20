/**
 * Structural proof that the desktop shell is Tauri-wired.
 * Complements data-path.test.ts (runtime list/detail) with config/scripts checks.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('Tauri desktop shell project', () => {
  it('ships official Tauri config + Rust crate entry points', () => {
    const confPath = path.join(ROOT, 'src-tauri/tauri.conf.json')
    const cargoPath = path.join(ROOT, 'src-tauri/Cargo.toml')
    const libPath = path.join(ROOT, 'src-tauri/src/lib.rs')
    const mainPath = path.join(ROOT, 'src-tauri/src/main.rs')

    expect(fs.existsSync(confPath)).toBe(true)
    expect(fs.existsSync(cargoPath)).toBe(true)
    expect(fs.existsSync(libPath)).toBe(true)
    expect(fs.existsSync(mainPath)).toBe(true)

    const conf = JSON.parse(fs.readFileSync(confPath, 'utf-8')) as {
      productName?: string
      build?: { devUrl?: string; frontendDist?: string; beforeDevCommand?: string }
      app?: { windows?: Array<{ label?: string; create?: boolean }> }
    }

    expect(conf.productName).toBe('AI Chats')
    expect(conf.build?.devUrl).toMatch(/127\.0\.0\.1:3000/)
    // Production webview loads the Node backend (preserves createServerFn data path)
    expect(conf.build?.frontendDist).toMatch(/127\.0\.0\.1:3847/)
    expect(conf.build?.beforeDevCommand).toMatch(/npm run dev/)

    const cargo = fs.readFileSync(cargoPath, 'utf-8')
    expect(cargo).toMatch(/tauri\s*=/)
    expect(cargo).toMatch(/name\s*=\s*"ai-chats"/)

    const lib = fs.readFileSync(libPath, 'utf-8')
    expect(lib).toMatch(/start_backend|tauri::Builder/)
    // Cold-start fix: webview must be created after backend is ready
    expect(conf.app?.windows?.[0]?.create).toBe(false)
    expect(lib).toMatch(/WebviewWindowBuilder::from_config/)
    expect(lib).toMatch(/create_main_window/)
    // setup() must call start_backend before create_main_window
    const callBackend = lib.indexOf('backend::start_backend')
    const callCreate = lib.indexOf('create_main_window(app)')
    expect(callBackend).toBeGreaterThan(-1)
    expect(callCreate).toBeGreaterThan(callBackend)
  })

  it('exposes npm scripts that invoke the Tauri CLI', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'),
    ) as {
      scripts?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    expect(pkg.scripts?.['tauri:dev']).toMatch(/tauri dev/)
    expect(pkg.scripts?.['tauri:build']).toMatch(/tauri build/)
    expect(pkg.scripts?.desktop).toMatch(/launch-desktop/)
    expect(pkg.devDependencies?.['@tauri-apps/cli']).toBeTruthy()
  })
})
