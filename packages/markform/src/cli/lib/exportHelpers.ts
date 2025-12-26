/**
 * Export helpers for multi-format form output.
 *
 * Provides reusable functions for exporting forms to multiple formats:
 * - Markform format (.form.md) - canonical form with directives
 * - Raw markdown (.raw.md) - plain readable markdown
 * - YAML values (.yml) - extracted field values
 */

import { writeFileSync } from "node:fs";
import YAML from "yaml";

import { serialize, serializeRawMarkdown } from "../../engine/serialize.js";
import type { ParsedForm } from "../../engine/coreTypes.js";
import type { ExportResult } from "./cliTypes.js";

// Re-export types for backwards compatibility
export type { ExportResult } from "./cliTypes.js";

/**
 * Convert field values to plain values for YAML export.
 *
 * Extracts the underlying values from the typed FieldValue wrappers
 * for a cleaner YAML representation.
 */
export function toPlainValues(form: ParsedForm): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
    // Only export values for answered fields
    if (response.state !== "answered" || !response.value) {
      continue;
    }

    const value = response.value;
    switch (value.kind) {
      case "string":
        result[fieldId] = value.value ?? null;
        break;
      case "number":
        result[fieldId] = value.value ?? null;
        break;
      case "string_list":
        result[fieldId] = value.items;
        break;
      case "single_select":
        result[fieldId] = value.selected ?? null;
        break;
      case "multi_select":
        result[fieldId] = value.selected;
        break;
      case "checkboxes":
        result[fieldId] = value.values;
        break;
      case "url":
        result[fieldId] = value.value ?? null;
        break;
      case "url_list":
        result[fieldId] = value.items;
        break;
    }
  }

  return result;
}

/**
 * Derive export paths from a base form path.
 *
 * @param basePath - Path to the .form.md file
 * @returns Object with paths for all export formats
 */
export function deriveExportPaths(basePath: string): ExportResult {
  return {
    formPath: basePath,
    rawPath: basePath.replace(/\.form\.md$/, ".raw.md"),
    yamlPath: basePath.replace(/\.form\.md$/, ".yml"),
  };
}

/**
 * Export form to multiple formats.
 *
 * Writes:
 * - Markform format (.form.md) - canonical form with directives
 * - Raw markdown (.raw.md) - plain readable markdown (no directives)
 * - YAML values (.yml) - extracted field values only
 *
 * @param form - The parsed form to export
 * @param basePath - Base path for the .form.md file (other paths are derived)
 * @returns Paths to all exported files
 */
export function exportMultiFormat(
  form: ParsedForm,
  basePath: string,
): ExportResult {
  const paths = deriveExportPaths(basePath);

  // Export form markdown
  const formContent = serialize(form);
  writeFileSync(paths.formPath, formContent, "utf-8");

  // Export raw markdown
  const rawContent = serializeRawMarkdown(form);
  writeFileSync(paths.rawPath, rawContent, "utf-8");

  // Export YAML values
  const values = toPlainValues(form);
  const yamlContent = YAML.stringify(values);
  writeFileSync(paths.yamlPath, yamlContent, "utf-8");

  return paths;
}

/**
 * Export form to markform format only.
 *
 * Use this for commands like `markform fill` where only the canonical format
 * is needed by default. Users can generate raw/yaml via `markform export` or
 * `markform dump`. Note: The `examples` command uses exportMultiFormat() for
 * both user and agent fills.
 *
 * @param form - The parsed form to export
 * @param outputPath - Path to write the .form.md file
 */
export function exportFormOnly(form: ParsedForm, outputPath: string): void {
  const formContent = serialize(form);
  writeFileSync(outputPath, formContent, "utf-8");
}
