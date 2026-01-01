/**
 * Tests for ANSI utility functions.
 */

import { describe, it, expect } from 'vitest';
import { stripAnsi, hasAnsi, ANSI } from './ansi.js';

describe('ansi utilities', () => {
  describe('stripAnsi', () => {
    it('strips color codes', () => {
      const colored = `${ANSI.GREEN}success${ANSI.RESET}`;
      expect(stripAnsi(colored)).toBe('success');
    });

    it('strips multiple color codes', () => {
      const colored = `${ANSI.RED}error${ANSI.RESET}: ${ANSI.YELLOW}warning${ANSI.RESET}`;
      expect(stripAnsi(colored)).toBe('error: warning');
    });

    it('handles strings without ANSI codes', () => {
      expect(stripAnsi('plain text')).toBe('plain text');
    });

    it('strips bold and dim', () => {
      const styled = `${ANSI.BOLD}bold${ANSI.RESET} ${ANSI.DIM}dim${ANSI.RESET}`;
      expect(stripAnsi(styled)).toBe('bold dim');
    });
  });

  describe('hasAnsi', () => {
    it('returns true for strings with ANSI codes', () => {
      expect(hasAnsi(`${ANSI.GREEN}text${ANSI.RESET}`)).toBe(true);
    });

    it('returns false for plain strings', () => {
      expect(hasAnsi('plain text')).toBe(false);
    });

    it('returns false for empty strings', () => {
      expect(hasAnsi('')).toBe(false);
    });
  });

  describe('ANSI constants', () => {
    it('contains expected color codes', () => {
      expect(ANSI.RESET).toBe('\x1b[0m');
      expect(ANSI.RED).toBe('\x1b[31m');
      expect(ANSI.GREEN).toBe('\x1b[32m');
      expect(ANSI.YELLOW).toBe('\x1b[33m');
      expect(ANSI.BLUE).toBe('\x1b[34m');
      expect(ANSI.CYAN).toBe('\x1b[36m');
    });
  });
});
