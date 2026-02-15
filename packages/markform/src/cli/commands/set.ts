/**
 * Set command - Set field values with auto-coercion.
 *
 * High-level command that auto-detects the correct patch operation
 * based on the field's kind in the schema. Supports single-field,
 * batch (--values), append, delete, and meta operations (clear/skip/abort).
 */

import type { Command } from 'commander';

import { applyPatches } from '../../engine/apply.js';
import { parseForm } from '../../engine/parse.js';
import { serializeForm } from '../../engine/serialize.js';
import type {
  Patch,
  ApplyResult,
  InspectIssue,
  ProgressState,
  TableRowPatch,
} from '../../engine/coreTypes.js';
import {
  coerceToFieldPatch,
  coerceInputContext,
  findFieldById,
} from '../../engine/valueCoercion.js';
import type { InputContext, RawFieldValue } from '../../engine/valueCoercion.js';
import {
  formatOutput,
  getCommandContext,
  logDryRun,
  logError,
  logSuccess,
  logVerbose,
  logWarn,
  readFile,
  writeFile,
} from '../lib/shared.js';

import pc from 'picocolors';

interface SetReport {
  apply_status: 'applied' | 'partial' | 'rejected';
  form_state: ProgressState;
  is_complete: boolean;
  structure: ApplyResult['structureSummary'];
  progress: ApplyResult['progressSummary'];
  issues: InspectIssue[];
}

/**
 * Parse a CLI value string into a RawFieldValue.
 *
 * Only detects JSON arrays/objects ([ or { prefix). Everything else
 * is passed through as a string — the coercion layer handles
 * type conversion based on the field's kind.
 */
export function parseCliValue(raw: string): RawFieldValue {
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      return JSON.parse(raw) as RawFieldValue;
    } catch {
      // Not valid JSON — return as string
      return raw;
    }
  }
  return raw;
}

/**
 * Format set report for console output.
 */
function formatConsoleReport(report: SetReport, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;
  const red = useColors ? pc.red : (s: string) => s;

  lines.push(bold(cyan('Set Result')));
  lines.push('');

  const statusColor = report.apply_status === 'applied' ? green : red;
  lines.push(`${bold('Status:')} ${statusColor(report.apply_status)}`);
  lines.push(`${bold('Form State:')} ${report.form_state}`);
  lines.push(`${bold('Complete:')} ${report.is_complete ? green('yes') : dim('no')}`);
  lines.push('');

  const counts = report.progress.counts;
  lines.push(bold('Progress:'));
  lines.push(`  Total fields: ${counts.totalFields}`);
  lines.push(`  Filled: ${counts.filledFields}, Empty: ${counts.emptyFields}`);
  lines.push(`  Empty required: ${counts.emptyRequiredFields}`);
  lines.push('');

  if (report.issues.length > 0) {
    lines.push(bold(`Issues (${report.issues.length}):`));
    for (const issue of report.issues) {
      lines.push(`  P${issue.priority} ${dim(issue.ref)}: ${issue.message}`);
    }
  } else {
    lines.push(dim('No issues.'));
  }

  return lines.join('\n');
}

/**
 * Register the set command.
 */
export function registerSetCommand(program: Command): void {
  program
    .command('set <file> [fieldId] [value]')
    .description('Set field values with auto-coercion')
    .option('--values <json>', 'Batch set: JSON object of {fieldId: rawValue} pairs')
    .option('--append <value>', 'Append item/row to a collection field')
    .option('--delete <n>', 'Delete item/row at index (0-based) from a collection field')
    .option('--clear', 'Clear the field value')
    .option('--skip', 'Skip the field (marks as skipped)')
    .option('--abort', 'Abort the field (marks as unable to complete)')
    .option('--role <role>', 'Role for skip/abort (default: "user")', 'user')
    .option('--reason <text>', 'Reason for skip/abort')
    .option('-o, --output <file>', 'Output file (default: modify in place)')
    .option('--report', 'Output JSON report after applying (issues, progress)')
    .option('--normalize', 'Regenerate form without preserving external content')
    .action(
      async (
        file: string,
        fieldId: string | undefined,
        value: string | undefined,
        options: {
          values?: string;
          append?: string;
          delete?: string;
          clear?: boolean;
          skip?: boolean;
          abort?: boolean;
          role: string;
          reason?: string;
          output?: string;
          report?: boolean;
          normalize?: boolean;
        },
        cmd: Command,
      ) => {
        const ctx = getCommandContext(cmd);

        try {
          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, 'Parsing form...');
          const form = parseForm(content);

          let patches: Patch[];

          if (options.values) {
            // Batch mode: --values '{"name":"Alice","age":30}'
            if (fieldId) {
              logError('Cannot use --values with positional fieldId/value arguments');
              process.exit(1);
            }
            if (
              options.clear ||
              options.skip ||
              options.abort ||
              options.append !== undefined ||
              options.delete !== undefined
            ) {
              logError('Cannot use --values with --clear, --skip, --abort, --append, or --delete');
              process.exit(1);
            }

            let inputContext: InputContext;
            try {
              inputContext = JSON.parse(options.values) as InputContext;
            } catch {
              logError('Invalid JSON in --values option');
              process.exit(1);
            }

            if (typeof inputContext !== 'object' || Array.isArray(inputContext)) {
              logError('--values must be a JSON object');
              process.exit(1);
            }

            const result = coerceInputContext(form, inputContext);
            for (const w of result.warnings) {
              logVerbose(ctx, `Warning: ${w}`);
            }
            if (result.errors.length > 0) {
              for (const e of result.errors) {
                logError(e);
              }
              process.exit(1);
            }
            patches = result.patches;
          } else if (!fieldId) {
            logError('Either <fieldId> or --values is required');
            process.exit(1);
          } else if (options.clear) {
            if (!findFieldById(form, fieldId)) {
              logError(`Field "${fieldId}" not found in form`);
              process.exit(1);
            }
            patches = [{ op: 'clear_field', fieldId }];
          } else if (options.skip) {
            if (!findFieldById(form, fieldId)) {
              logError(`Field "${fieldId}" not found in form`);
              process.exit(1);
            }
            patches = [
              {
                op: 'skip_field',
                fieldId,
                role: options.role,
                ...(options.reason && { reason: options.reason }),
              },
            ];
          } else if (options.abort) {
            if (!findFieldById(form, fieldId)) {
              logError(`Field "${fieldId}" not found in form`);
              process.exit(1);
            }
            patches = [
              {
                op: 'abort_field',
                fieldId,
                role: options.role,
                ...(options.reason && { reason: options.reason }),
              },
            ];
          } else if (options.append !== undefined) {
            // Append mode: determine field kind, build append_* patch
            const field = findFieldById(form, fieldId);
            if (!field) {
              logError(`Field "${fieldId}" not found in form`);
              process.exit(1);
            }

            const rawValue = parseCliValue(options.append);

            if (field.kind === 'table') {
              // Expect JSON array of row objects
              const rows = Array.isArray(rawValue)
                ? rawValue
                : typeof rawValue === 'object' && rawValue !== null
                  ? [rawValue]
                  : null;
              if (!rows) {
                logError(
                  `--append for table field "${fieldId}" requires a JSON object or array of row objects`,
                );
                process.exit(1);
              }
              patches = [{ op: 'append_table', fieldId, value: rows as TableRowPatch[] }];
            } else if (field.kind === 'string_list') {
              const items = Array.isArray(rawValue)
                ? rawValue
                : [typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue)];
              patches = [{ op: 'append_string_list', fieldId, value: items }];
            } else if (field.kind === 'url_list') {
              const items = Array.isArray(rawValue)
                ? rawValue
                : [typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue)];
              patches = [{ op: 'append_url_list', fieldId, value: items }];
            } else {
              logError(
                `--append is not supported for ${field.kind} fields (only table, string_list, url_list)`,
              );
              process.exit(1);
            }
          } else if (options.delete !== undefined) {
            // Delete mode: determine field kind, build delete_* patch
            const field = findFieldById(form, fieldId);
            if (!field) {
              logError(`Field "${fieldId}" not found in form`);
              process.exit(1);
            }

            const index = parseInt(options.delete, 10);
            if (isNaN(index) || index < 0) {
              logError(`--delete requires a non-negative integer index, got "${options.delete}"`);
              process.exit(1);
            }

            if (field.kind === 'table') {
              patches = [{ op: 'delete_table', fieldId, value: index }];
            } else if (field.kind === 'string_list') {
              patches = [{ op: 'delete_string_list', fieldId, value: index }];
            } else if (field.kind === 'url_list') {
              patches = [{ op: 'delete_url_list', fieldId, value: index }];
            } else {
              logError(
                `--delete is not supported for ${field.kind} fields (only table, string_list, url_list)`,
              );
              process.exit(1);
            }
          } else if (value !== undefined) {
            // Single-field mode with auto-coercion
            const rawValue = parseCliValue(value);
            const result = coerceToFieldPatch(form, fieldId, rawValue);
            if (!result.ok) {
              logError(result.error);
              process.exit(1);
            }
            if ('warning' in result && result.warning) {
              logVerbose(ctx, `Warning: ${result.warning}`);
            }
            patches = [result.patch];
          } else {
            logError(
              'No value provided. Use <value>, --clear, --skip, --abort, --append, or --delete',
            );
            process.exit(1);
          }

          if (ctx.dryRun) {
            logDryRun(`Would apply ${patches.length} patches to ${file}`, { patches });
            return;
          }

          logVerbose(ctx, `Applying ${patches.length} patches...`);
          const applyResult = applyPatches(form, patches);

          if (applyResult.applyStatus === 'rejected') {
            logError('Patches rejected');
            for (const rp of applyResult.rejectedPatches) {
              logError(`  ${rp.message}`);
            }
            process.exit(1);
          }

          // Surface validation issues for the fields that were just set
          // Skip warnings for meta operations (clear/skip/abort/delete) where emptiness is expected
          const isMetaOp =
            Boolean(options.clear) ||
            Boolean(options.skip) ||
            Boolean(options.abort) ||
            options.delete !== undefined;
          if (!isMetaOp) {
            const patchedFieldIds = new Set(
              patches.map((p) => ('fieldId' in p ? p.fieldId : '')).filter(Boolean),
            );
            const relevantIssues = applyResult.issues.filter(
              (i) => i.reason === 'validation_error' && patchedFieldIds.has(i.ref),
            );
            for (const issue of relevantIssues) {
              logWarn(ctx, issue.message);
            }
          }

          // Output
          if (options.report) {
            const report: SetReport = {
              apply_status: applyResult.applyStatus,
              form_state: applyResult.formState,
              is_complete: applyResult.isComplete,
              structure: applyResult.structureSummary,
              progress: applyResult.progressSummary,
              issues: applyResult.issues,
            };
            const output = formatOutput(ctx, report, (data, useColors) =>
              formatConsoleReport(data as SetReport, useColors),
            );
            if (options.output) {
              await writeFile(options.output, output);
              logSuccess(ctx, `Report written to ${options.output}`);
            } else {
              console.log(output);
            }
          } else {
            // Output modified form
            const output = serializeForm(form, {
              preserveContent: !options.normalize,
            });
            const target = options.output ?? file;
            await writeFile(target, output);
            logSuccess(ctx, `Form updated: ${target}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      },
    );
}
