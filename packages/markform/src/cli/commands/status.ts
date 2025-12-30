/**
 * Status command - Display form fill status with per-role breakdown.
 *
 * Provides:
 * - Overall progress counts
 * - Per-role fill statistics
 * - Run mode (explicit or inferred)
 * - Suggested next command
 */

import { basename } from 'node:path';

import type { Command } from 'commander';
import pc from 'picocolors';

import type { Field, ParsedForm, RunMode } from '../../engine/coreTypes.js';
import { getAllFields } from '../../engine/inspect.js';
import { parseForm } from '../../engine/parse.js';
import { AGENT_ROLE, USER_ROLE } from '../../settings.js';
import { determineRunMode, getFieldRoles } from '../lib/runMode.js';
import { formatOutput, getCommandContext, logError, logVerbose, readFile } from '../lib/shared.js';

// =============================================================================
// Types
// =============================================================================

/** Statistics for a set of fields */
interface FieldStats {
  total: number;
  answered: number;
  skipped: number;
  aborted: number;
  unanswered: number;
}

/** Report structure for status command */
export interface StatusReport {
  path: string;
  runMode: RunMode | null;
  runModeSource: 'explicit' | 'inferred' | 'unknown';
  overall: FieldStats;
  byRole: Record<string, FieldStats>;
  suggestedCommand: string | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compute field statistics from a list of fields.
 */
function computeFieldStats(form: ParsedForm, fields: Field[]): FieldStats {
  let answered = 0;
  let skipped = 0;
  let aborted = 0;
  let unanswered = 0;

  for (const field of fields) {
    const response = form.responsesByFieldId[field.id];
    const state = response?.state ?? 'unanswered';

    switch (state) {
      case 'answered':
        answered++;
        break;
      case 'skipped':
        skipped++;
        break;
      case 'aborted':
        aborted++;
        break;
      case 'unanswered':
      default:
        unanswered++;
        break;
    }
  }

  return {
    total: fields.length,
    answered,
    skipped,
    aborted,
    unanswered,
  };
}

/**
 * Compute statistics grouped by role.
 */
function computeStatsByRole(form: ParsedForm): Record<string, FieldStats> {
  const allFields = getAllFields(form);
  const roles = getFieldRoles(form);
  const result: Record<string, FieldStats> = {};

  for (const role of roles) {
    const roleFields = allFields.filter((f) => f.role === role);
    result[role] = computeFieldStats(form, roleFields);
  }

  return result;
}

/**
 * Format percentage with one decimal place.
 */
function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

/**
 * Format status report for console output.
 */
function formatConsoleReport(report: StatusReport, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;
  const yellow = useColors ? pc.yellow : (s: string) => s;
  const red = useColors ? pc.red : (s: string) => s;

  // Header
  lines.push(bold(cyan(`Form Status: ${basename(report.path)}`)));
  lines.push('');

  // Overall stats
  const overall = report.overall;
  const overallPercent = formatPercent(overall.answered, overall.total);
  lines.push(
    `${bold('Overall:')} ${overall.answered}/${overall.total} fields filled (${overallPercent})`,
  );
  lines.push(`  ${green('✓')} Complete: ${overall.answered}`);
  lines.push(`  ${dim('○')} Empty: ${overall.unanswered}`);
  if (overall.skipped > 0) {
    lines.push(`  ${yellow('⊘')} Skipped: ${overall.skipped}`);
  }
  if (overall.aborted > 0) {
    lines.push(`  ${red('✗')} Aborted: ${overall.aborted}`);
  }
  lines.push('');

  // Per-role stats
  lines.push(bold('By Role:'));
  const roles = Object.keys(report.byRole).sort((a, b) => {
    // Sort user role first, then agent, then alphabetically
    if (a === USER_ROLE) return -1;
    if (b === USER_ROLE) return 1;
    if (a === AGENT_ROLE) return -1;
    if (b === AGENT_ROLE) return 1;
    return a.localeCompare(b);
  });

  for (const role of roles) {
    const stats = report.byRole[role];
    if (!stats) continue;
    const percent = formatPercent(stats.answered, stats.total);
    const needsAttention =
      role === USER_ROLE && stats.unanswered > 0 ? yellow(' ← needs attention') : '';
    lines.push(`  ${role}: ${stats.answered}/${stats.total} filled (${percent})${needsAttention}`);
  }
  lines.push('');

  // Run mode
  if (report.runMode) {
    const source = report.runModeSource === 'explicit' ? 'explicit' : 'inferred';
    lines.push(`${bold('Run Mode:')} ${report.runMode} (${source})`);
  } else {
    lines.push(`${bold('Run Mode:')} ${dim('unknown')}`);
  }

  // Suggested command
  if (report.suggestedCommand) {
    lines.push(`${bold('Suggested:')} ${cyan(report.suggestedCommand)}`);
  }

  return lines.join('\n');
}

/**
 * Generate a suggested command based on status.
 */
function getSuggestedCommand(report: StatusReport): string | null {
  const { overall, byRole, runMode, path } = report;
  const filename = basename(path);

  // If complete, no suggestion
  if (overall.total > 0 && overall.answered === overall.total) {
    return null;
  }

  // If user role has unfilled fields, suggest interactive
  const userStats = byRole[USER_ROLE];
  if (userStats && userStats.unanswered > 0) {
    return `markform fill ${filename} --interactive`;
  }

  // Otherwise suggest based on run mode
  if (runMode === 'research') {
    return `markform research ${filename}`;
  }

  return `markform run ${filename}`;
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register the status command.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status <file>')
    .description('Display form fill status with per-role breakdown')
    .action(async (file: string, _options: Record<string, unknown>, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        logVerbose(ctx, `Reading file: ${file}`);
        const content = await readFile(file);

        logVerbose(ctx, 'Parsing form...');
        const form = parseForm(content);

        logVerbose(ctx, 'Computing status...');

        // Compute overall stats
        const allFields = getAllFields(form);
        const overall = computeFieldStats(form, allFields);

        // Compute per-role stats
        const byRole = computeStatsByRole(form);

        // Determine run mode
        const runModeResult = determineRunMode(form);
        let runMode: RunMode | null = null;
        let runModeSource: 'explicit' | 'inferred' | 'unknown' = 'unknown';

        if (runModeResult.success) {
          runMode = runModeResult.runMode;
          runModeSource = runModeResult.source;
        }

        // Build report
        const report: StatusReport = {
          path: file,
          runMode,
          runModeSource,
          overall,
          byRole,
          suggestedCommand: null, // Will be computed below
        };

        report.suggestedCommand = getSuggestedCommand(report);

        // Output in requested format
        const output = formatOutput(ctx, report, (data, useColors) =>
          formatConsoleReport(data as StatusReport, useColors),
        );
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
