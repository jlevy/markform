/**
 * Next command - Field advisor for CLI-driven form filling.
 *
 * Read-only command that inspects a form and returns a prioritized,
 * filtered, enriched list of fields to fill next. Designed for
 * stateless next → set → next → set loops.
 */

import type { Command } from 'commander';

import pc from 'picocolors';

import { inspect } from '../../engine/inspect.js';
import {
  filterIssuesByOrder,
  filterIssuesByScope,
  getFieldIdFromRef,
} from '../../engine/issueFiltering.js';
import { parseForm } from '../../engine/parse.js';
import type {
  Field,
  FieldValue,
  InspectIssue,
  ParsedForm,
  ProgressState,
} from '../../engine/coreTypes.js';
import { findFieldById } from '../../engine/valueCoercion.js';
import { parseRolesFlag } from '../../settings.js';
import { formatOutput, getCommandContext, logError, logVerbose, readFile } from '../lib/shared.js';

// =============================================================================
// Types
// =============================================================================

/** Enriched field metadata included inline per issue. */
interface NextFieldMeta {
  kind: string;
  label: string;
  required: boolean;
  options?: string[];
  checkbox_mode?: string;
  columns?: { id: string; type: string; required: boolean }[];
  min_rows?: number;
  max_rows?: number;
}

/** Enriched issue for the next command output. */
interface NextIssue {
  ref: string;
  scope: string;
  reason: string;
  message: string;
  severity: 'required' | 'recommended';
  priority: number;
  field?: NextFieldMeta;
  current_value?: unknown;
  set_example: string;
  skip_example: string | null;
}

/** Top-level next command report. */
interface NextReport {
  is_complete: boolean;
  form_state: ProgressState;
  step_budget: number;
  progress: {
    total_fields: number;
    required_fields: number;
    filled_fields: number;
    empty_required_fields: number;
  };
  issues: NextIssue[];
}

// =============================================================================
// Enrichment Helpers
// =============================================================================

/**
 * Build field metadata for an issue's field.
 */
function buildFieldMeta(field: Field): NextFieldMeta {
  const meta: NextFieldMeta = {
    kind: field.kind,
    label: field.label,
    required: field.required,
  };

  if (field.kind === 'single_select' || field.kind === 'multi_select') {
    meta.options = field.options.map((o) => o.id);
  } else if (field.kind === 'checkboxes') {
    meta.options = field.options.map((o) => o.id);
    meta.checkbox_mode = field.checkboxMode;
  } else if (field.kind === 'table') {
    meta.columns = field.columns.map((c) => ({
      id: c.id,
      type: c.type,
      required: c.required,
    }));
    if (field.minRows !== undefined) meta.min_rows = field.minRows;
    if (field.maxRows !== undefined) meta.max_rows = field.maxRows;
  }

  return meta;
}

/**
 * Generate a concrete `markform set` example for a field.
 */
function generateSetExample(file: string, field: Field): string {
  const base = `markform set ${file} ${field.id}`;

  switch (field.kind) {
    case 'string':
      return `${base} "example text"`;
    case 'number':
      return `${base} 42`;
    case 'string_list':
      return `${base} '["item1", "item2"]'`;
    case 'single_select':
      return field.options.length > 0 ? `${base} ${field.options[0]!.id}` : `${base} option_id`;
    case 'multi_select':
      return field.options.length > 0
        ? `${base} '["${field.options.map((o) => o.id).join('", "')}"]'`
        : `${base} '["option1"]'`;
    case 'checkboxes':
      if (field.checkboxMode === 'simple') {
        return `${base} '${JSON.stringify(Object.fromEntries(field.options.map((o) => [o.id, true])))}'`;
      }
      return `${base} '${JSON.stringify(Object.fromEntries(field.options.map((o) => [o.id, 'done'])))}'`;
    case 'url':
      return `${base} "https://example.com"`;
    case 'url_list':
      return `${base} '["https://example.com"]'`;
    case 'date':
      return `${base} "2024-01-15"`;
    case 'year':
      return `${base} 2024`;
    case 'table':
      if (field.columns.length > 0) {
        const example = Object.fromEntries(field.columns.map((c) => [c.id, `example_${c.type}`]));
        return `${base} --append '${JSON.stringify(example)}'`;
      }
      return `${base} --append '{}'`;
  }
}

/**
 * Generate a skip example for optional fields, or null for required fields.
 */
function generateSkipExample(file: string, fieldId: string, required: boolean): string | null {
  if (required) return null;
  return `markform set ${file} ${fieldId} --skip --reason "Not applicable"`;
}

/**
 * Convert a FieldValue to a serializable current_value for the report.
 */
function serializeCurrentValue(value: FieldValue): unknown {
  switch (value.kind) {
    case 'string':
    case 'url':
    case 'date':
      return value.value;
    case 'number':
    case 'year':
      return value.value;
    case 'string_list':
    case 'url_list':
      return value.items;
    case 'single_select':
      return value.selected;
    case 'multi_select':
      return value.selected;
    case 'checkboxes':
      return value.values;
    case 'table':
      return value.rows;
  }
}

/**
 * Enrich an InspectIssue into a NextIssue with field metadata and examples.
 */
function enrichIssue(issue: InspectIssue, form: ParsedForm, file: string): NextIssue {
  const fieldId = getFieldIdFromRef(issue.ref, issue.scope);
  const field = fieldId ? findFieldById(form, fieldId) : undefined;

  const enriched: NextIssue = {
    ref: issue.ref,
    scope: issue.scope,
    reason: issue.reason,
    message: issue.message,
    severity: issue.severity,
    priority: issue.priority,
    set_example: field
      ? generateSetExample(file, field)
      : `markform set ${file} ${issue.ref} "value"`,
    skip_example: field ? generateSkipExample(file, field.id, field.required) : null,
  };

  if (field) {
    enriched.field = buildFieldMeta(field);

    // Include current_value if the field has a partial/existing value
    const response = form.responsesByFieldId[field.id];
    if (response?.state === 'answered' && response.value) {
      enriched.current_value = serializeCurrentValue(response.value);
    }
  }

  return enriched;
}

// =============================================================================
// Console Formatting
// =============================================================================

/**
 * Format next report for console output.
 */
function formatConsoleReport(report: NextReport, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;
  const yellow = useColors ? pc.yellow : (s: string) => s;
  const red = useColors ? pc.red : (s: string) => s;

  // State line
  const stateColor =
    report.form_state === 'complete' ? green : report.form_state === 'invalid' ? red : yellow;
  const progressStr = `${report.progress.filled_fields}/${report.progress.total_fields} fields filled, ${report.progress.empty_required_fields} required remaining`;
  lines.push(`${bold('State:')} ${stateColor(report.form_state)} ${dim(`(${progressStr})`)}`);

  if (report.is_complete) {
    lines.push('');
    lines.push(green(bold('Form is complete!')));
    return lines.join('\n');
  }

  lines.push('');
  lines.push(
    bold(`Next fields to fill (${report.issues.length} issues, budget: ${report.step_budget}):`),
  );
  lines.push('');

  for (const issue of report.issues) {
    const prioLabel = `P${issue.priority}`;
    const prioColor = issue.priority <= 1 ? red : issue.priority <= 2 ? yellow : cyan;
    const sevLabel = issue.severity === 'required' ? 'required' : 'recommended';

    const kindStr = issue.field ? ` ${dim(`(${issue.field.kind})`)}` : '';
    let optionsStr = '';
    if (issue.field?.options && issue.field.options.length > 0) {
      optionsStr = ` ${dim(`[${issue.field.options.join(', ')}]`)}`;
    }

    lines.push(
      `  ${prioColor(prioLabel)} ${dim(`[${sevLabel}]`)} ${bold(issue.ref)}${kindStr}${optionsStr}`,
    );
    lines.push(`     ${issue.message}`);
    lines.push(`     ${dim('->')} ${cyan(issue.set_example)}`);
    if (issue.skip_example) {
      lines.push(`     ${dim('->')} ${dim(issue.skip_example)}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

// =============================================================================
// Command Registration
// =============================================================================

const DEFAULT_MAX_ISSUES = 10;

/**
 * Register the next command.
 */
export function registerNextCommand(program: Command): void {
  program
    .command('next <file>')
    .description('Show prioritized next fields to fill (field advisor for CLI form filling)')
    .option('--roles <roles>', "Target roles (comma-separated, or '*' for all; default: all)")
    .option('--max-fields <n>', 'Max distinct fields per batch')
    .option('--max-groups <n>', 'Max distinct groups per batch')
    .option('--max-issues <n>', `Max issues to return (default: ${DEFAULT_MAX_ISSUES})`)
    .action(
      async (
        file: string,
        options: {
          roles?: string;
          maxFields?: string;
          maxGroups?: string;
          maxIssues?: string;
        },
        cmd: Command,
      ) => {
        const ctx = getCommandContext(cmd);

        try {
          // Parse --roles
          let targetRoles: string[] | undefined;
          if (options.roles) {
            try {
              targetRoles = parseRolesFlag(options.roles);
              if (targetRoles.includes('*')) {
                targetRoles = undefined;
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              logError(`Invalid --roles: ${message}`);
              process.exit(1);
            }
          }

          // Parse numeric options
          const maxFields = options.maxFields ? parseInt(options.maxFields, 10) : undefined;
          const maxGroups = options.maxGroups ? parseInt(options.maxGroups, 10) : undefined;

          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, 'Parsing form...');
          const form = parseForm(content);

          // Read harness config from frontmatter for defaults
          const harnessConfig = form.metadata?.harnessConfig;
          const effectiveMaxIssues = options.maxIssues
            ? parseInt(options.maxIssues, 10)
            : (harnessConfig?.maxIssuesPerTurn ?? DEFAULT_MAX_ISSUES);
          const effectiveMaxFields = maxFields ?? undefined;
          const effectiveMaxGroups = maxGroups ?? undefined;

          logVerbose(ctx, 'Running inspection...');
          const result = inspect(form, { targetRoles });

          // Apply three-stage filtering pipeline
          // Stage 0: Order filtering
          const orderFiltered = filterIssuesByOrder(result.issues, form);
          // Stage 1: Scope filtering
          const scopeFiltered = filterIssuesByScope(
            orderFiltered,
            form,
            effectiveMaxFields,
            effectiveMaxGroups,
          );
          // Stage 2: Count cap
          const limitedIssues = scopeFiltered.slice(0, effectiveMaxIssues);

          // Step budget
          const maxPatches = harnessConfig?.maxPatchesPerTurn ?? limitedIssues.length;
          const stepBudget = Math.min(maxPatches, limitedIssues.length);

          // Enrich issues
          const enrichedIssues = limitedIssues.map((issue) => enrichIssue(issue, form, file));

          // Build report
          const counts = result.progressSummary.counts;
          const report: NextReport = {
            is_complete: result.isComplete,
            form_state: result.formState,
            step_budget: stepBudget,
            progress: {
              total_fields: counts.totalFields,
              required_fields: counts.requiredFields,
              filled_fields: counts.filledFields,
              empty_required_fields: counts.emptyRequiredFields,
            },
            issues: enrichedIssues,
          };

          // Output
          const output = formatOutput(ctx, report, (data, useColors) =>
            formatConsoleReport(data as NextReport, useColors),
          );
          console.log(output);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      },
    );
}
