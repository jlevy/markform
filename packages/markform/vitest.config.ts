import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // json-summary required for GitHub Actions PR comments
      reporter: ['text', 'text-summary', 'html', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.config.*',
        '**/tests/**',
        '**/__mocks__/**',
        '**/__fixtures__/**',
      ],
      // Thresholds based on current coverage (~50%); will increase as coverage improves
      thresholds: {
        statements: 50,
        branches: 49,
        functions: 50,
        lines: 50,
      },
      // Generate reports even when thresholds fail (needed for PR comments)
      reportOnFailure: true,
    },
  },
});
