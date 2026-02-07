# Research: Tool Choice Parameter in AI SDK and Major LLM Providers

**Date:** 2026-02-02 (last updated 2026-02-02)

**Author:** AI Research

**Status:** Complete

## Overview

This research document provides a comprehensive technical overview of the `toolChoice` parameter
implementation in the Vercel AI SDK and across major LLM providers. The focus is on understanding
how to ensure agents reliably use tools (especially for form-filling use cases where web search
or other research tools should be invoked before populating form fields).

## Questions to Answer

1. How does the AI SDK implement `toolChoice` and translate it to each provider's native format?
2. What are the exact behaviors and options for each major provider (OpenAI, Anthropic, Google,
   Deepseek, xAI/Grok)?
3. What are the best practices for ensuring agents use tools (especially web search) before
   filling in forms or generating structured output?
4. What are the common issues and pitfalls when using `toolChoice`?
5. What patterns exist for combining tool calling with structured output?

## Scope

- **Included**: AI SDK implementation details (source code analysis), provider-specific behaviors,
  community best practices, form-filling patterns, troubleshooting guidance
- **Excluded**: Implementation of specific form-filling applications, UI/UX considerations

---

## Findings

### 1. AI SDK Core Implementation

#### 1.1 Type Definition

The AI SDK defines `ToolChoice` in `packages/ai/src/types/language-model.ts:100-104`:

```typescript
export type ToolChoice<TOOLS extends Record<string, unknown>> =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'tool'; toolName: Extract<keyof TOOLS, string> };
```

**Options:**
- `'auto'` (default): The model can choose whether and which tools to call
- `'none'`: The model must not call tools
- `'required'`: The model must call a tool (can choose which one)
- `{ type: 'tool', toolName: string }`: The model must call the specified tool

#### 1.2 Core Translation Logic

In `packages/ai/src/prompt/prepare-tools-and-tool-choice.ts:79-85`, the SDK translates the
user-facing `toolChoice` to the internal provider format:

```typescript
toolChoice:
  toolChoice == null
    ? { type: 'auto' }
    : typeof toolChoice === 'string'
      ? { type: toolChoice }
      : { type: 'tool' as const, toolName: toolChoice.toolName as string },
```

**Key insight**: When `toolChoice` is `undefined`/`null`, it defaults to `{ type: 'auto' }`.

#### 1.3 Provider-Level Type

The internal type used by providers is `LanguageModelV3ToolChoice` in
`packages/provider/src/language-model/v3/language-model-v3-tool-choice.ts`:

```typescript
export type LanguageModelV3ToolChoice =
  | { type: 'auto' }    // tool selection is automatic (can be no tool)
  | { type: 'none' }    // no tool must be selected
  | { type: 'required' } // one of the available tools must be selected
  | { type: 'tool'; toolName: string }; // a specific tool must be selected
```

---

### 2. Provider-Specific Implementations

#### 2.1 OpenAI

**Source**: `packages/openai/src/chat/openai-chat-prepare-tools.ts:59-76`

**Translation:**

| AI SDK Value | OpenAI Native Value |
|--------------|---------------------|
| `auto` | `'auto'` |
| `none` | `'none'` |
| `required` | `'required'` |
| `{ type: 'tool', toolName }` | `{ type: 'function', function: { name: toolName } }` |

**Native API Documentation:**
- `tool_choice: "auto"` - Model decides whether to call functions (default)
- `tool_choice: "none"` - Model will not call any tool, generates message only
- `tool_choice: "required"` - Model must call one or more tools
- `tool_choice: { type: "function", function: { name: "..." } }` - Force specific function

**Notable:** OpenAI supports parallel function calling by default.

**Sources:**
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI Tools Guide](https://platform.openai.com/docs/guides/tools)

#### 2.2 Anthropic (Claude)

**Source**: `packages/anthropic/src/anthropic-prepare-tools.ts:310-353`

**Translation (with important differences):**

| AI SDK Value | Anthropic Native Value |
|--------------|------------------------|
| `auto` | `{ type: 'auto' }` |
| `none` | *removes tools entirely* (Anthropic doesn't support 'none') |
| `required` | `{ type: 'any' }` (**Note: 'any', not 'required'**) |
| `{ type: 'tool', toolName }` | `{ type: 'tool', name: toolName }` |

**Critical Insight from Source Code (lines 333-335):**
```typescript
case 'none':
  // Anthropic does not support 'none' tool choice, so we remove the tools:
  return { tools: undefined, toolChoice: undefined, toolWarnings, betas };
```

**Anthropic-Specific Features:**
- `disable_parallel_tool_use: boolean` - Can be combined with any toolChoice type
- Setting `disable_parallel_tool_use=true` with `type: 'any'` or `type: 'tool'` ensures
  exactly one tool is called

**Extended Thinking Limitation:**
When using extended thinking, only `tool_choice: {"type": "auto"}` and
`tool_choice: {"type": "none"}` are compatible. Using `any` or `tool` types will error.

**Sources:**
- [Anthropic Tool Use Documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Anthropic Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)

#### 2.3 Google (Gemini)

**Source**: `packages/google/src/google-prepare-tools.ts:225-256`

**Translation:**

| AI SDK Value | Gemini Native Value |
|--------------|---------------------|
| `auto` | `{ functionCallingConfig: { mode: 'AUTO' } }` |
| `none` | `{ functionCallingConfig: { mode: 'NONE' } }` |
| `required` | `{ functionCallingConfig: { mode: 'ANY' } }` |
| `{ type: 'tool', toolName }` | `{ functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [toolName] } }` |

**Native API Options:**
- `AUTO` (default): Model decides whether to call functions
- `NONE`: Model cannot make function calls
- `ANY`: Forces model to predict a function call
- `VALIDATED` (Preview): Like ANY but allows text responses too

**Best Practices from Google:**
- Keep active tools to **10-20 maximum** to reduce selection errors
- Use **low temperature** (e.g., 0) for deterministic function calls
- Apply **strong typing** (enums for fixed value sets)

**Sources:**
- [Google AI Function Calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Vertex AI Function Calling](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/function-calling)

#### 2.4 DeepSeek

**Source**: `packages/deepseek/src/chat/deepseek-prepare-tools.ts:54-68`

**Translation (follows OpenAI format):**

| AI SDK Value | DeepSeek Native Value |
|--------------|----------------------|
| `auto` | `'auto'` |
| `none` | `'none'` |
| `required` | `'required'` |
| `{ type: 'tool', toolName }` | `{ type: 'function', function: { name: toolName } }` |

**Notable Limitations:**
- DeepSeek's official documentation does not explicitly document the `tool_choice` parameter
- Uses OpenAI-compatible API format
- The model may hallucinate parameters not in your schema - validate arguments before calling
- Not great at multi-turn function calling; performs best with single user message triggering calls

**Sources:**
- [DeepSeek Function Calling](https://api-docs.deepseek.com/guides/function_calling)
- [DeepSeek Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)

#### 2.5 xAI (Grok)

**Source**: `packages/xai/src/xai-prepare-tools.ts:71-86` and
`packages/xai/src/responses/xai-responses-prepare-tools.ts:156-186`

**Translation:**

| AI SDK Value | xAI Native Value |
|--------------|------------------|
| `auto` | `'auto'` |
| `none` | `'none'` |
| `required` | `'required'` |
| `{ type: 'tool', toolName }` | `{ type: 'function', name: toolName }` |

**Notable from Source Code (lines 173-180):**
```typescript
if (selectedTool.type === 'provider') {
  // xAI API does not support forcing specific server-side tools via toolChoice
  // Only function tools can be forced
  toolWarnings.push({
    type: 'unsupported',
    feature: `toolChoice for server-side tool "${selectedTool.name}"`,
  });
```

**Recommended Model:** xAI recommends `grok-4-1-fast` for agentic tool calling.

**Sources:**
- [xAI Function Calling](https://docs.x.ai/docs/guides/function-calling)
- [xAI Tools Overview](https://docs.x.ai/docs/guides/tools/overview)

---

### 3. Summary: Provider Translation Table

| AI SDK `toolChoice` | OpenAI | Anthropic | Google | DeepSeek | xAI |
|---------------------|--------|-----------|--------|----------|-----|
| `'auto'` | `'auto'` | `{ type: 'auto' }` | `mode: 'AUTO'` | `'auto'` | `'auto'` |
| `'none'` | `'none'` | *removes tools* | `mode: 'NONE'` | `'none'` | `'none'` |
| `'required'` | `'required'` | `{ type: 'any' }` | `mode: 'ANY'` | `'required'` | `'required'` |
| `{ type: 'tool', toolName: 'x' }` | `{ type: 'function', function: { name: 'x' } }` | `{ type: 'tool', name: 'x' }` | `mode: 'ANY', allowedFunctionNames: ['x']` | `{ type: 'function', function: { name: 'x' } }` | `{ type: 'function', name: 'x' }` |

---

### 4. Form-Filling Use Cases and Patterns

#### 4.1 The Challenge

When building form-filling agents, a common issue is that the model may:
1. **Hallucinate data** instead of using tools to research
2. **Skip tool calls** and go directly to filling the form
3. **Analyze/plan** what it would do instead of actually calling tools
4. **Call tools unreliably** after ~5 messages in a conversation

#### 4.2 Pattern: Answer Tool with `toolChoice: 'required'`

**Recommended Approach (AI SDK 6+):**

Use an "answer" tool without an `execute` function and `toolChoice: 'required'` to force
structured output:

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: yourModel,
  tools: {
    webSearch: tool({
      description: 'Search the web for information',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => { /* search implementation */ }
    }),
    submitForm: tool({
      description: 'Submit the completed form with researched data',
      parameters: z.object({
        field1: z.string().describe('Value for field1 (must be researched)'),
        field2: z.string().describe('Value for field2 (must be researched)'),
      }),
      // No execute function - acts as termination signal
    }),
  },
  toolChoice: 'required', // Must use a tool at every step
  stopWhen: hasToolCall('submitForm'), // Stop when form is submitted
  system: `You are a research assistant. Before filling ANY form field:
1. Use webSearch to find accurate, current information
2. NEVER guess or hallucinate data
3. Only call submitForm when you have researched ALL fields`,
  prompt: userQuery,
});

// Get the form data from staticToolCalls (tools without execute)
const formData = result.staticToolCalls.find(
  call => call.toolName === 'submitForm'
)?.args;
```

#### 4.3 Pattern: AI SDK 6 Unified Output

**New in AI SDK 6:** Combine tool calling with structured output in one flow:

```typescript
import { generateText, Output } from 'ai';

const result = await generateText({
  model: yourModel,
  tools: { webSearch, fetchUrl },
  output: Output.object({
    schema: z.object({
      companyName: z.string(),
      foundedYear: z.number(),
      headquarters: z.string(),
    }),
  }),
  system: `Research the company thoroughly using web search before
           providing structured output. Do not hallucinate.`,
  prompt: 'Get information about Anthropic',
});

// result.object contains the structured data
```

**Important:** Structured output generation counts as an additional step. Adjust `stopWhen`
accordingly.

#### 4.4 Pattern: Explicit Tool Guidance in Prompts

**System Prompt Best Practices:**

```
CRITICAL INSTRUCTIONS FOR TOOL USE:
1. For ANY information that could be time-sensitive, ALWAYS use webSearch first
2. For ANY factual claims (dates, numbers, names), ALWAYS verify with webSearch
3. NEVER fill in form fields with guessed or assumed data
4. If webSearch returns no results, explicitly state "Unknown" rather than guessing
5. Call tools BEFORE reasoning about the answer, not after
```

#### 4.5 Pattern: Multi-Step Verification Loop

For critical data accuracy, use a verification pattern:

```typescript
const agent = createAgent({
  tools: {
    webSearch,
    verifyFact: tool({
      description: 'Double-check a fact by searching again',
      parameters: z.object({
        fact: z.string(),
        originalSource: z.string(),
      }),
      execute: async ({ fact }) => { /* second search */ },
    }),
    submitVerifiedForm: tool({
      description: 'Submit only after all facts are verified',
      parameters: formSchema,
    }),
  },
  stopWhen: hasToolCall('submitVerifiedForm'),
  prepareStep: ({ lastToolResults }) => {
    // Force verification if not all fields verified
    if (needsVerification(lastToolResults)) {
      return { toolChoice: { type: 'tool', toolName: 'verifyFact' } };
    }
    return {};
  },
});
```

---

### 5. Common Issues and Troubleshooting

#### 5.1 Tool Execution Becomes Unreliable After ~5 Messages

**Issue:** Models increasingly fail to execute tools after approximately 5 messages, instead
analyzing or describing what they would do.

**Solutions:**
- Add explicit tool-use reminders in subsequent messages: "Remember to USE the webSearch
  tool, not describe using it"
- Reset context periodically with `context.compact()` in AI SDK 6
- Use `toolChoice: 'required'` to force tool usage

#### 5.2 Endless Loop with `toolChoice: 'required'`

**Issue:** Setting `toolChoice: 'required'` can cause infinite loops when using `streamText`.

**Solutions:**
- Use `stopWhen: hasToolCall('finalTool')` with a termination tool
- Use `stopWhen: stepCountIs(n)` as a safety limit
- Use `prepareStep` to dynamically change `toolChoice` on final step:

```typescript
prepareStep: ({ stepNumber }) => {
  if (stepNumber >= 5) {
    return { toolChoice: 'auto' }; // Allow text response
  }
  return { toolChoice: 'required' };
},
```

#### 5.3 Model Hallucinating Tool Calls

**Issue:** Model says it's calling a tool but actually hallucinating results.

**Solutions:**
- Check for actual tool_use blocks in response, not just text mentioning tools
- Use `toolChoice: 'required'` to force structured tool calls
- Implement validation on tool results before accepting

#### 5.4 Anthropic: 'none' Doesn't Work as Expected

**Issue:** `toolChoice: 'none'` with Anthropic doesn't just prevent tool use, it removes
all tool definitions.

**Solution:** This is intentional per the source code. If you need tools available but not
used in a specific call, use prompting instead: "Do not use any tools for this response."

#### 5.5 Parallel Tool Calls Not Working

**Causes:**
1. Incorrect tool result formatting (separate messages instead of combined)
2. Weak prompting
3. Model-specific limitations (Sonnet 3.7 less likely than Claude 4)

**Solution:**
```typescript
// Wrong: Separate messages
[
  { role: 'assistant', content: [tool_use_1, tool_use_2] },
  { role: 'user', content: [tool_result_1] },
  { role: 'user', content: [tool_result_2] },  // Separate
]

// Correct: Single message with all results
[
  { role: 'assistant', content: [tool_use_1, tool_use_2] },
  { role: 'user', content: [tool_result_1, tool_result_2] },  // Combined
]
```

---

### 6. Best Practices Summary

#### 6.1 For Reliable Tool Use

1. **Use `toolChoice: 'required'`** when tools MUST be used
2. **Provide detailed tool descriptions** - this is the most important factor
3. **Limit tools to 5-7** for optimal selection accuracy (10-20 max)
4. **Use explicit prompting** about when to use which tool
5. **Implement answer/termination tools** for structured output flows

#### 6.2 For Form-Filling Specifically

1. **Always research before filling** - use `toolChoice: 'required'` initially
2. **Use an answer tool without execute** - terminates loop with structured data
3. **Validate all tool results** - don't trust raw model outputs
4. **Use the AI SDK 6 `output` option** for cleaner structured output flows
5. **Add verification steps** for critical data

#### 6.3 Provider-Specific Recommendations

| Provider | Recommendation |
|----------|----------------|
| OpenAI | Use `'required'` directly; supports parallel calls |
| Anthropic | Remember `required` → `any` translation; use `disable_parallel_tool_use` for single calls |
| Google | Use `ANY` mode with `allowedFunctionNames` for specific tools |
| DeepSeek | Validate tool arguments; avoid multi-turn tool flows |
| xAI | Use `grok-4-1-fast` for best tool calling; can't force provider tools |

---

## Options Considered

### Option A: Use `toolChoice: 'required'` Everywhere

**Description:** Force tool use on every step until completion.

**Pros:**
- Guarantees tools are called
- Prevents hallucination of tool results

**Cons:**
- Can cause infinite loops without proper termination
- May force unnecessary tool calls
- Not compatible with Anthropic extended thinking

### Option B: Use `toolChoice: 'auto'` with Strong Prompting

**Description:** Rely on system prompts to guide tool use.

**Pros:**
- More flexible
- Works with all features (extended thinking, etc.)
- Natural conversation flow

**Cons:**
- Model may ignore prompts and skip tools
- Reliability degrades over long conversations
- Harder to guarantee tool usage

### Option C: Hybrid Approach with `prepareStep`

**Description:** Use `toolChoice: 'required'` initially, switch to `'auto'` for final
response.

**Pros:**
- Best of both worlds
- Guarantees initial research
- Allows natural completion

**Cons:**
- More complex implementation
- Requires careful step management

---

## Recommendations

1. **For form-filling with mandatory research:** Use Option C (Hybrid) with:
   - `toolChoice: 'required'` for first N steps
   - An answer tool without execute function
   - `stopWhen: hasToolCall('submitForm')`

2. **For simpler tool integration:** Use Option A with proper termination:
   - Define a clear termination tool
   - Use `stopWhen` to prevent infinite loops

3. **For conversation-like interfaces:** Use Option B with:
   - Strong system prompts
   - Explicit tool-use instructions in user messages
   - Periodic context compaction

---

## Next Steps

- [ ] Implement the recommended hybrid pattern in markform
- [ ] Add tool input validation for form fields
- [ ] Create a verification step for critical data
- [ ] Test across multiple providers for consistency

---

## References

### AI SDK Documentation
- [AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK Agents: Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- [AI SDK Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI SDK Troubleshooting: Tool Calling with Structured Outputs](https://ai-sdk.dev/docs/troubleshooting/tool-calling-with-structured-outputs)
- [AI SDK 6 Announcement](https://vercel.com/blog/ai-sdk-6)

### Provider Documentation
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [Anthropic Implement Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Google Gemini Function Calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [DeepSeek Function Calling](https://api-docs.deepseek.com/guides/function_calling)
- [xAI Function Calling](https://docs.x.ai/docs/guides/function-calling)

### AI SDK Source Code References
- `packages/ai/src/types/language-model.ts:100-104` - ToolChoice type definition
- `packages/ai/src/prompt/prepare-tools-and-tool-choice.ts` - Core translation logic
- `packages/provider/src/language-model/v3/language-model-v3-tool-choice.ts` - Provider-level type
- `packages/openai/src/chat/openai-chat-prepare-tools.ts:59-76` - OpenAI translation
- `packages/anthropic/src/anthropic-prepare-tools.ts:310-353` - Anthropic translation
- `packages/google/src/google-prepare-tools.ts:225-256` - Google translation
- `packages/deepseek/src/chat/deepseek-prepare-tools.ts:54-68` - DeepSeek translation
- `packages/xai/src/xai-prepare-tools.ts:71-86` - xAI translation

### Community Resources
- [GitHub Issue: Tool Execution Unreliable After ~5 Messages](https://github.com/vercel/ai/issues/10269)
- [GitHub Issue: toolChoice 'required' Endless Loop](https://github.com/vercel/ai/issues/3944)
- [Vercel Blog: We Removed 80% of Our Agent's Tools](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools)
- [GitHub Discussion: Tool Calling Loop Understanding](https://github.com/vercel/ai/discussions/8514)

### Hallucination Prevention
- [Zep: Reducing LLM Hallucinations](https://www.getzep.com/ai-agents/reducing-llm-hallucinations/)
- [Cleanlab: Prevent Hallucinated Responses](https://cleanlab.ai/blog/prevent-hallucinated-responses/)
- [AWS: Reducing Hallucinations with Verified Semantic Cache](https://aws.amazon.com/blogs/machine-learning/reducing-hallucinations-in-llm-agents-with-a-verified-semantic-cache-using-amazon-bedrock-knowledge-bases/)
