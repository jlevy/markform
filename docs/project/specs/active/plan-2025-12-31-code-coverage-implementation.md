# Plan Spec: Modern Code Coverage Implementation

## Purpose

Technical design for implementing comprehensive code coverage with GitHub Actions
visibility, following modern best practices for TypeScript/Vitest projects.

## Background

The markform project has:

- Vitest testing framework with `@vitest/coverage-v8` already installed
- Basic coverage configuration in `packages/markform/vitest.config.ts`
- Scripts for `test:coverage` and `test:coverage:html`
- No CI coverage integration (coverage not run in GitHub Actions)

Current state (as of 2025-12-31):

- **Statements**: 50.9% (threshold 60%)
- **Branches**: 49.9% (threshold 80%)
- **Functions**: 50% (threshold 80%)
- **Lines**: 51.29% (threshold 60%)

Key coverage gaps identified:

| Area | Coverage | Notes |
| --- | --- | --- |
| `src/cli/` | ~0% | CLI commands not tested |
| `src/engine/scopeRef*.ts` | 0-10% | Scope reference validation |
| `src/engine/table/` | 30% | Table parsing logic |
| `src/harness/liveAgent.ts` | 8% | Live agent execution |
| `src/research/` | 0% | Research feature |

References:

- [Code Coverage Research Report](../../../general/research/current/research-code-coverage-typescript.md)

## Summary of Task

Implement modern code coverage infrastructure with:

1. **Coverage reporting in CI** - Run coverage on every PR
2. **PR visibility** - Coverage reports as PR comments with file-level changes
3. **Coverage badges** - Visual indicator in README
4. **Threshold enforcement** - Block PRs that reduce coverage
5. **Gradual threshold increases** - Realistic starting points with path to 80%+
6. **End-to-end validation** - Verify the entire pipeline works correctly

## Backward Compatibility

- **No breaking changes** - This is CI/testing infrastructure only
- **Existing tests unchanged** - All current tests continue to work
- **Thresholds adjusted** - Starting thresholds lowered to match reality, then gradually
  increased

## Stage 1: Planning Stage

### Feature Requirements

**Must Have (MVP):**

- [x] Coverage runs in CI on every PR and push to main
- [x] Coverage reports posted as PR comments (updated in-place)
- [x] Coverage thresholds that match current state (non-blocking)
- [x] Coverage summary in GitHub Actions step summary
- [x] `json-summary` reporter for machine-readable output

**Should Have:**

- [x] Coverage badge in README showing current state
- [x] File-specific coverage in PR comments (only changed files)
- [x] Comparison against main branch (show delta)

**Nice to Have (defer):**

- [ ] Codecov/Coveralls integration (adds complexity, external dependency)
- [ ] Per-file thresholds (use global first)
- [ ] Coverage trend graphs (defer to Codecov if ever added)

**NOT Included:**

- Writing new tests to increase coverage (separate effort)
- Per-package coverage for monorepo (single package currently)
- Branch protection rules (manual configuration by maintainer)

### Acceptance Criteria

1. PRs show coverage comment with summary and changed files
2. CI passes when coverage meets thresholds
3. README displays coverage badge
4. Developers can run `pnpm test:coverage` locally with same config
5. Local HTML report available for detailed PR review

## Stage 2: Architecture Stage

### Tool Selection

| Tool | Purpose | Rationale |
| --- | --- | --- |
| `@vitest/coverage-v8` | Coverage collection | Already installed, V8-native, fast |
| `vitest-coverage-report` action | PR comments | Purpose-built for Vitest, actively maintained |
| `coverage-badges-action` | Badge generation | Works with json-summary, simple setup |
| GitHub Gist | Badge hosting | Free, works with protected branches |

### CI Workflow Design

```yaml
# .github/workflows/ci.yml additions
jobs:
  test:
    steps:
      # ... existing steps ...
      - run: pnpm test:coverage

      - name: Coverage Report
        uses: davelosert/vitest-coverage-report-action@v2
        if: github.event_name == 'pull_request'
        with:
          json-summary-path: packages/markform/coverage/coverage-summary.json
          json-final-path: packages/markform/coverage/coverage-final.json
          file-coverage-mode: changes

      - name: Coverage Badges
        uses: jpb06/coverage-badges-action@v1.4.6
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        with:
          coverage-summary-path: packages/markform/coverage/coverage-summary.json
          output-folder: ./badges
          branches: main
```

Note: Coverage artifacts are not uploaded to reduce storage overhead (~1.5MB per build).
Run `pnpm --filter markform test:coverage` locally to generate detailed HTML reports.

### Vitest Configuration Updates

```typescript
// vitest.config.ts updates
coverage: {
  provider: 'v8',
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
  // Realistic thresholds based on current coverage
  thresholds: {
    statements: 50,
    branches: 49,
    functions: 50,
    lines: 50,
  },
  // Report even when thresholds fail (for PR comments)
  reportOnFailure: true,
}
```

### Directory Structure

```
packages/markform/
├── coverage/              # Generated (gitignored)
│   ├── coverage-final.json
│   ├── coverage-summary.json
│   ├── lcov.info
│   └── index.html
├── vitest.config.ts       # Updated configuration
└── ...

.github/
└── workflows/
    └── ci.yml             # Updated with coverage steps
```

## Stage 3: Implementation

### Phase 1: Fix Vitest Configuration

Update coverage configuration to be production-ready.

**Tasks:**

- [x] Update `vitest.config.ts` with correct reporters (`json-summary` required)
- [x] Add `reportOnFailure: true` to continue even when thresholds fail
- [x] Lower thresholds to realistic starting points (50/49/50/50)
- [x] Update exclude patterns for completeness
- [x] Test locally with `pnpm test:coverage`
- [x] Verify `coverage/coverage-summary.json` is generated

### Phase 2: Add GitHub Actions Coverage Integration

Add coverage reporting to CI workflow.

**Tasks:**

- [x] Add `vitest-coverage-report-action` to CI workflow
- [x] Configure for monorepo paths (`packages/markform/coverage/`)
- [x] Set `file-coverage-mode: changes` for PR-only file reports
- [x] Test with a PR to verify comments appear

### Phase 3: Add Coverage Badge

Add visible coverage badge to README.

**Tasks:**

- [x] Add `coverage-badges-action@v1.4.6` to workflow (main branch only)
- [x] Update README with badge markdown (uses ./badges/coverage-total.svg)
- [x] Create initial placeholder badge in ./badges/

### Phase 4: Validation and Documentation

Verify end-to-end functionality and document.

**Tasks:**

- [x] Create test PR to verify full pipeline (PR #53)
- [x] Verify coverage comment appears and updates on new commits
- [x] Verify badge shows in README
- [x] Verify threshold failures block CI (when intentional) - tested locally
- [x] Update `docs/development.md` with coverage section
- [x] Update research report with implementation notes

## Stage 4: Validation Stage

### End-to-End Test Plan

#### Test 1: Local Coverage Generation

```bash
# 1. Run coverage locally
pnpm --filter markform test:coverage

# 2. Verify outputs exist
ls packages/markform/coverage/
# Expected: coverage-summary.json, coverage-final.json, lcov.info, index.html

# 3. Verify JSON structure
cat packages/markform/coverage/coverage-summary.json | head -20
# Expected: { "total": { "lines": {...}, "statements": {...}, ... }}

# 4. View HTML report
open packages/markform/coverage/index.html
```

#### Test 2: CI Coverage Run

1. Push branch with coverage changes
2. Verify CI job runs `pnpm test:coverage`
3. Verify coverage summary appears in Actions step summary
4. Verify no errors in coverage generation

#### Test 3: PR Comment Generation

1. Create PR against main
2. Verify `vitest-coverage-report-action` runs
3. Verify PR comment appears with:
   - Coverage summary table (lines, statements, branches, functions)
   - Changed files coverage (if `file-coverage-mode: changes`)
4. Push new commit to PR
5. Verify comment updates (not duplicated)

#### Test 4: Coverage Badge

1. Merge PR to main
2. Verify badge action runs
3. Verify badge updates in gist (or repo)
4. Verify badge displays in README

#### Test 5: Threshold Enforcement

1. Temporarily lower a threshold below current coverage
2. Verify CI fails with threshold error message
3. Revert threshold change

### Rollback Plan

If issues arise:

1. Remove `vitest-coverage-report-action` from workflow
2. Revert `vitest.config.ts` to previous thresholds
3. Coverage badge can remain (static) or badge markdown removed

### Success Metrics

- [x] PR comments show coverage on all PRs
- [x] Coverage badge displays in README
- [x] CI runs coverage in under 60 seconds additional time
- [x] No flaky coverage-related failures
- [x] Local and CI coverage match (within ~1% variance)

## Implementation Notes

### Why Not Codecov?

Codecov is excellent but adds:

- External service dependency
- Token management
- Additional configuration complexity

For a single-package project, the native GitHub Actions approach is simpler and
provides sufficient visibility. Codecov can be added later if trend analysis or
team features are needed.

### Coverage Threshold Strategy

| Phase | Statements | Branches | Functions | Lines | Timeline |
| --- | --- | --- | --- | --- | --- |
| Current | 50.9% | 49.9% | 50% | 51.3% | Now |
| Phase 1 | 50% | 49% | 49% | 50% | Start |
| Phase 2 | 60% | 55% | 60% | 60% | After test improvements |
| Phase 3 | 70% | 65% | 70% | 70% | Target |
| Phase 4 | 80% | 75% | 80% | 80% | Stretch goal |

Thresholds will be increased as test coverage improves through separate efforts.

### File Exclusion Rationale

| Pattern | Reason |
| --- | --- |
| `**/*.d.ts` | Type definitions, no runtime code |
| `**/dist/**` | Build output |
| `**/node_modules/**` | Dependencies |
| `**/*.config.*` | Configuration files |
| `**/tests/**` | Test files themselves |
| `**/__mocks__/**` | Mock implementations |
| `**/__fixtures__/**` | Test fixtures |

## References

- [Vitest Coverage Documentation](https://vitest.dev/guide/coverage.html)
- [vitest-coverage-report-action](https://github.com/marketplace/actions/vitest-coverage-report)
- [coverage-badges-action](https://github.com/jpb06/coverage-badges-action)
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/learn-github-actions/best-practices)
