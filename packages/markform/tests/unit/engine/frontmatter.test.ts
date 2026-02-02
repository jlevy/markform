/**
 * Unit tests for frontmatter parsing and serialization.
 *
 * Tests cover:
 * - Title and description preservation
 * - Roles and role_instructions handling
 * - Harness config validation and round-trips
 * - Zod schema error messages
 */

import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { serializeForm } from '../../../src/engine/serialize.js';
import { DEFAULT_ROLES, DEFAULT_ROLE_INSTRUCTIONS } from '../../../src/settings.js';

// =============================================================================
// Test Helpers
// =============================================================================

function createFormWithFrontmatter(frontmatter: string): string {
  return `---
${frontmatter}
---
{% form id="test" title="Test Form" %}
{% group id="g1" title="Group" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}`;
}

function roundTrip(markdown: string): string {
  const parsed = parseForm(markdown);
  return serializeForm(parsed);
}

// =============================================================================
// Title and Description Tests
// =============================================================================

describe('frontmatter title and description', () => {
  it('preserves title from markform section', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  title: "My Custom Title"
`);
    const form = parseForm(markdown);
    expect(form.metadata?.title).toBe('My Custom Title');

    // Round-trip
    const serialized = serializeForm(form);
    const reparsed = parseForm(serialized);
    expect(reparsed.metadata?.title).toBe('My Custom Title');
  });

  it('preserves description from markform section', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  description: "A detailed description of this form."
`);
    const form = parseForm(markdown);
    expect(form.metadata?.description).toBe('A detailed description of this form.');

    // Round-trip
    const serialized = serializeForm(form);
    const reparsed = parseForm(serialized);
    expect(reparsed.metadata?.description).toBe('A detailed description of this form.');
  });

  it('preserves both title and description', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  title: "Test Form Title"
  description: "Test form description."
`);
    const form = parseForm(markdown);
    expect(form.metadata?.title).toBe('Test Form Title');
    expect(form.metadata?.description).toBe('Test form description.');

    // Verify both survive round-trip
    const serialized = serializeForm(form);
    expect(serialized).toContain('title: Test Form Title');
    expect(serialized).toContain('description: Test form description.');
  });

  it('handles forms without title or description', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
`);
    const form = parseForm(markdown);
    expect(form.metadata?.title).toBeUndefined();
    expect(form.metadata?.description).toBeUndefined();
  });
});

// =============================================================================
// Roles Tests
// =============================================================================

describe('frontmatter roles', () => {
  it('uses default roles when not specified', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
`);
    const form = parseForm(markdown);
    expect(form.metadata?.roles).toEqual([...DEFAULT_ROLES]);
  });

  it('parses custom roles from markform section', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  roles:
    - researcher
    - reviewer
`);
    const form = parseForm(markdown);
    expect(form.metadata?.roles).toEqual(['researcher', 'reviewer']);
  });

  it('preserves custom roles through round-trip', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  roles:
    - admin
    - editor
    - viewer
`);
    const form = parseForm(markdown);
    const serialized = serializeForm(form);
    const reparsed = parseForm(serialized);
    expect(reparsed.metadata?.roles).toEqual(['admin', 'editor', 'viewer']);
  });

  it('does not serialize default roles (omits from output)', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  roles:
    - user
    - agent
`);
    const form = parseForm(markdown);
    const serialized = serializeForm(form);
    // Default roles should not be in the output
    expect(serialized).not.toMatch(/^\s+roles:/m);
  });
});

// =============================================================================
// Role Instructions Tests
// =============================================================================

describe('frontmatter role_instructions', () => {
  it('uses default instructions when not specified', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
`);
    const form = parseForm(markdown);
    expect(form.metadata?.roleInstructions).toEqual(DEFAULT_ROLE_INSTRUCTIONS);
  });

  it('parses custom role_instructions', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  role_instructions:
    user: "Please fill in your information."
    agent: "Complete the analysis."
`);
    const form = parseForm(markdown);
    expect(form.metadata?.roleInstructions).toEqual({
      user: 'Please fill in your information.',
      agent: 'Complete the analysis.',
    });
  });

  it('preserves custom role_instructions through round-trip', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  role_instructions:
    researcher: "Gather data from sources."
    reviewer: "Verify the findings."
`);
    const form = parseForm(markdown);
    const serialized = serializeForm(form);
    const reparsed = parseForm(serialized);
    expect(reparsed.metadata?.roleInstructions).toEqual({
      researcher: 'Gather data from sources.',
      reviewer: 'Verify the findings.',
    });
  });
});

// =============================================================================
// Harness Config Tests
// =============================================================================

describe('frontmatter harness config', () => {
  it('parses all harness config fields', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  harness:
    max_turns: 50
    max_patches_per_turn: 10
    max_issues_per_turn: 5
    max_parallel_agents: 2
`);
    const form = parseForm(markdown);
    expect(form.metadata?.harnessConfig).toEqual({
      maxTurns: 50,
      maxPatchesPerTurn: 10,
      maxIssuesPerTurn: 5,
      maxParallelAgents: 2,
    });
  });

  it('preserves harness config through round-trip', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  harness:
    max_turns: 25
    max_parallel_agents: 8
`);
    const form = parseForm(markdown);
    const serialized = serializeForm(form);
    const reparsed = parseForm(serialized);
    expect(reparsed.metadata?.harnessConfig).toEqual({
      maxTurns: 25,
      maxParallelAgents: 8,
    });
  });

  it('errors on unrecognized harness config key', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  harness:
    invalid_key: 10
`);
    expect(() => parseForm(markdown)).toThrow(/Unrecognized key/);
  });

  it('errors on camelCase harness config key', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  harness:
    maxTurns: 10
`);
    expect(() => parseForm(markdown)).toThrow(/Unrecognized key/);
  });

  it('errors on non-numeric harness config value', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  harness:
    max_turns: "ten"
`);
    expect(() => parseForm(markdown)).toThrow();
  });

  it('errors on negative harness config value', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  harness:
    max_turns: -5
`);
    expect(() => parseForm(markdown)).toThrow(/Too small|>0/);
  });

  it('errors on zero harness config value', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  harness:
    max_turns: 0
`);
    expect(() => parseForm(markdown)).toThrow(/Too small|>0/);
  });
});

// =============================================================================
// Run Mode Tests
// =============================================================================

describe('frontmatter run_mode', () => {
  it('parses run_mode from markform section', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  run_mode: interactive
`);
    const form = parseForm(markdown);
    expect(form.metadata?.runMode).toBe('interactive');
  });

  it('preserves run_mode through round-trip', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  run_mode: fill
`);
    const form = parseForm(markdown);
    const serialized = serializeForm(form);
    const reparsed = parseForm(serialized);
    expect(reparsed.metadata?.runMode).toBe('fill');
  });

  it('errors on invalid run_mode', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  run_mode: invalid_mode
`);
    expect(() => parseForm(markdown)).toThrow();
  });
});

// =============================================================================
// Complete Round-Trip Tests
// =============================================================================

describe('frontmatter complete round-trip', () => {
  it('preserves all frontmatter fields through round-trip', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  title: "Complete Test Form"
  description: "Testing all frontmatter fields."
  run_mode: research
  roles:
    - manager
    - contributor
  role_instructions:
    manager: "Oversee the process."
    contributor: "Add your contributions."
  harness:
    max_turns: 30
    max_patches_per_turn: 15
    max_issues_per_turn: 8
    max_parallel_agents: 4
`);

    const form = parseForm(markdown);
    const serialized = serializeForm(form);
    const reparsed = parseForm(serialized);

    // Verify all fields preserved
    expect(reparsed.metadata?.title).toBe('Complete Test Form');
    expect(reparsed.metadata?.description).toBe('Testing all frontmatter fields.');
    expect(reparsed.metadata?.runMode).toBe('research');
    expect(reparsed.metadata?.roles).toEqual(['manager', 'contributor']);
    expect(reparsed.metadata?.roleInstructions).toEqual({
      manager: 'Oversee the process.',
      contributor: 'Add your contributions.',
    });
    expect(reparsed.metadata?.harnessConfig).toEqual({
      maxTurns: 30,
      maxPatchesPerTurn: 15,
      maxIssuesPerTurn: 8,
      maxParallelAgents: 4,
    });
  });

  it('double round-trip produces identical results', () => {
    const markdown = createFormWithFrontmatter(`
markform:
  spec: "MF/0.1"
  title: "Double Trip Test"
  roles:
    - editor
  harness:
    max_turns: 20
`);

    const first = roundTrip(markdown);
    const second = roundTrip(first);
    expect(second).toBe(first);
  });
});
