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
  getAllExamplesWithMetadata,
  getExampleWithMetadata,
  loadExampleMetadata,
} from '../../../src/cli/examples/exampleRegistry.js';

describe('examples registry', () => {
  describe('EXAMPLE_DEFINITIONS', () => {
    it('has at least 3 examples', () => {
      expect(EXAMPLE_DEFINITIONS.length).toBeGreaterThanOrEqual(3);
    });

    it('each example has all required static fields', () => {
      for (const example of EXAMPLE_DEFINITIONS) {
        expect(example.id).toBeTruthy();
        expect(example.filename).toBeTruthy();
        expect(example.path).toBeTruthy();

        // Filename should end with .form.md
        expect(example.filename).toMatch(/\.form\.md$/);

        // Path should be relative path with subdirectory
        expect(example.path).toContain('/');
        expect(example.path).toMatch(/\.form\.md$/);
      }
    });

    it('each example has title and description in frontmatter', () => {
      for (const example of EXAMPLE_DEFINITIONS) {
        const metadata = loadExampleMetadata(example.id);
        expect(metadata.title).toBeTruthy();
        expect(metadata.description).toBeTruthy();
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

    it('includes earnings-analysis example', () => {
      expect(EXAMPLE_DEFINITIONS.some((e) => e.id === 'earnings-analysis')).toBe(true);
    });
  });

  describe('getExampleIds', () => {
    it('returns array of all example IDs', () => {
      const ids = getExampleIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain('simple');
      expect(ids).toContain('earnings-analysis');
    });
  });

  describe('getExampleById', () => {
    it('returns example for valid ID', () => {
      const example = getExampleById('simple');
      expect(example).toBeDefined();
      expect(example?.id).toBe('simple');
      expect(example?.filename).toBe('simple.form.md');
    });

    it('returns undefined for invalid ID', () => {
      const example = getExampleById('nonexistent');
      expect(example).toBeUndefined();
    });
  });

  describe('getExampleWithMetadata', () => {
    it('returns example with title and description loaded from frontmatter', () => {
      const example = getExampleWithMetadata('simple');
      expect(example).toBeDefined();
      expect(example?.id).toBe('simple');
      expect(example?.title).toBe('Simple Test Form');
      expect(example?.description).toBeTruthy();
    });

    it('returns undefined for invalid ID', () => {
      const example = getExampleWithMetadata('nonexistent');
      expect(example).toBeUndefined();
    });
  });

  describe('getAllExamplesWithMetadata', () => {
    it('returns all examples with metadata loaded', () => {
      const examples = getAllExamplesWithMetadata();
      expect(examples.length).toBe(EXAMPLE_DEFINITIONS.length);

      for (const example of examples) {
        expect(example.id).toBeTruthy();
        expect(example.title).toBeTruthy();
        expect(example.description).toBeTruthy();
      }
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

    it('loads earnings-analysis example content', () => {
      const content = loadExampleContent('earnings-analysis');
      expect(content).toBeTruthy();
      expect(content).toContain('markform:');
      expect(content).toContain('earnings_analysis');
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

    it('earnings-analysis example parses as valid form', () => {
      const content = loadExampleContent('earnings-analysis');
      const form = parseForm(content);

      expect(form.schema.id).toBe('earnings_analysis');
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
