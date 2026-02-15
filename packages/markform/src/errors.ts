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
  /** Raw response body from the API (for debugging) */
  readonly responseBody?: string;

  constructor(
    message: string,
    context: {
      provider?: string;
      model?: string;
      statusCode?: number;
      retryable?: boolean;
      responseBody?: string;
      cause?: Error;
    },
  ) {
    super(message, { cause: context.cause });
    this.provider = context.provider;
    this.model = context.model;
    this.statusCode = context.statusCode;
    this.retryable = context.retryable ?? false;
    this.responseBody = context.responseBody;
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

// =============================================================================
// API Error Wrapping
// =============================================================================

/**
 * Check if an error looks like a Vercel AI SDK APICallError.
 * These errors have statusCode, responseBody, and isRetryable properties.
 */
function isApiCallError(
  error: unknown,
): error is Error & { statusCode?: number; responseBody?: string; isRetryable?: boolean } {
  return (
    error instanceof Error &&
    ('statusCode' in error || 'responseBody' in error || 'isRetryable' in error)
  );
}

/**
 * Generate troubleshooting hints based on error status and message.
 */
function getTroubleshootingHints(
  statusCode: number | undefined,
  message: string,
  provider: string,
  model: string,
): string[] {
  const hints: string[] = [];
  const lowerMessage = message.toLowerCase();

  // Status-code specific hints
  if (statusCode === 404 || lowerMessage.includes('not found')) {
    hints.push(`Check if model "${model}" exists and is available for the ${provider} API`);
    hints.push('Verify the model ID is spelled correctly (check provider documentation)');
    hints.push('Some models require specific API tier access or waitlist approval');
  } else if (statusCode === 403 || lowerMessage.includes('forbidden')) {
    hints.push(`Your API key may not have permission to use model "${model}"`);
    hints.push('Check that your API key has the required access tier/plan');
    hints.push('Some preview models require explicit opt-in via provider dashboard');
  } else if (
    statusCode === 401 ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('invalid api key')
  ) {
    hints.push('Verify your API key is correct and not expired');
    hints.push(`Check that the correct env var is set (e.g., ${provider.toUpperCase()}_API_KEY)`);
  } else if (statusCode === 429 || lowerMessage.includes('rate limit')) {
    hints.push('You have hit the rate limit - wait a moment and retry');
    hints.push('Consider using a model with higher rate limits or upgrading your plan');
  } else if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
    hints.push('The API provider is experiencing issues - retry in a few minutes');
    hints.push('Check the provider status page for any ongoing incidents');
  }

  // Generic hints if no specific match
  if (hints.length === 0) {
    hints.push('Check your API key and model availability');
    hints.push(`Run "markform models" to see available models for ${provider}`);
  }

  return hints;
}

/**
 * Wrap an API error with rich context for debugging.
 *
 * Extracts details from Vercel AI SDK APICallError and creates a MarkformLlmError
 * with actionable information including model ID, status code, response body, and
 * troubleshooting hints.
 *
 * @param error - The original error from the API call
 * @param provider - The LLM provider name (e.g., 'anthropic', 'openai')
 * @param model - The model identifier that was requested
 * @returns A MarkformLlmError with rich context
 */
export function wrapApiError(error: unknown, provider: string, model: string): MarkformLlmError {
  // Extract details from APICallError if available
  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let retryable = false;
  let originalMessage = 'Unknown error';

  if (isApiCallError(error)) {
    statusCode = error.statusCode;
    responseBody = error.responseBody;
    retryable = error.isRetryable ?? false;
    originalMessage = error.message;
  } else if (error instanceof Error) {
    originalMessage = error.message;
  } else {
    originalMessage = String(error);
  }

  // Build a rich error message
  const parts: string[] = [];
  parts.push(`API call failed for model "${provider}/${model}"`);

  if (statusCode !== undefined) {
    parts.push(`HTTP ${statusCode}`);
  }

  parts.push(originalMessage);

  // Add response body hint if available and not too long
  if (responseBody) {
    const truncated = responseBody.length > 200 ? responseBody.slice(0, 200) + '...' : responseBody;
    parts.push(`Response: ${truncated}`);
  }

  // Add troubleshooting hints
  const hints = getTroubleshootingHints(statusCode, originalMessage, provider, model);
  if (hints.length > 0) {
    parts.push(`\n\nTroubleshooting:\n  - ${hints.join('\n  - ')}`);
  }

  return new MarkformLlmError(parts.join(': '), {
    provider,
    model,
    statusCode,
    retryable,
    responseBody,
    cause: error instanceof Error ? error : undefined,
  });
}

// =============================================================================
// Backward Compatibility Aliases
// =============================================================================

/**
 * Alias for MarkformParseError.
 * @deprecated Use MarkformParseError instead. ParseError will be removed in a future version.
 */
export const ParseError = MarkformParseError;
