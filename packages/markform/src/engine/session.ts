/**
 * Session module - parsing and serializing session transcripts.
 *
 * Session transcripts are used for golden testing and session replay.
 * They capture the full interaction between the harness and agent.
 */
import YAML from "yaml";
import type { SessionTranscript } from "./types";
import { SessionTranscriptSchema } from "./types";

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
      `Failed to parse session YAML: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Convert snake_case to camelCase
  const converted = toCamelCaseDeep(raw);

  // Validate against schema
  const result = SessionTranscriptSchema.safeParse(converted);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
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
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a string from camelCase to snake_case.
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively convert all object keys from snake_case to camelCase.
 */
function toCamelCaseDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toCamelCaseDeep);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = toCamelCaseDeep(value);
    }
    return result;
  }

  return obj;
}

/**
 * Recursively convert all object keys from camelCase to snake_case.
 */
function toSnakeCaseDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCaseDeep);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = toSnakeCaseDeep(value);
    }
    return result;
  }

  return obj;
}
