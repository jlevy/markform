import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/dist/**",
        "**/node_modules/**",
        "**/*.config.*",
        "**/tests/**",
      ],
      // Initial thresholds based on current coverage; target is 80-90%
      thresholds: {
        statements: 60,
        branches: 80,
        functions: 80,
        lines: 60,
      },
    },
  },
});
