#!/usr/bin/env bash
set -e

echo "Installing AnyCode..."

INSTALL_DIR="${ANYCODE_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|Windows*)
    echo "Downloading for Windows..."
    curl -fsSL -o "$INSTALL_DIR/anycode.exe" "https://github.com/anymousxe/anycode/releases/latest/download/anycode-windows-x64.exe"
    echo "Installed to $INSTALL_DIR/anycode.exe"
    ;;
  Darwin)
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
      echo "Downloading for macOS ARM..."
      curl -fsSL -o "$INSTALL_DIR/anycode" "https://github.com/anymousxe/anycode/releases/latest/download/anycode-darwin-arm64"
    else
      echo "Downloading for macOS Intel..."
      curl -fsSL -o "$INSTALL_DIR/anycode" "https://github.com/anymousxe/anycode/releases/latest/download/anycode-darwin-x64"
    fi
    chmod +x "$INSTALL_DIR/anycode"
    echo "Installed to $INSTALL_DIR/anycode"
    ;;
  Linux*)
    echo "Downloading for Linux..."
    curl -fsSL -o "$INSTALL_DIR/anycode" "https://github.com/anymousxe/anycode/releases/latest/download/anycode-linux-x64"
    chmod +x "$INSTALL_DIR/anycode"
    echo "Installed to $INSTALL_DIR/anycode"
    ;;
  *)
    echo "Unsupported OS: $(uname -s)"
    exit 1
    ;;
esac

echo ""
echo "Done! Run 'anycode' to start."

if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo ""
  echo "Add $INSTALL_DIR to your PATH:"
  echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
fi
