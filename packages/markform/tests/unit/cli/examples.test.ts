/**
 * Tests for the examples command and registry.
 */

import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import {
  EXAMPLE_DEFINITIONS,
  getExampleById,
  getExampleIds,
  loadExampleContent,
} from '../../../src/cli/examples/exampleRegistry.js';

describe('examples registry', () => {
  describe('EXAMPLE_DEFINITIONS', () => {
    it('has at least 3 examples', () => {
      expect(EXAMPLE_DEFINITIONS.length).toBeGreaterThanOrEqual(3);
    });

    it('each example has all required fields', () => {
      for (const example of EXAMPLE_DEFINITIONS) {
        expect(example.id).toBeTruthy();
        expect(example.title).toBeTruthy();
        expect(example.description).toBeTruthy();
        expect(example.filename).toBeTruthy();
        expect(example.path).toBeTruthy();

        // Filename should end with .form.md
        expect(example.filename).toMatch(/\.form\.md$/);

        // Path should be relative path with subdirectory
        expect(example.path).toContain('/');
        expect(example.path).toMatch(/\.form\.md$/);
      }
    });

    it('has unique example IDs', () => {
      const ids = EXAMPLE_DEFINITIONS.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('includes simple example', () => {
      expect(EXAMPLE_DEFINITIONS.some((e) => e.id === 'simple')).toBe(true);
    });

    it('includes political-research example', () => {
      expect(EXAMPLE_DEFINITIONS.some((e) => e.id === 'political-research')).toBe(true);
    });

    it('includes earnings-analysis example', () => {
      expect(EXAMPLE_DEFINITIONS.some((e) => e.id === 'earnings-analysis')).toBe(true);
    });
  });

  describe('getExampleIds', () => {
    it('returns array of all example IDs', () => {
      const ids = getExampleIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain('simple');
      expect(ids).toContain('political-research');
      expect(ids).toContain('earnings-analysis');
    });
  });

  describe('getExampleById', () => {
    it('returns example for valid ID', () => {
      const example = getExampleById('simple');
      expect(example).toBeDefined();
      expect(example?.id).toBe('simple');
      expect(example?.title).toBe('Simple Test Form');
    });

    it('returns undefined for invalid ID', () => {
      const example = getExampleById('nonexistent');
      expect(example).toBeUndefined();
    });
  });

  describe('loadExampleContent', () => {
    it('loads simple example content', () => {
      const content = loadExampleContent('simple');
      expect(content).toBeTruthy();
      expect(typeof content).toBe('string');
      expect(content).toContain('markform:');
      expect(content).toContain('{% form');
    });

    it('loads political-research example content', () => {
      const content = loadExampleContent('political-research');
      expect(content).toBeTruthy();
      expect(content).toContain('markform:');
      expect(content).toContain('political_research');
    });

    it('loads earnings-analysis example content', () => {
      const content = loadExampleContent('earnings-analysis');
      expect(content).toBeTruthy();
      expect(content).toContain('markform:');
      expect(content).toContain('company_analysis');
    });

    it('throws for unknown example', () => {
      expect(() => loadExampleContent('nonexistent')).toThrow('Unknown example: nonexistent');
    });
  });

  describe('example form validation', () => {
    it('simple example parses as valid form', () => {
      const content = loadExampleContent('simple');
      const form = parseForm(content);

      expect(form.schema.id).toBe('simple_test');
      expect(form.schema.groups.length).toBeGreaterThan(0);
    });

    it('political-research example parses as valid form', () => {
      const content = loadExampleContent('political-research');
      const form = parseForm(content);

      expect(form.schema.id).toBe('political_research');
      expect(form.schema.groups.length).toBeGreaterThan(0);

      // Should have the name field with user role
      const nameField = form.schema.groups.flatMap((g) => g.children).find((f) => f.id === 'name');
      expect(nameField).toBeDefined();
      expect(nameField?.role).toBe('user');
    });

    it('earnings-analysis example parses as valid form', () => {
      const content = loadExampleContent('earnings-analysis');
      const form = parseForm(content);

      expect(form.schema.id).toBe('company_analysis');
      expect(form.schema.groups.length).toBeGreaterThan(0);
    });

    it('all examples contain roles in frontmatter content', () => {
      for (const example of EXAMPLE_DEFINITIONS) {
        const content = loadExampleContent(example.id);

        // Check that the raw content contains roles in frontmatter
        expect(content).toContain('roles:');
        expect(content).toContain('- user');
        // Note: simple form only has user role for testing interactive fill
        // Political and earnings examples have both user and agent roles
        if (example.id !== 'simple') {
          expect(content).toContain('- agent');
        }
      }
    });
  });
});
