---
close_reason: null
closed_at: 2026-01-01T22:46:25.084Z
created_at: 2026-01-01T21:17:52.427Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.420Z
    original_id: markform-506
id: is-01kg3x1bva1fvtqqg8ywjm8s08
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Implement structured error handling with typed error hierarchy
type: is
updated_at: 2026-01-01T22:46:25.084Z
version: 1
---
## Problem Statement

markform currently throws generic JavaScript errors that don't distinguish library errors from user errors, making debugging difficult for consumers. Current errors lack:

1. **Clear categorization** - validation vs runtime vs configuration vs LLM errors
2. **Structured context** - field IDs, patch details, form state, model info
3. **Recovery hints** - what the consumer can do about it
4. **Version info** - which markform version threw the error

Example of current poor error:
```
Error: Cannot read properties of undefined (reading 'length')
```

vs what it should be:
```
MarkformPatchError: Checkboxes field 'business_model' requires Record<string, boolean>, got undefined
  fieldId: 'business_model'
  expectedType: 'Record<string, boolean>'
  receivedValue: undefined
  patchOperation: 'set_checkboxes'
  version: '0.1.9'
```

## Proposed Error Hierarchy

Following patterns from well-designed libraries (zod, prisma, axios):

```typescript
// src/errors.ts

/**
 * Base error class for all markform errors.
 * Consumers can catch this to handle any markform error.
 */
export class MarkformError extends Error {
  readonly name = 'MarkformError';
  readonly version: string = VERSION; // From package

  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Form definition/parsing errors.
 * Thrown when the form markdown is invalid.
 */
export class MarkformParseError extends MarkformError {
  readonly name = 'MarkformParseError';
  readonly source?: string;  // File path or form identifier
  readonly line?: number;    // Line number in source
  readonly column?: number;  // Column number in source

  constructor(
    message: string,
    context?: { source?: string; line?: number; column?: number; cause?: Error }
  ) {
    super(message, { cause: context?.cause });
    this.source = context?.source;
    this.line = context?.line;
    this.column = context?.column;
  }
}

/**
 * Single patch validation error.
 * Thrown when an LLM generates an invalid patch value.
 */
export class MarkformPatchError extends MarkformError {
  readonly name = 'MarkformPatchError';
  readonly fieldId: string;
  readonly patchOperation: string;
  readonly expectedType: string;
  readonly receivedValue: unknown;
  readonly receivedType: string;

  constructor(
    message: string,
    context: {
      fieldId: string;
      patchOperation: string;
      expectedType: string;
      receivedValue: unknown;
      cause?: Error;
    }
  ) {
    super(message, { cause: context.cause });
    this.fieldId = context.fieldId;
    this.patchOperation = context.patchOperation;
    this.expectedType = context.expectedType;
    this.receivedValue = context.receivedValue;
    this.receivedType = context.receivedValue === null 
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
  readonly name = 'MarkformValidationError';
  readonly issues: MarkformPatchError[];

  constructor(issues: MarkformPatchError[]) {
    const summary = issues.length === 1
      ? issues[0].message
      : `${issues.length} validation errors: ${issues.map(i => i.fieldId).join(', ')}`;
    super(summary);
    this.issues = issues;
  }

  /** Get all affected field IDs */
  get fieldIds(): string[] {
    return this.issues.map(i => i.fieldId);
  }
}

/**
 * LLM/API errors.
 * Thrown for rate limits, timeouts, invalid responses, etc.
 */
export class MarkformLlmError extends MarkformError {
  readonly name = 'MarkformLlmError';
  readonly provider?: string;
  readonly model?: string;
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    context: {
      provider?: string;
      model?: string;
      statusCode?: number;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message, { cause: context.cause });
    this.provider = context.provider;
    this.model = context.model;
    this.statusCode = context.statusCode;
    this.retryable = context.retryable ?? false;
  }
}

/**
 * Configuration errors.
 * Thrown when invalid options are passed to fillForm, etc.
 */
export class MarkformConfigError extends MarkformError {
  readonly name = 'MarkformConfigError';
  readonly option: string;
  readonly expectedType: string;
  readonly receivedValue: unknown;

  constructor(
    message: string,
    context: { option: string; expectedType: string; receivedValue: unknown }
  ) {
    super(message);
    Object.assign(this, context);
  }
}

/**
 * Form abort error.
 * Thrown when a form is explicitly aborted via abort_form patch.
 */
export class MarkformAbortError extends MarkformError {
  readonly name = 'MarkformAbortError';
  readonly reason: string;
  readonly fieldId?: string;

  constructor(reason: string, fieldId?: string) {
    super(`Form aborted: ${reason}`);
    this.reason = reason;
    this.fieldId = fieldId;
  }
}
```

## Type Guards

```typescript
// For environments where instanceof doesn't work reliably (bundlers, etc.)

export function isMarkformError(error: unknown): error is MarkformError {
  return (
    error instanceof Error &&
    'version' in error &&
    error.name.startsWith('Markform')
  );
}

export function isPatchError(error: unknown): error is MarkformPatchError {
  return isMarkformError(error) && error.name === 'MarkformPatchError';
}

export function isValidationError(error: unknown): error is MarkformValidationError {
  return isMarkformError(error) && error.name === 'MarkformValidationError';
}

export function isLlmError(error: unknown): error is MarkformLlmError {
  return isMarkformError(error) && error.name === 'MarkformLlmError';
}

export function isRetryableError(error: unknown): boolean {
  return isLlmError(error) && error.retryable;
}
```

## Usage in apply.ts

```typescript
// Before (crashes with generic error)
case 'set_checkboxes': {
  const validOptions = new Set(field.options.map((o) => o.id));
  for (const optId of Object.keys(patch.values)) {  // CRASH if undefined
    // ...
  }
}

// After (throws descriptive error)
case 'set_checkboxes': {
  if (patch.values === undefined || patch.values === null) {
    throw new MarkformPatchError(
      `Checkboxes field '${fieldId}' requires values object, got ${patch.values === null ? 'null' : 'undefined'}`,
      {
        fieldId,
        patchOperation: 'set_checkboxes',
        expectedType: 'Record<OptionId, CheckboxValue>',
        receivedValue: patch.values,
      }
    );
  }
  
  if (typeof patch.values !== 'object' || Array.isArray(patch.values)) {
    throw new MarkformPatchError(
      `Checkboxes field '${fieldId}' requires values object, got ${Array.isArray(patch.values) ? 'array' : typeof patch.values}`,
      {
        fieldId,
        patchOperation: 'set_checkboxes',
        expectedType: 'Record<OptionId, CheckboxValue>',
        receivedValue: patch.values,
      }
    );
  }
  
  // Now safe to iterate
  const validOptions = new Set(field.options.map((o) => o.id));
  for (const optId of Object.keys(patch.values)) {
    // ...
  }
}
```

## Consumer Usage Examples

### Typed catch blocks

```typescript
import {
  MarkformError,
  MarkformPatchError,
  MarkformLlmError,
  MarkformValidationError,
} from 'markform';

try {
  await fillForm(options);
} catch (error) {
  if (error instanceof MarkformValidationError) {
    // Multiple patches failed - log each one
    for (const issue of error.issues) {
      logger.warn(`Invalid patch for ${issue.fieldId}`, {
        expected: issue.expectedType,
        received: issue.receivedValue,
      });
    }
    // Could skip invalid patches and continue
  } else if (error instanceof MarkformPatchError) {
    // Single patch failed
    logger.warn(`Invalid LLM output for field ${error.fieldId}`);
  } else if (error instanceof MarkformLlmError) {
    if (error.retryable) {
      // Implement exponential backoff
      await sleep(1000);
      return fillForm(options);
    }
  } else if (error instanceof MarkformError) {
    // Other markform error
    logger.error(`Markform error: ${error.message}`);
  } else {
    // Not a markform error
    throw error;
  }
}
```

### Structured logging/telemetry

```typescript
catch (error) {
  if (isMarkformError(error)) {
    telemetry.captureException(error, {
      tags: {
        markform_version: error.version,
        error_type: error.name,
      },
      extra: {
        ...(isPatchError(error) && {
          fieldId: error.fieldId,
          patchOp: error.patchOperation,
          expectedType: error.expectedType,
        }),
        ...(isLlmError(error) && {
          provider: error.provider,
          model: error.model,
          retryable: error.retryable,
        }),
      },
    });
  }
}
```

## Implementation Plan

1. **Create `src/errors.ts`** with all error classes and type guards
2. **Export from `src/index.ts`** - all error classes should be public API
3. **Update `apply.ts`** - add validation checks before accessing patch properties
4. **Update `liveAgent.ts`** - wrap LLM errors in MarkformLlmError
5. **Update `parse.ts`** - throw MarkformParseError with line/column info
6. **Update `programmaticFill.ts`** - aggregate validation errors
7. **Add tests** - verify error types, messages, and context are correct
8. **Update docs** - document error handling in README

## Relationship to Other Work

- **markform-504** (Patch validation matrix) - The matrix tests should verify that `MarkformPatchError` is thrown with correct context for each invalid input
- **markform-505** (ANSI consolidation) - Error messages should be plain text, formatting handled by CLI layer

## Benefits Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| Error message | `Cannot read properties of undefined` | `Checkboxes field 'business_model' requires Record<string, boolean>, got undefined` |
| Categorization | None | Typed hierarchy: Parse, Patch, LLM, Config, Abort |
| Context | None | fieldId, expectedType, receivedValue, patchOperation |
| Version | Consumer must add | Included automatically |
| Stack trace | Lost on wrap | Preserved via Error cause chain |
| Recovery | Impossible | retryable flag, issue aggregation |
