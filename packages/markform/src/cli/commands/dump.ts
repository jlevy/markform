/**
 * Dump command - Extract and display form values only.
 *
 * A lightweight alternative to inspect that outputs only the values map,
 * without structure, progress, or validation information.
 * Useful for quick value extraction, scripting, and integration.
 */

import type { Command } from "commander";

import pc from "picocolors";

import { parseForm } from "../../engine/parse.js";
import type { FieldValue } from "../../engine/coreTypes.js";
import {
  formatOutput,
  getCommandContext,
  logError,
  logVerbose,
  readFile,
} from "../lib/shared.js";

/**
 * Format a field value for console display.
 */
function formatFieldValue(
  value: FieldValue | undefined,
  useColors: boolean
): string {
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
        ? green(`[${value.items.join(", ")}]`)
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
    case "url":
      return value.value ? green(`"${value.value}"`) : dim("(empty)");
    case "url_list":
      return value.items.length > 0
        ? green(`[${value.items.join(", ")}]`)
        : dim("(empty)");
    default:
      return dim("(unknown)");
  }
}

/**
 * Format values for console output.
 */
function formatConsoleValues(
  values: Record<string, FieldValue>,
  useColors: boolean
): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;

  for (const [fieldId, value] of Object.entries(values)) {
    const valueStr = formatFieldValue(value, useColors);
    lines.push(`${bold(fieldId)}: ${valueStr}`);
  }

  if (lines.length === 0) {
    const dim = useColors ? pc.dim : (s: string) => s;
    lines.push(dim("(no values)"));
  }

  return lines.join("\n");
}

/**
 * Convert FieldValue to a plain value for JSON/YAML serialization.
 */
function toPlainValue(value: FieldValue): unknown {
  switch (value.kind) {
    case "string":
      return value.value ?? null;
    case "number":
      return value.value ?? null;
    case "string_list":
      return value.items;
    case "single_select":
      return value.selected ?? null;
    case "multi_select":
      return value.selected;
    case "checkboxes":
      return value.values;
    case "url":
      return value.value ?? null;
    case "url_list":
      return value.items;
    default:
      return null;
  }
}

/**
 * Register the dump command.
 */
export function registerDumpCommand(program: Command): void {
  program
    .command("dump <file>")
    .description("Extract and display form values only (lightweight inspect)")
    .action(async (file: string, _options: Record<string, unknown>, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        logVerbose(ctx, `Reading file: ${file}`);
        const content = await readFile(file);

        logVerbose(ctx, "Parsing form...");
        const form = parseForm(content);

        // For JSON/YAML output, convert to plain values
        // For console/plaintext, use the full FieldValue objects for formatting
        const isStructured = ctx.format === "json" || ctx.format === "yaml";

        if (isStructured) {
          // Convert to plain values for structured output
          const plainValues: Record<string, unknown> = {};
          for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
            // Only include answered fields in structured output
            if (response.state === "answered" && response.value) {
              plainValues[fieldId] = toPlainValue(response.value);
            }
          }
          const output = formatOutput(ctx, plainValues, () => "");
          console.log(output);
        } else {
          // Use formatted output for console/plaintext
          // Extract values from responses for display
          const values: Record<string, FieldValue> = {};
          for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
            if (response.state === "answered" && response.value) {
              values[fieldId] = response.value;
            }
          }
          const output = formatOutput(ctx, values, (data, useColors) =>
            formatConsoleValues(data as Record<string, FieldValue>, useColors)
          );
          console.log(output);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
