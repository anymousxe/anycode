#!/usr/bin/env bash
set -e

echo "Installing AnyCode..."

INSTALL_DIR="${ANYCODE_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR"

echo "Downloading..."
curl -fsSL -o "$INSTALL_DIR/anycode" "https://github.com/anymousxe/anycode/releases/latest/download/anycode.exe"
chmod +x "$INSTALL_DIR/anycode" 2>/dev/null || true

echo ""
echo "Done! Run 'anycode' to start."

if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo ""
  echo "Add $INSTALL_DIR to your PATH:"
  echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
fi
