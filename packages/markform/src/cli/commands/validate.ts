/**
 * Validate command - Display form summary and validation issues.
 *
 * A streamlined version of inspect that shows:
 * - Form state
 * - Structure summary (field counts, types)
 * - Progress summary (filled/empty counts)
 * - Issues sorted by priority
 *
 * Does NOT include full form content (use inspect for that).
 */

import type { Command } from 'commander';

import pc from 'picocolors';

import { inspect } from '../../engine/inspect.js';
import { parseForm } from '../../engine/parse.js';
import { validateSyntaxConsistency, type SyntaxViolation } from '../../engine/preprocess.js';
import type { InspectIssue, ProgressState, SyntaxStyle } from '../../engine/coreTypes.js';
import {
  formatOutput,
  getCommandContext,
  logError,
  logVerbose,
  readFile,
  shouldUseColors,
} from '../lib/shared.js';

/** Map CLI option values to internal SyntaxStyle */
type SyntaxOption = 'comments' | 'tags';

function syntaxOptionToStyle(option: SyntaxOption): SyntaxStyle {
  return option === 'comments' ? 'html-comment' : 'markdoc';
}

/**
 * Format syntax violations for console output.
 */
function formatSyntaxViolations(
  violations: SyntaxViolation[],
  expectedSyntax: SyntaxOption,
  useColors: boolean,
): string {
  const lines: string[] = [];
  const red = useColors ? pc.red : (s: string) => s;
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;

  lines.push(red(bold(`Syntax violations found (expected: ${expectedSyntax}):`)));
  lines.push('');

  for (const v of violations) {
    const syntaxName = v.foundSyntax === 'markdoc' ? 'Markdoc tag' : 'HTML comment';
    lines.push(`  Line ${v.line}: ${syntaxName} found`);
    lines.push(`    ${dim(v.pattern.length > 60 ? v.pattern.slice(0, 60) + '...' : v.pattern)}`);
  }

  return lines.join('\n');
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
 * Format priority badge for console output.
 */
function formatPriority(priority: number, useColors: boolean): string {
  const label = `P${priority}`;
  if (!useColors) {
    return label;
  }
  switch (priority) {
    case 1:
      return pc.red(pc.bold(label));
    case 2:
      return pc.yellow(label);
    case 3:
      return pc.cyan(label);
    case 4:
      return pc.blue(label);
    case 5:
    default:
      return pc.dim(label);
  }
}

/**
 * Format severity badge for console output.
 */
function formatSeverity(severity: 'required' | 'recommended', useColors: boolean): string {
  if (!useColors) {
    return severity;
  }
  return severity === 'required' ? pc.red(severity) : pc.yellow(severity);
}

/** Report structure for validate command */
interface ValidateReport {
  title?: string;
  structure: unknown;
  progress: unknown;
  form_state: ProgressState;
  issues: {
    ref: string;
    scope: string;
    reason: string;
    message: string;
    priority: number;
    severity: 'required' | 'recommended';
  }[];
}

/**
 * Format validate report for console output.
 */
function formatConsoleReport(report: ValidateReport, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;

  // Header
  lines.push(bold(cyan('Form Validation Report')));
  if (report.title) {
    lines.push(`${bold('Title:')} ${report.title}`);
  }
  lines.push('');

  // Form state
  lines.push(`${bold('Form State:')} ${formatState(report.form_state, useColors)}`);
  lines.push('');

  // Structure summary
  const structure = report.structure as {
    groupCount: number;
    fieldCount: number;
    optionCount: number;
  };
  lines.push(bold('Structure:'));
  lines.push(`  Groups: ${structure.groupCount}`);
  lines.push(`  Fields: ${structure.fieldCount}`);
  lines.push(`  Options: ${structure.optionCount}`);
  lines.push('');

  // Progress summary
  const progress = report.progress as {
    counts: {
      totalFields: number;
      requiredFields: number;
      unansweredFields: number;
      answeredFields: number;
      skippedFields: number;
      abortedFields: number;
      validFields: number;
      invalidFields: number;
      emptyFields: number;
      filledFields: number;
      emptyRequiredFields: number;
      totalNotes: number;
    };
  };
  lines.push(bold('Progress:'));
  lines.push(`  Total fields: ${progress.counts.totalFields}`);
  lines.push(`  Required: ${progress.counts.requiredFields}`);
  lines.push(
    `  AnswerState: answered=${progress.counts.answeredFields}, skipped=${progress.counts.skippedFields}, aborted=${progress.counts.abortedFields}, unanswered=${progress.counts.unansweredFields}`,
  );
  lines.push(
    `  Validity: valid=${progress.counts.validFields}, invalid=${progress.counts.invalidFields}`,
  );
  lines.push(
    `  Value: filled=${progress.counts.filledFields}, empty=${progress.counts.emptyFields}`,
  );
  lines.push(`  Empty required: ${progress.counts.emptyRequiredFields}`);
  lines.push('');

  // Issues
  if (report.issues.length > 0) {
    lines.push(bold(`Issues (${report.issues.length}):`));
    for (const issue of report.issues) {
      const priority = formatPriority(issue.priority, useColors);
      const severity = formatSeverity(issue.severity, useColors);
      lines.push(
        `  ${priority} (${severity}) ${dim(`[${issue.scope}]`)} ${dim(issue.ref)}: ${issue.message}`,
      );
    }
  } else {
    lines.push(dim('No issues found.'));
  }

  return lines.join('\n');
}

/** Options for validate command */
interface ValidateOptions {
  syntax?: SyntaxOption;
}

/**
 * Register the validate command.
 */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate <file>')
    .description('Validate a form and display summary and issues (no form content)')
    .option(
      '--syntax <style>',
      'Enforce syntax style (comments or tags). Fails if file uses the other syntax.',
      (value: string) => {
        if (value !== 'comments' && value !== 'tags') {
          throw new Error(`Invalid syntax value: ${value}. Must be 'comments' or 'tags'.`);
        }
        return value as SyntaxOption;
      },
    )
    .action(async (file: string, options: ValidateOptions, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        logVerbose(ctx, `Reading file: ${file}`);
        const content = await readFile(file);

        // If --syntax is specified, validate syntax consistency first
        if (options.syntax) {
          logVerbose(ctx, `Checking syntax consistency (expected: ${options.syntax})...`);
          const expectedStyle = syntaxOptionToStyle(options.syntax);
          const violations = validateSyntaxConsistency(content, expectedStyle);

          if (violations.length > 0) {
            const useColors = shouldUseColors(ctx);
            if (ctx.format === 'json') {
              console.log(
                JSON.stringify(
                  {
                    error: 'syntax_violation',
                    expected: options.syntax,
                    violations: violations.map((v) => ({
                      line: v.line,
                      pattern: v.pattern,
                      foundSyntax: v.foundSyntax,
                    })),
                  },
                  null,
                  2,
                ),
              );
            } else {
              console.error(formatSyntaxViolations(violations, options.syntax, useColors));
            }
            process.exit(1);
          }
          logVerbose(ctx, 'Syntax consistency check passed.');
        }

        logVerbose(ctx, 'Parsing form...');
        const form = parseForm(content);

        logVerbose(ctx, 'Running validation...');
        const result = inspect(form);

        // Build the report structure (without form content)
        const report: ValidateReport = {
          title: form.schema.title,
          structure: result.structureSummary,
          progress: result.progressSummary,
          form_state: result.formState,
          issues: result.issues.map((issue: InspectIssue) => ({
            ref: issue.ref,
            scope: issue.scope,
            reason: issue.reason,
            message: issue.message,
            priority: issue.priority,
            severity: issue.severity,
          })),
        };

        // Output in requested format
        const output = formatOutput(ctx, report, (data, useColors) =>
          formatConsoleReport(data as ValidateReport, useColors),
        );
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
