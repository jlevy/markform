## What’s Changed

### Features

- **Per-column constraints for table fields**: Table columns now support type-specific
  constraints (`minLength`, `maxLength`, `pattern`, `enum` for strings; `min`, `max`,
  `integer` for numbers; `min`/`max` for dates and years).
  Specified via `columnTypes` attributes, enforced during validation, preserved through
  round-trips, and mapped to JSON Schema.
- **FillRecord performance metrics**: FillRecord now includes `llmParallelism`,
  `llmTimeMs`/`totalMs` timing breakdown, and `avgDurationMs` per tool.
  Text summaries show s/turn and s/field rates.
  HTML dashboard gains a parallelism card and duration rates.
- **`onError` callback and error preservation**: New `onError` callback in
  `FillCallbacks` for real-time error reporting with turn context.
  `FillStatus` now preserves the full Error object (cause chain, statusCode, etc.)
  as a discriminated union.
- **Agent-friendly `examples --list`**: `markform examples --list` now supports
  `--format=json`. Examples reordered by complexity with twitter-thread registered.

### Fixes

- **Serve UI**: Tabs reorganized (Form, Report, Source, ...) with hash-based routing for
  direct linking
- **`set` command**: Now surfaces validation warnings for patched fields
- **Parse/serialize**: Fixed instruction line-break loss during round-trip; explicit
  checkboxes render as Yes/No in reports
- **CLI logging**: All diagnostic log functions now write to stderr for pipeline
  compatibility

### Documentation

- Per-column constraints documented in spec and reference
- QA and manual tests consolidated into `tests/qa/`

**Full commit history**:
[https://github.com/jlevy/markform/compare/v0.1.24 … v0.1.25](https://github.com/jlevy/markform/compare/v0.1.24...v0.1.25)
