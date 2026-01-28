/**
 * Plan command - Show the idealized execution plan for a form.
 *
 * Computes and displays the execution plan (order levels, parallel batches,
 * loose serial items) without actually filling anything. Shows only remaining
 * (unanswered) fields. The form must pass validation before planning.
 */

import type { Command } from 'commander';

import pc from 'picocolors';

import type { ExecutionPlanItem, FieldBase, ParsedForm } from '../../engine/coreTypes.js';
import { computeExecutionPlan } from '../../engine/executionPlan.js';
import { inspect } from '../../engine/inspect.js';
import { parseForm } from '../../engine/parse.js';
import { formatOutput, getCommandContext, logError, logVerbose, readFile } from '../lib/shared.js';

// =============================================================================
// Types
// =============================================================================

interface PlanItemJson {
  itemId: string;
  itemType: 'field' | 'group';
  fields?: PlanFieldJson[];
}

interface PlanFieldJson {
  fieldId: string;
  label?: string;
  status: string;
  required: boolean;
}

interface PlanBatchJson {
  batchId: string;
  items: PlanItemJson[];
}

interface PlanOrderLevelJson {
  order: number;
  looseSerial: PlanItemJson[];
  parallelBatches: PlanBatchJson[];
}

interface PlanReport {
  formId: string;
  title?: string;
  orderLevels: PlanOrderLevelJson[];
  summary: {
    orderLevelCount: number;
    parallelBatchCount: number;
    totalItems: number;
    remainingFields: number;
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the response status string for a field.
 */
function getFieldStatus(form: ParsedForm, fieldId: string): string {
  const response = form.responsesByFieldId[fieldId];
  if (!response) {
    return 'unanswered';
  }
  return response.state; // 'answered', 'skipped', 'aborted', 'unanswered'
}

/**
 * Check if a field still needs work (not yet answered).
 */
function fieldNeedsWork(form: ParsedForm, fieldId: string): boolean {
  const response = form.responsesByFieldId[fieldId];
  if (!response) {
    return true;
  }
  return response.state !== 'answered';
}

/**
 * Get all field IDs for an execution plan item.
 */
function getFieldIdsForItem(form: ParsedForm, item: ExecutionPlanItem): string[] {
  if (item.itemType === 'field') {
    return [item.itemId];
  }
  // Group: find matching group and return its children's IDs
  const group = form.schema.groups.find((g) => g.id === item.itemId);
  if (!group) {
    return [];
  }
  return group.children.map((f) => f.id);
}

/**
 * Get field metadata from the form schema.
 */
function getFieldMeta(form: ParsedForm, fieldId: string): FieldBase | undefined {
  for (const group of form.schema.groups) {
    const field = group.children.find((f) => f.id === fieldId);
    if (field) {
      return field;
    }
  }
  return undefined;
}

/**
 * Build a PlanItemJson, including only fields that need work.
 * Returns undefined if no fields need work.
 */
function buildPlanItem(form: ParsedForm, item: ExecutionPlanItem): PlanItemJson | undefined {
  const fieldIds = getFieldIdsForItem(form, item);
  const remainingFieldIds = fieldIds.filter((id) => fieldNeedsWork(form, id));

  if (remainingFieldIds.length === 0) {
    return undefined; // All fields answered
  }

  const planItem: PlanItemJson = {
    itemId: item.itemId,
    itemType: item.itemType,
  };

  if (item.itemType === 'group') {
    planItem.fields = remainingFieldIds.map((id) => {
      const meta = getFieldMeta(form, id);
      return {
        fieldId: id,
        label: meta?.label,
        status: getFieldStatus(form, id),
        required: meta?.required ?? false,
      };
    });
  }

  return planItem;
}

// =============================================================================
// Console Formatting
// =============================================================================

function formatConsolePlan(report: PlanReport, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const yellow = useColors ? pc.yellow : (s: string) => s;

  // Header
  const titlePart = report.title ? ` (${report.title})` : '';
  lines.push(bold(cyan(`Plan: ${report.formId}${titlePart}`)));
  lines.push('');

  if (report.orderLevels.length === 0) {
    lines.push(dim('No remaining work — all fields are complete.'));
    return lines.join('\n');
  }

  for (const level of report.orderLevels) {
    const itemCount =
      level.looseSerial.length + level.parallelBatches.reduce((sum, b) => sum + b.items.length, 0);
    lines.push(bold(`Order level ${level.order} (${itemCount} items):`));

    // Loose serial
    if (level.looseSerial.length > 0) {
      lines.push(`  Loose serial (primary agent):`);
      for (const item of level.looseSerial) {
        formatItem(lines, item, dim, yellow, '    ');
      }
    }

    // Parallel batches
    for (const batch of level.parallelBatches) {
      lines.push(
        `  Parallel batch "${batch.batchId}" (${batch.items.length} items, ${batch.items.length} agents):`,
      );
      for (const item of batch.items) {
        formatItem(lines, item, dim, yellow, '    ');
      }
    }

    lines.push('');
  }

  // Summary
  const s = report.summary;
  lines.push(
    dim(
      `Summary: ${s.orderLevelCount} order level${s.orderLevelCount !== 1 ? 's' : ''}, ` +
        `${s.parallelBatchCount} parallel batch${s.parallelBatchCount !== 1 ? 'es' : ''}, ` +
        `${s.remainingFields} remaining field${s.remainingFields !== 1 ? 's' : ''}`,
    ),
  );

  return lines.join('\n');
}

function formatItem(
  lines: string[],
  item: PlanItemJson,
  dim: (s: string) => string,
  yellow: (s: string) => string,
  indent: string,
): void {
  if (item.itemType === 'group' && item.fields) {
    lines.push(`${indent}- ${item.itemId} [group]`);
    for (const f of item.fields) {
      const label = f.label ? ` (${f.label})` : '';
      const req = f.required ? yellow('required') + ', ' : '';
      lines.push(`${indent}    ${f.fieldId}${label} — ${req}${dim(f.status)}`);
    }
  } else {
    // Single field
    const meta = item;
    lines.push(`${indent}- ${meta.itemId}`);
  }
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register the plan command.
 */
export function registerPlanCommand(program: Command): void {
  program
    .command('plan <file>')
    .description('Show the idealized execution plan for a form (parallel batches, order levels)')
    .action(async (file: string, _options: Record<string, unknown>, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        logVerbose(ctx, `Reading file: ${file}`);
        const content = await readFile(file);

        logVerbose(ctx, 'Parsing and validating form...');
        const form = parseForm(content);

        // Validate: inspect for issues
        const inspectResult = inspect(form);
        const parseErrors = inspectResult.issues.filter((i) => i.reason === 'validation_error');
        if (parseErrors.length > 0) {
          logError(
            `Form has validation errors. Fix them before planning:\n` +
              parseErrors.map((e) => `  - ${e.message}`).join('\n'),
          );
          process.exit(1);
        }

        logVerbose(ctx, 'Computing execution plan...');
        const executionPlan = computeExecutionPlan(form);

        // Build plan report grouped by order level, filtered to remaining work
        const orderLevels: PlanOrderLevelJson[] = [];
        let totalItems = 0;
        let totalRemainingFields = 0;
        let totalBatches = 0;

        for (const order of executionPlan.orderLevels) {
          // Filter loose serial items to only those with remaining work
          const looseItems: PlanItemJson[] = [];
          for (const item of executionPlan.looseSerial) {
            if (item.order !== order) continue;
            const planItem = buildPlanItem(form, item);
            if (planItem) {
              looseItems.push(planItem);
              totalItems++;
              totalRemainingFields += countRemainingFields(form, item);
            }
          }

          // Filter parallel batches
          const batches: PlanBatchJson[] = [];
          for (const batch of executionPlan.parallelBatches) {
            const batchItems: PlanItemJson[] = [];
            for (const item of batch.items) {
              if (item.order !== order) continue;
              const planItem = buildPlanItem(form, item);
              if (planItem) {
                batchItems.push(planItem);
                totalItems++;
                totalRemainingFields += countRemainingFields(form, item);
              }
            }
            if (batchItems.length > 0) {
              batches.push({ batchId: batch.batchId, items: batchItems });
              totalBatches++;
            }
          }

          if (looseItems.length > 0 || batches.length > 0) {
            orderLevels.push({
              order,
              looseSerial: looseItems,
              parallelBatches: batches,
            });
          }
        }

        const report: PlanReport = {
          formId: form.schema.id,
          title: form.schema.title,
          orderLevels,
          summary: {
            orderLevelCount: orderLevels.length,
            parallelBatchCount: totalBatches,
            totalItems,
            remainingFields: totalRemainingFields,
          },
        };

        const output = formatOutput(ctx, report, (data, useColors) =>
          formatConsolePlan(data as PlanReport, useColors),
        );
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}

/**
 * Count remaining fields for an execution plan item.
 */
function countRemainingFields(form: ParsedForm, item: ExecutionPlanItem): number {
  const fieldIds = getFieldIdsForItem(form, item);
  return fieldIds.filter((id) => fieldNeedsWork(form, id)).length;
}
