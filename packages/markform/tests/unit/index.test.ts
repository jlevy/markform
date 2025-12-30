import { describe, expect, it } from 'vitest';

import { VERSION } from '../../src/index.js';

describe('markform', () => {
  it('exports VERSION as semver or development', () => {
    // When running from source (not built), VERSION is 'development'
    // When running from built output, VERSION is the semver from package.json
    // The node-free-core.test.ts verifies built VERSION matches package.json
    expect(VERSION).toMatch(/^(\d+\.\d+\.\d+|development)$/);
  });
});
