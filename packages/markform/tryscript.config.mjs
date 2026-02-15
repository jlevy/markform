import { defineConfig } from 'tryscript';

export default defineConfig({
  // Global config - individual test files can override
  env: {
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  },
  timeout: 30000,
  patterns: {
    // Matches semver and dev versions: 0.1.15, 0.1.15-beta.1, 0.1.15-dev.116.abc123-dirty
    VERSION: '\\d+\\.\\d+\\.\\d+(?:-[a-z0-9.-]+)?',
    PATH: '/[^\\s]+',
  },
  // Coverage configuration for CLI subprocess testing
  // tryscript v0.1.4+ uses --merge-lcov to combine vitest + tryscript coverage:
  //   vitest run --coverage && tryscript run ... --coverage --merge-lcov coverage/lcov.info
  // This merges vitest's LCOV into tryscript's coverage output (coverage-tryscript/)
  // See: https://github.com/jlevy/tryscript/blob/main/docs/tryscript-reference.md
  coverage: {
    reportsDir: 'coverage-tryscript',
    reporters: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
    include: ['dist/**'],
    src: 'src',
    excludeNodeModules: true,
    monocart: true,
  },
});
