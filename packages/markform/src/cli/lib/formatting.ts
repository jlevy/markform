/**
 * Color and output formatting utilities for CLI.
 */

import pc from 'picocolors';

import type { InspectIssue, IssueReason } from '../../engine/coreTypes.js';
import type { FormDisplayInfo } from './cliTypes.js';

/**
 * Semantic color helpers for consistent CLI output.
 */
export const colors = {
  success: (msg: string) => pc.green(msg),
  error: (msg: string) => pc.red(msg),
  warn: (msg: string) => pc.yellow(msg),
  info: (msg: string) => pc.cyan(msg),
  dim: (msg: string) => pc.dim(msg),
  bold: (msg: string) => pc.bold(msg),
  title: (msg: string) => pc.bold(pc.cyan(msg)),
};

/**
 * Format a duration in seconds.
 */
export function formatDuration(ms: number): string {
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Format a timing message.
 */
export function formatTiming(label: string, durationMs: number): string {
  return pc.cyan(`⏰ ${label}: ${formatDuration(durationMs)}`);
}

/**
 * Format a count with label.
 */
export function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

/**
 * Format a state badge.
 */
export function formatState(state: string): string {
  switch (state) {
    case 'complete':
      return pc.green('✓ complete');
    case 'incomplete':
      return pc.yellow('○ incomplete');
    case 'empty':
      return pc.dim('◌ empty');
    case 'invalid':
      return pc.red('✗ invalid');
    default:
      return state;
  }
}

/**
 * Format a priority badge.
 *
 * Priority tiers and colors:
 * - P1: bold red (critical)
 * - P2: yellow (high)
 * - P3: cyan (medium)
 * - P4: blue (low)
 * - P5: dim/gray (minimal)
 */
export function formatPriority(priority: number): string {
  const label = `P${priority}`;
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
 * Get a short status word from an issue reason.
 */
export function issueReasonToStatus(reason: IssueReason): string {
  switch (reason) {
    case 'required_missing':
      return 'missing';
    case 'validation_error':
      return 'invalid';
    case 'checkbox_incomplete':
      return 'incomplete';
    case 'min_items_not_met':
      return 'too-few';
    case 'optional_empty':
      return 'empty';
    default:
      return 'issue';
  }
}

/**
 * Format a single issue as "fieldId (status)".
 */
export function formatIssueBrief(issue: InspectIssue): string {
  const status = issueReasonToStatus(issue.reason);
  return `${issue.ref} (${status})`;
}

/**
 * Format a list of issues as a compact comma-separated summary.
 * Example: "company_name (missing), revenue (invalid), tasks (incomplete)"
 */
export function formatIssuesSummary(issues: InspectIssue[]): string {
  return issues.map(formatIssueBrief).join(', ');
}

/**
 * Format issues for turn logging - shows count and brief field list.
 * Example: "5 issue(s): company_name (missing), revenue (invalid), ..."
 */
export function formatTurnIssues(issues: InspectIssue[], maxShow = 5): string {
  const count = issues.length;
  if (count === 0) {
    return '0 issues';
  }

  const shown = issues.slice(0, maxShow);
  const summary = shown.map(formatIssueBrief).join(', ');
  const suffix = count > maxShow ? `, +${count - maxShow} more` : '';

  return `${count} issue(s): ${summary}${suffix}`;
}

// =============================================================================
// Form Display Formatting
// =============================================================================

/**
 * Format form info for menu label display.
 * Format: "filename - Title [runMode]"
 * Example: "movie-deep-research.form.md - Movie Deep Research [research]"
 */
export function formatFormLabel(info: FormDisplayInfo): string {
  const titlePart = info.title ? ` - ${info.title}` : '';
  const runModePart = info.runMode ? ` [${info.runMode}]` : '';
  return `${info.filename}${titlePart}${runModePart}`;
}

/**
 * Format form info for menu hint display.
 * Returns description without parentheses (prompts library adds them).
 */
export function formatFormHint(info: FormDisplayInfo): string {
  return info.description ?? '';
}

/**
 * Format form info for log line (e.g., after copying).
 * Format: "filename - Title" (dimmed title)
 * Example: "✓ movie-deep-research.form.md - Movie Deep Research"
 */
export function formatFormLogLine(info: FormDisplayInfo, prefix: string): string {
  const titlePart = info.title ? ` - ${info.title}` : '';
  return `${prefix} ${info.filename}${pc.dim(titlePart)}`;
}
