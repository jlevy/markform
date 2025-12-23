/**
 * Apply command - Apply patches to a form.
 *
 * Reads patches from JSON and applies them to the form,
 * outputting the modified form or a report.
 */

import type { Command } from "commander";

import YAML from "yaml";

import { applyPatches } from "../../engine/apply.js";
import { parseForm } from "../../engine/parse.js";
import { serialize } from "../../engine/serialize.js";
import { PatchSchema } from "../../engine/types.js";
import {
  getCommandContext,
  logDryRun,
  logError,
  logSuccess,
  logVerbose,
  readFile,
  writeFile,
} from "../lib/shared.js";

/**
 * Register the apply command.
 */
export function registerApplyCommand(program: Command): void {
  program
    .command("apply <file>")
    .description("Apply patches to a form")
    .option("--patch <json>", "JSON array of patches to apply")
    .option("-o, --output <file>", "Output file (defaults to stdout)")
    .option("--report", "Output apply result report instead of modified form")
    .action(
      async (
        file: string,
        options: { patch?: string; output?: string; report?: boolean },
        cmd: Command
      ) => {
        const ctx = getCommandContext(cmd);

        try {
          // Validate patch option
          if (!options.patch) {
            logError("--patch option is required");
            process.exit(1);
          }

          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, "Parsing form...");
          const form = parseForm(content);

          logVerbose(ctx, "Parsing patches...");
          let parsedJson: unknown;
          try {
            parsedJson = JSON.parse(options.patch) as unknown;
          } catch {
            logError("Invalid JSON in --patch option");
            process.exit(1);
          }

          if (!Array.isArray(parsedJson)) {
            logError("--patch must be a JSON array");
            process.exit(1);
          }
          const patches = parsedJson as unknown[];

          // Validate each patch against schema
          const validatedPatches = [];
          for (let i = 0; i < patches.length; i++) {
            const result = PatchSchema.safeParse(patches[i]);
            if (!result.success) {
              logError(
                `Invalid patch at index ${i}: ${result.error.issues[0]?.message ?? "Unknown error"}`
              );
              process.exit(1);
            }
            validatedPatches.push(result.data);
          }

          if (ctx.dryRun) {
            logDryRun(`Would apply ${validatedPatches.length} patches to ${file}`, {
              patches: validatedPatches,
            });
            return;
          }

          logVerbose(ctx, `Applying ${validatedPatches.length} patches...`);
          const result = applyPatches(form, validatedPatches);

          if (result.applyStatus === "rejected") {
            logError("Patches rejected - structural validation failed");
            console.error(YAML.stringify({ issues: result.issues }));
            process.exit(1);
          }

          // Output result
          if (options.report) {
            // Output apply result report
            const report = {
              apply_status: result.applyStatus,
              form_state: result.formState,
              is_complete: result.isComplete,
              structure: result.structureSummary,
              progress: result.progressSummary,
              issues: result.issues,
            };

            const output = YAML.stringify(report);
            if (options.output) {
              await writeFile(options.output, output);
              logSuccess(ctx, `Report written to ${options.output}`);
            } else {
              console.log(output);
            }
          } else {
            // Output modified form
            const output = serialize(form);
            if (options.output) {
              await writeFile(options.output, output);
              logSuccess(ctx, `Modified form written to ${options.output}`);
            } else {
              console.log(output);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      }
    );
}
