---
description: CLI Tool Development Rules
globs: scripts/cli/**/*.ts, scripts/test-*.ts, scripts/*-cli.ts
alwaysApply: false
---
# CLI Tool Development Rules

These rules apply to all CLI tools, command-line scripts, and terminal utilities.

## Color and Output Formatting

- **ALWAYS use picocolors for terminal colors:** Import `picocolors` (aliased as `pc`)
  for all color and styling needs.
  NEVER use hardcoded ANSI escape codes like `\x1b[36m` or `\033[32m`.

  ```ts
  // GOOD: Use picocolors
  import pc from 'picocolors';
  console.log(pc.green('Success!'));
  console.log(pc.cyan('Info message'));
  
  // BAD: Hardcoded ANSI codes
  console.log('\x1b[32mSuccess!\x1b[0m');
  console.log('\x1b[36mInfo message\x1b[0m');
  ```

- **Use shared color utilities:** Create a shared formatting module for consistent color
  application across commands.

  ```ts
  // lib/cliFormatting.ts - shared color utilities
  import pc from 'picocolors';
  
  export const colors = {
    success: (s: string) => pc.green(s),
    error: (s: string) => pc.red(s),
    info: (s: string) => pc.cyan(s),
    warn: (s: string) => pc.yellow(s),
    muted: (s: string) => pc.gray(s),
  };
  
  // Usage in commands:
  import { colors } from '../lib/cliFormatting.js';
  console.log(colors.success('Operation completed'));
  ```

- **Trust picocolors TTY detection:** Picocolors automatically detects when stdout is
  not a TTY (e.g., piped to `cat` or redirected to a file) and disables colors.
  DO NOT manually check `process.stdout.isTTY` unless you need special non-color
  behavior.

  Picocolors respects:

  - `NO_COLOR=1` environment variable (disables colors)

  - `FORCE_COLOR=1` environment variable (forces colors)

  - `--no-color` and `--color` command-line flags (if implemented)

  - TTY detection via `process.stdout.isTTY`

  ```ts
  // GOOD: Let picocolors handle it automatically
  import pc from 'picocolors';
  console.log(pc.green('This works correctly in all contexts'));
  
  // BAD: Manual TTY checking (redundant with picocolors)
  const useColors = process.stdout.isTTY;
  const msg = useColors ? '\x1b[32mSuccess\x1b[0m' : 'Success';
  console.log(msg);
  ```

## Commander.js Patterns

- **Use Commander.js for all CLI tools:** Import from `commander` and follow established
  patterns for command registration and option handling.

- **Apply colored help to all commands:** Use `withColoredHelp()` wrapper from shared
  utilities to ensure consistent help text formatting.

  ```ts
  import { Command } from 'commander';
  import { withColoredHelp } from '../lib/shared.js';
  
  export const myCommand = withColoredHelp(new Command('my-command'))
    .description('Description here')
    .action(async (options, command) => {
      // Implementation
    });
  ```

- **Use shared context helpers:** Create utilities like `getCommandContext()`,
  `setupDebug()`, and `logDryRun()` in a shared module for consistent behavior.

  ```ts
  import { getCommandContext, setupDebug, logDryRun } from '../lib/shared.js';
  
  .action(async (options, command) => {
    const ctx = getCommandContext(command);
    setupDebug(ctx);
  
    if (ctx.dryRun) {
      logDryRun('Would perform action', { details: 'here' });
      return;
    }
  
    // Actual implementation
  });
  ```

- **Support `--dry-run`, `--verbose`, and `--quiet` flags:** These are global options
  defined at the program level.
  Access them via `getCommandContext()`.

## Progress and Feedback

- **Use @clack/prompts for interactive UI:** Import `@clack/prompts` as `p` for
  spinners, prompts, and status messages.

  ```ts
  import * as p from '@clack/prompts';
  
  p.intro('🧪 Starting test suite');
  
  const spinner = p.spinner();
  spinner.start('Processing data');
  // ... work ...
  spinner.stop('✅ Data processed');
  
  p.outro('All done!');
  ```

- **Use consistent logging methods:**

  - `p.log.info()` for informational messages

  - `p.log.success()` for successful operations

  - `p.log.warn()` for warnings

  - `p.log.error()` for errors

  - `p.log.step()` for step-by-step progress

- **Use appropriate emojis for status:** Follow emoji conventions from
  `@docs/general/agent-rules/general-style-rules.md`:

  - ✅ for success

  - ❌ for failure/error

  - ⚠️ for warnings

  - ⏰ for timing information

  - 🧪 for tests

## Timing and Performance

- **Display timing for long operations:** For operations that take multiple seconds,
  display timing information using the ⏰ emoji and colored output.

  ```ts
  const start = Date.now();
  // ... operation ...
  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(colors.cyan(`⏰ Operation completed: ${duration}s`));
  ```

- **Show total time for multi-step operations:** For scripts that run multiple phases
  (like test suites), show individual phase times and a total.

  ```ts
  console.log(colors.cyan(`⏰ Phase 1: ${phase1Time}s`));
  console.log(colors.cyan(`⏰ Phase 2: ${phase2Time}s`));
  console.log('');
  console.log(colors.green(`⏰ Total time: ${totalTime}s`));
  ```

## Script Structure

- **Use TypeScript for all CLI scripts:** Write scripts as `.ts` files with proper
  types. Use `#!/usr/bin/env tsx` shebang for executable scripts.

  ```ts
  #!/usr/bin/env tsx
  
  /**
   * Script description here.
   */
  
  import { execSync } from 'node:child_process';
  import * as p from '@clack/prompts';
  
  async function main() {
    // Implementation
  }
  
  main().catch((err) => {
    p.log.error(`Script failed: ${err}`);
    process.exit(1);
  });
  ```

- **Handle errors gracefully:** Always catch errors at the top level and provide clear
  error messages before exiting.

  ```ts
  main().catch((err) => {
    p.log.error(`Operation failed: ${err.message || err}`);
    process.exit(1);
  });
  ```

- **Exit with proper codes:** Use `process.exit(0)` for success and `process.exit(1)`
  for failures. This is important for CI/CD pipelines and shell scripts.

## File Naming

- **Use descriptive kebab-case names:** CLI script files should use kebab-case with
  clear purpose indicators.

  - Examples: `test-with-timings.ts`, `test-all-commands.ts`, `generate-config-data.ts`

- **Organize commands in a `commands/` directory:** Keep command implementations
  organized with one file per command or command group.

## Documentation

- **Document CLI scripts with file-level comments:** Include a brief description of what
  the script does at the top of the file.

  ```ts
  /**
   * Test Runner with Timing
   *
   * Runs the full test suite (codegen, format, lint, unit, integration)
   * and displays timing information for each phase.
   */
  ```

- **Add help text to all commands and options:** Use `.description()` for commands and
  options to provide clear help text.

  ```ts
  .option('--mode <mode>', 'Mock mode: real or full_fixed')
  .option('--output-dir <path>', 'Output directory', './runs')
  ```

## Environment Variables

When supporting environment variables, especially those used by SDK libraries (like
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.), also support `.env` loading so CLIs work
seamlessly in local dev and in remote environments.

- **Add dotenv as a dependency:** Add `dotenv` to your project dependencies for `.env`
  file loading.

- **Load `.env.local` and `.env` automatically (recommended):** Support both
  `.env.local` and `.env` automatically, with `.env.local` taking precedence over
  `.env`.

- **Manual dotenv loading:** For standalone scripts that don’t use `vite-node`, load
  environment files manually with explicit precedence:

  ```ts
  import dotenv from 'dotenv';
  import { existsSync } from 'node:fs';
  
  // Load .env.local first (higher priority), then .env (lower priority).
  // Note: dotenv does NOT override existing values by default, so load higher-priority
  // first.
  if (existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
  }
  if (existsSync('.env')) {
    dotenv.config({ path: '.env' });
  }
  ```

- **Fail fast with clear errors:** If a required env var is missing, throw immediately
  with a message listing all accepted variable names.

- **Document required variables:** List required environment variables in the command’s
  help text or a README.

- **Never commit secrets:** Use `.env.local` for secrets (it’s typically gitignored).
  `.env` should only contain non-sensitive defaults.

## Best Practices

- **Don’t reinvent the wheel:** Use established patterns from existing CLI commands in
  this project or best practices from other modern open source CLI tools in Typescript.

- **Test with pipes:** Verify that scripts work correctly when output is piped (e.g.,
  `npm test | cat` should have no ANSI codes).

- **Respect environment variables:**

  - `NO_COLOR` - disable colors

  - `FORCE_COLOR` - force colors

  - `DEBUG` or `VERBOSE` - enable verbose logging

  - `QUIET_MODE` - suppress non-essential output

- **Make scripts composable:** Design scripts to work well in pipelines and automation.
  Consider how they'll be used in CI/CD and shell scripts.

## Library/CLI Hybrid Packages

When building a package that functions as both a library and a CLI tool, **isolate all
Node.js dependencies to CLI-only code**. This allows the core library to be used in
non-Node environments (browsers, edge runtimes, Cloudflare Workers, Convex, etc.).

### Why This Matters

Node.js-specific imports like `node:path`, `node:fs`, or `node:module` will cause bundler
errors or runtime failures in non-Node environments. Even if only the CLI uses these
imports, if they're in shared code, the entire library becomes Node-dependent.

### Directory Structure for Isolation

Keep CLI code in a dedicated subdirectory:

```
src/
├── index.ts           # Library entry point (NO node: imports)
├── settings.ts        # Configuration constants (NO node: imports)
├── engine/            # Core library code (NO node: imports)
├── cli/               # CLI-only code (node: imports OK here)
│   ├── cli.ts         # CLI entry point
│   ├── commands/      # Command implementations
│   └── lib/           # CLI utilities (path resolution, etc.)
└── integrations/      # Optional integrations (NO node: imports)
```

### Pattern: Move Node.js Utilities to CLI

```ts
// BAD: Node.js import in shared settings
// src/settings.ts
import { resolve } from 'node:path';

export const DEFAULT_OUTPUT_DIR = './output';

export function getOutputDir(override?: string): string {
  return resolve(process.cwd(), override ?? DEFAULT_OUTPUT_DIR);
}

// GOOD: Constant in settings, function in CLI
// src/settings.ts (node-free)
export const DEFAULT_OUTPUT_DIR = './output';

// src/cli/lib/paths.ts (node: imports OK)
import { resolve } from 'node:path';
import { DEFAULT_OUTPUT_DIR } from '../../settings.js';

export { DEFAULT_OUTPUT_DIR };  // Re-export for CLI convenience

export function getOutputDir(override?: string): string {
  return resolve(process.cwd(), override ?? DEFAULT_OUTPUT_DIR);
}
```

### Pattern: Build-Time Constants

For values that need Node.js at build time (like reading `package.json`), use bundler
`define` options to inject them as compile-time constants:

```ts
// tsdown.config.ts / esbuild / rollup config
import pkg from './package.json' with { type: 'json' };

export default {
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
};

// src/index.ts (node-free)
declare const __VERSION__: string;

export const VERSION: string =
  typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'development';
```

### Guard Tests

Add automated tests to prevent Node.js dependency leaks:

```ts
// tests/node-free-core.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = 'src';
const NODE_ALLOWED_DIRS = ['cli'];  // Only CLI can use node:
const NODE_IMPORT_PATTERN = /from\s+['"]node:/g;

function getAllTsFiles(dir: string): string[] { /* recursive scan */ }

describe('Node-free core library', () => {
  it('source files outside cli/ should not import from node:', () => {
    const violations: string[] = [];

    for (const file of getAllTsFiles(SRC_DIR)) {
      const rel = relative(SRC_DIR, file);
      if (NODE_ALLOWED_DIRS.some(d => rel.startsWith(d + '/'))) continue;

      const content = readFileSync(file, 'utf-8');
      if (NODE_IMPORT_PATTERN.test(content)) {
        violations.push(rel);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('dist/index.mjs should not reference node: modules', () => {
    const content = readFileSync('dist/index.mjs', 'utf-8');
    expect(content).not.toMatch(NODE_IMPORT_PATTERN);
  });
});
```

### Checklist for Library/CLI Packages

- [ ] Core library entry point (`index.ts`) has no `node:` imports
- [ ] All `node:` imports are in `cli/` directory only
- [ ] Configuration constants are in node-free files
- [ ] Build-time values use bundler `define` injection
- [ ] Guard tests prevent future regressions
- [ ] Built output (`dist/*.mjs`) has no `node:` references

## Recommended Patterns

The following patterns are recommendations for building maintainable CLI applications.
They are not strict rules but represent proven approaches from production CLI tools.

### Directory Structure

Organize CLI code for maintainability:

```
scripts/cli/
├── cli.ts                  # Main entry point, program setup
├── commands/               # Command implementations (one file per command group)
│   ├── my-feature.ts       # Command with subcommands
│   └── simple-cmd.ts       # Simple single command
├── lib/                    # Shared utilities and base classes
│   ├── baseCommand.ts      # Base class for handlers
│   ├── outputManager.ts    # Unified output handling
│   ├── commandContext.ts   # Global option management
│   ├── *Formatters.ts      # Domain-specific formatters
│   └── shared.ts           # General utilities
└── types/
    └── commandOptions.ts   # Named types for command options
```

### Base Command Pattern

Use a base class to eliminate duplicate code across commands:

```ts
// lib/baseCommand.ts
export abstract class BaseCommand {
  protected ctx: CommandContext;
  protected output: OutputManager;
  private client?: HttpClient;

  constructor(command: Command, format: OutputFormat) {
    this.ctx = getCommandContext(command);
    this.output = new OutputManager({ format, ...this.ctx });
  }

  protected getClient(): HttpClient {
    if (!this.client) {
      this.client = new HttpClient(getApiUrl());
    }
    return this.client;
  }

  protected async execute<T>(
    action: () => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      this.output.error(errorMessage, error);
      process.exit(1);
    }
  }

  protected checkDryRun(message: string, details?: object): boolean {
    if (this.ctx.dryRun) {
      logDryRun(message, details);
      return true;
    }
    return false;
  }

  abstract run(options: any): Promise<void>;
}

// Usage in command handler:
class MyCommandHandler extends BaseCommand {
  async run(options: MyCommandOptions): Promise<void> {
    if (this.checkDryRun('Would perform action', options)) return;

    const client = this.getClient();
    const result = await this.execute(
      () => client.query(api.something, {}),
      'Failed to fetch data'
    );

    this.output.data(result, () => displayResult(result, this.ctx));
  }
}
```

### Dual Output Mode (Text + JSON)

Support both human-readable and machine-parseable output:

```ts
// lib/outputManager.ts
export class OutputManager {
  private format: 'text' | 'json';
  private quiet: boolean;
  private verbose: boolean;

  // Structured data - always goes to stdout
  data<T>(data: T, textFormatter?: (data: T) => void): void {
    if (this.format === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else if (textFormatter) {
      textFormatter(data);
    }
  }

  // Status messages - text mode only, stdout
  success(message: string): void {
    if (this.format === 'text' && !this.quiet) {
      p.log.success(message);
    }
  }

  // Errors - always stderr, always shown
  error(message: string, err?: Error): void {
    if (this.format === 'json') {
      console.error(JSON.stringify({ error: message, details: err?.message }));
    } else {
      console.error(colors.error(`Error: ${message}`));
    }
  }

  // Spinner - returns no-op in JSON/quiet mode
  spinner(message: string): Spinner {
    if (this.format === 'text' && !this.quiet) {
      const s = p.spinner();
      s.start(message);
      return { message: (m) => s.message(m), stop: (m) => s.stop(m) };
    }
    return { message: () => {}, stop: () => {} };
  }
}
```

### Handler + Command Structure

Separate command definitions from implementation:

```ts
// commands/my-feature.ts

// 1. Handler class (extends BaseCommand)
class MyFeatureListHandler extends BaseCommand {
  async run(options: MyFeatureListOptions): Promise<void> {
    // Implementation
  }
}

// 2. Subcommand definition
const listCommand = withColoredHelp(new Command('list'))
  .description('List resources')
  .option('--limit <number>', 'Maximum results', '20')
  .action(async (options, command) => {
    setupDebug(getCommandContext(command));
    const format = validateFormat(options.format);
    const handler = new MyFeatureListHandler(command, format);
    await handler.run(options);
  });

// 3. Main command export (aggregates subcommands)
export const myFeatureCommand = withColoredHelp(new Command('my-feature'))
  .description('Manage resources')
  .addCommand(listCommand)
  .addCommand(showCommand)
  .addCommand(createCommand);
```

### Named Option Types

Use named interfaces for command options:

```ts
// types/commandOptions.ts
export interface MyFeatureListOptions {
  limit: string;
  status: string | null;
  verbose: boolean;
}

export interface MyFeatureCreateOptions {
  name: string;
  description: string | null;
}

// Usage:
class MyFeatureListHandler extends BaseCommand {
  async run(options: MyFeatureListOptions): Promise<void> {
    const limit = parseInt(options.limit, 10);
    // TypeScript knows exactly what options are available
  }
}
```

### Formatter Pattern

Pair text and JSON formatters for each domain:

```ts
// lib/myFeatureFormatters.ts

// Text formatter - for human-readable output
export function displayMyFeatureList(items: Item[], ctx: CommandContext): void {
  if (items.length === 0) {
    p.log.info('No items found');
    return;
  }

  const table = createStandardTable(['ID', 'Name', 'Status']);
  for (const item of items) {
    table.push([item.id, item.name, formatStatus(item.status)]);
  }
  p.log.message('\n' + table.toString());
}

// JSON formatter - structured data for machine consumption
export function formatMyFeatureListJson(items: Item[]): object {
  return {
    total: items.length,
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      status: item.status,
    })),
  };
}

// Usage in handler:
this.output.data(
  formatMyFeatureListJson(items),  // JSON format
  () => displayMyFeatureList(items, this.ctx)  // Text format
);
```

### Version Handling

Use git-based dynamic versioning for accurate, npm-compatible version strings. This format
embeds the git hash in the pre-release identifier (since npm strips build metadata).

**Version format**: `X.Y.Z-dev.N.hash`

| State | Format | Example |
| --- | --- | --- |
| On tag | `X.Y.Z` | `1.2.3` |
| After tag | `X.Y.Z-dev.N.hash` | `1.2.4-dev.12.a1b2c3d` |
| Dirty working dir | `X.Y.Z-dev.N.hash-dirty` | `1.2.4-dev.12.a1b2c3d-dirty` |
| No tags | `0.0.0-dev.0.hash` | `0.0.0-dev.0.a1b2c3d` |

**Why bump patch for dev versions**: Ensures correct sorting. Dev versions should sort
*before* the next release, not after the current one:

```
1.2.3 < 1.2.4-dev.1.abc < 1.2.4-dev.12.def < 1.2.4  ✓ correct
1.2.3 < 1.2.3-dev.1.abc                              ✗ wrong (dev after release)
```

**Implementation for tsdown.config.ts**:

```ts
import { execSync } from 'node:child_process';
import { defineConfig } from 'tsdown';
import pkg from './package.json' with { type: 'json' };

/**
 * Get version from git tags: X.Y.Z-dev.N.hash
 * Falls back to package.json if not in a git repo.
 */
function getGitVersion(): string {
  try {
    const git = (args: string) =>
      execSync(`git ${args}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

    const tag = git('describe --tags --abbrev=0');
    const tagVersion = tag.replace(/^v/, '');
    const [major, minor, patch] = tagVersion.split('.').map(Number);
    const commitsSinceTag = parseInt(git(`rev-list ${tag}..HEAD --count`), 10);
    const hash = git('rev-parse --short=7 HEAD');

    let dirty = false;
    try {
      git('diff --quiet');
      git('diff --cached --quiet');
    } catch {
      dirty = true;
    }

    if (commitsSinceTag === 0 && !dirty) {
      return tagVersion;
    }

    const bumpedPatch = (patch ?? 0) + 1;
    const suffix = dirty ? `${hash}-dirty` : hash;
    return `${major}.${minor}.${bumpedPatch}-dev.${commitsSinceTag}.${suffix}`;
  } catch {
    return pkg.version;
  }
}

export default defineConfig({
  // ... other config
  define: {
    __VERSION__: JSON.stringify(getGitVersion()),
  },
});
```

**Usage in library code**:

```ts
// src/index.ts
declare const __VERSION__: string;
export const VERSION: string =
  typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'development';
```

### Global Options

Define global options once at the program level:

```ts
// cli.ts
const program = new Command()
  .name('my-cli')
  .version(getVersionInfo().version)
  .option('--dry-run', 'Show what would be done without making changes')
  .option('--verbose', 'Enable verbose output')
  .option('--quiet', 'Suppress non-essential output')
  .option('--format <format>', 'Output format: text or json', 'text');

// Access via getCommandContext() in any command:
export function getCommandContext(command: Command): CommandContext {
  const opts = command.optsWithGlobals();
  return {
    dryRun: opts.dryRun ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
    format: opts.format ?? 'text',
  };
}
```

### Avoid Single-Letter Option Aliases

Use full option names to prevent conflicts in large CLIs:

```ts
// GOOD: Full names only
program
  .option('--dry-run', 'Show what would be done')
  .option('--verbose', 'Enable verbose output')
  .option('--quiet', 'Suppress output')

// AVOID: Single-letter aliases
program
  .option('-d, --dry-run', 'Show what would be done')  // -d might conflict
  .option('-v, --verbose', 'Verbose output')           // -v used by --version
```

### Show Help After Errors

Configure Commander.js to display help after usage errors. This helps users understand
what went wrong and how to correctly use the command:

```ts
// In program setup (affects all commands)
const program = new Command()
  .name('my-cli')
  .showHelpAfterError()  // Show full help after errors
  // ... other options

// Or with a custom hint message (more concise)
program.showHelpAfterError('(add --help for additional information)');
```

This provides a better user experience when required arguments are missing or options
are invalid:

```console
$ my-cli research
error: missing required argument 'input'

Usage: my-cli research [options] <input>

Fill a form using a web-search-enabled model

Options:
  --model <provider/model>  Model to use (required)
  -h, --help                display help for command
```

When configured on the root program, this behavior propagates to all subcommands
automatically.

### Stdout/Stderr Separation

Route output appropriately for Unix pipeline compatibility:

```ts
// Data/success → stdout (can be piped)
console.log(JSON.stringify(data));
this.output.success('Operation complete');

// Errors/warnings → stderr (visible even when piped)
console.error('Error: something failed');
this.output.warn('Deprecated option');

// This enables: my-cli list --format json | jq '.items[]'
```

### Testing with Dry-Run

Design commands to be testable via `--dry-run`:

```ts
class MyCommandHandler extends BaseCommand {
  async run(options: Options): Promise<void> {
    // Check dry-run early and return
    if (this.checkDryRun('Would create resource', {
      name: options.name,
      config: options.config,
    })) {
      return;
    }

    // Actual implementation only runs if not dry-run
    await this.createResource(options);
  }
}

// Test script can verify all commands with:
// my-cli resource create --name test --dry-run
// my-cli resource delete --id res-123 --dry-run
```

### Preaction Hooks

Use Commander.js hooks for cross-cutting concerns:

```ts
program.hook('preAction', (thisCommand) => {
  const commandName = thisCommand.name();

  // Run codegen before commands that need it
  if (!['help', 'docs', 'version'].includes(commandName)) {
    runCodegenIfNeeded({ silent: true });
  }

  // Set up logging based on verbose flag
  if (thisCommand.optsWithGlobals().verbose) {
    process.env.DEBUG = 'true';
  }
});
```

### Documentation Command

Add a `docs` command that shows comprehensive help:

```ts
const docsCommand = new Command('docs')
  .description('Show full documentation for all commands')
  .action(async () => {
    let output = '';
    output += formatMainHelp(program);

    for (const cmd of program.commands) {
      output += formatCommandHelp(cmd);
      for (const subcmd of cmd.commands) {
        output += formatCommandHelp(subcmd);
      }
    }

    // Use pager for long output
    await showInPager(output);
  });
```
