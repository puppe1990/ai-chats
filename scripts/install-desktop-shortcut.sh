#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/runtime.sh
source "$SCRIPT_DIR/lib/runtime.sh"

DESKTOP_DIR="${AI_CHATS_DESKTOP_DIR:-$HOME/Desktop}"
SHORTCUT_NAME="${AI_CHATS_SHORTCUT_NAME:-AI Chats}"
COMMAND_PATH="$DESKTOP_DIR/${SHORTCUT_NAME}.command"
APP_PATH="$DESKTOP_DIR/${AI_CHATS_APP_NAME}.app"

mkdir -p "$DESKTOP_DIR"

cat >"$COMMAND_PATH" <<EOF
#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:\$PATH"
if [ -s "\$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "\$HOME/.nvm/nvm.sh"
fi
cd "$ROOT_DIR"
exec bash scripts/launch-desktop.sh
EOF
chmod +x "$COMMAND_PATH"

if tauri_app="$(find_tauri_app 2>/dev/null)"; then
  echo "Tauri app bundle: $tauri_app"
  echo "Launch with: npm run desktop"
elif [ -d "$ROOT_DIR/$AI_CHATS_APP_NAME.app" ]; then
  bash "$SCRIPT_DIR/build-desktop-launcher.sh" "$APP_PATH"
  echo "Legacy Pake desktop launcher: $APP_PATH"
else
  echo "App bundle not found yet. Primary: npm run tauri:build"
fi

echo "Fallback shortcut: $COMMAND_PATH"
echo "Double-click the shortcut to start the server and open AI Chats (Tauri preferred)."