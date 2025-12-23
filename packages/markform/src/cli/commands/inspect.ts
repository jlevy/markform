/**
 * Inspect command - Display form structure, progress, and issues.
 *
 * Outputs a YAML report with:
 * - Structure summary (field counts, types)
 * - Progress summary (filled/empty counts, form state)
 * - Issues sorted by priority
 */

import type { Command } from "commander";

import YAML from "yaml";

import { inspect } from "../../engine/inspect.js";
import { parseForm } from "../../engine/parse.js";
import {
  getCommandContext,
  logError,
  logVerbose,
  readFile,
} from "../lib/shared.js";

/**
 * Register the inspect command.
 */
export function registerInspectCommand(program: Command): void {
  program
    .command("inspect <file>")
    .description("Inspect a form and display its structure, progress, and issues")
    .option("--json", "Output as JSON instead of YAML")
    .action(async (file: string, options: { json?: boolean }, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        logVerbose(ctx, `Reading file: ${file}`);
        const content = await readFile(file);

        logVerbose(ctx, "Parsing form...");
        const form = parseForm(content);

        logVerbose(ctx, "Running inspection...");
        const result = inspect(form);

        // Build the report structure
        const report = {
          structure: result.structureSummary,
          progress: result.progressSummary,
          form_state: result.formState,
          issues: result.issues.map((issue) => ({
            ref: issue.ref,
            scope: issue.scope,
            reason: issue.reason,
            message: issue.message,
            priority: issue.priority,
            severity: issue.severity,
          })),
        };

        // Output in requested format (YAML by default, no ANSI codes)
        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(YAML.stringify(report));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
