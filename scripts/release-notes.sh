#!/usr/bin/env bash
# release-notes.sh - Display categorized commits since the last release tag
#
# This script helps prepare release notes by showing commits organized by
# conventional commit type (feat, fix, refactor, etc.).
#
# Usage:
#   pnpm release:changes
#   ./scripts/release-notes.sh [base_ref]
#
# Arguments:
#   base_ref - Optional base reference (default: last git tag)
#              Can be a tag (v0.1.14), branch (main), or commit SHA
#
# Output:
#   Categorized list of commits suitable for drafting release notes.
#   The agent or human can use this to write a summary following the
#   format in docs/publishing.md "Writing Release Notes" section.
#
# Examples:
#   ./scripts/release-notes.sh              # Changes since last tag
#   ./scripts/release-notes.sh v0.1.10      # Changes since v0.1.10
#   ./scripts/release-notes.sh main~20      # Last 20 commits on main

set -euo pipefail

# Determine base reference
if [[ $# -ge 1 && -n "$1" ]]; then
    BASE_REF="$1"
else
    BASE_REF=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [[ -z "$BASE_REF" ]]; then
        echo "No release tags found. Use: $0 <base_ref>" >&2
        exit 1
    fi
fi

RANGE="${BASE_REF}..HEAD"

echo "Changes since $BASE_REF"
echo "Compare: https://github.com/jlevy/markform/compare/${BASE_REF}...HEAD"
echo ""

# Count commits
COUNT=$(git log "$RANGE" --oneline 2>/dev/null | wc -l | tr -d ' ')
echo "Total commits: $COUNT"
echo ""

# Helper to print commits matching a pattern
print_category() {
    local title="$1"
    local pattern="$2"

    echo "### $title"
    local commits
    commits=$(git log "$RANGE" --pretty=format:"%s" 2>/dev/null | grep -E "$pattern" || true)
    if [[ -n "$commits" ]]; then
        echo "$commits" | while read -r line; do
            # Strip the conventional commit prefix for cleaner output
            echo "- ${line#*: }"
        done
    else
        echo "(none)"
    fi
    echo ""
}

print_category "Features" "^feat(\([^)]+\))?:"
print_category "Fixes" "^fix(\([^)]+\))?:"
print_category "Refactoring" "^refactor(\([^)]+\))?:"
print_category "Tests" "^test(\([^)]+\))?:"
print_category "Documentation" "^docs(\([^)]+\))?:"
print_category "Other (chore, ci, build)" "^(chore|ci|build|style|perf)(\([^)]+\))?:"
