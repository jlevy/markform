/**
 * Export helpers for multi-format form output.
 *
 * Provides reusable functions for exporting forms to multiple formats:
 * - Markform format (.form.md) - canonical form with directives
 * - Raw markdown (.raw.md) - plain readable markdown
 * - YAML values (.yml) - extracted field values
 * - JSON Schema (.schema.json) - form structure for validation/tooling
 */

import YAML from 'yaml';

import { serialize, serializeReportMarkdown } from '../../engine/serialize.js';
import { formToJsonSchema } from '../../engine/jsonSchema.js';
import type { ParsedForm } from '../../engine/coreTypes.js';
import { deriveExportPath, deriveReportPath, deriveSchemaPath } from '../../settings.js';
import type { ExportResult } from './cliTypes.js';
import { writeFile } from './shared.js';

// Re-export types for backwards compatibility
export type { ExportResult } from './cliTypes.js';

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
    if (!response || response.state === 'unanswered') {
      result[fieldId] = { state: 'unanswered' };
      continue;
    }

    if (response.state === 'skipped') {
      result[fieldId] = {
        state: 'skipped',
        ...(response.reason && { reason: response.reason }),
      };
      continue;
    }

    if (response.state === 'aborted') {
      result[fieldId] = {
        state: 'aborted',
        ...(response.reason && { reason: response.reason }),
      };
      continue;
    }

    // state === 'answered'
    if (!response.value) {
      result[fieldId] = { state: 'answered', value: null };
      continue;
    }

    const value = response.value;
    let exportValue: unknown;

    switch (value.kind) {
      case 'string':
        exportValue = value.value ?? null;
        break;
      case 'number':
        exportValue = value.value ?? null;
        break;
      case 'string_list':
        exportValue = value.items;
        break;
      case 'single_select':
        exportValue = value.selected ?? null;
        break;
      case 'multi_select':
        exportValue = value.selected;
        break;
      case 'checkboxes':
        exportValue = value.values;
        break;
      case 'url':
        exportValue = value.value ?? null;
        break;
      case 'url_list':
        exportValue = value.items;
        break;
    }

    result[fieldId] = { state: 'answered', value: exportValue };
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
 * Uses centralized extension constants from settings.ts.
 *
 * Standard exports: report, values (yaml), form, schema.
 * Raw markdown is available via CLI but not in standard exports.
 *
 * @param basePath - Path to the .form.md file
 * @returns Object with paths for all export formats
 */
export function deriveExportPaths(basePath: string): ExportResult {
  return {
    reportPath: deriveReportPath(basePath),
    yamlPath: deriveExportPath(basePath, 'yaml'),
    formPath: deriveExportPath(basePath, 'form'),
    schemaPath: deriveSchemaPath(basePath),
  };
}

/**
 * Export form to multiple formats.
 *
 * Standard exports:
 * - Report format (.report.md) - filtered markdown (excludes instructions, report=false)
 * - YAML values (.yml) - structured format with state and notes
 * - Markform format (.form.md) - canonical form with directives
 * - JSON Schema (.schema.json) - form structure for validation/tooling
 *
 * Note: Raw markdown (.raw.md) is available via CLI `markform export --raw`
 * but is not included in standard multi-format export.
 *
 * @param form - The parsed form to export
 * @param basePath - Base path for the .form.md file (other paths are derived)
 * @returns Paths to all exported files
 */
export async function exportMultiFormat(form: ParsedForm, basePath: string): Promise<ExportResult> {
  const paths = deriveExportPaths(basePath);

  // Export report markdown (filtered, no instructions, excludes report=false)
  const reportContent = serializeReportMarkdown(form);
  await writeFile(paths.reportPath, reportContent);

  // Export YAML values with structured format (markform-218, markform-219)
  const values = toStructuredValues(form);
  const notes = toNotesArray(form);
  const exportData = {
    values,
    ...(notes.length > 0 && { notes }),
  };
  const yamlContent = YAML.stringify(exportData);
  await writeFile(paths.yamlPath, yamlContent);

  // Export form markdown
  const formContent = serialize(form);
  await writeFile(paths.formPath, formContent);

  // Export JSON Schema
  const schemaResult = formToJsonSchema(form);
  const schemaContent = JSON.stringify(schemaResult.schema, null, 2) + '\n';
  await writeFile(paths.schemaPath, schemaContent);

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
export async function exportFormOnly(form: ParsedForm, outputPath: string): Promise<void> {
  const formContent = serialize(form);
  await writeFile(outputPath, formContent);
}
