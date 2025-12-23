/**
 * Global settings and constants for Markform.
 *
 * This file consolidates non-changing default values that were previously
 * scattered across the codebase. These are NOT runtime configurable - they
 * are compile-time constants.
 */

import type { FieldPriorityLevel } from "./engine/types.js";

// =============================================================================
// Field Defaults
// =============================================================================

/**
 * The default priority level for fields when not explicitly specified.
 * Used by the parser to set default values and by the serializer to
 * determine whether to emit the priority attribute.
 */
export const DEFAULT_PRIORITY: FieldPriorityLevel = "medium";

// =============================================================================
// CLI Defaults
// =============================================================================

/**
 * The default port for the serve command.
 */
export const DEFAULT_PORT = 3344;
