#!/usr/bin/env bash

# Primary desktop launch path: standalone Tauri app (Rust data layer, no Node at runtime).
# Legacy Pake bundles still need the local Node server if no Tauri binary is present.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/runtime.sh
source "$SCRIPT_DIR/lib/runtime.sh"

# Prefer a built Tauri app; fall back to `tauri dev` when developing.
# Native Tauri embeds the SPA + Rust providers — do not start a Node server.
if app_path="$(find_tauri_app 2>/dev/null)"; then
  echo "Opening Tauri app: $app_path"
  open "$app_path"
  exit 0
fi

setup_runtime_path

if command -v cargo >/dev/null 2>&1 && [ -f "$ROOT_DIR/src-tauri/Cargo.toml" ]; then
  echo "No Tauri app bundle found — starting development shell (tauri dev)..."
  echo "Tip: run npm run tauri:build once to produce a native .app"
  cd "$ROOT_DIR"
  exec npm run tauri:dev
fi

# Legacy fallback: Pake-wrapped app (still depends on local Node preview server)
if app_path="$(find_desktop_app 2>/dev/null)"; then
  ensure_server_running
  echo "Opening legacy Pake app: $app_path"
  echo "(Primary desktop path is Tauri — run: npm run tauri:build)"
  open "$app_path"
  exit 0
fi

echo "Desktop app not found." >&2
echo "  Primary:  npm run tauri:build && npm run desktop" >&2
echo "  Dev:      npm run tauri:dev" >&2
echo "  Legacy:   npm run pake:build" >&2
exit 1
