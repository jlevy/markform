# markform

## 0.1.24

### Patch Changes

- a048f20: CLI form-filling commands (set, next, patch), append/delete patch ops, Claude Code skill integration, fill record improvements, and test coverage enhancements

## 0.1.23

### Patch Changes

- 5ed47e2: Extensible provider support via ProviderAdapter; fix skip reason display in badge pill

## 0.1.22

### Patch Changes

- a8738d4: Render subpath export, skip reason display, URL parsing fix, API error improvements

## 0.1.21

### Patch Changes

- e445541: Bug fixes for parallel execution tracking and YAML formatting improvements

## 0.1.20

### Patch Changes

- e899eef: Add FillRecord visualization with Gantt chart, tooltips, and copy handlers

## 0.1.19

### Patch Changes

- 114105b: FillRecord implementation, security fixes, proxy support, and URL rendering improvements

## 0.1.18

### Patch Changes

- 28696dc: Add parallel form filling with plan command, ParallelHarness, and order/parallel attributes

## 0.1.17

### Patch Changes

- 56d1cc2: Add implicit checkboxes feature and content preservation

## 0.1.16

### Patch Changes

- 97390e0: Add HTML comment syntax as a cleaner alternative to Markdoc tags, making forms render as valid Markdown on GitHub while maintaining full backward compatibility with existing tag syntax

## 0.1.15

### Patch Changes

- 34fd531: Unified test coverage, URL formatting improvements, and documentation updates

## 0.1.14

### Patch Changes

- 8992edc: Add array-to-checkboxes coercion for LLM compatibility, complete checkbox mode states in prompts, and enhance documentation

## 0.1.13

### Patch Changes

- 08634fd: Add best-effort patch application with value coercion, coercion warnings in session files, and increase maxStepsPerTurn default to 20

## 0.1.12

### Patch Changes

- 2a70552: Add resumable form fills, standardize patch property names, rename maxTurns to maxTurnsTotal

## 0.1.11

### Patch Changes

- 8d72787: Support boolean checkbox values, standardize patch property names, and improve error messages

## 0.1.10

### Patch Changes

- 576e19b: Add structured error handling with typed error hierarchy, improve frontmatter parsing using Markdoc native support, add defensive null checks for table rows and patch validation, and significantly improve test coverage to 60%

## 0.1.9

### Patch Changes

- a9079b4: Improve serve command with syntax highlighting and tabs, add inline field instructions to prompts, rename generatePatches to fill_form, add wire format to session logs, fix table/date/year support in CLI, fix multi_select infinite loop

## 0.1.8

### Patch Changes

- b803791: Fix serialization of table values and frontmatter, improve rejection feedback handling in LLM prompts, and add comprehensive golden test coverage

## 0.1.7

### Patch Changes

- 71692eb: Unified fill logging, CLI improvements, JSON Schema enhancements, Zod v4 upgrade

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
