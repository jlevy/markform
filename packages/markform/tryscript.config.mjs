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
  // Coverage configuration for CLI subprocess testing
  coverage: {
    reportsDir: 'coverage-tryscript',
    // Include lcov for merging with vitest coverage
    reporters: ['text', 'html', 'lcov', 'json'],
    include: ['dist/**'],
    src: 'src',
    // Exclude node_modules from coverage (default in 0.1.2+)
    excludeNodeModules: true,
    // Use monocart for AST-aware line counts that align with vitest
    // This prevents inflated line counts when merging coverage reports
    monocart: true,
  },
});
