#!/usr/bin/env bash
set -e

echo "Installing AnyCode..."

INSTALL_DIR="${ANYCODE_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR"

ARCH="$(uname -m)"
case "$ARCH" in
    x86_64|amd64) BIN="anycode-linux-x64" ;;
    aarch64|arm64) BIN="anycode-darwin-arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

if [ "$(uname -s)" = "Darwin" ]; then
    case "$ARCH" in
        x86_64|amd64) BIN="anycode-darwin-x64" ;;
        aarch64|arm64) BIN="anycode-darwin-arm64" ;;
    esac
fi

echo "Downloading $BIN..."
curl -fsSL -o "$INSTALL_DIR/anycode" "https://github.com/anymousxe/anycode/releases/latest/download/$BIN"
chmod +x "$INSTALL_DIR/anycode"

echo ""
echo "Done! Run 'anycode' to start."

if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    echo ""
    echo "Add $INSTALL_DIR to your PATH:"
    echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
fi
