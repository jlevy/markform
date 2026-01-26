---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Round-Trip Serialization Tests

Tests that verify parse -> serialize round-trips preserve form structure correctly.
Uses real forms from the examples directory for more realistic coverage.

---

## Non-Normalized Round-Trip (Content Preserving)

# Test: movie-deep-research round-trip produces valid form

```console
$ $CLI export examples/movie-research/movie-deep-research.form.md > /tmp/mf-rt-preserve.md && $CLI validate /tmp/mf-rt-preserve.md > /dev/null && echo "Valid"
Valid
? 0
```

# Test: preserved output has same field count as original

```console
$ $CLI inspect --format json /tmp/mf-rt-preserve.md | grep -o '"field_count": [0-9]*'
"field_count": 42
? 0
```

# Test: preserved output has same group count as original

```console
$ $CLI inspect --format json /tmp/mf-rt-preserve.md | grep -o '"group_count": [0-9]*'
"group_count": 15
? 0
```

---

## Normalized Round-Trip (Regenerated)

With --normalize, the form is fully regenerated from the parsed structure.

# Test: movie-deep-research normalized export is valid

```console
$ $CLI export --normalize examples/movie-research/movie-deep-research.form.md > /tmp/mf-rt-normalize.md && $CLI validate /tmp/mf-rt-normalize.md > /dev/null && echo "Valid"
Valid
? 0
```

# Test: normalized output has same field count as original

```console
$ $CLI inspect --format json /tmp/mf-rt-normalize.md | grep -o '"field_count": [0-9]*'
"field_count": 42
? 0
```

---

## Filled Form Round-Trip

Test with a filled form to ensure values are preserved.

# Test: filled form round-trip produces valid form

```console
$ $CLI export examples/movie-research/movie-deep-research-mock-filled.form.md > /tmp/mf-rt-filled.md && $CLI validate /tmp/mf-rt-filled.md > /dev/null && echo "Valid"
Valid
? 0
```

# Test: filled form values are preserved (movie title)

```console
$ $CLI dump /tmp/mf-rt-filled.md | grep "^movie:"
movie: "The Shawshank Redemption"
? 0
```

# Test: filled form values are preserved (year)

```console
$ $CLI dump /tmp/mf-rt-filled.md | grep "^year:"
year: 1994
? 0
```

# Test: normalized filled form is also valid

```console
$ $CLI export --normalize examples/movie-research/movie-deep-research-mock-filled.form.md > /tmp/mf-rt-filled-norm.md && $CLI validate /tmp/mf-rt-filled-norm.md > /dev/null && echo "Valid"
Valid
? 0
```

# Test: normalized filled form preserves values (movie title)

```console
$ $CLI dump /tmp/mf-rt-filled-norm.md | grep "^movie:"
movie: "The Shawshank Redemption"
? 0
```

---

## Simple Form Round-Trip

Test with the simple form which has all field types.

# Test: simple form preserving round-trip is valid

```console
$ $CLI export examples/simple/simple.form.md > /tmp/mf-rt-simple.md && $CLI validate /tmp/mf-rt-simple.md > /dev/null && echo "Valid"
Valid
? 0
```

# Test: simple form field count preserved

```console
$ $CLI inspect --format json /tmp/mf-rt-simple.md | grep -o '"field_count": [0-9]*'
"field_count": 21
? 0
```

# Test: simple form normalized round-trip is valid

```console
$ $CLI export --normalize examples/simple/simple.form.md > /tmp/mf-rt-simple-norm.md && $CLI validate /tmp/mf-rt-simple-norm.md > /dev/null && echo "Valid"
Valid
? 0
```

---

## Double Round-Trip (Idempotency)

A normalized form re-exported should be identical.

# Test: normalized then re-normalized is identical

```console
$ $CLI export --normalize /tmp/mf-rt-normalize.md > /tmp/mf-rt-normalize2.md && diff /tmp/mf-rt-normalize.md /tmp/mf-rt-normalize2.md && echo "Identical"
Identical
? 0
```

# Test: preserved export is idempotent after first round-trip (structure)

After one round-trip, subsequent round-trips should produce structurally identical forms.

```console
$ $CLI export /tmp/mf-rt-preserve.md > /tmp/mf-rt-preserve2.md && $CLI inspect --format json /tmp/mf-rt-preserve.md | grep -o '"field_count": [0-9]*'
"field_count": 42
? 0
```

```console
$ $CLI inspect --format json /tmp/mf-rt-preserve2.md | grep -o '"field_count": [0-9]*'
"field_count": 42
? 0
```

---

## Startup Form Round-Trip (Complex Form)

The startup-deep-research form is a complex form with many field types.

# Test: startup form round-trip is valid

```console
$ $CLI export examples/startup-deep-research/startup-deep-research.form.md > /tmp/mf-rt-startup.md && $CLI validate /tmp/mf-rt-startup.md > /dev/null && echo "Valid"
Valid
? 0
```

# Test: startup form field count preserved

```console
$ $CLI inspect --format json /tmp/mf-rt-startup.md | grep -o '"field_count": [0-9]*'
"field_count": 47
? 0
```

# Test: startup form normalized is valid

```console
$ $CLI export --normalize examples/startup-deep-research/startup-deep-research.form.md > /tmp/mf-rt-startup-norm.md && $CLI validate /tmp/mf-rt-startup-norm.md > /dev/null && echo "Valid"
Valid
? 0
```
