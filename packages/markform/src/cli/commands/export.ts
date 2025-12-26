/**
 * Export command - Export form as markform or plain markdown or structured data.
 *
 * Default output is markform format (canonical markdown with markdoc directives).
 * With --format=markdown, outputs plain readable markdown without markdoc.
 * With --format=json or --format=yaml, outputs structured data with:
 * - schema: Form structure and field definitions
 * - values: Current field values
 * - markdown: Canonical markdown string
 */

import type { Command } from "commander";

import YAML from "yaml";

import { parseForm } from "../../engine/parse.js";
import { serialize, serializeRawMarkdown } from "../../engine/serialize.js";
import type { FieldValue, Id } from "../../engine/coreTypes.js";
import { getCommandContext, logError, logVerbose, readFile } from "../lib/shared.js";

interface ExportField {
  id: string;
  kind: string;
  label: string;
  required: boolean;
  options?: { id: string; label: string }[];
}

interface ExportGroup {
  id: string;
  title?: string;
  children: ExportField[];
}

interface ExportSchema {
  id: string;
  title?: string;
  groups: ExportGroup[];
}

interface ExportOutput {
  schema: ExportSchema;
  values: Record<Id, FieldValue>;
  markdown: string;
}

/** Export format options */
type ExportFormat = "markform" | "markdown" | "json" | "yaml";

/**
 * Register the export command.
 */
export function registerExportCommand(program: Command): void {
  program
    .command("export <file>")
    .description(
      "Export form as markform (default), markdown (readable), or json/yaml for structured data"
    )
    .option("--compact", "Output compact JSON (no formatting, only for JSON format)")
    .action(
      async (
        file: string,
        options: { compact?: boolean },
        cmd: Command
      ) => {
        const ctx = getCommandContext(cmd);

        // Determine format: map global format to export format
        // json/yaml from global --format work for export
        // console/plaintext from global map to markform (export's default)
        let format: ExportFormat = "markform";
        if (ctx.format === "json") {
          format = "json";
        } else if (ctx.format === "yaml") {
          format = "yaml";
        } else if (ctx.format === "markdown") {
          format = "markdown";
        } else if (ctx.format === "markform") {
          format = "markform";
        }
        // "console" and "plaintext" default to "markform" for export

        try {
          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, "Parsing form...");
          const form = parseForm(content);

          // For markform format, output canonical markdoc markdown
          if (format === "markform") {
            console.log(serialize(form));
            return;
          }

          // For markdown format, output plain readable markdown
          if (format === "markdown") {
            console.log(serializeRawMarkdown(form));
            return;
          }

          // For JSON/YAML, build the full structured output
          const schema: ExportSchema = {
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

          // Extract values from responses for export
          const values: Record<string, FieldValue> = {};
          for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
            if (response.state === "answered" && response.value) {
              values[fieldId] = response.value;
            }
          }

          const output: ExportOutput = {
            schema,
            values,
            markdown: serialize(form),
          };

          // Output in JSON or YAML format
          if (format === "json") {
            if (options.compact) {
              console.log(JSON.stringify(output));
            } else {
              console.log(JSON.stringify(output, null, 2));
            }
          } else {
            // YAML format
            console.log(YAML.stringify(output));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      }
    );
}
