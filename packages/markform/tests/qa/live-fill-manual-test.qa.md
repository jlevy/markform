# Manual End-to-End Fill Tests

> **Purpose**: Validate live agent form filling with real API keys.
> These tests capture complete FillRecord output for manual review.
> 
> **NOT automated** - Run manually before releases to verify end-to-end behavior.
> 
> **Environment**: Works with both direct network access and proxy environments.
> The CLI automatically configures proxy support via undici when HTTP_PROXY is set.

* * *

## Prerequisites

1. **Build the CLI**:
   ```bash
   pnpm build
   ```

2. **Set up API keys** in `.env` at the directory where you run the CLI:
   ```bash
   OPENAI_API_KEY=sk-...
   # Or for Anthropic:
   # ANTHROPIC_API_KEY=sk-ant-...
   ```

   The CLI automatically loads `.env` files from the current working directory.
   Loading order (highest priority first): shell env vars > `.env.local` > `.env`.

Note: Output files go to `test-output/` which is gitignored. Parent directories are
created automatically.

* * *

## Test 1: Simple Form Fill (OpenAI)

Fill the simple form with basic field types using GPT-5-mini.
Uses `--roles "*"` to fill all fields (the simple form has user-role fields by default).

**Note**: Use `openai/gpt-5-mini` for all manual testing - it’s the recommended model.

### Command

```bash
pnpm markform fill examples/simple/simple.form.md \
  --model openai/gpt-5-mini \
  --roles "*" \
  --output test-output/simple-filled.form.md \
  --record-fill \
  --instructions "Fill this form with realistic sample data."
```

### Expected Output Structure

```
⚠️  Warning: Filling all roles including user-designated fields
Available tools: fill_form, web_search
Filling form: .../examples/simple/simple.form.md
Agent: live (openai/gpt-5-mini)
Turn 1: 10 issue(s): age (missing), categories (missing), ...
  → 10 patches (tokens: ↓XXXX ↑XXX):
    age (number) = 42
    categories (multi_select) = [frontend, backend]
    ...
Turn 2: 10 issue(s): ...
  → 10 patches (tokens: ↓XXXX ↑XXX):
    ...
Turn 3: 1 issue(s): team_members (unanswered)
  → 1 patches (tokens: ↓XXXX ↑XX):
    team_members (table) = [2 rows]
  ✓ Complete
Form completed in 3 turn(s)
⏰ Fill time: 16.2s
Form written to: test-output/simple-filled.form.md

Fill completed in 16.2s (0 turns)

Tokens:  12,295 input / 519 output (openai/openai/gpt-5-mini)
Tools:   0 calls

Progress: 21/21 fields filled (100%)
Fill record written to: test-output/simple-filled.fill.json
Session Transcript

Form: .../examples/simple/simple.form.md
Mode: live
Version: 0.1.0

Harness Config:
  Max turns: 100
  Max patches/turn: 20
  Max issues/turn: 10

Turns (3):
  Turn 1: 10 issues → 10 patches → 2 remaining
  Turn 2: 10 issues → 10 patches → 0 remaining
  Turn 3: 1 issues → 1 patches → 0 remaining

Expected: ✓ complete
Completed form: test-output/simple-filled.form.md
```

### Verification Checklist

- [ ] Form completes without errors
- [ ] FillRecord summary shows token counts > 0
- [ ] Tool calls show succeeded count
- [ ] Progress shows fields filled
- [ ] Output file exists and is valid Markform
- [ ] Sidecar `.fill.json` file created with `--record-fill`

### Review Commands

```bash
# Check output form is valid
pnpm markform validate test-output/simple-filled.form.md

# Check fill status
pnpm markform status test-output/simple-filled.form.md

# View FillRecord sidecar
cat test-output/simple-filled.fill.json | jq .
```

* * *

## Test 2: Startup Research Form (Web Search)

Fill the startup research form which requires web search capabilities.

### Command

```bash
pnpm markform research examples/startup-research/startup-research.form.md \
  --model openai/gpt-5-mini \
  --company "Anthropic" \
  --output test-output/startup-anthropic.form.md \
  --record-fill
```

### Alternative: Manual Fill with Input

```bash
# If research command not available, use fill with pre-filled company name
pnpm markform fill examples/startup-research/startup-research.form.md \
  --model openai/gpt-5-mini \
  --output test-output/startup-filled.form.md \
  --record-fill
```

### Expected Output Structure

```
Filling form: .../startup-research.form.md
Agent: openai/gpt-5-mini
Turn 1: X issues
...
Form completed in N turn(s)
⏰ Fill time: X.Xs
Form written to: test-output/startup-filled.form.md

Fill completed in Xms (N turns)

Tokens:  XXXX input / XXXX output (openai/gpt-5-mini)
Tools:   N calls (N succeeded)

Progress: X/Y fields filled (XX%)
```

### Verification Checklist

- [ ] Form completes (may be partial due to research complexity)
- [ ] Multiple turns executed (research requires iteration)
- [ ] Token usage reflects complexity
- [ ] Company information fields populated
- [ ] URLs captured (company website, etc.)

* * *

## Test 3: Quiet Mode Verification

Verify `--quiet` suppresses the FillRecord summary.

### Command

```bash
pnpm markform fill examples/simple/simple.form.md \
  --model openai/gpt-5-mini \
  --output test-output/simple-quiet.form.md \
  --quiet
```

### Expected Output

Should show minimal output with NO FillRecord summary:
- No “Fill completed in …” line
- No “Tokens:” line
- No “Tools:” line
- No “Progress:” line

### Verification

```bash
# This should return nothing (no summary lines)
pnpm markform fill examples/simple/simple.form.md \
  --model openai/gpt-5-mini \
  --output test-output/simple-quiet2.form.md \
  --quiet 2>&1 | grep -E "^(Fill completed|Tokens:|Tools:|Progress:)"
```

* * *

## Test 4: FillRecord JSON Sidecar

Verify the `--record-fill` flag creates a complete FillRecord JSON sidecar.

### Command

```bash
pnpm markform fill examples/simple/simple.form.md \
  --model openai/gpt-5-mini \
  --output test-output/simple-record.form.md \
  --record-fill
```

### Verify Sidecar Contents

```bash
# Check sidecar file exists
ls -la test-output/simple-record.fill.json

# Verify JSON structure
cat test-output/simple-record.fill.json | jq 'keys'
# Expected: ["completedAt", "durationMs", "events", "finalProgress", "model", ...]

# Check events were captured
cat test-output/simple-record.fill.json | jq '.events | length'
# Should be > 0

# Check token usage
cat test-output/simple-record.fill.json | jq '.tokenUsage'
# Should show inputTokens and outputTokens > 0

# Check tool calls
cat test-output/simple-record.fill.json | jq '.toolCalls'
# Should show count > 0
```

### FillRecord Schema Verification

The sidecar should contain:

```json
{
  "startedAt": "2026-01-30T...",
  "completedAt": "2026-01-30T...",
  "durationMs": 1234,
  "status": "completed",
  "provider": "openai",
  "model": "gpt-5-mini",
  "tokenUsage": {
    "inputTokens": 1234,
    "outputTokens": 567
  },
  "toolCalls": {
    "count": 5,
    "succeeded": 5,
    "failed": 0
  },
  "turns": 3,
  "finalProgress": {
    "filled": 21,
    "total": 21,
    "percentage": 100
  },
  "events": [...]
}
```

* * *

## Test 5: Error Handling

Verify graceful handling of API errors.

### Test with Invalid API Key

```bash
OPENAI_API_KEY=invalid-key pnpm markform fill examples/simple/simple.form.md \
  --model openai/gpt-5-mini \
  --output test-output/simple-error.form.md 2>&1
```

### Expected Behavior

- Should show clear error message about authentication
- Should not crash with unhandled exception
- Exit code should be non-zero

* * *

## Test 6: Multi-Provider Comparison

Compare fill behavior across different providers (if keys available).

### OpenAI

```bash
pnpm markform fill examples/simple/simple.form.md \
  --model openai/gpt-5-mini \
  --output test-output/simple-openai.form.md \
  --record-fill
```

### Anthropic

```bash
pnpm markform fill examples/simple/simple.form.md \
  --model anthropic/claude-sonnet-4-5 \
  --output test-output/simple-anthropic.form.md \
  --record-fill
```

### Compare Results

```bash
# Compare token usage
echo "OpenAI tokens:"
cat test-output/simple-openai.fill.json | jq '.tokenUsage'

echo "Anthropic tokens:"
cat test-output/simple-anthropic.fill.json | jq '.tokenUsage'

# Compare turns needed
echo "OpenAI turns:"
cat test-output/simple-openai.fill.json | jq '.turns'

echo "Anthropic turns:"
cat test-output/simple-anthropic.fill.json | jq '.turns'
```

* * *

## Cleanup

```bash
rm -rf test-output
```

* * *

## Regression Checklist

Before release, verify:

- [ ] Test 1: Simple form fills completely
- [ ] Test 2: Research form captures company data
- [ ] Test 3: Quiet mode suppresses summary
- [ ] Test 4: FillRecord JSON sidecar is complete
- [ ] Test 5: Errors are handled gracefully
- [ ] Test 6: Multiple providers work (if keys available)

**Compare output to previous release** - Review FillRecord structure for unexpected
changes.

* * *

## Notes

- Tests require valid API keys - not suitable for CI automation
- Token costs apply - use sparingly
- Output may vary between runs due to LLM non-determinism
- Focus on structure verification, not exact output matching
