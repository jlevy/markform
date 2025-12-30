# markform

## 0.1.6

### Patch Changes

- 3862a96: Add FillCallbacks for harness observability, make core library Node.js-free

## 0.1.5

### Patch Changes

- 367c2bc: Add unknown tag validation in parser and rename field-group tag to group

## 0.1.4

### Patch Changes

- 5b1794b: Add custom tool injection, unified field tag syntax, table-field type, date/year field support, and various bug fixes

## 0.1.3

### Patch Changes

- 3ea571b: - fix: Move ai from peerDependencies to regular dependencies (resolves install issues for new users)
  - refactor: Change multi-format export from raw to report format
  - docs: Update README example and add MPAA rating to minimal form
  - fix(examples): simplify movie-research-minimal form structure

## 0.1.2

### Patch Changes

- 1ad64ba: Major internal refactoring and new features including: unified response model with notes and skip/abort reasons (%SKIP%/%ABORT% syntax), date-field and year-field types, research API and CLI command, smart fence serialization, forms directory for centralized output, report command with multi-format export, web search support for Anthropic/xAI, token counting in logs, interactive file viewer after fill, Prettier/ESLint integration, modularized parser, and comprehensive movie research examples

## 0.1.1

### Patch Changes

- Add skip_field operation for optional field skipping, URL field types (url-field, url-list), web search tool support, role-aware form completion, improved prompts and verbose logging

## 0.1.0

### Minor Changes

- 2127c78: Add programmatic fill API, doc block syntax, examples command, and publishing automation
