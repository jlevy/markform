---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Patch Command Tests

Tests for the patch command with various patch operations.

---

## Basic Patch Operations

# Test: patch set_string

```console
$ $CLI patch examples/simple/simple.form.md '[{"op":"set_string","fieldId":"name","value":"Test User"}]' | grep "Test User"
Test User
? 0
```

# Test: patch set_number

```console
$ $CLI patch examples/simple/simple.form.md '[{"op":"set_number","fieldId":"age","value":25}]' | grep "^25$"
25
? 0
```

# Test: patch set_single_select

```console
$ $CLI patch examples/simple/simple.form.md '[{"op":"set_single_select","fieldId":"priority","value":"high"}]' | grep "\[x\].*High"
- [x] High <!-- #high -->
? 0
```

# Test: patch multiple patches at once

```console
$ $CLI patch examples/simple/simple.form.md '[{"op":"set_string","fieldId":"name","value":"Multi Test"},{"op":"set_string","fieldId":"email","value":"multi@test.com"}]' | grep -E "(Multi Test|multi@test.com)"
Multi Test
multi@test.com
? 0
```

---

## Patch with Output Options

# Test: patch --dry-run shows what would change

```console
$ $CLI patch examples/simple/simple.form.md '[{"op":"set_string","fieldId":"name","value":"Dry Run"}]' --dry-run 2>&1 | grep "DRY RUN"
[DRY RUN] Would apply 1 patches to examples/simple/simple.form.md
? 0
```

# Test: patch with --output writes to file

```console
$ $CLI patch examples/simple/simple.form.md '[{"op":"set_string","fieldId":"name","value":"Output Test"}]' --output /tmp/test-patch-output.form.md 2>&1 | grep "written"
Modified form written to /tmp/test-patch-output.form.md
? 0
```

---

## Patch Error Handling

# Test: patch with invalid JSON

```console
$ $CLI patch examples/simple/simple.form.md 'not valid json'
Error: Invalid JSON in patch argument
? 1
```

# Test: patch with non-array JSON

```console
$ $CLI patch examples/simple/simple.form.md '{"op":"set_string","fieldId":"name","value":"test"}'
Error: Patch argument must be a JSON array
? 1
```

# Test: patch to nonexistent field shows rejection

```console
$ $CLI patch examples/simple/simple.form.md '[{"op":"set_string","fieldId":"nonexistent_field","value":"test"}]' --dry-run 2>&1 | grep "DRY RUN"
[DRY RUN] Would apply 1 patches to examples/simple/simple.form.md
? 0
```
