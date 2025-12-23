/**
 * Inspect command - Display form structure, progress, and issues.
 *
 * Outputs a comprehensive report with:
 * - Form state and title
 * - Structure summary (field counts, types)
 * - Progress summary (filled/empty counts)
 * - Full form content (groups, fields, current values)
 * - Issues sorted by priority
 */

import type { Command } from "commander";

import pc from "picocolors";

import { inspect } from "../../engine/inspect.js";
import { parseForm } from "../../engine/parse.js";
import type {
  FieldValue,
  InspectIssue,
  ProgressState,
} from "../../engine/types.js";
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
 *
 * Priority tiers and colors:
 * - P1: bold red (critical)
 * - P2: yellow (high)
 * - P3: cyan (medium)
 * - P4: blue (low)
 * - P5: dim/gray (minimal)
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

/**
 * Format a field value for console display.
 */
function formatFieldValue(
  value: FieldValue | undefined,
  useColors: boolean
): string {
  const dim = useColors ? pc.dim : (s: string) => s;
  const green = useColors ? pc.green : (s: string) => s;

  if (!value) {
    return dim("(empty)");
  }

  switch (value.kind) {
    case "string":
      return value.value ? green(`"${value.value}"`) : dim("(empty)");
    case "number":
      return value.value !== null ? green(String(value.value)) : dim("(empty)");
    case "string_list":
      return value.items.length > 0
        ? green(`[${value.items.map((i) => `"${i}"`).join(", ")}]`)
        : dim("(empty)");
    case "single_select":
      return value.selected ? green(value.selected) : dim("(none selected)");
    case "multi_select":
      return value.selected.length > 0
        ? green(`[${value.selected.join(", ")}]`)
        : dim("(none selected)");
    case "checkboxes": {
      const entries = Object.entries(value.values);
      if (entries.length === 0) {
        return dim("(no entries)");
      }
      return entries.map(([k, v]) => `${k}:${v}`).join(", ");
    }
    default:
      return dim("(unknown)");
  }
}

/** Field info for console report */
interface ReportField {
  id: string;
  kind: string;
  label: string;
  required: boolean;
}

/** Group info for console report */
interface ReportGroup {
  id: string;
  title?: string;
  children: ReportField[];
}

/** Report structure for console/JSON output */
interface InspectReport {
  title?: string;
  structure: unknown;
  progress: unknown;
  form_state: ProgressState;
  groups: ReportGroup[];
  values: Record<string, FieldValue>;
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
 * Format inspect report for console output.
 */
function formatConsoleReport(report: InspectReport, useColors: boolean): string {
  const lines: string[] = [];
  const bold = useColors ? pc.bold : (s: string) => s;
  const dim = useColors ? pc.dim : (s: string) => s;
  const cyan = useColors ? pc.cyan : (s: string) => s;
  const yellow = useColors ? pc.yellow : (s: string) => s;

  // Header
  lines.push(bold(cyan("Form Inspection Report")));
  if (report.title) {
    lines.push(`${bold("Title:")} ${report.title}`);
  }
  lines.push("");

  // Form state
  lines.push(`${bold("Form State:")} ${formatState(report.form_state, useColors)}`);
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

  // Form content (groups and fields with values)
  lines.push(bold("Form Content:"));
  for (const group of report.groups) {
    lines.push(`  ${bold(group.title ?? group.id)}`);
    for (const field of group.children) {
      const reqBadge = field.required ? yellow("[required]") : dim("[optional]");
      const value = report.values[field.id];
      const valueStr = formatFieldValue(value, useColors);
      lines.push(`    ${field.label} ${dim(`(${field.kind})`)} ${reqBadge}`);
      lines.push(`      ${dim("→")} ${valueStr}`);
    }
  }
  lines.push("");

  // Issues
  if (report.issues.length > 0) {
    lines.push(bold(`Issues (${report.issues.length}):`));
    for (const issue of report.issues) {
      const priority = formatPriority(issue.priority, useColors);
      const severity = formatSeverity(issue.severity, useColors);
      lines.push(
        `  ${priority} (${severity}) ${dim(`[${issue.scope}]`)} ${dim(issue.ref)}: ${issue.message}`
      );
    }
  } else {
    lines.push(dim("No issues found."));
  }

  return lines.join("\n");
}

/**
 * Register the inspect command.
 */
export function registerInspectCommand(program: Command): void {
  program
    .command("inspect <file>")
    .description("Inspect a form and display its structure, progress, and issues")
    .action(async (file: string, _options: Record<string, unknown>, cmd: Command) => {
      const ctx = getCommandContext(cmd);

      try {
        logVerbose(ctx, `Reading file: ${file}`);
        const content = await readFile(file);

        logVerbose(ctx, "Parsing form...");
        const form = parseForm(content);

        logVerbose(ctx, "Running inspection...");
        const result = inspect(form);

        // Build the report structure
        const report: InspectReport = {
          title: form.schema.title,
          structure: result.structureSummary,
          progress: result.progressSummary,
          form_state: result.formState,
          groups: form.schema.groups.map((group) => ({
            id: group.id,
            title: group.title,
            children: group.children.map((field) => ({
              id: field.id,
              kind: field.kind,
              label: field.label,
              required: field.required,
            })),
          })),
          values: form.valuesByFieldId,
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
          formatConsoleReport(
            data as typeof report,
            useColors
          )
        );
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });
}
