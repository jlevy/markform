/**
 * CLI implementation for markform.
 *
 * Provides commands for inspecting, applying patches, exporting,
 * serving, and running harness loops on .form.md files.
 */

import { Command } from 'commander';
import pc from 'picocolors';

import { VERSION } from '../index.js';
import { DEFAULT_FORMS_DIR } from '../settings.js';
import { registerApplyCommand } from './commands/apply.js';
import { registerDumpCommand } from './commands/dump.js';
import { registerExamplesCommand } from './commands/examples.js';
import { registerExportCommand } from './commands/export.js';
import { registerFillCommand } from './commands/fill.js';
import { registerInspectCommand } from './commands/inspect.js';
import { registerReadmeCommand } from './commands/readme.js';
import { registerSpecCommand } from './commands/spec.js';
import { registerModelsCommand } from './commands/models.js';
import { registerRenderCommand } from './commands/render.js';
import { registerResearchCommand } from './commands/research.js';
import { registerServeCommand } from './commands/serve.js';
import { registerValidateCommand } from './commands/validate.js';
import { OUTPUT_FORMATS } from './lib/shared.js';

/**
 * Configure Commander with colored help text and global options display.
 */
function withColoredHelp<T extends Command>(cmd: T): T {
  cmd.configureHelp({
    styleTitle: (str) => pc.bold(pc.cyan(str)),
    styleCommandText: (str) => pc.green(str),
    styleOptionText: (str) => pc.yellow(str),
    showGlobalOptions: true,
  });
  return cmd;
}

/**
 * Create and configure the CLI program.
 */
function createProgram(): Command {
  const program = withColoredHelp(new Command());

  program
    .name('markform')
    .description('Agent-friendly, human-readable, editable forms')
    .version(VERSION)
    .showHelpAfterError()
    .option('--verbose', 'Enable verbose output')
    .option('--quiet', 'Suppress non-essential output')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--format <format>', `Output format: ${OUTPUT_FORMATS.join(', ')}`, 'console')
    .option('--forms-dir <dir>', `Directory for form output (default: ${DEFAULT_FORMS_DIR})`);

  // Register commands
  // Help first
  registerReadmeCommand(program);
  registerSpecCommand(program);
  // Rest alphabetical for help display
  registerApplyCommand(program);
  registerDumpCommand(program);
  registerExamplesCommand(program);
  registerExportCommand(program);
  registerFillCommand(program);
  registerInspectCommand(program);
  registerModelsCommand(program);
  registerRenderCommand(program);
  registerResearchCommand(program);
  registerServeCommand(program);
  registerValidateCommand(program);

  return program;
}

/**
 * Run the CLI.
 */
export async function runCli(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}
