# Coverage Strategy Review

**Author**: Senior Engineer Review (Claude)
**Date**: 2026-01-06
**Status**: Analysis Complete

## Executive Summary

This document presents a strategic review of the test coverage infrastructure, analyzing whether coverage is being measured correctly, evaluating the effectiveness of the tryscript framework, and proposing high-leverage improvements to achieve 90%+ coverage while maintaining code quality.

**Key Findings:**
1. ✅ Source-only line coverage is already excellent at **96.9%**
2. ⚠️ Branch coverage is **69.7%** - this is the real gap
3. 🐛 Coverage config bug: c8 includes node_modules, inflating reported numbers
4. 📊 Three files (1144 lines) are genuinely untestable and should be excluded

**Recommendation:** With strategic exclusions and config fixes, the project can achieve **90%+ effective coverage** with minimal additional tests.

---

## Current State Analysis

### Coverage Configuration Issue

The current c8 configuration in `package.json` includes `--include 'dist/**'` which incorrectly pulls in transpiled node_modules:

```json
"test:coverage": "c8 --src src --all --include 'src/**' --include 'dist/**' ..."
```

This causes the coverage report to include external packages like:
- `@ai-sdk/anthropic/dist/index.mjs` (77.04% coverage reported)
- `@ai-sdk/provider-utils/dist/index.mjs` (97.36% coverage reported)

**Impact:** The reported 94.34% coverage is artificially inflated by ~7,400 lines of external code.

### True Source Coverage (Excluding node_modules)

| Metric | Current | Target |
|--------|---------|--------|
| Files | 69 | - |
| Lines | 96.9% | 90% |
| Branches | 69.7% | 75% |
| Functions | 69.9% | 80% |

**Line coverage is already excellent.** The real gap is branch coverage.

### Low-Coverage Files Analysis

| File | Lines | Branches | Root Cause |
|------|-------|----------|------------|
| `research.ts` | 33.7% | 100% | Requires web-search API |
| `browse.ts` | 76.2% | 100% | Interactive @clack/prompts |
| `run.ts` | 78.9% | 100% | Interactive @clack/prompts |
| `report.ts` | 82.5% | 50% | Missing tryscript tests |
| `apply.ts` | 85.1% | 29.4% | Error handling untested |
| `runMode.ts` | 89.9% | 25% | Edge cases untested |

### Branch Coverage Gaps

Top files with significant uncovered branches:

| File | Uncovered Branches | Nature |
|------|-------------------|--------|
| `engine/serialize.ts` | 97 | Edge cases in serialization |
| `engine/parse.ts` | 51 | Error handling paths |
| `cli/commands/serve.ts` | 49 | Server edge cases |
| `engine/apply.ts` | 36 | Patch validation errors |
| `cli/commands/inspect.ts` | 36 | Format/output options |

---

## Tryscript Framework Effectiveness

### What Tryscript Covers Well

The tryscript tests in `tests/cli/*.tryscript.md` effectively cover:

1. **CLI command basics** - `--version`, `--help` for all commands
2. **Happy path workflows** - inspect, export, dump, validate, status
3. **Error handling** - Missing files, invalid options, conflicts
4. **Apply command** - Patching forms with JSON patches
5. **Mock fill workflows** - Using `--mock` and `--mock-source`

### What Tryscript Cannot Cover

| Area | Reason | Alternative |
|------|--------|-------------|
| Interactive CLI (browse, run) | Requires TTY input | Exclude from coverage |
| Research command | Requires web-search API | Exclude from coverage |
| Branch paths in CLI commands | Only tests main path | Add unit tests |
| Server WebSocket handlers | Requires running server | Integration tests |

### Golden Tests Effectiveness

Golden tests in `tests/golden/` provide excellent coverage of:
- Form parsing for all field types
- Session replay with mock agents
- JSON schema generation
- Export format generation (report.md, .yml, .schema.json)

---

## Strategic Recommendations

### Strategy 1: Fix Coverage Configuration

**Action:** Update `package.json` to properly exclude node_modules:

```json
"test:coverage": "c8 --src src --all --include 'src/**' --exclude '**/node_modules/**' --exclude '**/*[Tt]ypes.ts' --exclude '**/index.ts' ..."
```

Or better, rely on vitest's built-in coverage which is already configured correctly.

**Impact:** Accurate coverage numbers without external package inflation.

### Strategy 2: Exclude Genuinely Untestable Code

**Files to exclude:**

```typescript
// vitest.config.ts
exclude: [
  // ... existing exclusions ...
  '**/research.ts',        // Requires web-search LLM API
  '**/browse.ts',          // Interactive @clack/prompts UI
  '**/commands/run.ts',    // Interactive @clack/prompts UI
]
```

**Rationale:**
- `research.ts` - The research command requires web-search-enabled LLM APIs (Google, OpenAI) which cannot be mocked in coverage tests. The underlying `runResearch.ts` module IS covered.
- `browse.ts` / `run.ts` - These use `@clack/prompts` for interactive menus which require TTY input. The helper functions they call ARE covered.

**Impact:** Coverage with exclusions = **98.2% lines**

### Strategy 3: High-Leverage Branch Coverage Improvements

Add targeted tests for the highest-impact uncovered branches:

#### Priority 1: Engine Apply Errors (36 branches)

Add unit tests for:
- Invalid patch types
- Field type mismatches
- Missing field errors
- Table column validation

```typescript
// tests/unit/engine/apply.test.ts
describe('patch validation errors', () => {
  it('rejects patch for non-existent field', ...);
  it('rejects type mismatch (string to number)', ...);
  it('rejects invalid table row structure', ...);
});
```

#### Priority 2: CLI Format Options

Add tryscript tests for format variations:

```markdown
# Test: inspect --format=yaml
$ $CLI inspect examples/simple/simple.form.md --format=yaml | head -5
...

# Test: validate with all issue types
$ $CLI validate examples/validation-errors.form.md
...
```

#### Priority 3: Serialize Edge Cases

Add unit tests for serialization edge cases:
- Empty values
- Special characters
- Boundary conditions

### Strategy 4: Progressive Threshold Increases

Update thresholds incrementally:

| Phase | Lines | Branches | Functions |
|-------|-------|----------|-----------|
| Current | 50% | 49% | 49% |
| After config fix | 85% | 65% | 65% |
| After exclusions | 90% | 70% | 70% |
| After targeted tests | 95% | 75% | 75% |

---

## Implementation Plan

### Phase 1: Configuration Fixes (Immediate)

1. Update vitest.config.ts to exclude interactive/API-dependent files
2. Fix or remove the c8 configuration
3. Update CI workflow if needed

### Phase 2: Targeted Tests (1-2 hours)

1. Add apply.ts error path tests
2. Add format option tryscript tests
3. Add report command tryscript tests

### Phase 3: Threshold Updates

1. Update thresholds after each improvement
2. Add coverage badges to reflect true coverage

---

## Conclusion

The coverage infrastructure is fundamentally sound. The tryscript framework effectively tests CLI behavior, and golden tests ensure the core engine works correctly. The main issues are:

1. **Configuration artifact** - c8 including node_modules
2. **Missing exclusions** - Interactive/API code counting against coverage
3. **Branch coverage gap** - Error paths not tested

By implementing the recommendations above, the project can achieve **90%+ meaningful coverage** while avoiding the maintenance burden of brittle unit tests. The strategy aligns with the golden testing guidelines: few but comprehensive end-to-end tests, supplemented by targeted unit tests for edge cases.

---

## Appendix: Coverage Calculation Details

### Source Files Breakdown

```
Total source files: 69
Total lines: 25,369
Covered lines: 24,582 (96.9%)

With exclusions (research.ts, browse.ts, run.ts):
Total lines: 24,225
Covered lines: 23,799 (98.2%)
```

### Files Already Well-Covered (>95%)

- `engine/coreTypes.ts` - 100%
- `engine/validate.ts` - 98.24%
- `engine/parseFields.ts` - 99.73%
- `engine/serialize.ts` - 98.92%
- `harness/liveAgent.ts` - 100%
- `harness/mockAgent.ts` - 100%
- `cli/lib/*` - Most at 100%
