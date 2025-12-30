/**
 * CLI types - Types for CLI commands and utilities.
 *
 * This module consolidates types from:
 * - shared.ts: OutputFormat, CommandContext
 * - exportHelpers.ts: ExportResult
 * - examples/index.ts: ExampleDefinition
 */

// =============================================================================
// Output Format Types
// =============================================================================

/**
 * Output format options for CLI commands.
 * - console: auto-detect TTY, use ANSI colors if available (default)
 * - plaintext: same as console but no ANSI colors
 * - yaml: structured YAML output
 * - json: structured JSON output
 * - markform: canonical markform format (markdoc directives, for export command)
 * - markdown: plain readable markdown (no directives, for export command)
 */
export type OutputFormat = 'console' | 'plaintext' | 'yaml' | 'json' | 'markform' | 'markdown';

/**
 * Context available to all commands.
 */
export interface CommandContext {
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  format: OutputFormat;
  /** Optional forms directory override from --forms-dir CLI option */
  formsDir?: string;
}

// =============================================================================
// Export Types
// =============================================================================

/**
 * Result of multi-format export.
 *
 * Standard exports: report (.report.md), values (.yml), form (.form.md), schema (.schema.json).
 * Note: Raw markdown (.raw.md) is available via CLI `markform export --raw` but
 * is not included in standard multi-format export.
 */
export interface ExportResult {
  reportPath: string;
  yamlPath: string;
  formPath: string;
  schemaPath: string;
}

// =============================================================================
// Example Types
// =============================================================================

/**
 * Example type for distinguishing workflow modes.
 */
export type ExampleType = 'fill' | 'research';

/**
 * Example definition for the examples command.
 * Note: title and description are optional in the static definition
 * because they are loaded dynamically from the form's YAML frontmatter.
 */
export interface ExampleDefinition {
  /** Machine-readable identifier (e.g., 'simple', 'movie-research-deep'). */
  id: string;
  /** Human-readable title for menu display. Loaded from frontmatter. */
  title?: string;
  /** One-line description of the example. Loaded from frontmatter. */
  description?: string;
  /** Default output filename (e.g., 'simple.form.md'). */
  filename: string;
  /** Relative path within examples directory. */
  path: string;
  /** Example type: 'fill' for standard fill workflow, 'research' for web-search workflow. */
  type?: ExampleType;
}
