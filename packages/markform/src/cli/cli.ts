/**
 * CLI implementation for markform.
 *
 * Provides commands for inspecting, applying patches, exporting,
 * serving, and running harness loops on .form.md files.
 */

import { Command } from "commander";
import pc from "picocolors";

import { VERSION } from "../index.js";
import { registerApplyCommand } from "./commands/apply.js";
import { registerExportCommand } from "./commands/export.js";
import { registerFillCommand } from "./commands/fill.js";
import { registerInspectCommand } from "./commands/inspect.js";
import { registerRenderCommand } from "./commands/render.js";
import { registerServeCommand } from "./commands/serve.js";
import { registerValidateCommand } from "./commands/validate.js";
import { OUTPUT_FORMATS } from "./lib/shared.js";

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
    .name("markform")
    .description("Agent-friendly, human-readable, editable forms")
    .version(VERSION)
    .option("--verbose", "Enable verbose output")
    .option("--quiet", "Suppress non-essential output")
    .option("--dry-run", "Show what would be done without making changes")
    .option(
      "-f, --format <format>",
      `Output format: ${OUTPUT_FORMATS.join(", ")}`,
      "console"
    );

  // Register commands
  registerInspectCommand(program);
  registerValidateCommand(program);
  registerApplyCommand(program);
  registerExportCommand(program);
  registerRenderCommand(program);
  registerServeCommand(program);
  registerFillCommand(program);

  return program;
}

/**
 * Run the CLI.
 */
export async function runCli(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}
