/**
 * CLI implementation for markform.
 *
 * Provides commands for inspecting, applying patches, exporting,
 * serving, and running harness loops on .form.md files.
 */

import { Command } from 'commander';
import pc from 'picocolors';

import { CLI_VERSION } from './lib/cliVersion.js';
import { DEFAULT_FORMS_DIR } from './lib/paths.js';
import { registerApisCommand } from './commands/apis.js';
import { registerApplyCommand } from './commands/apply.js';
import { registerBrowseCommand } from './commands/browse.js';
import { registerDocsCommand } from './commands/docs.js';
import { registerDumpCommand } from './commands/dump.js';
import { registerExamplesCommand } from './commands/examples.js';
import { registerExportCommand } from './commands/export.js';
import { registerFillCommand } from './commands/fill.js';
import { registerInspectCommand } from './commands/inspect.js';
import { registerReadmeCommand } from './commands/readme.js';
import { registerReportCommand } from './commands/report.js';
import { registerRunCommand } from './commands/run.js';
import { registerSpecCommand } from './commands/spec.js';
import { registerModelsCommand } from './commands/models.js';
import { registerRenderCommand } from './commands/render.js';
import { registerResearchCommand } from './commands/research.js';
import { registerSchemaCommand } from './commands/schema.js';
import { registerServeCommand } from './commands/serve.js';
import { registerStatusCommand } from './commands/status.js';
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
    .version(CLI_VERSION, '--version', 'output the version number')
    .showHelpAfterError()
    .option('--verbose', 'Enable verbose output')
    .option('--quiet', 'Suppress non-essential output')
    .option('--debug', 'Enable debug output (full prompts, raw tool I/O)')
    .option('--trace <file>', 'Write incremental log output to file during execution')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--format <format>', `Output format: ${OUTPUT_FORMATS.join(', ')}`, 'console')
    .option('--forms-dir <dir>', `Directory for form output (default: ${DEFAULT_FORMS_DIR})`)
    .option('--overwrite', 'Overwrite existing field values (default: continue/skip filled)');

  // Register commands
  // Help/docs first
  registerReadmeCommand(program);
  registerDocsCommand(program);
  registerSpecCommand(program);
  registerApisCommand(program);
  // Rest alphabetical for help display
  registerApplyCommand(program);
  registerBrowseCommand(program);
  registerDumpCommand(program);
  registerExamplesCommand(program);
  registerExportCommand(program);
  registerFillCommand(program);
  registerInspectCommand(program);
  registerModelsCommand(program);
  registerRenderCommand(program);
  registerReportCommand(program);
  registerResearchCommand(program);
  registerRunCommand(program);
  registerSchemaCommand(program);
  registerServeCommand(program);
  registerStatusCommand(program);
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
