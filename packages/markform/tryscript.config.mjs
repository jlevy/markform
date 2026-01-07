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
  // Coverage configuration - unified output for vitest + tryscript coverage merge
  // Uses `tryscript coverage --monocart "pnpm vitest run" "tryscript run ..."`
  // to merge vitest unit tests and CLI subprocess coverage into one report.
  coverage: {
    // Output to 'coverage' to match CI expectations (vitest-coverage-report-action)
    reportsDir: 'coverage',
    // Reporters needed for CI: json-summary for badges/PR comments, json for detailed reports
    reporters: ['text', 'text-summary', 'html', 'json', 'json-summary', 'lcov'],
    include: ['dist/**'],
    src: 'src',
    // Exclude node_modules from coverage (default in 0.1.2+)
    // Note: There's a known issue (markform-12) where node_modules still appears
    // in coverage output when using monocart. The src file coverage is still accurate.
    excludeNodeModules: true,
    // Use monocart for AST-aware line counts that align with vitest
    // This prevents inflated line counts when merging coverage reports
    monocart: true,
  },
});
