#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/runtime.sh
source "$SCRIPT_DIR/lib/runtime.sh"

PAKE_BIN="${PAKE_BIN:-}"
if [ -z "$PAKE_BIN" ]; then
  if command -v pake >/dev/null 2>&1; then
    PAKE_BIN="pake"
  else
    PAKE_BIN="npx --yes pake-cli"
  fi
fi

started_server=false
if port_in_use && server_is_ai_chats; then
  echo "Using existing AI Chats server on port $AI_CHATS_PORT"
elif port_in_use; then
  echo "Port $AI_CHATS_PORT is already in use by another process." >&2
  echo "Stop it or run with AI_CHATS_PORT=<free-port> npm run pake:build" >&2
  exit 1
else
  start_server
  started_server=true
fi

cleanup() {
  if [ "$started_server" = true ]; then
    stop_server
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR"

echo "Packaging desktop app with Pake..."
# macOS: build .app bundle in project root
if [ "$(uname -s)" = "Darwin" ]; then
  PAKE_CREATE_APP=1 $PAKE_BIN "http://127.0.0.1:${AI_CHATS_PORT}/" \
    --name "$AI_CHATS_APP_NAME" \
    --icon "$ROOT_DIR/public/logo512.png" \
    --width 1200 \
    --height 800 \
    --min-width 900 \
    --min-height 600 \
    --targets app \
    --hide-on-close \
    --internal-url-regex "^http://127\\.0\\.0\\.1:${AI_CHATS_PORT}(/.*)?$"
else
  $PAKE_BIN "http://127.0.0.1:${AI_CHATS_PORT}/" \
    --name "$AI_CHATS_APP_NAME" \
    --icon "$ROOT_DIR/public/logo512.png" \
    --width 1200 \
    --height 800 \
    --min-width 900 \
    --min-height 600 \
    --hide-on-close \
    --internal-url-regex "^http://127\\.0\\.0\\.1:${AI_CHATS_PORT}(/.*)?$"
fi

echo ""
echo "Desktop app ready."
echo "Launch with: npm run pake:launch"
if [ -d "$ROOT_DIR/$AI_CHATS_APP_NAME.app" ]; then
  echo "App bundle: $ROOT_DIR/$AI_CHATS_APP_NAME.app"
fi

if [ "$(uname -s)" = "Darwin" ]; then
  bash "$SCRIPT_DIR/install-desktop-shortcut.sh"
fi