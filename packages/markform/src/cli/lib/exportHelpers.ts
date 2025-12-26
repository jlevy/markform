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
 *
 * NOTE: This is the legacy export format (backward compatibility).
 * For the new structured format with state, use toStructuredValues().
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
 * Convert field responses to structured format for export (markform-218).
 *
 * Includes state for all fields:
 * - { state: 'unanswered' } for unfilled fields
 * - { state: 'skipped' } for skipped fields
 * - { state: 'aborted' } for aborted fields
 * - { state: 'answered', value: ... } for answered fields
 */
export function toStructuredValues(form: ParsedForm): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
    if (!response || response.state === "unanswered") {
      result[fieldId] = { state: "unanswered" };
      continue;
    }

    if (response.state === "skipped") {
      result[fieldId] = {
        state: "skipped",
        ...(response.reason && { reason: response.reason }),
      };
      continue;
    }

    if (response.state === "aborted") {
      result[fieldId] = {
        state: "aborted",
        ...(response.reason && { reason: response.reason }),
      };
      continue;
    }

    // state === 'answered'
    if (!response.value) {
      result[fieldId] = { state: "answered", value: null };
      continue;
    }

    const value = response.value;
    let exportValue: unknown;

    switch (value.kind) {
      case "string":
        exportValue = value.value ?? null;
        break;
      case "number":
        exportValue = value.value ?? null;
        break;
      case "string_list":
        exportValue = value.items;
        break;
      case "single_select":
        exportValue = value.selected ?? null;
        break;
      case "multi_select":
        exportValue = value.selected;
        break;
      case "checkboxes":
        exportValue = value.values;
        break;
      case "url":
        exportValue = value.value ?? null;
        break;
      case "url_list":
        exportValue = value.items;
        break;
    }

    result[fieldId] = { state: "answered", value: exportValue };
  }

  return result;
}

/**
 * Convert notes to export format (markform-219).
 */
export function toNotesArray(form: ParsedForm) {
  return form.notes.map((note) => ({
    id: note.id,
    ref: note.ref,
    role: note.role,
    text: note.text,
  }));
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
 * - YAML values (.yml) - structured format with state and notes (markform-218, markform-219)
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

  // Export YAML values with structured format (markform-218, markform-219)
  const values = toStructuredValues(form);
  const notes = toNotesArray(form);
  const exportData = {
    values,
    ...(notes.length > 0 && { notes }),
  };
  const yamlContent = YAML.stringify(exportData);
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
