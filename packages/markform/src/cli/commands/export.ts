/**
 * Export command - Export form schema and values.
 *
 * Outputs an object with:
 * - schema: Form structure and field definitions
 * - values: Current field values
 */

import type { Command } from "commander";

import pc from "picocolors";

import { parseForm } from "../../engine/parse.js";
import type { FieldValue, Id } from "../../engine/types.js";
import {
  formatOutput,
  getCommandContext,
  logError,
  logVerbose,
  readFile,
} from "../lib/shared.js";

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
}

/**
 * Format export output for console display.
 */
function formatConsoleExport(data: ExportOutput, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const yellow = useColors ? pc.yellow : (s: string) => s;

  // Header
  lines.push(bold(cyan("Form Export")));
  lines.push("");

  // Schema info
  lines.push(`${bold("Form:")} ${data.schema.title ?? data.schema.id}`);
  lines.push(`${dim("ID:")} ${data.schema.id}`);
  lines.push("");

  // Groups and fields
  for (const group of data.schema.groups) {
    lines.push(bold(`${group.title ?? group.id}`));

    for (const field of group.children) {
      const reqBadge = field.required ? yellow("[required]") : dim("[optional]");
      const value = data.values[field.id];
      const valueStr = formatFieldValue(value, useColors);

      lines.push(`  ${field.label} ${dim(`(${field.kind})`)} ${reqBadge}`);
      lines.push(`    ${dim("→")} ${valueStr}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format a field value for console display.
 */
function formatFieldValue(value: FieldValue | undefined, useColors: boolean): string {
  const dim = useColors ? pc.dim : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;

  if (!value) {
    return dim("(empty)");
  }

  switch (value.kind) {
    case "string":
      return value.value ? green(`"${value.value}"`) : dim("(empty)");
    case "number":
      return value.value !== null ? green(String(value.value)) : dim("(empty)");
    case "string_list":
      return value.items.length > 0
        ? green(`[${value.items.map((i) => `"${i}"`).join(", ")}]`)
        : dim("(empty)");
    case "single_select":
      return value.selected ? green(value.selected) : dim("(none selected)");
    case "multi_select":
      return value.selected.length > 0
        ? green(`[${value.selected.join(", ")}]`)
        : dim("(none selected)");
    case "checkboxes": {
      const entries = Object.entries(value.values);
      if (entries.length === 0) {
        return dim("(no entries)");
      }
      return entries.map(([k, v]) => `${k}:${v}`).join(", ");
    }
    default:
      return dim("(unknown)");
  }
}

/**
 * Register the export command.
 */
export function registerExportCommand(program: Command): void {
  program
    .command("export <file>")
    .description("Export form schema and values")
    .option("--compact", "Output compact JSON (no formatting, only for JSON format)")
    .action(
      async (
        file: string,
        options: { compact?: boolean },
        cmd: Command
      ) => {
        const ctx = getCommandContext(cmd);

        try {
          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, "Parsing form...");
          const form = parseForm(content);

          // Extract schema and values
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
                required: field.required ?? false,
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
          const output: ExportOutput = { schema, values };

          // Handle compact JSON specially
          if (options.compact && ctx.format === "json") {
            console.log(JSON.stringify(output));
            return;
          }

          // Output in requested format
          const formatted = formatOutput(ctx, output, (data, useColors) =>
            formatConsoleExport(data as ExportOutput, useColors)
          );
          console.log(formatted);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      }
    );
}
