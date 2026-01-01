/**
 * Global settings and constants for Markform.
 *
 * This file consolidates non-changing default values that were previously
 * scattered across the codebase. These are NOT runtime configurable - they
 * are compile-time constants.
 */

import type { FieldPriorityLevel } from './engine/coreTypes.js';
import { MarkformConfigError } from './errors.js';

// =============================================================================
// Spec Version Constants
// =============================================================================

/**
 * The current Markform spec version in full notation (e.g., "MF/0.1").
 * This is distinct from npm package version and tracks the format that
 * .form.md files conform to.
 */
export const MF_SPEC_VERSION = 'MF/0.1';

/**
 * The numeric portion of the spec version (e.g., "0.1").
 * Used when only the version number is needed.
 */
export const MF_SPEC_VERSION_NUMBER = '0.1';

// =============================================================================
// Role System Constants
// =============================================================================

/** Default role for fields without explicit role attribute */
export const AGENT_ROLE = 'agent' as const;

/** Role for human-filled fields in interactive mode */
export const USER_ROLE = 'user' as const;

/** Default roles list for forms without explicit roles in frontmatter */
export const DEFAULT_ROLES: readonly [typeof USER_ROLE, typeof AGENT_ROLE] = [
  USER_ROLE,
  AGENT_ROLE,
] as const;

/** Default instructions per role (used when form doesn't specify role_instructions) */
export const DEFAULT_ROLE_INSTRUCTIONS: Record<string, string> = {
  [USER_ROLE]: 'Fill in the fields you have direct knowledge of.',
  [AGENT_ROLE]: 'Complete the remaining fields based on the provided context.',
};

/** Pattern for valid role names: starts with letter, alphanumeric with underscores/hyphens */
export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

/** Reserved role identifiers (not allowed as role names in forms) */
export const RESERVED_ROLE_NAMES = ['*'] as const;

/**
 * Normalize a role name: trim whitespace, lowercase.
 * Throws if invalid pattern or reserved name.
 */
export function normalizeRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (!ROLE_NAME_PATTERN.test(normalized)) {
    throw new MarkformConfigError(
      `Invalid role name: "${role}" (must match pattern: start with letter, alphanumeric with underscores/hyphens)`,
      { option: 'role', expectedType: 'valid role name pattern', receivedValue: role },
    );
  }
  if ((RESERVED_ROLE_NAMES as readonly string[]).includes(normalized)) {
    throw new MarkformConfigError(`Reserved role name: "${role}"`, {
      option: 'role',
      expectedType: 'non-reserved role name',
      receivedValue: role,
    });
  }
  return normalized;
}

/**
 * Parse --roles CLI flag value into normalized role array.
 * Handles comma-separated values and '*' wildcard.
 */
export function parseRolesFlag(raw: string): string[] {
  if (raw === '*') {
    return ['*'];
  }
  return raw.split(',').map((r) => normalizeRole(r));
}

// =============================================================================
// Field Defaults
// =============================================================================

/**
 * The default priority level for fields when not explicitly specified.
 * Used by the parser to set default values and by the serializer to
 * determine whether to emit the priority attribute.
 */
export const DEFAULT_PRIORITY: FieldPriorityLevel = 'medium';

// =============================================================================
// CLI Defaults
// =============================================================================

/**
 * Default forms directory for CLI output (relative to cwd).
 * Commands write form outputs here to avoid cluttering the workspace.
 */
export const DEFAULT_FORMS_DIR = './forms';

/**
 * Maximum forms to display in 'markform run' menu.
 * Additional forms are not shown but can be run directly by path.
 */
export const MAX_FORMS_IN_MENU = 30;

/**
 * The default port for the serve command.
 */
export const DEFAULT_PORT = 3344;

// =============================================================================
// Harness Defaults
// =============================================================================

/**
 * Default maximum turns for the fill harness.
 * Prevents runaway loops during agent execution.
 */
export const DEFAULT_MAX_TURNS = 100;

/**
 * Default maximum patches per turn.
 */
export const DEFAULT_MAX_PATCHES_PER_TURN = 20;

/**
 * Default maximum issues to show per turn.
 * Note: Renamed from DEFAULT_MAX_ISSUES for naming consistency with other per-turn limits.
 */
export const DEFAULT_MAX_ISSUES_PER_TURN = 10;

// =============================================================================
// Research Defaults
// =============================================================================

/**
 * Default maximum issues to show per turn in research mode.
 * Lower than general fill to keep research responses focused.
 */
export const DEFAULT_RESEARCH_MAX_ISSUES_PER_TURN = 5;

/**
 * Default maximum patches per turn in research mode.
 */
export const DEFAULT_RESEARCH_MAX_PATCHES_PER_TURN = 10;

// =============================================================================
// File Extension Constants
// =============================================================================

/**
 * Export format extensions used by the export command and exportMultiFormat.
 * These are the primary output formats when exporting forms.
 */
export const EXPORT_EXTENSIONS = {
  /** Canonical markform files with markdoc directives */
  form: '.form.md',
  /** Raw markdown export (no directives) */
  raw: '.raw.md',
  /** YAML values export */
  yaml: '.yml',
  /** JSON values export */
  json: '.json',
} as const;

/**
 * Report extension - generated by the report command.
 * Separate from exports as it's a filtered human-readable output.
 */
export const REPORT_EXTENSION = '.report.md' as const;

/**
 * Schema extension - generated JSON Schema for form structure.
 * Used for validation, code generation, and LLM tooling.
 */
export const SCHEMA_EXTENSION = '.schema.json' as const;

/**
 * All recognized markform file extensions.
 * Combines export formats with report and schema formats.
 */
export const ALL_EXTENSIONS = {
  ...EXPORT_EXTENSIONS,
  report: REPORT_EXTENSION,
  schema: SCHEMA_EXTENSION,
} as const;

/** Union type of recognized file types for routing and rendering */
export type FileType = 'form' | 'raw' | 'report' | 'yaml' | 'json' | 'schema' | 'unknown';

/**
 * Detect file type from path based on extension.
 * Used by serve command to dispatch to appropriate renderer.
 */
export function detectFileType(filePath: string): FileType {
  if (filePath.endsWith(ALL_EXTENSIONS.form)) return 'form';
  if (filePath.endsWith(ALL_EXTENSIONS.raw)) return 'raw';
  if (filePath.endsWith(ALL_EXTENSIONS.report)) return 'report';
  if (filePath.endsWith(ALL_EXTENSIONS.yaml)) return 'yaml';
  if (filePath.endsWith(ALL_EXTENSIONS.schema)) return 'schema';
  if (filePath.endsWith(ALL_EXTENSIONS.json)) return 'json';
  // Generic .md files are treated as raw markdown
  if (filePath.endsWith('.md')) return 'raw';
  return 'unknown';
}

/**
 * Derive export path by replacing any known extension with the target format.
 * Only works with export formats (form, raw, yaml, json), not report.
 */
export function deriveExportPath(basePath: string, format: keyof typeof EXPORT_EXTENSIONS): string {
  let base = basePath;
  // Remove any known extension first
  for (const ext of Object.values(ALL_EXTENSIONS)) {
    if (base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
      break;
    }
  }
  return base + EXPORT_EXTENSIONS[format];
}

/**
 * Derive report path from any markform file path.
 * Strips known extensions and appends .report.md.
 */
export function deriveReportPath(basePath: string): string {
  let base = basePath;
  for (const ext of Object.values(ALL_EXTENSIONS)) {
    if (base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
      break;
    }
  }
  return base + REPORT_EXTENSION;
}

/**
 * Derive schema path from any markform file path.
 * Strips known extensions and appends .schema.json.
 */
export function deriveSchemaPath(basePath: string): string {
  let base = basePath;
  for (const ext of Object.values(ALL_EXTENSIONS)) {
    if (base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
      break;
    }
  }
  return base + SCHEMA_EXTENSION;
}

// =============================================================================
// LLM Settings (re-exported from llms.ts for backwards compatibility)
// =============================================================================

export {
  SUGGESTED_LLMS,
  formatSuggestedLlms,
  WEB_SEARCH_CONFIG,
  hasWebSearchSupport,
  getWebSearchConfig,
  type WebSearchConfig,
} from './llms.js';
