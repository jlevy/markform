/**
 * Export command - Export form schema and values as JSON.
 *
 * Outputs a JSON object with:
 * - schema: Form structure and field definitions
 * - values: Current field values
 */

import type { Command } from "commander";

import { parseForm } from "../../engine/parse.js";
import {
  getCommandContext,
  logError,
  logVerbose,
  readFile,
} from "../lib/shared.js";

/**
 * Register the export command.
 */
export function registerExportCommand(program: Command): void {
  program
    .command("export <file>")
    .description("Export form schema and values as JSON")
    .option("--pretty", "Pretty-print the JSON output", true)
    .option("--compact", "Output compact JSON (no formatting)")
    .action(
      async (
        file: string,
        options: { pretty?: boolean; compact?: boolean },
        cmd: Command
      ) => {
        const ctx = getCommandContext(cmd);

        try {
          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, "Parsing form...");
          const form = parseForm(content);

          // Extract schema and values
          const schema = {
            id: form.schema.id,
            title: form.schema.title,
            groups: form.schema.groups.map((group) => ({
              id: group.id,
              title: group.title,
              children: group.children.map((field) => ({
                id: field.id,
                kind: field.kind,
                label: field.label,
                required: field.required,
                ...(field.kind === "single_select" ||
                field.kind === "multi_select" ||
                field.kind === "checkboxes"
                  ? {
                      options: field.options.map((opt) => ({
                        id: opt.id,
                        label: opt.label,
                      })),
                    }
                  : {}),
              })),
            })),
          };

          // Extract current values from valuesByFieldId
          const values = form.valuesByFieldId;

          const output = { schema, values };

          // Output JSON
          if (options.compact) {
            console.log(JSON.stringify(output));
          } else {
            console.log(JSON.stringify(output, null, 2));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      }
    );
}
