/**
 * Tests for versioning utilities.
 */

import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  generateVersionedPath,
  incrementVersion,
  parseVersionedPath,
} from '../../../src/cli/lib/versioning.js';

// Mock fs.existsSync for testing generateVersionedPath
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('versioning', () => {
  describe('parseVersionedPath', () => {
    it('parses file without version', () => {
      const result = parseVersionedPath('form.form.md');
      expect(result).toEqual({
        base: 'form',
        version: null,
        extension: '.form.md',
      });
    });

    it('parses file with -filled1 version', () => {
      const result = parseVersionedPath('form-filled1.form.md');
      expect(result).toEqual({
        base: 'form',
        version: 1,
        extension: '.form.md',
      });
    });

    it('parses file with -filled99 version', () => {
      const result = parseVersionedPath('form-filled99.form.md');
      expect(result).toEqual({
        base: 'form',
        version: 99,
        extension: '.form.md',
      });
    });

    it('parses file with _filled1 version', () => {
      const result = parseVersionedPath('form_filled1.form.md');
      expect(result).toEqual({
        base: 'form',
        version: 1,
        extension: '.form.md',
      });
    });

    it('parses legacy -v1 version for backwards compatibility', () => {
      const result = parseVersionedPath('form-v1.form.md');
      expect(result).toEqual({
        base: 'form',
        version: 1,
        extension: '.form.md',
      });
    });

    it('parses file with path', () => {
      const result = parseVersionedPath('/path/to/form-filled5.form.md');
      expect(result).toEqual({
        base: '/path/to/form',
        version: 5,
        extension: '.form.md',
      });
    });

    it('returns null for non-.form.md file', () => {
      const result = parseVersionedPath('form.md');
      expect(result).toBeNull();
    });
  });

  describe('incrementVersion', () => {
    it('adds -filled1 to file without version', () => {
      expect(incrementVersion('form.form.md')).toBe('form-filled1.form.md');
    });

    it('increments -filled1 to -filled2', () => {
      expect(incrementVersion('form-filled1.form.md')).toBe('form-filled2.form.md');
    });

    it('increments -filled99 to -filled100', () => {
      expect(incrementVersion('form-filled99.form.md')).toBe('form-filled100.form.md');
    });

    it('converts legacy -v1 to -filled2', () => {
      expect(incrementVersion('form-v1.form.md')).toBe('form-filled2.form.md');
    });

    it('handles files with paths', () => {
      expect(incrementVersion('/path/to/form-filled5.form.md')).toBe(
        '/path/to/form-filled6.form.md',
      );
    });

    it('handles non-.form.md files', () => {
      expect(incrementVersion('file.txt')).toBe('file.txt-filled1');
    });
  });

  describe('generateVersionedPath', () => {
    const mockExistsSync = vi.mocked(existsSync);

    it('returns -filled1 when no files exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(generateVersionedPath('form.form.md')).toBe('form-filled1.form.md');
    });

    it('returns -filled2 when -filled1 exists', () => {
      mockExistsSync.mockImplementation((path) => {
        return path === 'form-filled1.form.md';
      });
      expect(generateVersionedPath('form.form.md')).toBe('form-filled2.form.md');
    });

    it('returns -filled3 when -filled1 and -filled2 exist', () => {
      mockExistsSync.mockImplementation((path) => {
        return path === 'form-filled1.form.md' || path === 'form-filled2.form.md';
      });
      expect(generateVersionedPath('form.form.md')).toBe('form-filled3.form.md');
    });

    it('increments from existing version', () => {
      mockExistsSync.mockImplementation((path) => {
        return path === 'form-filled6.form.md';
      });
      expect(generateVersionedPath('form-filled5.form.md')).toBe('form-filled7.form.md');
    });

    it('skips to next available version', () => {
      mockExistsSync.mockImplementation((path) => {
        return (
          path === 'form-filled6.form.md' ||
          path === 'form-filled7.form.md' ||
          path === 'form-filled8.form.md'
        );
      });
      expect(generateVersionedPath('form-filled5.form.md')).toBe('form-filled9.form.md');
    });

    it('handles non-.form.md files', () => {
      mockExistsSync.mockImplementation((path) => {
        return path === 'file.txt-filled1';
      });
      expect(generateVersionedPath('file.txt')).toBe('file.txt-filled2');
    });
  });
});
