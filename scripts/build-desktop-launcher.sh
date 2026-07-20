#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/runtime.sh
source "$SCRIPT_DIR/lib/runtime.sh"

TARGET_APP="${1:-}"

if [ -z "$TARGET_APP" ]; then
  echo "Usage: build-desktop-launcher.sh <path/to/AI Chats.app>" >&2
  exit 1
fi

PAKE_APP="$ROOT_DIR/$AI_CHATS_APP_NAME.app"

if [ ! -d "$PAKE_APP" ]; then
  echo "Pake app not found. Run: npm run pake:build" >&2
  exit 1
fi

rm -rf "$TARGET_APP"
mkdir -p "$TARGET_APP/Contents/MacOS" "$TARGET_APP/Contents/Resources"

cat >"$TARGET_APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>${AI_CHATS_APP_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIconFile</key>
  <string>ai_chats</string>
  <key>CFBundleIdentifier</key>
  <string>com.db-code-harness.ai-chats.launcher</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${AI_CHATS_APP_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13</string>
</dict>
</plist>
EOF

cat >"$TARGET_APP/Contents/MacOS/launcher" <<EOF
#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:\$PATH"
if [ -s "\$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "\$HOME/.nvm/nvm.sh"
fi
cd "$ROOT_DIR"
exec /bin/bash "$ROOT_DIR/scripts/launch-desktop.sh"
EOF
chmod +x "$TARGET_APP/Contents/MacOS/launcher"

if [ -f "$PAKE_APP/Contents/Resources/ai_chats.icns" ]; then
  cp "$PAKE_APP/Contents/Resources/ai_chats.icns" "$TARGET_APP/Contents/Resources/ai_chats.icns"
fi

echo "Launcher app created: $TARGET_APP"