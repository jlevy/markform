---
close_reason: null
closed_at: 2025-12-23T21:21:09.090Z
created_at: 2025-12-23T21:15:55.647Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.917Z
    original_id: markform-105
id: is-01kg3x1bv072pvws0cdg48pszd
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Implement LiveAgent class using AI SDK
type: is
updated_at: 2025-12-23T21:21:09.090Z
version: 1
---
Implement the LiveAgent class that uses Vercel AI SDK to generate patches via LLM.

**Location:** `harness/liveAgent.ts`

**Interface:** Implements `Agent` interface from `mockAgent.ts`:
```typescript
interface Agent {
  generatePatches(
    issues: InspectIssue[],
    form: ParsedForm,
    maxPatches: number
  ): Promise<Patch[]>;
}
```

**Implementation:**
- Constructor takes `LiveAgentConfig`: `{ model, maxStepsPerTurn, systemPrompt? }`
- Uses `generateText` from AI SDK with Markform tools
- Builds context prompt with form state, issues, field types
- Extracts patches from tool call results
- Handles rate limits and API errors gracefully (retry with backoff)

**AI SDK Integration:**
- Uses existing tools from `integrations/ai-sdk.ts`
- `maxSteps` controls agentic loop iterations per turn
- Session store tracks form state across tool calls

**Error Handling:**
- API key missing → clear error with env var name
- Rate limit → exponential backoff retry
- Model error → surface error message to user

**Tests:** Mock AI SDK responses for unit tests

**Part of:** markform-101 (fill command)
