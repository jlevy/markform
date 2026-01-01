/**
 * Structured error types for markform.
 *
 * Provides a typed error hierarchy with context-rich information for debugging
 * and error handling by consumers.
 */

// Build-time injected version
declare const __MARKFORM_VERSION__: string;
const VERSION: string =
  typeof __MARKFORM_VERSION__ !== 'undefined' ? __MARKFORM_VERSION__ : 'development';

// =============================================================================
// Base Error Class
// =============================================================================

/**
 * Base error class for all markform errors.
 * Consumers can catch this to handle any markform error.
 */
export class MarkformError extends Error {
  override readonly name: string = 'MarkformError';
  readonly version: string = VERSION;

  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// =============================================================================
// Parse Errors
// =============================================================================

/**
 * Form definition/parsing errors.
 * Thrown when the form markdown is invalid.
 */
export class MarkformParseError extends MarkformError {
  override readonly name = 'MarkformParseError';
  /** File path or form identifier */
  readonly source?: string;
  /** Line number in source (1-indexed) */
  readonly line?: number;
  /** Column number in source (1-indexed) */
  readonly column?: number;

  constructor(
    message: string,
    context?: { source?: string; line?: number; column?: number; cause?: Error },
  ) {
    super(message, { cause: context?.cause });
    this.source = context?.source;
    this.line = context?.line;
    this.column = context?.column;
  }
}

// =============================================================================
// Patch Errors
// =============================================================================

/**
 * Single patch validation error.
 * Thrown when an LLM generates an invalid patch value.
 */
export class MarkformPatchError extends MarkformError {
  override readonly name = 'MarkformPatchError';
  /** The field ID that was targeted */
  readonly fieldId: string;
  /** The patch operation that failed */
  readonly patchOperation: string;
  /** The expected type description */
  readonly expectedType: string;
  /** The actual value that was received */
  readonly receivedValue: unknown;
  /** The type of the received value */
  readonly receivedType: string;
  /** Patch index in the batch (for batch operations) */
  readonly patchIndex?: number;

  constructor(
    message: string,
    context: {
      fieldId: string;
      patchOperation: string;
      expectedType: string;
      receivedValue: unknown;
      patchIndex?: number;
      cause?: Error;
    },
  ) {
    super(message, { cause: context.cause });
    this.fieldId = context.fieldId;
    this.patchOperation = context.patchOperation;
    this.expectedType = context.expectedType;
    this.receivedValue = context.receivedValue;
    this.patchIndex = context.patchIndex;
    this.receivedType =
      context.receivedValue === null
        ? 'null'
        : Array.isArray(context.receivedValue)
          ? 'array'
          : typeof context.receivedValue;
  }
}

/**
 * Multiple validation errors in a single operation.
 * Thrown when multiple patches fail validation.
 */
export class MarkformValidationError extends MarkformError {
  override readonly name = 'MarkformValidationError';
  /** Individual patch errors */
  readonly issues: MarkformPatchError[];

  constructor(issues: MarkformPatchError[]) {
    const summary =
      issues.length === 1
        ? issues[0]!.message
        : `${issues.length} validation errors: ${issues.map((i) => i.fieldId).join(', ')}`;
    super(summary);
    this.issues = issues;
  }

  /** Get all affected field IDs */
  get fieldIds(): string[] {
    return this.issues.map((i) => i.fieldId);
  }
}

// =============================================================================
// LLM Errors
// =============================================================================

/**
 * LLM/API errors.
 * Thrown for rate limits, timeouts, invalid responses, etc.
 */
export class MarkformLlmError extends MarkformError {
  override readonly name = 'MarkformLlmError';
  /** LLM provider (e.g., 'anthropic', 'openai') */
  readonly provider?: string;
  /** Model identifier */
  readonly model?: string;
  /** HTTP status code if applicable */
  readonly statusCode?: number;
  /** Whether this error is retryable */
  readonly retryable: boolean;

  constructor(
    message: string,
    context: {
      provider?: string;
      model?: string;
      statusCode?: number;
      retryable?: boolean;
      cause?: Error;
    },
  ) {
    super(message, { cause: context.cause });
    this.provider = context.provider;
    this.model = context.model;
    this.statusCode = context.statusCode;
    this.retryable = context.retryable ?? false;
  }
}

// =============================================================================
// Configuration Errors
// =============================================================================

/**
 * Configuration errors.
 * Thrown when invalid options are passed to fillForm, etc.
 */
export class MarkformConfigError extends MarkformError {
  override readonly name = 'MarkformConfigError';
  /** The configuration option that was invalid */
  readonly option: string;
  /** Expected type or value description */
  readonly expectedType: string;
  /** The actual value that was received */
  readonly receivedValue: unknown;

  constructor(
    message: string,
    context: { option: string; expectedType: string; receivedValue: unknown },
  ) {
    super(message);
    this.option = context.option;
    this.expectedType = context.expectedType;
    this.receivedValue = context.receivedValue;
  }
}

// =============================================================================
// Form Abort Error
// =============================================================================

/**
 * Form abort error.
 * Thrown when a form is explicitly aborted via abort_form patch.
 */
export class MarkformAbortError extends MarkformError {
  override readonly name = 'MarkformAbortError';
  /** The reason for aborting */
  readonly reason: string;
  /** Field ID that triggered the abort, if applicable */
  readonly fieldId?: string;

  constructor(reason: string, fieldId?: string) {
    super(`Form aborted: ${reason}`);
    this.reason = reason;
    this.fieldId = fieldId;
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an error is any markform error.
 * Works in environments where instanceof might not be reliable (bundlers, etc.).
 */
export function isMarkformError(error: unknown): error is MarkformError {
  return error instanceof Error && 'version' in error && error.name.startsWith('Markform');
}

/** Check if an error is a parse error */
export function isParseError(error: unknown): error is MarkformParseError {
  return isMarkformError(error) && error.name === 'MarkformParseError';
}

/** Check if an error is a single patch error */
export function isPatchError(error: unknown): error is MarkformPatchError {
  return isMarkformError(error) && error.name === 'MarkformPatchError';
}

/** Check if an error is a validation error (multiple patches) */
export function isValidationError(error: unknown): error is MarkformValidationError {
  return isMarkformError(error) && error.name === 'MarkformValidationError';
}

/** Check if an error is an LLM/API error */
export function isLlmError(error: unknown): error is MarkformLlmError {
  return isMarkformError(error) && error.name === 'MarkformLlmError';
}

/** Check if an error is a configuration error */
export function isConfigError(error: unknown): error is MarkformConfigError {
  return isMarkformError(error) && error.name === 'MarkformConfigError';
}

/** Check if an error is a form abort error */
export function isAbortError(error: unknown): error is MarkformAbortError {
  return isMarkformError(error) && error.name === 'MarkformAbortError';
}

/** Check if an error is retryable (currently only LLM errors) */
export function isRetryableError(error: unknown): boolean {
  return isLlmError(error) && error.retryable;
}
