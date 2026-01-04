# Tryscript Bug Report & Enhancement Proposals

## Summary

Tryscript is a promising CLI testing tool but has critical bugs and missing features. This report covers bugs found in practice plus enhancements to make it more powerful, elegant, and flexible for all users.

---

## Part 1: Bugs

### Bug 1: `bin` config parsed but never used

**Location:** `src/lib/runner.ts`

```typescript
// binPath is computed here...
let binPath = config.bin ?? "";
if (binPath && !binPath.startsWith("/"))
  binPath = join(testDir, binPath);
return { binPath, ... };

// ...but executeCommand ignores it completely
const proc = spawn(command, { shell: true, cwd: ctx.tempDir });
```

**Expected:** `bin: ./my-cli` should make `$ my-cli` resolve to `./my-cli`

### Bug 2: Commands always run in temp directory

```typescript
const proc = spawn(command, { cwd: ctx.tempDir }); // Always /tmp/tryscript-xxx/
```

**Result:** All relative paths break. Must use absolute paths everywhere:
```console
$ /home/user/project/dist/bin.mjs inspect /home/user/project/examples/file.md
```

---

## Part 2: Observed Inelegance

From our actual test files, here are concrete examples of awkwardness:

### Problem 1: Path repetition is painful

Every single command repeats the same 50+ character path:
```console
$ /home/user/markform/packages/markform/dist/bin.mjs status /home/user/markform/packages/markform/examples/simple/simple.form.md
$ /home/user/markform/packages/markform/dist/bin.mjs validate /home/user/markform/packages/markform/examples/simple/simple.form.md
$ /home/user/markform/packages/markform/dist/bin.mjs inspect /home/user/markform/packages/markform/examples/simple/simple.form.md
```

### Problem 2: Inline shell commands for setup

Testing mutable operations requires awkward inline setup:
```console
$ cp /home/user/.../simple.form.md /tmp/test-apply.form.md && /home/user/.../bin.mjs apply /tmp/test-apply.form.md --patch '...' | head -19
```

No way to:
- Set up files in a `before` block
- Verify file contents after modification
- Clean up in an `after` block

### Problem 3: No variables or aliases

Can't define once and reuse:
```yaml
# WISH: Define aliases
vars:
  BIN: ./dist/bin.mjs
  FORM: examples/simple/simple.form.md
---
$ $BIN validate $FORM  # Would be so much cleaner
```

### Problem 4: Same output verified multiple times

The `validate` test has 21 lines of Issues output. The `inspect` test has the same 21 lines. Changing issue format requires updating both.

### Problem 5: No structured assertions

Export commands produce JSON/YAML, but we can only do text matching:
```console
$ mycli export --format json
{
  "name": "test",
...
```

Can't assert: "output is valid JSON" or "output.name equals 'test'"

### Problem 6: No way to verify file modifications

After `apply` command modifies a file, we pipe through `head` to see partial output. Can't verify:
- File was actually written
- Specific fields changed
- File is valid markdown

---

## Part 3: Enhancements

### Enhancement 1: `cwd` option (Critical)

```yaml
---
cwd: .  # Run from test file's directory
---
$ ./dist/bin.mjs inspect examples/file.md
```

**Implementation:**
```typescript
const cwd = config.cwd ? resolve(testDir, config.cwd) : tempDir;
spawn(command, { cwd });
```

---

### Enhancement 2: `binName` option (Critical)

```yaml
---
bin: ./dist/bin.mjs
binName: markform
---
$ markform --help
```

---

### Enhancement 3: Variables/aliases (High)

Define reusable values in frontmatter:

```yaml
---
bin: ./dist/bin.mjs
binName: mycli
cwd: .
vars:
  FORM: examples/simple/simple.form.md
  FILLED: examples/simple/simple-mock-filled.form.md
---

$ mycli validate $FORM
...
? 0

$ mycli dump $FILLED
name: "Alice"
...
? 0
```

**Implementation:**
```typescript
function expandVars(command: string, vars: Record<string, string>): string {
  return command.replace(/\$(\w+)/g, (_, name) => vars[name] || `$${name}`);
}
```

---

### Enhancement 4: Fixtures / setup blocks (High)

Set up files before tests, clean up after:

```yaml
---
fixtures:
  - source: examples/simple/simple.form.md
    dest: $TEMP/test.form.md
---

### modify and verify

```console
$ mycli apply $TEMP/test.form.md --patch '[...]'
Applied 1 patch
? 0
```

```file $TEMP/test.form.md contains
name: "Test User"
```
```

**New block types:**
- `fixture` - Copy file to temp
- `file ... contains` - Assert file contents
- `file ... exists` - Assert file exists
- `file ... matches` - Regex match on file

---

### Enhancement 5: Before/after hooks (Medium)

```yaml
---
before: |
  mkdir -p $TEMP/forms
  cp examples/*.form.md $TEMP/forms/

after: |
  rm -rf $TEMP/forms
---
```

---

### Enhancement 6: Skip/focus tests (Medium)

```markdown
### test to skip <!-- skip -->

### test to focus <!-- only -->

### test with tag <!-- tag:slow -->
```

CLI flags:
```bash
tryscript --skip slow
tryscript --only "validate*"
tryscript --focus  # Run only tests marked 'only'
```

---

### Enhancement 7: Separate stdout/stderr (Medium)

Currently stdout and stderr are merged. Allow separate assertions:

```console
$ mycli broken-command
? 1
! Error: Something went wrong
```

Where `!` prefix means stderr.

Or explicit blocks:
```stdout
Normal output
```
```stderr
Error: Something went wrong
```

---

### Enhancement 8: Structured output assertions (Medium)

For JSON/YAML output, allow programmatic assertions:

```console
$ mycli export --format json
```
```assert json
$.name == "test"
$.fields | length > 0
```

Or simpler:
```console
$ mycli export --format json
```
```json-valid```

```console
$ mycli schema
```
```json-schema-valid```

---

### Enhancement 9: Regex patterns in expected output (Low)

Beyond `[..]` elision, allow inline regex:

```console
$ mycli status
Progress: {{/\d+/}}/21 fields filled
? 0
```

Or named captures for later assertions:
```console
$ mycli status
Progress: {{count:\d+}}/21 fields filled
? 0
```
```assert
$count >= 0
$count <= 21
```

---

### Enhancement 10: Include common config (Low)

```yaml
---
include: ../common.tryscript.yaml
---
```

Where `common.tryscript.yaml`:
```yaml
bin: ./dist/bin.mjs
binName: mycli
cwd: .
env:
  NO_COLOR: "1"
vars:
  FORM: examples/simple/simple.form.md
```

---

### Enhancement 11: Multi-command sequences with state (Low)

Commands in a single block share state:

```console
$ cd /tmp && mkdir test-dir
$ ls test-dir
$ rm -r test-dir
? 0
```

Currently each `$` line is independent. With state, `cd` would persist.

---

### Enhancement 12: Stdin support (Low)

```console
$ mycli parse --stdin << EOF
# My Form
{% field id="name" %}
EOF
Parsed 1 field
? 0
```

Or:
```console
$ echo '{"name": "test"}' | mycli import --format json
Imported 1 record
? 0
```

---

## Ideal End State

After all enhancements, tests become:

```yaml
---
bin: ./dist/bin.mjs
binName: markform
cwd: .
env:
  NO_COLOR: "1"
vars:
  FORM: examples/simple/simple.form.md
  FILLED: examples/simple/simple-mock-filled.form.md
fixtures:
  - source: $FORM
    dest: $TEMP/test.form.md
---

# Markform CLI Tests

## Validation

### empty form has issues

```console
$ markform validate $FORM
Form Validation Report
...
Issues ([..]):
...
? 0
```

### filled form is valid

```console
$ markform validate $FILLED
...
Issues (0):
? 0
```

## Mutations

### apply modifies file

```console
$ markform apply $TEMP/test.form.md --patch '[{"op":"set_string","fieldId":"name","value":"Test"}]'
Applied 1 patch
? 0
```

```file $TEMP/test.form.md contains
name: "Test"
```

## Export

### schema is valid JSON Schema

```console
$ markform schema $FORM
```
```json-schema-valid```

### export produces valid YAML

```console
$ markform export $FORM --format yaml
```
```yaml-valid```
```

**Line count comparison:**
- Current: ~265 lines with absolute paths and awkward setup
- Ideal: ~60 lines, clean and readable

---

## Priority Summary

| Item | Type | Priority | Impact |
|------|------|----------|--------|
| Bug 1: bin not used | Bug | Critical | Documented feature broken |
| Bug 2: temp dir only | Bug | Critical | All relative paths break |
| `cwd` option | Feature | Critical | Enables relative paths |
| `binName` option | Feature | Critical | Clean command names |
| Variables/aliases | Feature | High | Eliminates repetition |
| Fixtures | Feature | High | Enables mutation testing |
| Before/after hooks | Feature | Medium | Setup/teardown |
| Skip/focus | Feature | Medium | Developer workflow |
| Separate stderr | Feature | Medium | Better error testing |
| Structured assertions | Feature | Medium | JSON/YAML validation |
| Regex patterns | Feature | Low | Flexible matching |
| Includes | Feature | Low | Config sharing |
| Command state | Feature | Low | Complex workflows |
| Stdin support | Feature | Low | Pipe testing |
