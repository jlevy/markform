/**
 * Tests for structured error types.
 */

import { describe, expect, it } from 'vitest';
import {
  MarkformError,
  MarkformParseError,
  MarkformPatchError,
  MarkformValidationError,
  MarkformLlmError,
  MarkformConfigError,
  MarkformAbortError,
  isMarkformError,
  isParseError,
  isPatchError,
  isValidationError,
  isLlmError,
  isConfigError,
  isAbortError,
  isRetryableError,
  wrapApiError,
} from '../../src/errors.js';

describe('MarkformError', () => {
  it('creates base error with message', () => {
    const error = new MarkformError('test message');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('MarkformError');
    expect(error.version).toBeDefined();
  });

  it('preserves cause chain', () => {
    const cause = new Error('original error');
    const error = new MarkformError('wrapped', { cause });
    expect(error.cause).toBe(cause);
  });

  it('maintains prototype chain for instanceof', () => {
    const error = new MarkformError('test');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof MarkformError).toBe(true);
  });
});

describe('MarkformParseError', () => {
  it('creates parse error with location info', () => {
    const error = new MarkformParseError('Invalid field', { line: 10, column: 5 });
    expect(error.message).toBe('Invalid field');
    expect(error.name).toBe('MarkformParseError');
    expect(error.line).toBe(10);
    expect(error.column).toBe(5);
  });

  it('creates parse error with source', () => {
    const error = new MarkformParseError('Invalid field', { source: 'test.form.md' });
    expect(error.source).toBe('test.form.md');
  });

  it('preserves cause', () => {
    const cause = new SyntaxError('YAML parse error');
    const error = new MarkformParseError('Invalid frontmatter', { cause });
    expect(error.cause).toBe(cause);
  });
});

describe('MarkformPatchError', () => {
  it('creates patch error with full context', () => {
    const error = new MarkformPatchError('Invalid value for field business_model', {
      fieldId: 'business_model',
      patchOperation: 'set_checkboxes',
      expectedType: 'Record<OptionId, boolean>',
      receivedValue: undefined,
    });
    expect(error.message).toBe('Invalid value for field business_model');
    expect(error.name).toBe('MarkformPatchError');
    expect(error.fieldId).toBe('business_model');
    expect(error.patchOperation).toBe('set_checkboxes');
    expect(error.expectedType).toBe('Record<OptionId, boolean>');
    expect(error.receivedValue).toBe(undefined);
    expect(error.receivedType).toBe('undefined');
  });

  it('detects null type', () => {
    const error = new MarkformPatchError('null value', {
      fieldId: 'test',
      patchOperation: 'set_string',
      expectedType: 'string',
      receivedValue: null,
    });
    expect(error.receivedType).toBe('null');
  });

  it('detects array type', () => {
    const error = new MarkformPatchError('array value', {
      fieldId: 'test',
      patchOperation: 'set_checkboxes',
      expectedType: 'object',
      receivedValue: ['a', 'b'],
    });
    expect(error.receivedType).toBe('array');
  });

  it('includes patch index when provided', () => {
    const error = new MarkformPatchError('batch error', {
      fieldId: 'test',
      patchOperation: 'set_string',
      expectedType: 'string',
      receivedValue: 123,
      patchIndex: 3,
    });
    expect(error.patchIndex).toBe(3);
  });
});

describe('MarkformValidationError', () => {
  it('aggregates multiple patch errors', () => {
    const issues = [
      new MarkformPatchError('error 1', {
        fieldId: 'field1',
        patchOperation: 'set_string',
        expectedType: 'string',
        receivedValue: 1,
      }),
      new MarkformPatchError('error 2', {
        fieldId: 'field2',
        patchOperation: 'set_number',
        expectedType: 'number',
        receivedValue: 'x',
      }),
    ];
    const error = new MarkformValidationError(issues);
    expect(error.name).toBe('MarkformValidationError');
    expect(error.issues).toBe(issues);
    expect(error.fieldIds).toEqual(['field1', 'field2']);
    expect(error.message).toContain('2 validation errors');
  });

  it('uses single error message for one issue', () => {
    const issues = [
      new MarkformPatchError('single error', {
        fieldId: 'field1',
        patchOperation: 'set_string',
        expectedType: 'string',
        receivedValue: 1,
      }),
    ];
    const error = new MarkformValidationError(issues);
    expect(error.message).toBe('single error');
  });
});

describe('MarkformLlmError', () => {
  it('creates LLM error with provider info', () => {
    const error = new MarkformLlmError('Rate limited', {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      statusCode: 429,
      retryable: true,
    });
    expect(error.name).toBe('MarkformLlmError');
    expect(error.provider).toBe('anthropic');
    expect(error.model).toBe('claude-sonnet-4-5');
    expect(error.statusCode).toBe(429);
    expect(error.retryable).toBe(true);
  });

  it('defaults retryable to false', () => {
    const error = new MarkformLlmError('Unknown error', {});
    expect(error.retryable).toBe(false);
  });

  it('includes responseBody when provided', () => {
    const error = new MarkformLlmError('API error', {
      provider: 'openai',
      model: 'gpt-4o',
      statusCode: 404,
      responseBody: '{"error": {"message": "Model not found"}}',
    });
    expect(error.responseBody).toBe('{"error": {"message": "Model not found"}}');
  });
});

describe('wrapApiError', () => {
  it('wraps a plain error with model context', () => {
    const originalError = new Error('Not Found');
    const wrapped = wrapApiError(originalError, 'anthropic', 'claude-opus-4-5');

    expect(wrapped).toBeInstanceOf(MarkformLlmError);
    expect(wrapped.provider).toBe('anthropic');
    expect(wrapped.model).toBe('claude-opus-4-5');
    expect(wrapped.message).toContain('anthropic/claude-opus-4-5');
    expect(wrapped.message).toContain('Not Found');
    expect(wrapped.cause).toBe(originalError);
  });

  it('extracts statusCode from APICallError-like errors', () => {
    const apiError = Object.assign(new Error('Forbidden'), {
      statusCode: 403,
      isRetryable: false,
    });
    const wrapped = wrapApiError(apiError, 'google', 'gemini-3-pro');

    expect(wrapped.statusCode).toBe(403);
    expect(wrapped.retryable).toBe(false);
    expect(wrapped.message).toContain('HTTP 403');
  });

  it('extracts responseBody from APICallError-like errors', () => {
    const apiError = Object.assign(new Error('Bad Request'), {
      statusCode: 400,
      responseBody: '{"error": {"message": "Invalid model"}}',
      isRetryable: false,
    });
    const wrapped = wrapApiError(apiError, 'openai', 'invalid-model');

    expect(wrapped.responseBody).toBe('{"error": {"message": "Invalid model"}}');
    expect(wrapped.message).toContain('Response:');
    expect(wrapped.message).toContain('Invalid model');
  });

  it('truncates long response bodies', () => {
    const longBody = 'x'.repeat(500);
    const apiError = Object.assign(new Error('Error'), {
      responseBody: longBody,
    });
    const wrapped = wrapApiError(apiError, 'anthropic', 'test-model');

    expect(wrapped.message).toContain('...');
    expect(wrapped.responseBody).toBe(longBody); // Full body preserved in property
  });

  it('handles retryable errors', () => {
    const apiError = Object.assign(new Error('Rate limited'), {
      statusCode: 429,
      isRetryable: true,
    });
    const wrapped = wrapApiError(apiError, 'anthropic', 'claude-sonnet-4-5');

    expect(wrapped.retryable).toBe(true);
    expect(wrapped.statusCode).toBe(429);
  });

  it('handles non-Error values', () => {
    const wrapped = wrapApiError('string error', 'xai', 'grok-4');

    expect(wrapped.message).toContain('string error');
    expect(wrapped.provider).toBe('xai');
    expect(wrapped.model).toBe('grok-4');
  });

  describe('troubleshooting hints', () => {
    it('adds hints for 404 Not Found errors', () => {
      const apiError = Object.assign(new Error('Not Found'), { statusCode: 404 });
      const wrapped = wrapApiError(apiError, 'anthropic', 'claude-opus-4-5');

      expect(wrapped.message).toContain('Troubleshooting');
      expect(wrapped.message).toContain('Check if model');
      expect(wrapped.message).toContain('Verify the model ID');
    });

    it('adds hints for 403 Forbidden errors', () => {
      const apiError = Object.assign(new Error('Forbidden'), { statusCode: 403 });
      const wrapped = wrapApiError(apiError, 'google', 'gemini-3-pro');

      expect(wrapped.message).toContain('Troubleshooting');
      expect(wrapped.message).toContain('permission');
      expect(wrapped.message).toContain('access tier');
    });

    it('adds hints for 401 Unauthorized errors', () => {
      const apiError = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      const wrapped = wrapApiError(apiError, 'openai', 'gpt-5');

      expect(wrapped.message).toContain('Troubleshooting');
      expect(wrapped.message).toContain('API key');
      expect(wrapped.message).toContain('OPENAI_API_KEY');
    });

    it('adds hints for 429 Rate Limit errors', () => {
      const apiError = Object.assign(new Error('Rate limited'), { statusCode: 429 });
      const wrapped = wrapApiError(apiError, 'anthropic', 'claude-sonnet-4-5');

      expect(wrapped.message).toContain('Troubleshooting');
      expect(wrapped.message).toContain('rate limit');
      expect(wrapped.message).toContain('retry');
    });

    it('adds hints for 5xx server errors', () => {
      const apiError = Object.assign(new Error('Internal Server Error'), { statusCode: 500 });
      const wrapped = wrapApiError(apiError, 'xai', 'grok-4');

      expect(wrapped.message).toContain('Troubleshooting');
      expect(wrapped.message).toContain('experiencing issues');
      expect(wrapped.message).toContain('status page');
    });

    it('adds generic hints for unknown errors', () => {
      const apiError = new Error('Something went wrong');
      const wrapped = wrapApiError(apiError, 'deepseek', 'deepseek-chat');

      expect(wrapped.message).toContain('Troubleshooting');
      expect(wrapped.message).toContain('API key');
      expect(wrapped.message).toContain('markform models');
    });
  });
});

describe('MarkformConfigError', () => {
  it('creates config error with option info', () => {
    const error = new MarkformConfigError('Invalid maxTurns', {
      option: 'maxTurns',
      expectedType: 'number > 0',
      receivedValue: -1,
    });
    expect(error.name).toBe('MarkformConfigError');
    expect(error.option).toBe('maxTurns');
    expect(error.expectedType).toBe('number > 0');
    expect(error.receivedValue).toBe(-1);
  });
});

describe('MarkformAbortError', () => {
  it('creates abort error with reason', () => {
    const error = new MarkformAbortError('Insufficient information');
    expect(error.name).toBe('MarkformAbortError');
    expect(error.reason).toBe('Insufficient information');
    expect(error.message).toBe('Form aborted: Insufficient information');
  });

  it('includes field ID when provided', () => {
    const error = new MarkformAbortError('Cannot determine value', 'company_name');
    expect(error.fieldId).toBe('company_name');
  });
});

describe('Type Guards', () => {
  describe('isMarkformError', () => {
    it('returns true for markform errors', () => {
      expect(isMarkformError(new MarkformError('test'))).toBe(true);
      expect(isMarkformError(new MarkformParseError('test'))).toBe(true);
      expect(isMarkformError(new MarkformLlmError('test', {}))).toBe(true);
    });

    it('returns false for non-markform errors', () => {
      expect(isMarkformError(new Error('test'))).toBe(false);
      expect(isMarkformError(new TypeError('test'))).toBe(false);
      expect(isMarkformError(null)).toBe(false);
      expect(isMarkformError('string')).toBe(false);
    });
  });

  describe('isParseError', () => {
    it('identifies parse errors', () => {
      expect(isParseError(new MarkformParseError('test'))).toBe(true);
      expect(isParseError(new MarkformError('test'))).toBe(false);
    });
  });

  describe('isPatchError', () => {
    it('identifies patch errors', () => {
      const patchError = new MarkformPatchError('test', {
        fieldId: 'f',
        patchOperation: 'set_string',
        expectedType: 'string',
        receivedValue: 1,
      });
      expect(isPatchError(patchError)).toBe(true);
      expect(isPatchError(new MarkformError('test'))).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('identifies validation errors', () => {
      const patchError = new MarkformPatchError('test', {
        fieldId: 'f',
        patchOperation: 'set_string',
        expectedType: 'string',
        receivedValue: 1,
      });
      const validationError = new MarkformValidationError([patchError]);
      expect(isValidationError(validationError)).toBe(true);
      expect(isValidationError(patchError)).toBe(false);
    });
  });

  describe('isLlmError', () => {
    it('identifies LLM errors', () => {
      expect(isLlmError(new MarkformLlmError('test', {}))).toBe(true);
      expect(isLlmError(new MarkformError('test'))).toBe(false);
    });
  });

  describe('isConfigError', () => {
    it('identifies config errors', () => {
      const configError = new MarkformConfigError('test', {
        option: 'x',
        expectedType: 'string',
        receivedValue: 1,
      });
      expect(isConfigError(configError)).toBe(true);
      expect(isConfigError(new MarkformError('test'))).toBe(false);
    });
  });

  describe('isAbortError', () => {
    it('identifies abort errors', () => {
      expect(isAbortError(new MarkformAbortError('test'))).toBe(true);
      expect(isAbortError(new MarkformError('test'))).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('returns true for retryable LLM errors', () => {
      expect(isRetryableError(new MarkformLlmError('test', { retryable: true }))).toBe(true);
    });

    it('returns false for non-retryable LLM errors', () => {
      expect(isRetryableError(new MarkformLlmError('test', { retryable: false }))).toBe(false);
      expect(isRetryableError(new MarkformLlmError('test', {}))).toBe(false);
    });

    it('returns false for non-LLM errors', () => {
      expect(isRetryableError(new MarkformError('test'))).toBe(false);
    });
  });
});
