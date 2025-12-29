#!/bin/bash
# Automated beads setup for Claude Code sessions
# This script runs on SessionStart to ensure beads CLI is available

set -e

# Add common binary locations to PATH
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"

# Check if bd is already installed
if command -v bd &> /dev/null; then
    echo "[beads] CLI found at $(which bd)"
else
    echo "[beads] CLI not found, installing..."

    # Detect platform
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    [ "$ARCH" = "x86_64" ] && ARCH="amd64"
    [ "$ARCH" = "aarch64" ] && ARCH="arm64"

    echo "[beads] Detected platform: ${OS}_${ARCH}"

    # Get latest version from GitHub API
    BD_VERSION=$(curl -sI https://github.com/steveyegge/beads/releases/latest | \
      grep -i "^location:" | sed 's/.*tag\///' | tr -d '\r\n')

    if [ -z "$BD_VERSION" ]; then
        echo "[beads] ERROR: Could not determine latest version"
        exit 1
    fi

    echo "[beads] Latest version: ${BD_VERSION}"

    # Download and install
    DOWNLOAD_URL="https://github.com/steveyegge/beads/releases/download/${BD_VERSION}/beads_${BD_VERSION#v}_${OS}_${ARCH}.tar.gz"
    echo "[beads] Downloading from ${DOWNLOAD_URL}..."

    curl -fsSL -o /tmp/beads.tar.gz "$DOWNLOAD_URL"
    tar -xzf /tmp/beads.tar.gz -C /tmp

    # Install to ~/.local/bin (works in cloud and local)
    mkdir -p ~/.local/bin
    cp /tmp/bd ~/.local/bin/
    chmod +x ~/.local/bin/bd

    # Clean up
    rm -f /tmp/beads.tar.gz /tmp/bd

    echo "[beads] Installed to ~/.local/bin/bd"
fi

# Check if we're in a beads-enabled project
if [ -d ".beads" ]; then
    echo "[beads] Project has .beads directory, running bd prime..."
    bd prime
else
    echo "[beads] No .beads directory found (not a beads-tracked project)"
fi
