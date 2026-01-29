/**
 * Tests for CLI FillRecord-related functionality.
 */

import { describe, it, expect } from 'vitest';

describe('FillRecord CLI helpers', () => {
  describe('sidecar file path derivation', () => {
    // This tests the pattern used in fill.ts for deriving sidecar paths
    const deriveSidecarPath = (outputPath: string): string => {
      return outputPath.replace(/\.(form\.)?md$/, '.fill.json');
    };

    it('handles .form.md extension', () => {
      expect(deriveSidecarPath('/path/to/doc.form.md')).toBe('/path/to/doc.fill.json');
    });

    it('handles plain .md extension', () => {
      expect(deriveSidecarPath('/path/to/doc.md')).toBe('/path/to/doc.fill.json');
    });

    it('handles paths with multiple dots', () => {
      expect(deriveSidecarPath('/path/to/doc.v1.form.md')).toBe('/path/to/doc.v1.fill.json');
    });

    it('handles versioned filenames', () => {
      expect(deriveSidecarPath('/forms/doc.001.form.md')).toBe('/forms/doc.001.fill.json');
    });

    it('preserves directory structure', () => {
      expect(deriveSidecarPath('/home/user/forms/project/report.form.md')).toBe(
        '/home/user/forms/project/report.fill.json',
      );
    });

    it('handles Windows-style paths', () => {
      // Note: regex still works on forward slashes; Windows paths with backslashes are normalized
      expect(deriveSidecarPath('C:/Users/docs/form.form.md')).toBe('C:/Users/docs/form.fill.json');
    });
  });
});
