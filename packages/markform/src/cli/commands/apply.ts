/**
 * Apply command - Apply patches to a form.
 *
 * Reads patches from JSON and applies them to the form,
 * outputting the modified form or a report.
 */

import type { Command } from 'commander';

import pc from 'picocolors';

import { applyPatches } from '../../engine/apply.js';
import { parseForm } from '../../engine/parse.js';
import { serializeForm } from '../../engine/serialize.js';
import type { ApplyResult, InspectIssue, ProgressState } from '../../engine/coreTypes.js';
import { PatchSchema } from '../../engine/coreTypes.js';
import {
  formatOutput,
  getCommandContext,
  logDryRun,
  logError,
  logSuccess,
  logVerbose,
  readFile,
  writeFile,
} from '../lib/shared.js';

interface ApplyReport {
  apply_status: 'applied' | 'partial' | 'rejected';
  form_state: ProgressState;
  is_complete: boolean;
  structure: ApplyResult['structureSummary'];
  progress: ApplyResult['progressSummary'];
  issues: InspectIssue[];
}

/**
 * Format state badge for console output.
 */
function formatState(state: ProgressState, useColors: boolean): string {
  const badges: Record<ProgressState, [string, (s: string) => string]> = {
    complete: ['✓ complete', pc.green],
    incomplete: ['○ incomplete', pc.yellow],
    empty: ['◌ empty', pc.dim],
    invalid: ['✗ invalid', pc.red],
  };
  const [text, colorFn] = badges[state] ?? [state, (s: string) => s];
  return useColors ? colorFn(text) : text;
}

/**
 * Format apply report for console output.
 */
function formatConsoleReport(report: ApplyReport, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;
  const red = useColors ? pc.red : (s: string) => s;

  // Header
  lines.push(bold(cyan('Apply Result')));
  lines.push('');

  // Status
  const statusColor = report.apply_status === 'applied' ? green : red;
  lines.push(`${bold('Status:')} ${statusColor(report.apply_status)}`);
  lines.push(`${bold('Form State:')} ${formatState(report.form_state, useColors)}`);
  lines.push(`${bold('Complete:')} ${report.is_complete ? green('yes') : dim('no')}`);
  lines.push('');

  // Progress summary
  const counts = report.progress.counts;
  lines.push(bold('Progress:'));
  lines.push(`  Total fields: ${counts.totalFields}`);
  lines.push(`  Valid: ${counts.validFields}, Invalid: ${counts.invalidFields}`);
  lines.push(`  Filled: ${counts.filledFields}, Empty: ${counts.emptyFields}`);
  lines.push(`  Empty required: ${counts.emptyRequiredFields}`);
  lines.push('');

  // Issues
  if (report.issues.length > 0) {
    lines.push(bold(`Issues (${report.issues.length}):`));
    for (const issue of report.issues) {
      const priority = `P${issue.priority}`;
      lines.push(`  ${dim(priority)} ${dim(issue.ref)}: ${issue.message}`);
    }
  } else {
    lines.push(dim('No issues.'));
  }

  return lines.join('\n');
}

/**
 * Register the apply command.
 */
export function registerApplyCommand(program: Command): void {
  program
    .command('apply <file>')
    .description('Apply patches to a form')
    .option('--patch <json>', 'JSON array of patches to apply')
    .option('-o, --output <file>', 'Output file (defaults to stdout)')
    .option('--report', 'Output apply result report instead of modified form')
    .option('--normalize', 'Regenerate form without preserving external content')
    .action(
      async (
        file: string,
        options: { patch?: string; output?: string; report?: boolean; normalize?: boolean },
        cmd: Command,
      ) => {
        const ctx = getCommandContext(cmd);

        try {
          // Validate patch option
          if (!options.patch) {
            logError('--patch option is required');
            process.exit(1);
          }

          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, 'Parsing form...');
          const form = parseForm(content);

          logVerbose(ctx, 'Parsing patches...');
          let parsedJson: unknown;
          try {
            parsedJson = JSON.parse(options.patch) as unknown;
          } catch {
            logError('Invalid JSON in --patch option');
            process.exit(1);
          }

          if (!Array.isArray(parsedJson)) {
            logError('--patch must be a JSON array');
            process.exit(1);
          }
          const patches = parsedJson as unknown[];

          // Validate each patch against schema
          const validatedPatches = [];
          for (let i = 0; i < patches.length; i++) {
            const result = PatchSchema.safeParse(patches[i]);
            if (!result.success) {
              logError(
                `Invalid patch at index ${i}: ${result.error.issues[0]?.message ?? 'Unknown error'}`,
              );
              process.exit(1);
            }
            validatedPatches.push(result.data);
          }

          if (ctx.dryRun) {
            logDryRun(`Would apply ${validatedPatches.length} patches to ${file}`, {
              patches: validatedPatches,
            });
            return;
          }

          logVerbose(ctx, `Applying ${validatedPatches.length} patches...`);
          const result = applyPatches(form, validatedPatches);

          if (result.applyStatus === 'rejected') {
            logError('Patches rejected - structural validation failed');
            const report: ApplyReport = {
              apply_status: result.applyStatus,
              form_state: result.formState,
              is_complete: result.isComplete,
              structure: result.structureSummary,
              progress: result.progressSummary,
              issues: result.issues,
            };
            const output = formatOutput(ctx, report, (data, useColors) =>
              formatConsoleReport(data as ApplyReport, useColors),
            );
            console.error(output);
            process.exit(1);
          }

          // Output result
          if (options.report) {
            // Output apply result report
            const report: ApplyReport = {
              apply_status: result.applyStatus,
              form_state: result.formState,
              is_complete: result.isComplete,
              structure: result.structureSummary,
              progress: result.progressSummary,
              issues: result.issues,
            };

            const output = formatOutput(ctx, report, (data, useColors) =>
              formatConsoleReport(data as ApplyReport, useColors),
            );
            if (options.output) {
              await writeFile(options.output, output);
              logSuccess(ctx, `Report written to ${options.output}`);
            } else {
              console.log(output);
            }
          } else {
            // Output modified form (always markdown)
            // --normalize disables content preservation (regenerates from scratch)
            const output = serializeForm(form, {
              preserveContent: !options.normalize,
            });
            if (options.output) {
              await writeFile(options.output, output);
              logSuccess(ctx, `Modified form written to ${options.output}`);
            } else {
              console.log(output);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      },
    );
}
