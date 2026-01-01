/**
 * Unit tests for research form validation utilities.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../../src/engine/parse.js';
import {
  isResearchForm,
  validateResearchForm,
} from '../../../src/research/researchFormValidation.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const SIMPLE_FORM = `---
markform:
  spec: MF/0.1
---
{% form id="simple" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;

const EMPTY_FORM = `---
spec: MF/0.1
---
{% form id="empty" %}
{% group id="g1" %}
{% /group %}
{% /form %}
`;

// =============================================================================
// Tests
// =============================================================================

describe('researchFormValidation', () => {
  describe('isResearchForm', () => {
    it('returns false for simple form without research config', () => {
      const form = parseForm(SIMPLE_FORM);
      expect(isResearchForm(form)).toBe(false);
    });

    it('returns false for form without metadata', () => {
      const form = parseForm(EMPTY_FORM);
      expect(isResearchForm(form)).toBe(false);
    });

    it('returns true when metadata has webSearchModel', () => {
      const form = parseForm(SIMPLE_FORM);
      // Simulate runtime injection of webSearchModel into metadata

      (form.metadata as any).webSearchModel = 'google:gemini-2.0-flash';

      expect(isResearchForm(form)).toBe(true);
    });

    it('returns true when metadata has enableWebSearch=true', () => {
      const form = parseForm(SIMPLE_FORM);
      // Simulate runtime injection of enableWebSearch into metadata

      (form.metadata as any).enableWebSearch = true;

      expect(isResearchForm(form)).toBe(true);
    });

    it('returns false when metadata has enableWebSearch=false', () => {
      const form = parseForm(SIMPLE_FORM);
      // enableWebSearch=false should not make it a research form

      (form.metadata as any).enableWebSearch = false;

      expect(isResearchForm(form)).toBe(false);
    });
  });

  describe('validateResearchForm', () => {
    it('returns valid for form with fields', () => {
      const form = parseForm(SIMPLE_FORM);
      const result = validateResearchForm(form);

      expect(result.isValid).toBe(true);
    });

    it('returns invalid for form with no fields', () => {
      const form = parseForm(EMPTY_FORM);
      const result = validateResearchForm(form);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('no fields');
    });
  });
});
