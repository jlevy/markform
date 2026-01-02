# Analysis: Tryscript Test Improvements

## Current Issues

### 1. Absolute Paths Are Ugly and Non-Portable

Current tests look like this:
```console
$ /home/user/markform/packages/markform/dist/bin.mjs inspect /home/user/markform/packages/markform/examples/simple/simple.form.md
```

This should be:
```console
$ markform inspect examples/simple/simple.form.md
```

**Root cause**: Tryscript runs commands in a temp directory, so relative paths don't resolve correctly.

### 2. The `bin` Config Doesn't Work As Expected

The README suggests:
```yaml
---
bin: ./my-cli
---
$ my-cli --help
```

But this doesn't work because:
1. The bin path is resolved relative to the temp dir (not test file)
2. The command name replacement logic may have issues

### 3. Verbose and Duplicated Output

The tests capture a lot of output that could be elided. For example, `validate` and `inspect` both show the same 21-line Issues section.

### 4. ~3,400 Lines of Unit Tests Could Be Simplified

Many CLI unit tests (formatting, colors, etc.) test internal utilities that are implicitly tested by end-to-end CLI tests.

---

## Proposed Tryscript Framework Improvements

### 1. Add `cwd` Option (Critical)

Run commands from a specific directory instead of a temp directory:

```yaml
---
cwd: .  # Run from test file's directory
---
$ ./dist/bin.mjs --help
```

Or with an absolute/relative path:
```yaml
---
cwd: /home/user/markform/packages/markform
---
$ markform inspect examples/simple/simple.form.md
```

**Implementation**: In `createExecutionContext`, use `cwd` as the working directory for `child_process.spawn`.

### 2. Add `binName` Option (High Value)

Separate the binary path from the command name used in tests:

```yaml
---
bin: ./dist/bin.mjs
binName: markform
---
$ markform --help
```

This allows writing natural commands while the framework resolves paths.

### 3. Support `[PKG]` Pattern (Nice to Have)

Like `[ROOT]` and `[CWD]`, add `[PKG]` to match the package root:

```console
$ markform inspect [PKG]/examples/simple/simple.form.md
```

### 4. Add `chdir` Option (Alternative to `cwd`)

Boolean to disable the temp directory entirely:

```yaml
---
chdir: false  # Don't copy to temp, run in place
---
```

---

## Proposed Markform Test Improvements

### Immediate: Create a Wrapper Script

Add `bin/markform` that invokes the CLI with proper paths:

```bash
#!/usr/bin/env node
import('./dist/bin.mjs');
```

Then tests become:
```yaml
---
bin: ./bin/markform
binName: markform
cwd: .
---
$ markform --help
```

### Short-term: More Aggressive Elision

Current:
```console
$ markform validate examples/simple/simple.form.md
Form Validation Report
Title: Simple Test Form

Form State: ◌ empty

Structure:
  Groups: 8
  Fields: 21
  Options: 15

Progress:
  Total fields: 21
  Required: 12
  AnswerState: answered=0, skipped=0, aborted=0, unanswered=21
  Validity: valid=21, invalid=0
  Value: filled=0, empty=21
  Empty required: 12

Issues (21):
  P1 (required) [field] age: Required field "Age" is empty
  ... (20 more lines)
? 0
```

Simplified:
```console
$ markform validate examples/simple/simple.form.md
Form Validation Report
Title: Simple Test Form
...
Issues (21):
...
? 0
```

### Medium-term: Consolidate Tests

**Before (2 tests, ~150 lines):**
- `validate shows issues` - Full output
- `inspect shows form structure` - Full output (overlapping)

**After (1 test with focused assertions):**
```console
$ markform validate examples/simple/simple.form.md
Form Validation Report
...
Issues (21):
...
? 0
```

```console
$ markform inspect examples/simple/simple.form.md
Form Inspection Report
...
Form Content:
...
? 0
```

### Long-term: Replace Some Unit Tests

**Candidates for replacement:**

| Unit Test | Lines | Can Replace With Tryscript? |
|-----------|-------|----------------------------|
| formatting.test.ts | 387 | Partial - test via CLI output |
| patchFormat.test.ts | 261 | Partial - test via `dump` output |
| exportHelpers.test.ts | 255 | Yes - test via `export` command |
| examples.test.ts | 184 | Yes - test via `examples --list` |

**Keep as unit tests:**

| Unit Test | Lines | Reason |
|-----------|-------|--------|
| interactivePrompts.test.ts | 1,184 | Requires TTY mocking |
| fillLogging.test.ts | 377 | Tests callback internals |
| runMode.test.ts | 232 | Tests edge cases |

---

## Ideal End State

### Test File Structure

```markdown
---
bin: markform
cwd: .
env:
  NO_COLOR: "1"
---

# Markform CLI Tests

## Help

### version

```console
$ markform --version
[VERSION]
? 0
```

### help

```console
$ markform --help
Usage: markform [options] [command]
...
? 0
```

## Forms

### validate empty form

```console
$ markform validate examples/simple/simple.form.md
Form Validation Report
...
Issues ([..]):
...
? 0
```

### validate filled form

```console
$ markform validate examples/simple/simple-mock-filled.form.md
Form Validation Report
...
Issues (0):
? 0
```
```

### Benefits

1. **Readable as documentation** - Clean command examples
2. **Portable** - No machine-specific paths
3. **Maintainable** - Update with `--update`
4. **Comprehensive** - Test real CLI behavior
5. **Less code** - ~265 lines vs ~3,400 lines of unit tests

---

## Action Items

### For tryscript (priority order)

1. [ ] Add `cwd` config option
2. [ ] Add `binName` config option
3. [ ] Fix `bin` path resolution (relative to test file)
4. [ ] Add `[PKG]` pattern support

### For markform (after tryscript changes)

1. [ ] Update tests to use `cwd: .`
2. [ ] Simplify paths to relative
3. [ ] Apply more aggressive elision
4. [ ] Evaluate which unit tests to migrate
