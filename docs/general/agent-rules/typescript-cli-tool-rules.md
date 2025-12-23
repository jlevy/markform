---
description: CLI Tool Development Rules
globs: scripts/cli/**/*.ts, scripts/test-*.ts, scripts/*-cli.ts
alwaysApply: false
---
# CLI Tool Development Rules

These rules apply to all CLI tools, command-line scripts, and terminal utilities.

This is a **template document** providing opinionated patterns for building TypeScript
CLI tools. The examples show suggested conventions—adapt them to your project’s
structure.

## Suggested Directory Layout

For projects with CLI tooling, use this structure:

```
scripts/
├── cli/
│   ├── cli.ts              # Main entry point, registers all commands
│   ├── commands/           # One file per command or command group
│   │   ├── build.ts
│   │   ├── test.ts
│   │   └── deploy.ts
│   └── lib/                # Shared utilities
│       ├── shared.ts       # Command context, debug setup, dry-run helpers
│       └── formatting.ts   # Color utilities, output formatting
├── test-with-timings.ts    # Standalone scripts (kebab-case)
└── generate-data.ts
```

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

- **Create shared color utilities:** For consistency across commands, create a
  `formatting.ts` module with semantic color helpers:

  ```ts
  // scripts/cli/lib/formatting.ts
  import pc from 'picocolors';
  
  export const colors = {
    success: (msg: string) => pc.green(msg),
    error: (msg: string) => pc.red(msg),
    warn: (msg: string) => pc.yellow(msg),
    info: (msg: string) => pc.cyan(msg),
    dim: (msg: string) => pc.dim(msg),
  };
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

- **Use Commander.js for all CLI tools:** Import from `commander` for argument parsing
  and command structure.

- **Create a colored help wrapper:** For consistent help text formatting:

  ```ts
  // scripts/cli/lib/shared.ts
  import { Command } from 'commander';
  import pc from 'picocolors';
  
  export function withColoredHelp<T extends Command>(cmd: T): T {
    cmd.configureHelp({
      styleTitle: (str) => pc.bold(pc.cyan(str)),
      styleCommandText: (str) => pc.green(str),
      styleOptionText: (str) => pc.yellow(str),
    });
    return cmd;
  }
  ```

- **Create shared context helpers:** Centralize option handling for consistency:

  ```ts
  // scripts/cli/lib/shared.ts
  import { Command } from 'commander';
  
  export interface CommandContext {
    dryRun: boolean;
    verbose: boolean;
    quiet: boolean;
  }
  
  export function getCommandContext(command: Command): CommandContext {
    const opts = command.optsWithGlobals();
    return {
      dryRun: opts.dryRun ?? false,
      verbose: opts.verbose ?? false,
      quiet: opts.quiet ?? false,
    };
  }
  
  export function logDryRun(message: string, details?: unknown): void {
    console.log(pc.yellow(`[DRY RUN] ${message}`));
    if (details) console.log(pc.dim(JSON.stringify(details, null, 2)));
  }
  ```

- **Support `--dry-run`, `--verbose`, and `--quiet` flags:** Define these as global
  options at the program level:

  ```ts
  // scripts/cli/cli.ts
  const program = withColoredHelp(new Command())
    .name('my-cli')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--verbose', 'Enable verbose output')
    .option('--quiet', 'Suppress non-essential output');
  ```

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

  - ✅ for success (or ✔︎ if the codebase prefers such Unicode symbols over emojis)

  - ❌ for failure/error (or ✘)

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
  console.log(pc.cyan(`⏰ Operation completed: ${duration}s`));
  ```

- **Show total time for multi-step operations:** For scripts that run multiple phases
  (like test suites), show individual phase times and a total.

  ```ts
  console.log(pc.cyan(`⏰ Phase 1: ${phase1Time}s`));
  console.log(pc.cyan(`⏰ Phase 2: ${phase2Time}s`));
  console.log('');
  console.log(pc.green(`⏰ Total time: ${totalTime}s`));
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

## Argument Validation

- **For simple CLIs:** Commander.js built-in validation is sufficient.
  Use `.choices()` for enums and `.argParser()` for custom parsing.

  ```ts
  .option('--format <type>', 'Output format')
  .choices(['json', 'csv', 'table'])
  ```

- **For complex CLIs:** If you have complex option interdependencies or need detailed
  validation errors, consider using `zod` to validate the parsed options object:

  ```ts
  import { z } from 'zod';
  
  const OptionsSchema = z.object({
    input: z.string().min(1, 'Input file is required'),
    output: z.string().optional(),
    format: z.enum(['json', 'csv']).default('json'),
  });
  
  // After Commander parses args:
  const result = OptionsSchema.safeParse(options);
  if (!result.success) {
    p.log.error(result.error.issues[0].message);
    process.exit(1);
  }
  ```

## File Naming

- **Use descriptive kebab-case names:** CLI script files should use kebab-case with
  clear purpose indicators.

  - Examples: `test-with-timings.ts`, `test-all-commands.ts`, `generate-config-data.ts`

- **Place CLI commands in `scripts/cli/commands/`:** Keep command implementations
  organized in the commands directory with one file per command or command group.

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

## Best Practices

- **Don’t reinvent the wheel:** Use established patterns from modern open source CLI
  tools in TypeScript.

- **Test with pipes:** Verify that scripts work correctly when output is piped (e.g.,
  `npm test | cat` should have no ANSI codes).

- **Respect environment variables:**

  - `NO_COLOR` - disable colors

  - `FORCE_COLOR` - force colors

  - `DEBUG` or `VERBOSE` - enable verbose logging

  - `QUIET_MODE` - suppress non-essential output

- **Make scripts composable:** Design scripts to work well in pipelines and automation.
  Consider how they’ll be used in CI/CD and shell scripts.
