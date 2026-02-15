#!/bin/sh
# Require Co-Authored-By trailer on all commits.
# Works with any AI agent (Claude, Copilot, Cursor, etc.)
# Use "Co-Authored-By: none" for purely human-authored commits.

COMMIT_MSG_FILE="$1"

if ! grep -qi "Co-Authored-By:" "$COMMIT_MSG_FILE"; then
  echo ""
  echo "ERROR: Missing Co-Authored-By trailer in commit message."
  echo ""
  echo "If an AI agent helped write this, add e.g.:"
  echo "  Co-Authored-By: Claude <noreply@anthropic.com>"
  echo "  Co-Authored-By: GitHub Copilot <noreply@github.com>"
  echo "  Co-Authored-By: Cursor <noreply@cursor.com>"
  echo ""
  echo "If purely human-authored, add:"
  echo "  Co-Authored-By: none"
  echo ""
  exit 1
fi
