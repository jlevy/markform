/**
 * Dump command - Extract and display form values only.
 *
 * A lightweight alternative to inspect that outputs only the values map,
 * without structure, progress, or validation information.
 * Useful for quick value extraction, scripting, and integration.
 *
 * Output includes full state for all fields:
 * - answered: shows the value
 * - skipped: shows reason if available
 * - unanswered: indicates field is not yet filled
 */

import type { Command } from 'commander';

import pc from 'picocolors';

import { parseForm } from '../../engine/parse.js';
import type { FieldResponse, ParsedForm } from '../../engine/coreTypes.js';
import { toStructuredValues, toNotesArray } from '../lib/exportHelpers.js';
import { formatOutput, getCommandContext, logError, logVerbose, readFile } from '../lib/shared.js';

/**
 * Format a field response for console display, including state information.
 */
function formatFieldResponse(response: FieldResponse, useColors: boolean): string {
  const dim = useColors ? pc.dim : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;
  const yellow = useColors ? pc.yellow : (s: string) => s;

  if (response.state === 'unanswered') {
    return dim('(unanswered)');
  }

  if (response.state === 'skipped') {
    const reason = response.reason ? ` ${response.reason}` : '';
    return yellow(`[skipped]${reason}`);
  }

  if (response.state === 'aborted') {
    const reason = response.reason ? ` ${response.reason}` : '';
    return yellow(`[aborted]${reason}`);
  }

  // state === 'answered'
  const value = response.value;
  if (!value) {
    return dim('(empty)');
  }

  switch (value.kind) {
    case 'string':
      return value.value ? green(`"${value.value}"`) : dim('(empty)');
    case 'number':
      return value.value !== null ? green(String(value.value)) : dim('(empty)');
    case 'string_list':
      return value.items.length > 0 ? green(`[${value.items.join(', ')}]`) : dim('(empty)');
    case 'single_select':
      return value.selected ? green(value.selected) : dim('(none selected)');
    case 'multi_select':
      return value.selected.length > 0
        ? green(`[${value.selected.join(', ')}]`)
        : dim('(none selected)');
    case 'checkboxes': {
      const entries = Object.entries(value.values);
      if (entries.length === 0) {
        return dim('(no entries)');
      }
      return entries.map(([k, v]) => `${k}:${v}`).join(', ');
    }
    case 'url':
      return value.value ? green(`"${value.value}"`) : dim('(empty)');
    case 'url_list':
      return value.items.length > 0 ? green(`[${value.items.join(', ')}]`) : dim('(empty)');
    case 'date':
      return value.value ? green(value.value) : dim('(empty)');
    case 'year':
      return value.value !== null ? green(String(value.value)) : dim('(empty)');
    case 'table':
      return value.rows.length > 0 ? green(`(${value.rows.length} rows)`) : dim('(empty)');
    default: {
      // Exhaustiveness check - TypeScript will error if a case is missing
      const _exhaustive: never = value;
      throw new Error(`Unhandled field value kind: ${(_exhaustive as { kind: string }).kind}`);
    }
  }
}

/**
 * Format form responses for console output, showing all fields with their states.
 */
function formatConsoleResponses(form: ParsedForm, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;

  for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
    const valueStr = formatFieldResponse(response, useColors);
    lines.push(`${bold(fieldId)}: ${valueStr}`);
  }

  if (lines.length === 0) {
    lines.push(dim('(no fields)'));
  }

  return lines.join('\n');
}

/**
 * Register the dump command.
 */
export function registerDumpCommand(program: Command): void {
  program
    .command('dump <file>')
    .description('Extract and display form values with state (lightweight inspect)')
    .action(async (file: string, _options: Record<string, unknown>, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        logVerbose(ctx, `Reading file: ${file}`);
        const content = await readFile(file);

        logVerbose(ctx, 'Parsing form...');
        const form = parseForm(content);

        // For JSON/YAML output, use toStructuredValues which includes state
        // For console/plaintext, use formatted output with field states
        const isStructured = ctx.format === 'json' || ctx.format === 'yaml';

        if (isStructured) {
          // Use toStructuredValues for state-aware structured output
          const structuredOutput = {
            values: toStructuredValues(form),
            ...(form.notes.length > 0 && { notes: toNotesArray(form) }),
          };

          const output = formatOutput(ctx, structuredOutput, () => '');
          console.log(output);
        } else {
          // Use formatted output for console/plaintext with state display
          const output = formatOutput(ctx, form, (data, useColors) =>
            formatConsoleResponses(data as ParsedForm, useColors),
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
