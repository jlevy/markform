import { describe, expect, it } from 'vitest';

import { VERSION } from '../../src/index.js';

describe('markform', () => {
  it('exports VERSION as a valid semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
