#!/usr/bin/env bash
set -e

echo "Installing AnyCode..."

if ! command -v bun &> /dev/null; then
  echo "Bun is required but not installed. Install it from https://bun.sh"
  exit 1
fi

INSTALL_DIR="${ANYCODE_INSTALL_DIR:-$HOME/.local/bin}"
TMPDIR=$(mktemp -d)

echo "Cloning..."
git clone --depth 1 https://github.com/anymousxe/anycode.git "$TMPDIR/anycode"

echo "Installing dependencies..."
cd "$TMPDIR/anycode"
bun install

echo "Building..."
cd packages/opencode
bun run script/build.ts --single

echo "Copying binary to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|Windows*)
    cp dist/anycode-windows-x64/bin/anycode.exe "$INSTALL_DIR/anycode.exe"
    ;;
  Darwin)
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
      cp dist/anycode-darwin-arm64/bin/anycode "$INSTALL_DIR/anycode"
    else
      cp dist/anycode-darwin-x64/bin/anycode "$INSTALL_DIR/anycode"
    fi
    ;;
  Linux*)
    cp dist/anycode-linux-x64/bin/anycode "$INSTALL_DIR/anycode"
    ;;
esac

chmod +x "$INSTALL_DIR/anycode" 2>/dev/null || true

rm -rf "$TMPDIR"

echo ""
echo "Done! Run 'anycode' to start."

if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo ""
  echo "Add $INSTALL_DIR to your PATH:"
  echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
fi
