# Research Brief: Code Coverage Merging for CLI Subprocess Testing

**Last Updated**: 2026-01-07

**Status**: Complete

**Related**:

- `docs/project/research/test-coverage-strategy.md`
- [tryscript#20](https://github.com/jlevy/tryscript/issues/20) - Add --exclude-node-modules
- [tryscript#22](https://github.com/jlevy/tryscript/issues/22) - Use ast-v8-to-istanbul
- [markform#95](https://github.com/jlevy/markform/pull/95) - Coverage merge documentation

* * *

## Executive Summary

This research investigates why merging coverage reports from vitest (unit tests) and tryscript (CLI subprocess tests) produces inflated line counts. The root cause is a fundamental difference in how the two tools convert V8 coverage data to Istanbul format:

- **vitest** uses `ast-v8-to-istanbul` which parses source code AST to identify only executable lines
- **c8/tryscript** uses `v8-to-istanbul` which maps all source-mapped lines, including non-executable ones

This results in vitest reporting 57 lines for a file while c8 reports 282 lines for the same file. When merged using the standard LCOV union algorithm, the inflated c8 line counts dominate the totals.

**Research Questions**:

1. Why does merging vitest and tryscript coverage produce inflated totals?

2. What is the standard algorithm for merging LCOV coverage reports?

3. Why do c8 and vitest report different line counts for the same file?

4. What is the proper fix for accurate merged coverage?

* * *

## Research Methodology

### Approach

1. Reviewed PR #94 and existing coverage merge implementation
2. Researched industry-standard LCOV merge algorithms (lcov-result-merger, nyc merge, istanbul-merge)
3. Tested coverage collection using tsx vs bundled dist to isolate variables
4. Compared vitest and c8 dependency trees to identify converter differences
5. Analyzed ast-v8-to-istanbul and v8-to-istanbul approaches

### Sources

- [lcov-result-merger](https://github.com/mweibel/lcov-result-merger) - Standard LCOV merge tool
- [nyc](https://github.com/istanbuljs/nyc) - Istanbul CLI with merge support
- [ast-v8-to-istanbul](https://github.com/AriPerkkio/ast-v8-to-istanbul) - AST-aware V8 coverage converter
- [v8-to-istanbul](https://github.com/istanbuljs/v8-to-istanbul) - Standard V8 coverage converter
- [Vitest coverage documentation](https://vitest.dev/guide/coverage)
- [c8 documentation](https://github.com/bcoe/c8)

* * *

## Research Findings

### Standard LCOV Merge Algorithm

**Status**: ✅ Complete

**Details**:

The industry-standard algorithm for merging LCOV coverage reports (used by lcov-result-merger, nyc merge, istanbul-merge):

1. **Union of coverpoints**: All lines/branches/functions from both sources appear in result
2. **Sum hit counts**: For coverpoints in both sources, add the hit counts together
3. **Preserve unique coverpoints**: Lines in only one source are added with their original count

```
Source A: {line 21: 33 hits, line 27: 33 hits}
Source B: {line 21: 5 hits, line 85: 12 hits}
Merged:   {line 21: 38 hits, line 27: 33 hits, line 85: 12 hits}
```

**Assessment**: The merge-coverage.ts script correctly implements this algorithm.

* * *

### Subprocess Coverage Collection

**Status**: ✅ Complete

**Details**:

Vitest's coverage only tracks code executed in the **main process**. CLI commands run by tryscript execute as **subprocesses**, making them invisible to vitest.

The solution is `NODE_V8_COVERAGE`:

1. Set `NODE_V8_COVERAGE=/path/to/dir` environment variable
2. Node.js writes V8 coverage JSON files when **any** process exits
3. This includes all subprocesses spawned by the test runner
4. c8 (or similar tool) aggregates these files into a report

This is why tryscript uses c8 - it's the standard way to collect subprocess coverage.

**Assessment**: The subprocess collection mechanism is correct and necessary.

* * *

### The Line Count Inflation Problem

**Status**: ✅ Complete

**Details**:

Experimental results for `settings.ts` (282 actual lines):

| Collection Method | Lines Reported |
|-------------------|----------------|
| vitest (@vitest/coverage-v8) | 57 |
| c8 via tsx (source) | 282 |
| c8 via dist (bundled) | 282 |

Key finding: **Running via tsx does NOT fix the issue**. Both tsx and bundled dist report 282 lines.

The difference is not about bundled vs source code. It's about the coverage converter.

**Assessment**: The inflation comes from the converter, not the code being executed.

* * *

### V8 Coverage Converters

**Status**: ✅ Complete

**Details**:

| Tool | Converter Package | Approach |
|------|-------------------|----------|
| vitest | `ast-v8-to-istanbul` | AST-aware, parses code to find executable lines |
| c8 | `v8-to-istanbul` | Direct mapping of source-mapped ranges |

**ast-v8-to-istanbul** (used by vitest):
- Parses source code using an AST parser (acorn, babel, oxc)
- Identifies which lines contain executable statements
- Only reports those lines as coverpoints
- Tagline: "Speed of V8 coverage, Accuracy of Istanbul coverage"

**v8-to-istanbul** (used by c8):
- Maps V8 byte ranges directly to source locations via source maps
- Reports all source-mapped lines as coverpoints
- Includes imports, comments, type definitions (compiled away)

**Assessment**: This is the root cause. ast-v8-to-istanbul provides Istanbul-quality accuracy while v8-to-istanbul reports all source-mapped lines.

* * *

### Node_modules Inclusion Issue

**Status**: ✅ Complete

**Details**:

Tryscript's c8 invocation includes `--all` and `--include 'dist/**'` but not `--exclude-node-modules`. This causes node_modules like `@ai-sdk/anthropic` to appear in coverage reports:

```
...ode_modules/@ai-sdk/anthropic/dist |   77.04% |
...odules/@ai-sdk/provider-utils/dist |   97.36% |
```

**Assessment**: Separate issue from line count inflation. Fixed by adding `--exclude-node-modules` flag. Filed as [tryscript#20](https://github.com/jlevy/tryscript/issues/20).

* * *

## Comparative Analysis

| Aspect | vitest | c8/tryscript |
|--------|--------|--------------|
| Coverage provider | @vitest/coverage-v8 | c8 |
| V8-to-Istanbul converter | ast-v8-to-istanbul | v8-to-istanbul |
| Lines reported (settings.ts) | 57 | 282 |
| Executable lines only | Yes | No |
| Subprocess support | No (main process only) | Yes (via NODE_V8_COVERAGE) |
| Node_modules filtering | Built-in | Requires --exclude-node-modules |

**Strengths/Weaknesses Summary**:

- **vitest**: Accurate line counts, but can't cover subprocess code
- **c8**: Covers subprocesses, but inflated line counts due to v8-to-istanbul
- **Merging both**: Produces inflated totals due to incompatible line counting

* * *

## Best Practices

1. **Use consistent coverage converters**: When merging coverage from multiple tools, ensure they use the same line counting methodology.

2. **Subprocess coverage requires NODE_V8_COVERAGE**: Standard coverage tools only track the main process. Use c8 or similar for subprocess coverage.

3. **Filter node_modules**: Always use `--exclude-node-modules` or equivalent when collecting CLI coverage.

4. **Standard LCOV merge**: Use union with hit count summation. Don't invent custom merge logic.

5. **AST-aware converters for accuracy**: Tools like ast-v8-to-istanbul provide Istanbul-quality accuracy with V8 speed.

* * *

## Open Research Questions

1. **c8 migration to ast-v8-to-istanbul**: Would c8 maintainers accept a PR to use ast-v8-to-istanbul? This would fix the ecosystem-wide issue.

2. **Performance impact**: How does ast-v8-to-istanbul's AST parsing affect coverage generation time compared to v8-to-istanbul?

3. **Alternative merge strategies**: Could the merge script use vitest's line definitions as "ground truth" and only add tryscript hits for those lines? This is a workaround, not a fix.

* * *

## Recommendations

### Summary

The proper fix is to make tryscript use `ast-v8-to-istanbul` instead of c8's `v8-to-istanbul` for coverage conversion. This will produce line counts consistent with vitest, enabling accurate merged reports.

### Recommended Approach

**For tryscript** (filed as [#22](https://github.com/jlevy/tryscript/issues/22)):

1. Keep `NODE_V8_COVERAGE` subprocess collection (unchanged)
2. Replace c8 report generation with direct use of `ast-v8-to-istanbul`
3. Output Istanbul-compatible reports (lcov, json, html)

**For markform** (until tryscript is fixed):

Option A: **Accept inflation** - Use standard merge, document that totals are inflated
Option B: **Vitest ground truth** - Only merge hits for lines vitest reports as executable
Option C: **Separate reporting** - Don't merge, report vitest and tryscript coverage separately

### Alternative Approaches

**Fix c8 upstream**: Make c8 use ast-v8-to-istanbul. Would fix the ecosystem but is a larger change.

**Istanbul provider in both**: Use `coverage: { provider: 'istanbul' }` in vitest and istanbul-based coverage in tryscript. Both would use the same instrumentation. However, Istanbul instrumentation is slower than V8.

* * *

## References

- [lcov-result-merger](https://github.com/mweibel/lcov-result-merger) - Standard LCOV merge algorithm
- [ast-v8-to-istanbul](https://github.com/AriPerkkio/ast-v8-to-istanbul) - AST-aware converter (used by vitest)
- [v8-to-istanbul](https://github.com/istanbuljs/v8-to-istanbul) - Standard converter (used by c8)
- [nyc documentation](https://github.com/istanbuljs/nyc) - Istanbul CLI with merge examples
- [Vitest coverage merging discussion](https://github.com/vitest-dev/vitest/discussions/3744) - Known V8 vs Istanbul issues
- [NODE_V8_COVERAGE](https://nodejs.org/docs/latest/api/cli.html#node_v8_coveragedir) - Node.js coverage environment variable

* * *

## Appendices

### Appendix A: Experimental Data

**Test: Compare coverage line counts for settings.ts**

```bash
# vitest coverage
$ pnpm test:coverage:vitest
# Result: settings.ts has 57 DA lines in lcov.info

# tsx via c8
$ rm -rf /tmp/tsx-cov
$ NODE_V8_COVERAGE=/tmp/tsx-cov pnpm exec tsx src/cli/bin.ts --version
$ c8 report --temp-directory /tmp/tsx-cov --reporter lcov
# Result: settings.ts has 282 DA lines in lcov.info

# dist via c8
$ rm -rf /tmp/dist-cov
$ NODE_V8_COVERAGE=/tmp/dist-cov node dist/bin.mjs --version
$ c8 report --temp-directory /tmp/dist-cov --reporter lcov
# Result: settings.ts has 282 DA lines in lcov.info
```

**Conclusion**: tsx does not fix the issue. Both tsx and dist produce 282 lines via c8.

### Appendix B: Package Dependencies

**vitest (@vitest/coverage-v8)**:
```json
{
  "dependencies": {
    "ast-v8-to-istanbul": "^0.3.8",
    "istanbul-lib-coverage": "^3.2.2",
    ...
  }
}
```

**c8**:
```json
{
  "dependencies": {
    "v8-to-istanbul": "^9.0.0",
    "istanbul-lib-coverage": "^3.2.0",
    ...
  }
}
```

### Appendix C: Merge Script Implementation

The merge-coverage.ts script in markform implements the standard LCOV merge algorithm:

```typescript
// For coverpoints in both: sum hit counts
// For coverpoints in only one: add to result (union)
function mergeCoverageData(a: CoverageData, b: CoverageData): CoverageData {
  // ... union with hit count summation
}
```

The script also filters node_modules via `shouldExcludeFile()` to address issue #20.
