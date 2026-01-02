---
env:
  NO_COLOR: "1"
  FORCE_COLOR: "0"
timeout: 30000
---

# Markform CLI Workflow Tests

Tests for multi-step CLI workflows and error handling.

---

## Error Handling

### missing file returns error

```console
$ /home/user/markform/packages/markform/dist/bin.mjs inspect /nonexistent/file.form.md
Error: ENOENT: no such file or directory, open '/nonexistent/file.form.md'
? 1
```

### validate missing file returns error

```console
$ /home/user/markform/packages/markform/dist/bin.mjs validate /nonexistent/file.form.md
Error: ENOENT: no such file or directory, open '/nonexistent/file.form.md'
? 1
```

### status missing file returns error

```console
$ /home/user/markform/packages/markform/dist/bin.mjs status /nonexistent/file.form.md
Error: ENOENT: no such file or directory, open '/nonexistent/file.form.md'
? 1
```

---

## Apply Command

### apply patches a form field

```console
$ cp /home/user/markform/packages/markform/examples/simple/simple.form.md /tmp/test-apply.form.md && /home/user/markform/packages/markform/dist/bin.mjs apply /tmp/test-apply.form.md --patch '[{"op":"set_string","fieldId":"name","value":"Test User"}]' | head -19
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

### inspect --help shows command options

```console
$ /home/user/markform/packages/markform/dist/bin.mjs inspect --help
Usage: markform inspect [options] <file>

Inspect a form and display its structure, progress, and issues
...
? 0
```

### fill --help shows command options

```console
$ /home/user/markform/packages/markform/dist/bin.mjs fill --help
Usage: markform fill [options] <file>

Run an agent to autonomously fill a form
...
? 0
```
