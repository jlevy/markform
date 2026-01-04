---
cwd: ../..
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
  CLI: ./dist/bin.mjs
timeout: 30000
---

# Markform CLI Workflow Tests

Tests for multi-step CLI workflows and error handling.

---

## Error Handling

# Test: missing file returns error

```console
$ $CLI inspect /nonexistent/file.form.md
Error: ENOENT: no such file or directory, open '/nonexistent/file.form.md'
? 1
```

# Test: validate missing file returns error

```console
$ $CLI validate /nonexistent/file.form.md
Error: ENOENT: no such file or directory, open '/nonexistent/file.form.md'
? 1
```

# Test: status missing file returns error

```console
$ $CLI status /nonexistent/file.form.md
Error: ENOENT: no such file or directory, open '/nonexistent/file.form.md'
? 1
```

---

## Apply Command

# Test: apply patches a form field

```console
$ cp examples/simple/simple.form.md /tmp/test-apply.form.md && $CLI apply /tmp/test-apply.form.md --patch '[{"op":"set_string","fieldId":"name","value":"Test User"}]' | head -19
---
markform:
  spec: "MF/0.1"
  run_mode: "interactive"
role_instructions:
  user: "Fill in the fields you have direct knowledge of."
  agent: "Complete the remaining fields based on the provided context."
---

{% form id="simple_test" title="Simple Test Form" %}

{% description ref="simple_test" %}
A fully interactive form demonstrating all Markform v0.1 field types.
Fill all fields using interactive prompts - no LLM API key needed.
{% /description %}

{% group id="basic_fields" title="Basic Fields" %}

{% field kind="string" id="name" role="user" examples=["John Smith", "Jane Doe"] label="Name" maxLength=50 minLength=2 placeholder="Enter your name" required=true %}
? 0
```

---

## Command Help

# Test: inspect --help shows command options

```console
$ $CLI inspect --help
Usage: markform inspect [options] <file>

Inspect a form and display its structure, progress, and issues
...
? 0
```

# Test: fill --help shows command options

```console
$ $CLI fill --help
Usage: markform fill [options] <file>

Run an agent to autonomously fill a form
...
? 0
```
