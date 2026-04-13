#!/usr/bin/env bash
set -e

echo "Installing AnyCode..."

INSTALL_DIR="${ANYCODE_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR"

PLATFORM="$(uname -s)"
ARCH="$(uname -m)"

if [ "$PLATFORM" = "Darwin" ]; then
    case "$ARCH" in
        x86_64|amd64) SUFFIX="darwin-x64" ;;
        aarch64|arm64) SUFFIX="darwin-arm64" ;;
        *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
elif [ "$PLATFORM" = "Linux" ]; then
    case "$ARCH" in
        x86_64|amd64) SUFFIX="linux-x64" ;;
        aarch64|arm64) SUFFIX="linux-arm64" ;;
        *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
else
    echo "Unsupported platform: $PLATFORM"
    exit 1
fi

URL="https://github.com/anymousxe/anycode/releases/latest/download/anycode-${SUFFIX}"
DEST="$INSTALL_DIR/anycode"

echo "Downloading anycode-${SUFFIX}..."
if command -v curl &>/dev/null; then
    curl -fsSL -o "$DEST" "$URL"
elif command -v wget &>/dev/null; then
    wget -q -O "$DEST" "$URL"
else
    echo "Neither curl nor wget found. Please install one and retry."
    exit 1
fi

if [ ! -s "$DEST" ]; then
    echo "Downloaded file is empty. The ${SUFFIX} binary may not be available yet."
    echo "Check https://github.com/anymousxe/anycode/releases for available assets."
    rm -f "$DEST"
    exit 1
fi

chmod +x "$DEST"

echo ""
echo "Done! Run 'anycode' to start."

if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    echo ""
    echo "Add $INSTALL_DIR to your PATH:"
    echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
fi
