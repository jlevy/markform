#!/usr/bin/env bash
# update-badge-links.sh - Update CI/Coverage badge links in README.md
#
# This script updates the markdown badge links (not the badge images) to point
# to a specific GitHub Actions run URL.
#
# Usage:
#   ./scripts/update-badge-links.sh <run_url> [readme_file]
#
# Arguments:
#   run_url     - The GitHub Actions run URL (e.g., https://github.com/owner/repo/actions/runs/12345)
#   readme_file - Path to README.md (default: README.md in current directory)
#
# Environment variables (optional, for CI use):
#   GITHUB_SERVER_URL  - GitHub server URL (default: https://github.com)
#   GITHUB_REPOSITORY  - Repository in owner/repo format
#   GITHUB_RUN_ID      - Workflow run ID
#
# The script only modifies badge LINKS, not badge IMAGES. It identifies badges by:
# - Looking for markdown image-link syntax: [![...](image_url)](link_url)
# - Only updating links that point to GitHub Actions URLs
#
# Examples:
#   # Direct usage with URL
#   ./scripts/update-badge-links.sh "https://github.com/owner/repo/actions/runs/12345"
#
#   # In GitHub Actions (uses env vars)
#   GITHUB_RUN_ID=12345 ./scripts/update-badge-links.sh

set -euo pipefail

# Build run URL from arguments or environment
if [[ $# -ge 1 && -n "$1" ]]; then
    RUN_URL="$1"
else
    # Build from environment variables
    SERVER_URL="${GITHUB_SERVER_URL:-https://github.com}"
    REPO="${GITHUB_REPOSITORY:-}"
    RUN_ID="${GITHUB_RUN_ID:-}"

    if [[ -z "$REPO" || -z "$RUN_ID" ]]; then
        echo "Error: Either provide run_url as argument or set GITHUB_REPOSITORY and GITHUB_RUN_ID" >&2
        echo "Usage: $0 <run_url> [readme_file]" >&2
        exit 1
    fi

    RUN_URL="${SERVER_URL}/${REPO}/actions/runs/${RUN_ID}"
fi

README_FILE="${2:-README.md}"

if [[ ! -f "$README_FILE" ]]; then
    echo "Error: README file not found: $README_FILE" >&2
    exit 1
fi

echo "Updating badge links in $README_FILE"
echo "New link URL: $RUN_URL"

# Pattern explanation:
# We want to match: [![...](image_url)](old_link_url)
# And replace old_link_url with the new run URL
#
# The key insight is that badge links in markdown follow this pattern:
#   )](https://github.com/...actions...)
# where the leading )] closes the image URL and opens the link URL.
#
# We match )](url_containing_/actions/) and replace the URL portion.
# This avoids matching the badge IMAGE urls (which also might contain github.com)

# Use sed to replace:
# Pattern: )](https://github.com/<anything>/actions/<anything>)
# With:    ](<new_run_url>)
#
# The pattern )](https://github.com/[^/]+/[^/]+/actions/[^)]*) matches:
# - )] literal
# - (https://github.com/ literal
# - [^/]+/[^/]+ owner/repo (any owner, any repo)
# - /actions/ literal
# - [^)]* rest of URL until closing paren

sed -i.bak -E "s|\)\]\(https://github\.com/[^/]+/[^/]+/actions/[^\)]*\)|)](${RUN_URL})|g" "$README_FILE"

# Show what changed
if diff -q "$README_FILE.bak" "$README_FILE" > /dev/null 2>&1; then
    echo "No changes made (links may already be up to date)"
    rm -f "$README_FILE.bak"
else
    echo "Badge links updated successfully"
    echo ""
    echo "Changes made:"
    diff "$README_FILE.bak" "$README_FILE" || true
    rm -f "$README_FILE.bak"
fi
