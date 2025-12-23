/**
 * CLI implementation for markform.
 *
 * Provides commands for inspecting, applying patches, exporting,
 * serving, and running harness loops on .form.md files.
 */

import { Command } from "commander";
import pc from "picocolors";

import { VERSION } from "../index.js";

/**
 * Configure Commander with colored help text.
 */
function withColoredHelp<T extends Command>(cmd: T): T {
  cmd.configureHelp({
    styleTitle: (str) => pc.bold(pc.cyan(str)),
    styleCommandText: (str) => pc.green(str),
    styleOptionText: (str) => pc.yellow(str),
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
    .option("--dry-run", "Show what would be done without making changes");

  // Placeholder for commands - will be added in Phase 2+
  program
    .command("inspect <file>")
    .description("Inspect a form and display its structure, progress, and issues")
    .action((_file: string) => {
      console.log(pc.yellow("Command not yet implemented: inspect"));
    });

  program
    .command("apply <file>")
    .description("Apply patches to a form")
    .action((_file: string) => {
      console.log(pc.yellow("Command not yet implemented: apply"));
    });

  program
    .command("export <file>")
    .description("Export form schema and values as JSON")
    .action((_file: string) => {
      console.log(pc.yellow("Command not yet implemented: export"));
    });

  program
    .command("serve <file>")
    .description("Serve a form as a web page for browsing")
    .action((_file: string) => {
      console.log(pc.yellow("Command not yet implemented: serve"));
    });

  program
    .command("run <file>")
    .description("Run the harness loop to fill a form")
    .option("--mock", "Use mock agent for testing")
    .option("--completed-mock <file>", "Path to completed mock file")
    .option("--record <file>", "Record session to file")
    .action((_file: string) => {
      console.log(pc.yellow("Command not yet implemented: run"));
    });

  return program;
}

/**
 * Run the CLI.
 */
export async function runCli(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}
