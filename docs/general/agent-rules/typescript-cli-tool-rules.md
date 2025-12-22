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

- **Use shared color utilities:** Import from `scripts/cli/lib/cliFormatting.ts` for
  consistent color application across commands.

  ```ts
  import { colors } from '../lib/cliFormatting.js';
  
  console.log(colors.success('Operation completed'));
  console.log(colors.error('Failed to process'));
  console.log(colors.info('Informational message'));
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

- **Use Commander.js for all CLI tools:** Import from `commander` and follow the
  patterns established in `scripts/cli/cli.ts`.

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

- **Use shared context helpers:** Import and use `getCommandContext()`, `setupDebug()`,
  and `logDryRun()` from `scripts/cli/lib/shared.ts` for consistent behavior.

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
  Consider how they’ll be used in CI/CD and shell scripts.
