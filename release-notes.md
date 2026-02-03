## What's Changed

### Features

- **Frontmatter validation**: Added MarkformSectionInputSchema with Zod validation for more reliable frontmatter parsing
- **Timing metrics**: Added startMs to timeline entries and tool calls for relative timing analysis in FillRecords

### Fixes

- **Reliable tool calling**: Default toolChoice to 'required' for consistent agent behavior
- **Parallel execution tracking**: Fixed executionId passing and per-execution turn tracking for correct tool call matching
- **Frontmatter round-trips**: Preserve title/description fields when serializing forms
- **Concurrency handling**: Corrected parallel execution concurrency and FillRecord tracking

### Refactoring

- **YAML formatting**: Centralized stringify options and improved output readability
- **HTML comment syntax**: Migrated all forms to HTML comment syntax for field attributes
- **Config handling**: Centralized harness config snake_case/camelCase mapping
- **Execution IDs**: Self-documenting format with eid: prefix

### Testing

- Comprehensive frontmatter unit tests
- Parallel execution integration and tracking tests
- Updated test expectations for HTML comment syntax

### Documentation

- Clarified .env file loading behavior
- Updated manual test docs and gitignore patterns

**Full commit history**: https://github.com/jlevy/markform/compare/v0.1.20...v0.1.21
