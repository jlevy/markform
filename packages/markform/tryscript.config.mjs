import { defineConfig } from 'tryscript';

export default defineConfig({
  // Global config - individual test files can override
  env: {
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  },
  timeout: 30000,
  patterns: {
    VERSION: '\\d+\\.\\d+\\.\\d+(?:-[a-z]+\\.\\d+)?',
    PATH: '/[^\\s]+',
  },
  // Coverage configuration for CLI subprocess testing (used by test:coverage:cli)
  // Note: Primary coverage comes from vitest (test:coverage) since markform has
  // significant engine code that's not exercised via CLI commands.
  coverage: {
    reportsDir: 'coverage-cli',
    reporters: ['text', 'text-summary', 'html', 'lcov'],
    include: ['dist/**'],
    src: 'src',
    excludeNodeModules: true,
    monocart: true,
  },
});
