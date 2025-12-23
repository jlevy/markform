import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Type-aware ESLint configuration using flat config.
 * Uses TypeScript's project service for precise, cross-project type information.
 */

// Apply type-checked configs only to TypeScript files
const typedRecommended = tseslint.configs.recommendedTypeChecked.map((cfg) => ({
  ...cfg,
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    ...(cfg.languageOptions ?? {}),
    parserOptions: {
      ...(cfg.languageOptions?.parserOptions ?? {}),
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

const typedStylistic = tseslint.configs.stylisticTypeChecked.map((cfg) => ({
  ...cfg,
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    ...(cfg.languageOptions ?? {}),
    parserOptions: {
      ...(cfg.languageOptions?.parserOptions ?? {}),
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

export default [
  // Global ignores
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.pnpm-store/**",
      "eslint.config.*",
      // Temporarily ignore examples until types are fully defined
      "**/examples/**/*.ts",
      // Scripts use optional dependencies (ai, @ai-sdk/anthropic)
      "**/scripts/**/*.ts",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // Type-aware TypeScript rules
  ...typedRecommended,
  ...typedStylistic,

  // TypeScript-specific rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // === Code Style ===
      curly: ["error", "all"],
      "brace-style": ["error", "1tbs", { allowSingleLine: false }],

      // === Unused Variables ===
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // === Promise Safety ===
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",

      // === Type Import Consistency ===
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: true,
        },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",

      // === Restricted Patterns ===
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSImportType",
          message:
            "Inline import() type expressions are not allowed. Use a proper import statement at the top of the file instead.",
        },
      ],
    },
  },

  // Relax rules for test files
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },

];
