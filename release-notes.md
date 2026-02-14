## What's Changed

### Features

- **CLI form-filling commands**: New `set` command with auto-coercion and `next` command for field advisor, plus rename of `apply` to `patch`
- **Append/delete patch operations**: Support for append and delete ops on tables, string_list, and url_list fields
- **Claude Code skill integration**: New `skill` and `setup` commands for Claude Code agent integration
- **Fill record improvements**: Empty fill record guard skips `.fill.json` when no turns executed; coercion warnings plumbed through to fill record timeline
- **Configurable agent retries**: Added `maxRetries` option for live agent API calls
- **Enriched AI SDK inspect**: `markform_inspect` now includes field advisor data

### Fixes

- Fixed CLI form-filling review findings across multiple commands
- Fixed `helpWidth` to 88 for consistent CLI output
- Updated tryscript golden files for new setup/skill commands

### Refactoring

- Extracted shared `resolvePackagePath` utility for bundled doc loading

### Tests

- Added tryscript tests for CLI `set` command error paths
- Added unit tests for `serialize.ts` edge cases and `apply.ts` error branches
- Added golden session test for multi-turn CLI form filling
- Raised coverage thresholds to lock in test improvements

**Full commit history**: https://github.com/jlevy/markform/compare/v0.1.23...v0.1.24
