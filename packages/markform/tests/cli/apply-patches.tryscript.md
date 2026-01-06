---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Apply Command Tests

Tests for the apply command with various patch operations.

---

## Basic Patch Operations

# Test: apply set_string patch

```console
$ $CLI apply examples/simple/simple.form.md --patch '[{"op":"set_string","fieldId":"name","value":"Test User"}]' | grep "Test User"
Test User
? 0
```

# Test: apply set_number patch

```console
$ $CLI apply examples/simple/simple.form.md --patch '[{"op":"set_number","fieldId":"age","value":25}]' | grep "^25$"
25
? 0
```

# Test: apply set_single_select patch

```console
$ $CLI apply examples/simple/simple.form.md --patch '[{"op":"set_single_select","fieldId":"priority","value":"high"}]' | grep "\[x\].*High"
- [x] High {% #high %}
? 0
```

# Test: apply multiple patches at once

```console
$ $CLI apply examples/simple/simple.form.md --patch '[{"op":"set_string","fieldId":"name","value":"Multi Test"},{"op":"set_string","fieldId":"email","value":"multi@test.com"}]' | grep -E "(Multi Test|multi@test.com)"
Multi Test
multi@test.com
? 0
```

---

## Apply with Output Options

# Test: apply --dry-run shows what would change

```console
$ $CLI apply examples/simple/simple.form.md --patch '[{"op":"set_string","fieldId":"name","value":"Dry Run"}]' --dry-run 2>&1 | grep "DRY RUN"
[DRY RUN] Would apply 1 patches to examples/simple/simple.form.md
? 0
```

# Test: apply with --output writes to file

```console
$ $CLI apply examples/simple/simple.form.md --patch '[{"op":"set_string","fieldId":"name","value":"Output Test"}]' --output /tmp/test-apply-output.form.md 2>&1 | grep "written"
Modified form written to /tmp/test-apply-output.form.md
? 0
```

---

## Apply Error Handling

# Test: apply with invalid JSON patch

```console
$ $CLI apply examples/simple/simple.form.md --patch 'not valid json'
Error: Invalid JSON in --patch option
? 1
```

# Test: apply with non-array patch

```console
$ $CLI apply examples/simple/simple.form.md --patch '{"op":"set_string","fieldId":"name","value":"test"}'
Error: --patch must be a JSON array
? 1
```

# Test: apply to nonexistent field shows rejection

```console
$ $CLI apply examples/simple/simple.form.md --patch '[{"op":"set_string","fieldId":"nonexistent_field","value":"test"}]' --dry-run 2>&1 | grep "DRY RUN"
[DRY RUN] Would apply 1 patches to examples/simple/simple.form.md
? 0
```
