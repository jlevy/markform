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
  // Per tryscript docs, for projects with programmatic imports (like markform),
  // use separate vitest + tryscript coverage runs and merge LCOV files:
  //   vitest run --coverage          → coverage/lcov.info
  //   tryscript run --coverage ...   → coverage-cli/lcov.info
  //   lcov -a coverage/lcov.info -a coverage-cli/lcov.info -o merged/lcov.info
  // See: https://github.com/jlevy/tryscript/blob/main/docs/tryscript-reference.md
  coverage: {
    reportsDir: 'coverage-cli',
    reporters: ['text', 'text-summary', 'html', 'lcov'],
    include: ['dist/**'],
    src: 'src',
    excludeNodeModules: true,
    monocart: true,
  },
});
