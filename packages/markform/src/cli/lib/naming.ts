/**
 * Naming convention utilities for JSON/YAML output.
 *
 * Converts between camelCase (TypeScript internal) and snake_case (JSON/YAML output).
 */

/**
 * Convert a camelCase string to snake_case.
 *
 * @example
 * toSnakeCase("fieldCount") // "field_count"
 * toSnakeCase("parentFieldId") // "parent_field_id"
 * toSnakeCase("already_snake") // "already_snake"
 */
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * Convert a snake_case string to camelCase.
 *
 * @example
 * toCamelCase("field_count") // "fieldCount"
 * toCamelCase("parent_field_id") // "parentFieldId"
 * toCamelCase("alreadyCamel") // "alreadyCamel"
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Recursively convert all object keys from camelCase to snake_case.
 *
 * Handles nested objects and arrays. Primitives are returned unchanged.
 */
export function convertKeysToSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnakeCase(key);
      result[snakeKey] = convertKeysToSnakeCase(value);
    }
    return result;
  }

  return obj;
}

/**
 * Recursively convert all object keys from snake_case to camelCase.
 *
 * Handles nested objects and arrays. Primitives are returned unchanged.
 */
export function convertKeysToCamelCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = toCamelCase(key);
      result[camelKey] = convertKeysToCamelCase(value);
    }
    return result;
  }

  return obj;
}
