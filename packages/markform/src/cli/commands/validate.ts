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

import type { Command } from "commander";

import pc from "picocolors";

import { inspect } from "../../engine/inspect.js";
import { parseForm } from "../../engine/parse.js";
import type { InspectIssue, ProgressState } from "../../engine/types.js";
import {
  formatOutput,
  getCommandContext,
  logError,
  logVerbose,
  readFile,
} from "../lib/shared.js";

/**
 * Format state badge for console output.
 */
function formatState(state: ProgressState, useColors: boolean): string {
  const badges: Record<ProgressState, [string, (s: string) => string]> = {
    complete: ["✓ complete", pc.green],
    incomplete: ["○ incomplete", pc.yellow],
    empty: ["◌ empty", pc.dim],
    invalid: ["✗ invalid", pc.red],
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
function formatSeverity(
  severity: "required" | "recommended",
  useColors: boolean
): string {
  if (!useColors) {
    return severity;
  }
  return severity === "required" ? pc.red(severity) : pc.yellow(severity);
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
    severity: "required" | "recommended";
  }[];
}

/**
 * Format validate report for console output.
 */
function formatConsoleReport(
  report: ValidateReport,
  useColors: boolean
): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;

  // Header
  lines.push(bold(cyan("Form Validation Report")));
  if (report.title) {
    lines.push(`${bold("Title:")} ${report.title}`);
  }
  lines.push("");

  // Form state
  lines.push(
    `${bold("Form State:")} ${formatState(report.form_state, useColors)}`
  );
  lines.push("");

  // Structure summary
  const structure = report.structure as {
    groupCount: number;
    fieldCount: number;
    optionCount: number;
  };
  lines.push(bold("Structure:"));
  lines.push(`  Groups: ${structure.groupCount}`);
  lines.push(`  Fields: ${structure.fieldCount}`);
  lines.push(`  Options: ${structure.optionCount}`);
  lines.push("");

  // Progress summary
  const progress = report.progress as {
    counts: {
      totalFields: number;
      requiredFields: number;
      submittedFields: number;
      completeFields: number;
      incompleteFields: number;
      invalidFields: number;
      emptyRequiredFields: number;
      emptyOptionalFields: number;
    };
  };
  lines.push(bold("Progress:"));
  lines.push(`  Total fields: ${progress.counts.totalFields}`);
  lines.push(`  Required: ${progress.counts.requiredFields}`);
  lines.push(`  Submitted: ${progress.counts.submittedFields}`);
  lines.push(`  Complete: ${progress.counts.completeFields}`);
  lines.push(`  Incomplete: ${progress.counts.incompleteFields}`);
  lines.push(`  Invalid: ${progress.counts.invalidFields}`);
  lines.push(`  Empty (required): ${progress.counts.emptyRequiredFields}`);
  lines.push(`  Empty (optional): ${progress.counts.emptyOptionalFields}`);
  lines.push("");

  // Issues
  if (report.issues.length > 0) {
    lines.push(bold(`Issues (${report.issues.length}):`));
    for (const issue of report.issues) {
      const priority = formatPriority(issue.priority, useColors);
      const severity = formatSeverity(issue.severity, useColors);
      lines.push(
        `  ${priority} ${dim(`[${issue.scope}]`)} ${dim(issue.ref)}: ${issue.message} ${dim(`(${severity})`)}`
      );
    }
  } else {
    lines.push(dim("No issues found."));
  }

  return lines.join("\n");
}

/**
 * Register the validate command.
 */
export function registerValidateCommand(program: Command): void {
  program
    .command("validate <file>")
    .description("Validate a form and display summary and issues (no form content)")
    .action(
      async (file: string, _options: Record<string, unknown>, cmd: Command) => {
        const ctx = getCommandContext(cmd);

        try {
          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, "Parsing form...");
          const form = parseForm(content);

          logVerbose(ctx, "Running validation...");
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
            formatConsoleReport(data as ValidateReport, useColors)
          );
          console.log(output);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          process.exit(1);
        }
      }
    );
}
