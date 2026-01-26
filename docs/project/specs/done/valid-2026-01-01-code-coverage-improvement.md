# Feature Validation: Code Coverage Improvement

## Purpose

Validation spec for the code coverage improvement implementation, covering all phases
of the plan spec. **Coverage target of 60%+ achieved!**

**Feature Plan:** [plan-2026-01-01-code-coverage-improvement.md]

## Stage 4: Validation Stage

## Validation Planning

This PR implements all phases of the coverage improvement plan:

1. **Phase 1**: Pure function tests (naming, initialValues)
2. **Phase 2**: Engine module tests (scopeRef, scopeRefValidation, parseTable)
3. **Phase 3**: Harness tests (rejectionMockAgent, harnessConfigResolver)
4. **Phase 4**: CLI utility tests (shared, formatting, versioning)
5. **Phase 5**: Engine edge cases (apply, parse)
6. **Phase 6**: Research validation, runMode, examples
7. **Phase 7**: Consolidated table-driven test refactoring
8. **Phase 8**: LLM mocking with session replay integration tests

## Automated Validation (Testing Performed)

### Unit Testing

All new tests follow the table-driven pattern as specified in the plan.

#### Phase 1: CLI Pure Functions (50 tests)

- **`tests/unit/cli/naming.test.ts`** (29 tests)
  - `toSnakeCase`: camelCase to snake_case conversion
  - `toCamelCase`: snake_case to camelCase conversion
  - `convertKeysToSnakeCase`: object key conversion
  - `convertKeysToCamelCase`: object key conversion

- **`tests/unit/cli/initialValues.test.ts`** (21 tests)
  - `parseInitialValues`: CLI arg parsing (name=value, name:number=123, name:list=a,b,c)
  - `validateInitialValueFields`: field ID validation against schema
  - Error handling for invalid formats

#### Phase 2: Engine Modules (94 tests)

- **`tests/unit/engine/scopeRef.test.ts`** (34 tests)
  - `parseScopeRef`: field refs, qualified refs, cell refs
  - `serializeScopeRef`: round-trip serialization
  - Type guards: `isFieldRef`, `isQualifiedRef`, `isCellRef`
  - `getFieldId`: extraction from all ref types

- **`tests/unit/engine/scopeRefValidation.test.ts`** (19 tests)
  - Field reference resolution against schema
  - Qualified reference resolution (options, columns)
  - Cell reference resolution for tables
  - `validateCellRowBounds`: row bounds checking

- **`tests/unit/engine/parseTable.test.ts`** (41 tests)
  - `parseCellValue`: all column types, sentinels (%SKIP%, %ABORT%)
  - `extractTableHeaderLabels`: header parsing
  - `parseRawTable`: row normalization, separator validation
  - `parseMarkdownTable`: column matching by label/id
  - `extractColumnsFromTable`: type row parsing
  - `parseInlineTable`: inline format parsing

#### Phase 3: Harness Modules (14 tests)

- **`tests/unit/harness/rejectionMockAgent.test.ts`** (6 tests)
  - Wrong patch generation for table fields on first attempt
  - Correct patch after rejection feedback
  - Correct patch for non-table fields immediately
  - Non-field issue handling
  - `maxPatches` limit enforcement

- **`tests/unit/harness/harnessConfigResolver.test.ts`** (8 tests)
  - Default config values
  - Frontmatter config precedence
  - Options override precedence
  - Partial options merging
  - Metadata edge cases

#### Phase 4-5: CLI Utilities and Engine Edge Cases

- **`tests/unit/cli/shared.test.ts`** (9 tests)
  - `formatPath`: relative path formatting with ANSI color output
  - `createNoOpSpinner`: spinner interface validation
  - `OUTPUT_FORMATS`: format constant validation

- **`tests/unit/engine/parseSentinels.test.ts`** (25 tests)
  - `parseSentinel`: %SKIP%, %ABORT% with optional reasons
  - Error handling for invalid sentinel syntax
  - Table-driven tests for all sentinel variants

- **`tests/unit/engine/apply.test.ts`** additions
  - Patch type mismatch scenarios
  - Table vs scalar field validation

- **`tests/unit/engine/parse.test.ts`** additions
  - Edge case error handling

#### Phase 6: Research and Run Mode

- **`tests/unit/cli/runMode.test.ts`** (16 tests)
  - Run mode detection and configuration

- **`tests/unit/research/researchFormValidation.test.ts`** (7 tests)
  - Research form validation logic

- **`tests/unit/cli/examples.test.ts`** additions
  - `getExampleOrder`, `getExamplePath` utilities

#### Phase 7-8: Session Replay Integration

- **`tests/integration/sessionReplay.test.ts`** (2 tests)
  - `createSessionMockModel`: Converts session wire format to MockLanguageModelV3
  - Full form fill integration with session replay
  - Validates LLM mocking approach for golden tests

#### Golden Tests

- **`tests/golden/golden.test.ts`** additions:
  - Complex Form Parse Tests for movie-deep-research form (42 fields)
  - Field value structure validation for all field types

### Integration and End-to-End Testing

- All 1318 tests pass (358+ new tests added in this PR)
- Pre-commit hooks run full test suite on each commit
- Pre-push hooks run full test suite before push
- Session replay integration test validates LLM mocking approach

### Coverage Results

| Metric | Before | After | Target | Status |
| --- | --- | --- | --- | --- |
| Lines | 50.81% | 60.73% | 60% | ✅ Achieved |
| Statements | 50.41% | 60.56% | 60% | ✅ Achieved |
| Branches | 49.27% | 59.30% | 55% | ✅ Achieved |
| Functions | 49.35% | 62.42% | 60% | ✅ Achieved |

**Coverage improved by ~10% in this PR (50.81% → 60.73%).**

**Total tests: 1318 (added 358+ new tests from baseline ~960)**

### Manual Testing Needed

The following should be verified by the user:

1. **Run tests and coverage locally:**
   ```bash
   pnpm --filter markform test
   pnpm --filter markform test:coverage
   ```

2. **Verify captureWireFormat flag behavior:**
   - The `fillForm()` API now requires `captureWireFormat: boolean` parameter
   - When `true`: wire format (full LLM prompts/responses) is logged in sessions
   - When `false`: wire format is omitted (smaller session files)
   - All existing CLI commands (`run`, `research`) pass `captureWireFormat: false`

3. **Review test patterns:**
   - Verify tests follow table-driven approach per the plan's guidelines
   - Confirm no long mechanistic tests were introduced

4. **Review movie research golden test:**
   - `examples/movie-research/movie-deep-research-mock-filled.form.md` contains Shawshank
     Redemption sample data
   - Verify the filled form parses correctly with all 42 fields

## Phase 7-8: LLM Integration Testing Strategy

### Research Findings

#### AI SDK Mock Providers

The [Vercel AI SDK provides official mock providers](https://ai-sdk.dev/docs/ai-sdk-core/testing)
for testing:

```typescript
import { MockLanguageModelV3 } from 'ai/test';

const mockModel = new MockLanguageModelV3({
  doGenerate: async () => ({
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: 'Hello, world!' }],
    warnings: [],
  }),
});
```

Key utilities from `ai/test`:
- **MockLanguageModelV3**: Full mock language model for `generateText`
- **mockValues**: Iterator for cycling through predefined responses
- **simulateReadableStream**: For testing streaming responses

#### Record/Replay Pattern

The existing session YAML format already captures both request and response:

```yaml
turns:
  - turn: 1
    wire:
      request:
        system: "..."   # System prompt sent to LLM
        prompt: "..."   # User prompt
        tools: {...}    # Tool definitions
      response:
        steps:          # LLM response (tool calls)
          - tool_calls:
              - tool_name: generatePatches
                input: {...}
        usage:
          input_tokens: 0
          output_tokens: 0
```

This enables **golden test replay** of full LiveAgent flows without actual LLM calls.

### Proposed Architecture

#### 1. Session-Based Mock Agent

Create a mock agent that reads recorded session responses:

```typescript
import { MockLanguageModelV3 } from 'ai/test';

function createSessionMockModel(sessionPath: string): MockLanguageModelV3 {
  const session = loadSession(sessionPath);
  let turnIndex = 0;

  return new MockLanguageModelV3({
    doGenerate: async () => {
      const turn = session.turns[turnIndex++];
      return {
        finishReason: 'stop',
        usage: turn.wire.response.usage,
        toolCalls: turn.wire.response.steps[0].tool_calls.map(tc => ({
          type: 'tool-call',
          toolName: tc.tool_name,
          args: tc.input,
        })),
      };
    },
  });
}
```

#### 2. Full Integration Test Flow

```typescript
it('replays movie-research session with MockLanguageModelV3', async () => {
  const sessionPath = 'examples/movie-research/movie-research.session.yaml';
  const mockModel = createSessionMockModel(sessionPath);

  const agent = createLiveAgent({
    model: mockModel,
    enableWebSearch: false,
  });

  const form = parseForm(loadFormContent('movie-research.form.md'));
  const result = await runHarness(form, agent, { maxTurns: 3 });

  expect(result.isComplete).toBe(true);
  // Verify against expected filled form
});
```

#### 3. Coverage Opportunities

This approach enables testing of currently-uncovered modules:
- **liveAgent.ts**: `generatePatches()` method (~7% → ~60%)
- **runResearch.ts**: Full research flow (~0% → ~40%)
- **harness.ts**: Real agent loop execution (~84% → ~95%)

### Implementation Phases

**Phase 7: Mock Infrastructure** (Estimated: 1-2 sessions)
1. Add `ai/test` imports to test dependencies
2. Create `tests/fixtures/sessionMock.ts` helper
3. Implement `createSessionMockModel()` function
4. Add test for basic LiveAgent.generatePatches with mock

**Phase 8: Full Integration Tests** (Estimated: 2-3 sessions)
1. Create movie-research integration test with recorded session
2. Test multi-turn form completion
3. Test web search tool integration (mock web_search tool)
4. Add rejection/retry flow tests

### Alternative: Eval-Style Testing

For ongoing LLM quality assurance, consider [vitest-evals](https://github.com/getsentry/vitest-evals):

```typescript
import { describeEval, ToolCallScorer } from 'vitest-evals';

describeEval('form-filling', {
  data: [{ form: 'simple.form.md', expected: 'simple-filled.form.md' }],
  task: async ({ form }) => runFormFill(form),
  scorers: [new ToolCallScorer({ expected: ['generatePatches'] })],
  threshold: 0.9,
});
```

This enables:
- Continuous LLM output evaluation
- Regression detection for prompt changes
- Scoring of tool call accuracy

## Open Questions (Resolved)

1. **Session recording mode**: Existing `captureWireFormat` flag captures LLM requests/responses.
   The session replay integration test demonstrates this works for golden testing.

2. **Test isolation**: MockLanguageModelV3 from `ai/test` provides proper isolation.
   Session replay pattern allows deterministic replay without external dependencies.

3. **Coverage target**: 60% target achieved (60.73% lines). Future work could pursue 70%+
   by expanding LLM mocking to cover more flows (research, multi-turn, web search).

## Status: Complete ✅

All coverage targets met. Ready for PR review.
