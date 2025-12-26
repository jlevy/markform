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
  AnswerState,
  Note,
} from "../../engine/coreTypes.js";
import { parseRolesFlag } from "../../settings.js";
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
 * Format answer state badge for console output.
 */
function formatAnswerState(state: AnswerState, useColors: boolean): string {
  const badges: Record<AnswerState, [string, (s: string) => string]> = {
    answered: ["answered", pc.green],
    skipped: ["skipped", pc.yellow],
    aborted: ["aborted", pc.red],
    unanswered: ["unanswered", pc.dim],
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
    case "url":
      return value.value ? green(`"${value.value}"`) : dim("(empty)");
    case "url_list":
      return value.items.length > 0
        ? green(`[${value.items.map((i) => `"${i}"`).join(", ")}]`)
        : dim("(empty)");
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
  role: string;
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
  notes: Note[];
  issues: {
    ref: string;
    scope: string;
    reason: string;
    message: string;
    priority: number;
    severity: "required" | "recommended";
    blockedBy?: string;
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
      // Dimension 1: AnswerState
      unansweredFields: number;
      answeredFields: number;
      skippedFields: number;
      abortedFields: number;
      // Dimension 2: Validity
      validFields: number;
      invalidFields: number;
      // Dimension 3: Value presence
      emptyFields: number;
      filledFields: number;
      // Derived
      emptyRequiredFields: number;
      totalNotes: number;
    };
    fields: Record<
      string,
      {
        answerState: AnswerState;
        hasNotes: boolean;
        noteCount: number;
      }
    >;
  };
  lines.push(bold("Progress:"));
  lines.push(`  Total fields: ${progress.counts.totalFields}`);
  lines.push(`  Required: ${progress.counts.requiredFields}`);
  lines.push(`  AnswerState: answered=${progress.counts.answeredFields}, skipped=${progress.counts.skippedFields}, aborted=${progress.counts.abortedFields}, unanswered=${progress.counts.unansweredFields}`);
  lines.push(`  Validity: valid=${progress.counts.validFields}, invalid=${progress.counts.invalidFields}`);
  lines.push(`  Value: filled=${progress.counts.filledFields}, empty=${progress.counts.emptyFields}`);
  lines.push(`  Empty required: ${progress.counts.emptyRequiredFields}`);
  lines.push(`  Total notes: ${progress.counts.totalNotes}`);
  lines.push("");

  // Form content (groups and fields with values)
  lines.push(bold("Form Content:"));
  for (const group of report.groups) {
    lines.push(`  ${bold(group.title ?? group.id)}`);
    for (const field of group.children) {
      const reqBadge = field.required ? yellow("[required]") : dim("[optional]");
      const roleBadge = field.role !== "agent" ? cyan(`[${field.role}]`) : "";
      const fieldProgress = progress.fields[field.id];
      const responseStateBadge = fieldProgress
        ? `[${formatAnswerState(fieldProgress.answerState, useColors)}]`
        : "";
      const notesBadge = fieldProgress?.hasNotes
        ? cyan(`[${fieldProgress.noteCount} note${fieldProgress.noteCount > 1 ? "s" : ""}]`)
        : "";
      const value = report.values[field.id];
      const valueStr = formatFieldValue(value, useColors);
      lines.push(`    ${field.label} ${dim(`(${field.kind})`)} ${reqBadge} ${roleBadge} ${responseStateBadge} ${notesBadge}`.trim());
      lines.push(`      ${dim("→")} ${valueStr}`);
    }
  }
  lines.push("");

  // Notes summary
  if (report.notes.length > 0) {
    lines.push(bold(`Notes (${report.notes.length}):`));
    for (const note of report.notes) {
      const roleBadge = cyan(`[${note.role}]`);
      const refLabel = dim(`${note.ref}:`);
      lines.push(`  ${note.id} ${roleBadge} ${refLabel} ${note.text}`.trim());
    }
    lines.push("");
  }

  // Issues
  if (report.issues.length > 0) {
    lines.push(bold(`Issues (${report.issues.length}):`));
    for (const issue of report.issues) {
      const priority = formatPriority(issue.priority, useColors);
      const severity = formatSeverity(issue.severity, useColors);
      const blockedInfo = issue.blockedBy
        ? ` ${dim(`(blocked by: ${issue.blockedBy})`)}`
        : "";
      lines.push(
        `  ${priority} (${severity}) ${dim(`[${issue.scope}]`)} ${dim(issue.ref)}: ${issue.message}${blockedInfo}`
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
    .option(
      "--roles <roles>",
      "Filter issues by target roles (comma-separated, or '*' for all; default: all)"
    )
    .action(
      async (
        file: string,
        options: { roles?: string },
        cmd: Command
      ) => {
        const ctx = getCommandContext(cmd);

        try {
          // Parse and validate --roles
          let targetRoles: string[] | undefined;
          if (options.roles) {
            try {
              targetRoles = parseRolesFlag(options.roles);
              // '*' means all roles - pass undefined to not filter
              if (targetRoles.includes("*")) {
                targetRoles = undefined;
              }
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              logError(`Invalid --roles: ${message}`);
              process.exit(1);
            }
          }

          logVerbose(ctx, `Reading file: ${file}`);
          const content = await readFile(file);

          logVerbose(ctx, "Parsing form...");
          const form = parseForm(content);

          logVerbose(ctx, "Running inspection...");
          const result = inspect(form, { targetRoles });

          // Extract values from responses for report
          const values: Record<string, FieldValue> = {};
          for (const [fieldId, response] of Object.entries(form.responsesByFieldId)) {
            if (response.state === "answered" && response.value) {
              values[fieldId] = response.value;
            }
          }

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
                role: field.role,
              })),
            })),
            values,
            notes: form.notes,
            issues: result.issues.map((issue: InspectIssue) => ({
              ref: issue.ref,
              scope: issue.scope,
              reason: issue.reason,
              message: issue.message,
              priority: issue.priority,
              severity: issue.severity,
              blockedBy: issue.blockedBy,
            })),
          };

          // Output in requested format
          const output = formatOutput(ctx, report, (data, useColors) =>
            formatConsoleReport(data as typeof report, useColors)
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
