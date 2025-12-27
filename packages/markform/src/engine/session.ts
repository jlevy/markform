/**
 * Session module - parsing and serializing session transcripts.
 *
 * Session transcripts are used for golden testing and session replay.
 * They capture the full interaction between the harness and agent.
 */
import YAML from 'yaml';
import type { SessionTranscript } from './coreTypes';
import { SessionTranscriptSchema } from './coreTypes';

/**
 * Parse a session transcript from YAML string.
 *
 * Converts snake_case keys to camelCase for TypeScript consumption.
 *
 * @param yaml - YAML string containing session transcript
 * @returns Parsed and validated SessionTranscript
 * @throws Error if YAML is invalid or doesn't match schema
 */
export function parseSession(yaml: string): SessionTranscript {
  // Parse YAML
  let raw: unknown;
  try {
    raw = YAML.parse(yaml);
  } catch (err) {
    throw new Error(
      `Failed to parse session YAML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Convert snake_case to camelCase
  const converted = toCamelCaseDeep(raw);

  // Validate against schema
  const result = SessionTranscriptSchema.safeParse(converted);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Invalid session transcript: ${errors}`);
  }

  return result.data;
}

/**
 * Serialize a session transcript to YAML string.
 *
 * Converts camelCase keys to snake_case for YAML output.
 *
 * @param session - Session transcript to serialize
 * @returns YAML string
 */
export function serializeSession(session: SessionTranscript): string {
  // Convert camelCase to snake_case
  const snakeCased = toSnakeCaseDeep(session);

  // Serialize to YAML
  return YAML.stringify(snakeCased, {
    indent: 2,
    lineWidth: 0, // Don't wrap lines
  });
}

// =============================================================================
// Key Case Conversion Helpers
// =============================================================================

/**
 * Convert a string from snake_case to camelCase.
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/**
 * Convert a string from camelCase to snake_case.
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively convert all object keys from snake_case to camelCase.
 *
 * Preserves keys that are user-defined identifiers (like option IDs in
 * checkboxes `values` objects).
 *
 * @param obj - Object to convert
 * @param preserveKeys - If true, don't convert keys in this object (but still recurse into values)
 */
function toCamelCaseDeep(obj: unknown, preserveKeys = false): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCaseDeep(item, false));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    const record = obj as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      // Determine the key to use
      const resultKey = preserveKeys ? key : snakeToCamel(key);

      // Check if this is a "values" key in a set_checkboxes patch
      // The "values" object contains option IDs as keys which should be preserved
      const isCheckboxValues = key === 'values' && record.op === 'set_checkboxes';

      result[resultKey] = toCamelCaseDeep(value, isCheckboxValues);
    }
    return result;
  }

  return obj;
}

/**
 * Recursively convert all object keys from camelCase to snake_case.
 *
 * Preserves keys that are user-defined identifiers (like option IDs in
 * checkboxes `values` objects).
 *
 * @param obj - Object to convert
 * @param preserveKeys - If true, don't convert keys in this object (but still recurse into values)
 */
function toSnakeCaseDeep(obj: unknown, preserveKeys = false): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCaseDeep(item, false));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    const record = obj as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      // Determine the key to use
      const resultKey = preserveKeys ? key : camelToSnake(key);

      // Check if this is a "values" key in a set_checkboxes patch
      // The "values" object contains option IDs as keys which should be preserved
      const isCheckboxValues = key === 'values' && record.op === 'set_checkboxes';

      result[resultKey] = toSnakeCaseDeep(value, isCheckboxValues);
    }
    return result;
  }

  return obj;
}
