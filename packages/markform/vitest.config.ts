import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // json-summary required for GitHub Actions PR comments
      reporter: ['text', 'text-summary', 'html', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      // Only include our source files (not dependencies)
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.config.*',
        '**/tests/**',
        '**/__mocks__/**',
        '**/__fixtures__/**',
        // Type-only files (no runtime code to cover)
        // Note: coreTypes.ts is NOT excluded as it contains runtime Zod schemas
        '**/*[Tt]ypes.ts', // Matches both *Types.ts and *types.ts
        '**/index.ts', // Re-export barrels
        // Test utilities (not production code)
        '**/rejectionMockAgent.ts',
        // Integration code requiring external setup (tested via integration tests)
        '**/vercelAiSdkTools.ts',
        // Interactive CLI commands (use @clack/prompts, tested via tryscript)
        // Testable logic extracted to *Helpers.ts modules
        '**/commands/browse.ts',
        '**/commands/run.ts',
        '**/commands/research.ts',
      ],
      // Thresholds based on current coverage (~50%); will increase as coverage improves
      thresholds: {
        statements: 50,
        branches: 49,
        functions: 49,
        lines: 50,
      },
      // Generate reports even when thresholds fail (needed for PR comments)
      reportOnFailure: true,
    },
  },
});
