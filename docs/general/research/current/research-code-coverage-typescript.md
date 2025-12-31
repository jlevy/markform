# Code Coverage Best Practices for TypeScript with Vitest

## Research Date

2025-12-23 (updated 2025-12-31)

## Tool Versions Researched

| Tool | Version | Notes |
| --- | --- | --- |
| Vitest | 4.0.16 | Testing framework |
| @vitest/coverage-v8 | 4.0.16 | V8-based coverage (recommended) |
| TypeScript | 5.9.3 | Language version |
| vitest-coverage-report-action | v2 | PR comments (GitHub Action) |
| coverage-badges-action | latest | Badge generation (GitHub Action) |

## Executive Summary

Best practices for implementing comprehensive code coverage in TypeScript codebases
using Vitest with the v8 coverage provider.

## Coverage Metrics

### Essential Metrics

- **Statements**: Percentage of statements executed

- **Branches**: Percentage of conditional branches taken

- **Functions**: Percentage of functions called

- **Lines**: Percentage of lines executed

### Recommended Thresholds

| Metric | Starting | Target | Notes |
| --- | --- | --- | --- |
| Statements | 70% | 80-90% | Catch untested code paths |
| Branches | 65% | 75-85% | Critical for TypeScript with union types |
| Functions | 70% | 80-90% | Ensure all exported APIs are tested |
| Lines | 70% | 80-90% | General code execution coverage |

### Why Branch Coverage Matters for TypeScript

Branch coverage is especially important in TypeScript due to:

- Union types (`string | null`)

- Optional chaining (`obj?.prop`)

- Conditional types

- Type guards

- Nullish coalescing (`??`)

Low branch coverage often indicates untested error paths and edge cases.

## Coverage Configuration

### Include/Exclude Patterns

**Always Exclude:**

- Generated files (`**/_generated/**`, `**/*.generated.ts`)

- Type definitions (`**/*.d.ts`)

- Test files themselves (`**/*.test.ts`, `**/__tests__/**`)

- Config files (`**/*.config.ts`, `**/vitest.setup.ts`)

- Build outputs (`**/dist/**`, `**/node_modules/**`)

- Migration files (if not testing migrations)

- Mocks and fixtures (`**/__mocks__/**`, `**/__fixtures__/**`)

**Include:**

- Source code directories (`src/**/*.ts`, `lib/**/*.ts`)

- Exclude test files from coverage calculation

### Reporter Configuration

**Recommended Reporters:**

| Reporter | Purpose |
| --- | --- |
| `text` | Terminal output for CI/quick checks |
| `text-summary` | Brief summary in terminal |
| `html` | Detailed visual reports for local dev |
| `json` | Machine-readable for CI/CD integration |
| `json-summary` | Machine-readable summary (`coverage-summary.json`) for PR annotations |
| `lcov` | Standard format for Codecov/Coveralls |

## Vitest Configuration

### Installation

```bash
# npm
npm install -D vitest @vitest/coverage-v8

# pnpm
pnpm add -D vitest @vitest/coverage-v8
```

### Example Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        '**/_generated/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/tests/**',
        '**/__mocks__/**',
        '**/*.config.*',
        '**/vitest.setup.ts',
        '**/dist/**',
        '**/node_modules/**',
      ],
      include: ['src/**/*.ts', 'lib/**/*.ts'],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
      // Enable per-file threshold checking
      perFile: true,
    },
  },
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:coverage:watch": "vitest --coverage",
    "test:coverage:html": "vitest run --coverage && open coverage/index.html"
  }
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true
```

### Fail Builds on Threshold Violations

Vitest automatically fails when thresholds are not met if configured:

```typescript
thresholds: {
  statements: 70,
  branches: 65,
  functions: 70,
  lines: 70,
}
```

## GitHub Actions Visibility (2025 Best Practices)

### PR Coverage Comments

The `vitest-coverage-report-action` provides native Vitest integration for PR visibility:

```yaml
- name: Run tests with coverage
  run: pnpm test:coverage

- name: Coverage Report
  uses: davelosert/vitest-coverage-report-action@v2
  if: github.event_name == 'pull_request'
  with:
    json-summary-path: ./coverage/coverage-summary.json
    json-final-path: ./coverage/coverage-final.json
    file-coverage-mode: changes  # Only show changed files
```

**Key features:**

- Markdown-formatted PR comments with coverage tables
- Updates in place (no comment spam)
- File-specific coverage for changed files only
- Comparison against base branch
- Works directly with Vitest's `json-summary` output

**Required Vitest reporters:**

- `json-summary` (required) - For summary tables
- `json` (optional) - For file-specific reports

### Coverage Badges

Generate coverage badges using `coverage-badges-action`:

```yaml
- name: Update Coverage Badge
  uses: jpb06/coverage-badges-action@latest
  if: github.ref == 'refs/heads/main'
  with:
    coverage-summary-path: ./coverage/coverage-summary.json
    output-folder: ./badges
```

**Badge hosting options:**

1. **GitHub Gist** - Works with protected branches
2. **Repository branch** - Simpler but requires push access
3. **External service** - Codecov, Shields.io

### Complete CI Workflow Example

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v6
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm build
      - run: pnpm test:coverage

      # PR coverage comment
      - name: Coverage Report
        uses: davelosert/vitest-coverage-report-action@v2
        if: github.event_name == 'pull_request'
        with:
          json-summary-path: ./coverage/coverage-summary.json
          json-final-path: ./coverage/coverage-final.json
          file-coverage-mode: changes

      # Upload coverage artifacts
      - name: Upload Coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

### Vitest Configuration for CI

Enable `reportOnFailure` to generate reports even when thresholds fail:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'text-summary', 'html', 'json', 'json-summary', 'lcov'],
  reportsDirectory: './coverage',
  thresholds: {
    statements: 70,
    branches: 65,
    functions: 70,
    lines: 70,
  },
  // Critical: Generate reports even when thresholds fail
  reportOnFailure: true,
}
```

### When to Use Codecov vs Native Actions

**Use native GitHub Actions when:**

- Single package or simple monorepo
- Don't need historical trend analysis
- Want to minimize external dependencies
- GitHub-only workflow

**Consider Codecov when:**

- Need coverage trend graphs over time
- Multiple packages with aggregated reporting
- Team features (PR blocking, notifications)
- Cross-repository coverage tracking

## Development Workflow

### Coverage-Driven Development

1. **Identify Gaps**: Use HTML reports to visually identify untested code

2. **Prioritize Critical Paths**: Focus on high-risk, high-value code first

3. **Track Trends**: Monitor coverage over time, prevent regressions

4. **Code Review**: Require coverage reports in PR reviews

### Coverage Analysis Workflow

1. Run coverage after writing tests

2. Review HTML report for gaps

3. Write tests for uncovered code

4. Re-run coverage to verify improvement

5. Commit with confidence

## Common Pitfalls

### Don’t Aim for 100% Coverage

- **Why**: Diminishing returns, can lead to brittle tests

- **Better**: Focus on meaningful coverage of critical paths

- **Target**: 80-90% is usually sufficient

### Don’t Test Implementation Details

- Coverage should validate behavior, not internals

- Focus on public APIs and user-facing behavior

### Don’t Ignore Branch Coverage

- TypeScript’s type system creates many branches

- Union types, optional chaining, type guards all create branches

- Low branch coverage = untested error paths

### Don’t Exclude Too Much

- Be selective about exclusions

- Generated code: exclude

- Utility functions: include

- Test helpers: exclude if not part of public API

## Prioritization Guidelines

### High Priority (Always Cover)

- Public API functions and methods

- Error handling paths

- Business logic and domain rules

- Security-related code

- Data validation

### Medium Priority

- Internal utilities used by multiple modules

- Configuration parsing

- Logging and monitoring code

### Lower Priority

- One-time migration scripts

- Debug utilities (development only)

- Generated code (exclude entirely)

## Test Organization

| Test Type | Pattern | Include in Coverage |
| --- | --- | --- |
| Unit | `**/*.test.ts` | Yes |
| Integration | `**/*.integration.test.ts` | Yes |
| E2E | `**/*.e2e.test.ts` | No (exclude) |

## References

- [Vitest Coverage Documentation](https://vitest.dev/guide/coverage.html)

- [v8 Coverage Provider](https://github.com/vitest-dev/vitest/tree/main/packages/coverage-v8)

- [Code Coverage Best
  Practices](https://www.atlassian.com/continuous-delivery/software-testing/code-coverage)

- [Codecov Documentation](https://docs.codecov.com/)

- [vitest-coverage-report-action](https://github.com/marketplace/actions/vitest-coverage-report) -
  PR comments for Vitest

- [coverage-badges-action](https://github.com/jpb06/coverage-badges-action) - Badge generation

- [Vitest Code Coverage with GitHub
  Actions](https://medium.com/@alvarado.david/vitest-code-coverage-with-github-actions-report-compare-and-block-prs-on-low-coverage-67fceaa79a47) -
  Comprehensive tutorial
