/**
 * Export command - Export form as canonical markdown or structured data.
 *
 * Default output is canonical markdown.
 * With --format=json or --format=yaml, outputs structured data with:
 * - schema: Form structure and field definitions
 * - values: Current field values
 * - markdown: Canonical markdown string
 */

import type { Command } from "commander";

import YAML from "yaml";

import { parseForm } from "../../engine/parse.js";
import { serialize } from "../../engine/serialize.js";
import type { FieldValue, Id } from "../../engine/types.js";
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

/** Export format options (markdown is unique to export command) */
type ExportFormat = "markdown" | "json" | "yaml";

/**
 * Register the export command.
 */
export function registerExportCommand(program: Command): void {
  program
    .command("export <file>")
    .description(
      "Export form as canonical markdown (default), or use --format=json/yaml for structured data"
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
        // console/plaintext from global map to markdown (export's default)
        let format: ExportFormat = "markdown";
        if (ctx.format === "json") {
          format = "json";
        } else if (ctx.format === "yaml") {
          format = "yaml";
        }
        // "console" and "plaintext" default to "markdown" for export

        try {
          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, "Parsing form...");
          const form = parseForm(content);

          // For markdown format, just output the serialized form
          if (format === "markdown") {
            console.log(serialize(form));
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

          const output: ExportOutput = {
            schema,
            values: form.valuesByFieldId,
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
