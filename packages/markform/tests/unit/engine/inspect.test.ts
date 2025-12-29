/**
 * Tests for engine/inspect.ts
 *
 * The inspect module provides the main entry point for form inspection,
 * combining validation results with summaries into a unified InspectResult.
 */
import { describe, it, expect } from 'vitest';
import { inspect } from '../../../src/engine/inspect';
import { parseForm } from '../../../src/engine/parse';

// =============================================================================
// Test Fixtures
// =============================================================================

const EMPTY_FORM = `---
spec: MF/0.1
---
{% form id="test_form" title="Test Form" %}

{% field-group id="basic" title="Basic" %}

{% field kind="string" id="name" label="Name" required=true %}{% /field %}

{% field kind="number" id="age" label="Age" %}{% /field %}

{% /field-group %}

{% /form %}
`;

const FILLED_FORM = `---
spec: MF/0.1
---
{% form id="test_form" title="Test Form" %}

{% field-group id="basic" title="Basic" %}

{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John Doe
\`\`\`
{% /field %}

{% field kind="number" id="age" label="Age" %}
\`\`\`value
30
\`\`\`
{% /field %}

{% /field-group %}

{% /form %}
`;

const INVALID_FORM = `---
spec: MF/0.1
---
{% form id="test_form" title="Test Form" %}

{% field-group id="basic" title="Basic" %}

{% field kind="number" id="count" label="Count" min=1 max=10 %}
\`\`\`value
100
\`\`\`
{% /field %}

{% /field-group %}

{% /form %}
`;

const MULTI_ISSUE_FORM = `---
spec: MF/0.1
---
{% form id="test_form" title="Test Form" %}

{% field-group id="basic" title="Basic" %}

{% field kind="string" id="name" label="Name" required=true %}{% /field %}

{% field kind="string" id="email" label="Email" required=true %}{% /field %}

{% field kind="number" id="age" label="Age" min=0 max=150 %}
\`\`\`value
-5
\`\`\`
{% /field %}

{% /field-group %}

{% /form %}
`;

// =============================================================================
// Tests
// =============================================================================

describe('inspect', () => {
  describe('basic functionality', () => {
    it('returns InspectResult with all required fields', () => {
      const form = parseForm(EMPTY_FORM);
      const result = inspect(form);

      expect(result).toHaveProperty('structureSummary');
      expect(result).toHaveProperty('progressSummary');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('isComplete');
      expect(result).toHaveProperty('formState');
    });

    it('returns structure summary with correct field counts', () => {
      const form = parseForm(EMPTY_FORM);
      const result = inspect(form);

      expect(result.structureSummary.fieldCount).toBe(2);
      // Note: requiredFields is in progressSummary.counts, not structureSummary
      expect(result.progressSummary.counts.emptyRequiredFields).toBe(1);
    });

    it('returns progress summary with field states', () => {
      const form = parseForm(EMPTY_FORM);
      const result = inspect(form);

      expect(result.progressSummary.fields).toHaveProperty('name');
      expect(result.progressSummary.fields).toHaveProperty('age');
    });
  });

  describe('issue detection', () => {
    it('detects missing required field as required issue', () => {
      const form = parseForm(EMPTY_FORM);
      const result = inspect(form);

      const requiredIssues = result.issues.filter((i) => i.severity === 'required');
      expect(requiredIssues.length).toBeGreaterThan(0);

      const nameIssue = requiredIssues.find((i) => i.ref === 'name');
      expect(nameIssue).toBeDefined();
      expect(nameIssue?.reason).toBe('required_missing');
    });

    it('detects validation errors as required issues', () => {
      const form = parseForm(INVALID_FORM);
      const result = inspect(form);

      const countIssue = result.issues.find((i) => i.ref === 'count');
      expect(countIssue).toBeDefined();
      expect(countIssue?.severity).toBe('required');
      // Min/max constraint violations are mapped to "validation_error"
      expect(countIssue?.reason).toBe('validation_error');
    });

    it('detects empty optional fields as recommended issues', () => {
      const form = parseForm(EMPTY_FORM);
      const result = inspect(form);

      const ageIssue = result.issues.find((i) => i.ref === 'age');
      expect(ageIssue).toBeDefined();
      expect(ageIssue?.severity).toBe('recommended');
      expect(ageIssue?.reason).toBe('optional_empty');
    });
  });

  describe('issue prioritization', () => {
    it('sorts issues by priority ascending (1 = highest)', () => {
      const form = parseForm(MULTI_ISSUE_FORM);
      const result = inspect(form);

      // Verify issues are sorted by priority ascending
      for (let i = 1; i < result.issues.length; i++) {
        expect(result.issues[i]!.priority).toBeGreaterThanOrEqual(result.issues[i - 1]!.priority);
      }
    });

    it('assigns lower priority numbers to required issues', () => {
      const form = parseForm(MULTI_ISSUE_FORM);
      const result = inspect(form);

      const requiredIssues = result.issues.filter((i) => i.severity === 'required');
      const recommendedIssues = result.issues.filter((i) => i.severity === 'recommended');

      if (requiredIssues.length > 0 && recommendedIssues.length > 0) {
        const maxRequiredPriority = Math.max(...requiredIssues.map((i) => i.priority));
        const minRecommendedPriority = Math.min(...recommendedIssues.map((i) => i.priority));
        expect(maxRequiredPriority).toBeLessThan(minRecommendedPriority);
      }
    });

    it('assigns valid tier-based priorities (1-5) to each issue', () => {
      const form = parseForm(MULTI_ISSUE_FORM);
      const result = inspect(form);

      // All priorities should be valid tiers (1-5)
      for (const issue of result.issues) {
        expect(issue.priority).toBeGreaterThanOrEqual(1);
        expect(issue.priority).toBeLessThanOrEqual(5);
      }

      // With the tiered system, multiple issues can share the same priority tier
      // Required issues (required_missing) on medium priority fields get tier 1 (score 2+3=5)
      // Optional issues (optional_empty) on medium priority fields get tier 3 (score 2+1=3)
    });
  });

  describe('completion status', () => {
    it('returns isComplete=false when required issues exist', () => {
      const form = parseForm(EMPTY_FORM);
      const result = inspect(form);

      expect(result.isComplete).toBe(false);
    });

    it('returns isComplete=true when no required issues exist', () => {
      const form = parseForm(FILLED_FORM);
      const result = inspect(form);

      expect(result.isComplete).toBe(true);
    });

    it("returns formState='empty' when no fields are filled", () => {
      const form = parseForm(EMPTY_FORM);
      const result = inspect(form);

      expect(result.formState).toBe('empty');
    });

    it("returns formState='complete' when all required fields are filled", () => {
      const form = parseForm(FILLED_FORM);
      const result = inspect(form);

      expect(result.formState).toBe('complete');
    });

    it("returns formState='invalid' when validation errors exist", () => {
      const form = parseForm(INVALID_FORM);
      const result = inspect(form);

      expect(result.formState).toBe('invalid');
    });
  });

  describe('issue scope', () => {
    it("sets scope to 'field' for field-level issues", () => {
      const form = parseForm(EMPTY_FORM);
      const result = inspect(form);

      const fieldIssues = result.issues.filter((i) => i.scope === 'field');
      expect(fieldIssues.length).toBeGreaterThan(0);
    });
  });
});
