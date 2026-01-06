#!/usr/bin/env bash
# Merge vitest and tryscript coverage reports
# Both output lcov.info files that can be concatenated and summarized

set -e

COVERAGE_DIR="coverage"
TRYSCRIPT_DIR="coverage-tryscript"
MERGED_DIR="coverage-merged"

mkdir -p "$MERGED_DIR"

# Check both coverage directories exist
if [[ ! -f "$COVERAGE_DIR/lcov.info" ]]; then
  echo "Error: $COVERAGE_DIR/lcov.info not found. Run 'pnpm test:coverage' first."
  exit 1
fi

if [[ ! -f "$TRYSCRIPT_DIR/lcov.info" ]]; then
  echo "Error: $TRYSCRIPT_DIR/lcov.info not found. Run 'pnpm test:tryscript:coverage' first."
  exit 1
fi

# Merge lcov files using lcov-result-merger (handles duplicate entries properly)
echo "Merging coverage reports..."
npx lcov-result-merger "$COVERAGE_DIR/lcov.info" "$TRYSCRIPT_DIR/lcov.info" > "$MERGED_DIR/lcov.info"

# Generate summary
echo ""
echo "=== Merged Coverage Summary ==="
npx lcov-summary "$MERGED_DIR/lcov.info" 2>/dev/null | tail -5

echo ""
echo "Full report written to $MERGED_DIR/lcov.info"
