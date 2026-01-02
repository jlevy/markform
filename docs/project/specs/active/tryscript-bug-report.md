# Tryscript Bug Report & Enhancement Proposals

## Summary

Tryscript is a promising CLI testing tool but has critical bugs and missing features that prevent clean, portable tests. This report covers bugs and enhancements to make the library more effective.

---

## Part 1: Bugs

### Bug 1: `bin` config is parsed but never used (Critical)

**Location:** `src/lib/runner.ts`

**Current code:**
```typescript
async function createExecutionContext(config, testFilePath) {
  let binPath = config.bin ?? "";
  if (binPath && !binPath.startsWith("/"))
    binPath = join(testDir, binPath);
  return { binPath, ... };  // Stored but never used!
}

async function executeCommand(command, ctx) {
  const proc = spawn(command, {  // Raw command, binPath ignored
    shell: true,
    cwd: ctx.tempDir,
    ...
  });
}
```

**Expected per README:**
```yaml
---
bin: ./my-cli
---
$ my-cli --help
```

Should replace `my-cli` with resolved path. Currently does nothing.

**Fix:**
```typescript
async function executeCommand(command, ctx) {
  let resolvedCommand = command;
  if (ctx.binPath) {
    const binName = basename(ctx.binPath);
    if (command.startsWith(binName + ' ') || command === binName) {
      resolvedCommand = command.replace(binName, ctx.binPath);
    }
  }
  const proc = spawn(resolvedCommand, { ... });
}
```

---

### Bug 2: Commands always run in temp directory (Critical)

**Location:** `src/lib/runner.ts`

**Current:**
```typescript
const proc = spawn(command, {
  cwd: ctx.tempDir,  // Always /tmp/tryscript-xxx/
});
```

This breaks all relative paths. Users must write:
```console
$ /home/user/project/dist/bin.mjs inspect /home/user/project/examples/file.md
```

Instead of:
```console
$ ./dist/bin.mjs inspect examples/file.md
```

**Fix:** See Enhancement 1 below.

---

## Part 2: Enhancements

### Enhancement 1: Add `cwd` config option (High Priority)

Allow specifying the working directory for command execution.

**Config schema addition:**
```typescript
cwd: z.string().optional(),
```

**Implementation:**
```typescript
// In createExecutionContext
const cwd = config.cwd
  ? resolve(testDir, config.cwd)
  : tempDir;

return { cwd, tempDir, ... };

// In executeCommand
const proc = spawn(command, {
  cwd: ctx.cwd,
  ...
});
```

**Usage:**
```yaml
---
cwd: .  # Run from test file's directory
---
$ ./dist/bin.mjs inspect examples/file.md
? 0
```

**Behavior:**
- `cwd: .` → Run from test file's directory
- `cwd: ../..` → Run from relative path
- `cwd: /abs/path` → Run from absolute path
- No `cwd` → Use temp directory (current behavior)

---

### Enhancement 2: Add `binName` option (High Priority)

Separate the binary path from the command name used in tests.

**Problem:** Binary filename (`bin.mjs`) isn't a natural command name.

**Config schema addition:**
```typescript
binName: z.string().optional(),
```

**Implementation:**
```typescript
// In executeCommand
const cmdName = ctx.binName || (ctx.binPath ? basename(ctx.binPath) : null);
if (cmdName && ctx.binPath) {
  const regex = new RegExp(`^${escapeRegex(cmdName)}(\\s|$)`);
  if (regex.test(command)) {
    resolvedCommand = command.replace(cmdName, ctx.binPath);
  }
}
```

**Usage:**
```yaml
---
bin: ./dist/bin.mjs
binName: markform
---
$ markform --help
Usage: markform [options]
...
? 0
```

---

### Enhancement 3: Add `[PKG]` pattern for package root (Medium Priority)

Like `[ROOT]` and `[CWD]`, add `[PKG]` to match the nearest `package.json` directory.

**Use case:** Reference files relative to package root in expected output:
```console
$ markform inspect examples/simple.form.md
Loading [PKG]/examples/simple.form.md
...
? 0
```

**Implementation:**
```typescript
// In preprocessPaths
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return startDir;
}

const pkgRoot = findPackageRoot(context.testDir);
result = result.replaceAll("[PKG]", pkgRoot.replace(/\\/g, "/"));
```

---

### Enhancement 4: Add `--cwd` CLI flag (Medium Priority)

Override `cwd` from command line for all test files.

```bash
# Run tests from package root
tryscript --cwd . 'tests/**/*.tryscript.md'
```

**Implementation:**
```typescript
// In CLI args
.option('--cwd <dir>', 'Working directory for commands')

// Merge with config
const effectiveCwd = cliOptions.cwd || config.cwd;
```

---

### Enhancement 5: Support environment variable expansion in paths (Low Priority)

Allow `$VAR` or `${VAR}` in `bin`, `cwd` paths.

```yaml
---
bin: $PROJECT_ROOT/dist/cli.js
cwd: $PROJECT_ROOT
---
```

**Implementation:**
```typescript
function expandEnvVars(str: string): string {
  return str.replace(/\$\{?(\w+)\}?/g, (_, name) => process.env[name] || '');
}

const binPath = expandEnvVars(config.bin || '');
const cwd = expandEnvVars(config.cwd || '');
```

---

## Ideal End State

After implementing all enhancements:

```yaml
---
bin: ./dist/cli.js
binName: mycli
cwd: .
env:
  NO_COLOR: "1"
timeout: 30000
patterns:
  VERSION: '\d+\.\d+\.\d+'
---

# My CLI Tests

## Help

### version

```console
$ mycli --version
[VERSION]
? 0
```

### help

```console
$ mycli --help
Usage: mycli [options] [command]
...
? 0
```

## File Operations

### process file with relative path

```console
$ mycli process examples/input.txt
Processing examples/input.txt...
Done.
? 0
```

### error on missing file

```console
$ mycli process nonexistent.txt
Error: File not found: nonexistent.txt
? 1
```
```

**Benefits:**
- Clean, readable commands (`mycli` not `/abs/path/to/dist/bin.mjs`)
- Portable tests (no machine-specific paths)
- Natural file references (relative paths work)
- Serves as documentation (users can copy-paste commands)

---

## Priority Summary

| Item | Type | Priority | Impact |
|------|------|----------|--------|
| Bug 1: bin not used | Bug | Critical | Documented feature broken |
| Bug 2: temp dir only | Bug | Critical | Tests unportable |
| Enhancement 1: cwd | Feature | High | Enables relative paths |
| Enhancement 2: binName | Feature | High | Clean command names |
| Enhancement 3: [PKG] | Feature | Medium | Better path matching |
| Enhancement 4: --cwd flag | Feature | Medium | CLI convenience |
| Enhancement 5: env vars | Feature | Low | Advanced use cases |
