#!/bin/bash
set -euo pipefail

# Only run in remote environments (Claude Code on the web)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

NODE_VERSION="v24.12.0"
NODE_DIR="$HOME/.local/node-${NODE_VERSION}-linux-x64"

# Install Node 24 if not already installed
if [ ! -d "$NODE_DIR" ]; then
  echo "Installing Node.js ${NODE_VERSION}..."
  mkdir -p "$HOME/.local"
  curl -fsSL "https://nodejs.org/dist/latest-v24.x/node-${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node24.tar.xz
  tar -xJf /tmp/node24.tar.xz -C "$HOME/.local"
  rm /tmp/node24.tar.xz
  echo "Node.js ${NODE_VERSION} installed successfully"
else
  echo "Node.js ${NODE_VERSION} already installed"
fi

# Set up PATH for the session
echo "export PATH=\"$NODE_DIR/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"

# Source the env file for this script
export PATH="$NODE_DIR/bin:$PATH"

# Verify Node version
echo "Using Node.js $(node --version)"

# Install dependencies
cd "$CLAUDE_PROJECT_DIR"
pnpm install
echo "Dependencies installed successfully"
