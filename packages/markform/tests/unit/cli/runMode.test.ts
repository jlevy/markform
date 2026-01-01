/**
 * Unit tests for runMode utilities.
 */

import { describe, it, expect } from 'vitest';
import { parseForm } from '../../../src/engine/parse.js';
import {
  getFieldRoles,
  validateRunMode,
  determineRunMode,
  formatRunModeSource,
} from '../../../src/cli/lib/runMode.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const USER_ONLY_FORM = `---
spec: MF/0.1
---
{% form id="user_form" %}
{% group id="g1" %}
{% field kind="string" id="user_input" label="User Input" role="user" required=true %}{% /field %}
{% /group %}
{% /form %}
`;

const AGENT_ONLY_FORM = `---
spec: MF/0.1
---
{% form id="agent_form" %}
{% group id="g1" %}
{% field kind="string" id="agent_field" label="Agent Field" required=true %}{% /field %}
{% /group %}
{% /form %}
`;

const MIXED_ROLES_FORM = `---
spec: MF/0.1
---
{% form id="mixed_form" %}
{% group id="g1" %}
{% field kind="string" id="agent_field" label="Agent Field" role="agent" %}{% /field %}
{% field kind="string" id="user_field" label="User Field" role="user" %}{% /field %}
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

const EXPLICIT_FILL_FORM = `---
markform:
  spec: MF/0.1
  run_mode: fill
---
{% form id="explicit" %}
{% group id="g1" %}
{% field kind="string" id="agent_field" label="Agent Field" role="agent" %}{% /field %}
{% /group %}
{% /form %}
`;

// Note: EXPLICIT_INTERACTIVE_FORM would be used for testing explicit interactive mode
// but we already cover that case implicitly through other tests

const EXPLICIT_INVALID_FORM = `---
markform:
  spec: MF/0.1
  run_mode: interactive
---
{% form id="invalid" %}
{% group id="g1" %}
{% field kind="string" id="agent_field" label="Agent Field" role="agent" %}{% /field %}
{% /group %}
{% /form %}
`;

// =============================================================================
// Tests
// =============================================================================

describe('runMode', () => {
  describe('getFieldRoles', () => {
    it('returns roles from form fields', () => {
      const form = parseForm(MIXED_ROLES_FORM);
      const roles = getFieldRoles(form);

      expect(roles.has('agent')).toBe(true);
      expect(roles.has('user')).toBe(true);
      expect(roles.size).toBe(2);
    });

    it('returns single role when all fields have same role', () => {
      const form = parseForm(AGENT_ONLY_FORM);
      const roles = getFieldRoles(form);

      expect(roles.has('agent')).toBe(true);
      expect(roles.size).toBe(1);
    });

    it('returns empty set for form with no fields', () => {
      const form = parseForm(EMPTY_FORM);
      const roles = getFieldRoles(form);

      expect(roles.size).toBe(0);
    });
  });

  describe('validateRunMode', () => {
    it('validates fill mode with agent fields', () => {
      const form = parseForm(AGENT_ONLY_FORM);
      const result = validateRunMode(form, 'fill');

      expect(result.valid).toBe(true);
    });

    it('validates interactive mode with user fields', () => {
      const form = parseForm(USER_ONLY_FORM);
      const result = validateRunMode(form, 'interactive');

      expect(result.valid).toBe(true);
    });

    it('rejects interactive mode without user fields', () => {
      const form = parseForm(AGENT_ONLY_FORM);
      const result = validateRunMode(form, 'interactive');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('no user-role fields');
    });

    it('rejects fill mode without agent fields', () => {
      const form = parseForm(USER_ONLY_FORM);
      const result = validateRunMode(form, 'fill');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('no agent-role fields');
    });

    it('rejects research mode without agent fields', () => {
      const form = parseForm(USER_ONLY_FORM);
      const result = validateRunMode(form, 'research');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('no agent-role fields');
    });
  });

  describe('determineRunMode', () => {
    it('uses explicit run_mode from frontmatter', () => {
      const form = parseForm(EXPLICIT_FILL_FORM);
      const result = determineRunMode(form);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.runMode).toBe('fill');
        expect(result.source).toBe('explicit');
      }
    });

    it('returns error for invalid explicit run_mode', () => {
      const form = parseForm(EXPLICIT_INVALID_FORM);
      const result = determineRunMode(form);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('no user-role fields');
      }
    });

    it('infers interactive mode from user-only fields', () => {
      const form = parseForm(USER_ONLY_FORM);
      const result = determineRunMode(form);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.runMode).toBe('interactive');
        expect(result.source).toBe('inferred');
      }
    });

    it('infers fill mode from agent-only fields', () => {
      const form = parseForm(AGENT_ONLY_FORM);
      const result = determineRunMode(form);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.runMode).toBe('fill');
        expect(result.source).toBe('inferred');
      }
    });

    it('returns error for empty form', () => {
      const form = parseForm(EMPTY_FORM);
      const result = determineRunMode(form);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('no fields');
      }
    });

    it('returns error for mixed roles without explicit run_mode', () => {
      const form = parseForm(MIXED_ROLES_FORM);
      const result = determineRunMode(form);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Cannot determine run mode');
        expect(result.error).toContain('agent');
        expect(result.error).toContain('user');
      }
    });
  });

  describe('formatRunModeSource', () => {
    it('formats explicit source', () => {
      expect(formatRunModeSource('explicit')).toBe('from frontmatter');
    });

    it('formats inferred source', () => {
      expect(formatRunModeSource('inferred')).toBe('inferred from field roles');
    });
  });
});
