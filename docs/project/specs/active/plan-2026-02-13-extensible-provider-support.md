# Feature: Extensible Provider Support via ProviderAdapter

**Date:** 2026-02-13 (last updated 2026-02-13)

**Author:** Claude (from issue #136 by jlevy)

**Status:** Draft

**Issue:** https://github.com/jlevy/markform/issues/136

## Overview

Add a `ProviderAdapter` interface and a `providers` option on `FillOptions` so that
callers can bring their own `@ai-sdk/*` providers (e.g., DeepInfra, Together, Fireworks,
Mistral) while preserving the existing 5 built-in providers as zero-config defaults.
No global mutable registry — just pass providers per call.

## Goals

- Allow external consumers to use any AI SDK provider with `fillForm()` via string-based
  model IDs (e.g., `deepinfra/glm-5`), not just the 5 hard-coded providers.
- Preserve full feature parity for custom providers: web search tools, provider metadata
  in fill records, and parallel execution support.
- Maintain 100% backward compatibility — existing code using `anthropic/claude-sonnet-4-5`
  works unchanged with no new imports or configuration.
- Accept AI SDK provider callables directly (zero-wrapper ergonomic) since they already
  conform to `(modelId: string) => LanguageModel`.

## Non-Goals

- **Removing built-in providers.** The 5 defaults (anthropic, openai, google, xai,
  deepseek) remain as first-class citizens with env var validation and helpful error
  messages.
- **CLI provider registration.** This feature targets the programmatic API (`fillForm`).
  CLI extensions (e.g., `markform fill --provider deepinfra=@ai-sdk/deepinfra`) may come
  later but are out of scope.
- **Provider auto-discovery.** We do not scan `node_modules` for `@ai-sdk/*` packages.
- **OpenAI-compatible proxy support.** Some users route through OpenAI-compatible
  endpoints. This is a separate concern (base URL config) not addressed here.

## Background

### Current Architecture

Markform resolves model strings through a tightly coupled pipeline:

```
"anthropic/claude-sonnet-4-5"
  → parseModelId()           validates against PROVIDERS constant (5 entries)
  → resolveModel()           dynamic-imports @ai-sdk/anthropic, checks env var
  → LiveAgent constructor    loads web search tools via hard-coded switch
```

Key coupling points:

1. **`modelResolver.ts`** — `PROVIDERS` constant maps 5 provider names to their npm
   packages, env vars, and factory function names. `parseModelId()` rejects any provider
   not in this map.

2. **`harnessTypes.ts`** — `ProviderName` is a string literal union
   (`'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek'`). Used in `ParsedModelId`,
   `ResolvedModel`, and throughout the harness.

3. **`liveAgent.ts`** — `loadWebSearchTools()` hard-codes imports of all 4 provider
   packages that support web search (`@ai-sdk/openai`, `@ai-sdk/anthropic`,
   `@ai-sdk/google`, `@ai-sdk/xai`). This is a top-level import coupling.

4. **`llms.ts`** — `SUGGESTED_LLMS` and `WEB_SEARCH_CONFIG` are keyed by provider name
   and used for help text and feature detection.

5. **`programmaticFill.ts`** — When `model` is a `LanguageModel` instance (not a string),
   provider is `undefined`, disabling web search and losing provider metadata in fill
   records.

### Workaround Pain Points (from issue)

External consumers who need non-default providers must:
- Create their own model resolver, import their `@ai-sdk/*` package, and pass a raw
  `LanguageModel` to `fillForm()`
- Lose provider metadata (`provider = undefined` in fill records)
- Lose web search capability (provider-specific tools can't be loaded)
- Cannot serialize the `LanguageModel` across process boundaries (closures)

## Design

### Approach

Introduce a `ProviderAdapter` interface that captures a provider's two capabilities:
(1) resolving model names to `LanguageModel` instances, and (2) optionally providing
tools (e.g., web search). Adapters are passed per-call via `FillOptions.providers`.
There is no global mutable registry — this keeps the API stateless, test-friendly, and
free of shared mutable state.

Built-in providers are exported as a constant (`BUILT_IN_PROVIDERS`) so callers can
easily compose custom providers with the defaults:

```typescript
// Zero-config — built-ins used automatically when no providers specified
await fillForm({ model: 'anthropic/claude-sonnet-4-5', ... });

// Custom provider — just pass it
import { createDeepInfra } from '@ai-sdk/deepinfra';
await fillForm({
  model: 'deepinfra/meta-llama/Llama-3.3-70B-Instruct-Turbo',
  providers: { deepinfra: createDeepInfra({ apiKey: '...' }) },
  ...
});

// Override a built-in (e.g., custom OpenAI base URL)
import { createOpenAI } from '@ai-sdk/openai';
await fillForm({
  model: 'openai/gpt-4o',
  providers: { openai: createOpenAI({ baseURL: 'https://my-proxy/v1' }) },
  ...
});
```

The resolution priority is:

```
1. options.providers[name]     per-call providers (highest priority)
2. BUILT_IN_PROVIDERS[name]    current 5 defaults (preserved as-is)
3.                             actionable error with hint
```

### Core Types

```typescript
/**
 * Adapter for an AI provider. Clients import their own @ai-sdk/* package,
 * configure it, and pass the adapter to markform.
 */
interface ProviderAdapter {
  /** Resolve a model name to a LanguageModel instance */
  model(modelId: string): LanguageModel;
  /** Optional provider-specific tools (e.g., web search) */
  tools?: Record<string, Tool>;
}

/**
 * A ProviderInput is either:
 * - A ProviderAdapter (explicit adapter)
 * - An AI SDK provider callable (auto-normalized)
 */
type ProviderInput = ProviderAdapter | AiSdkProviderCallable;

/**
 * AI SDK providers are callable: provider(modelId) => LanguageModel.
 * They may also have a .tools property with tool factories.
 */
type AiSdkProviderCallable =
  ((modelId: string) => LanguageModel) & {
    tools?: Record<string, (...args: unknown[]) => Tool>;
  };
```

### Normalization

When an AI SDK provider callable is passed (not a full `ProviderAdapter`), we normalize
it:

```typescript
function normalizeProvider(input: ProviderInput): ProviderAdapter {
  if (typeof input === 'function') {
    return {
      model: (id) => input(id),
      tools: extractToolsFromProvider(input),
    };
  }
  return input;
}
```

Web search tool auto-extraction duck-types the `.tools` property looking for known tool
names (`webSearch`, `webSearch_20250305`, `googleSearch`). This is best-effort — if the
provider has an unusual tool name, the consumer can use an explicit `ProviderAdapter` with
`.tools` instead.

### Components Affected

| File | Change |
|------|--------|
| `src/harness/harnessTypes.ts` | Add `ProviderAdapter`, `ProviderInput` types; add `providers?` to `FillOptions`; widen `ProviderName` to `string` with built-in defaults |
| `src/harness/modelResolver.ts` | Export `BUILT_IN_PROVIDERS`; update `parseModelId()` to be a pure parser; update `resolveModel()` to accept `providers` map; add `normalizeProvider()` and `extractToolsFromProvider()` |
| `src/harness/programmaticFill.ts` | Update `fillForm()` to merge per-call + built-in providers; pass adapter tools to `LiveAgent` |
| `src/harness/liveAgent.ts` | Replace hard-coded `loadWebSearchTools()` switch with adapter-provided tools; remove top-level provider imports |
| `src/llms.ts` | Keep `SUGGESTED_LLMS` and `WEB_SEARCH_CONFIG` for built-in providers |
| `src/index.ts` | Export `ProviderAdapter`, `ProviderInput`, `BUILT_IN_PROVIDERS` |

### API Changes

#### New exports from `markform`

```typescript
// Types
export type { ProviderAdapter, ProviderInput } from './harness/harnessTypes.js';

// Built-in provider list (for composing with custom providers)
export { BUILT_IN_PROVIDERS } from './harness/modelResolver.js';
```

#### Updated `FillOptions`

```typescript
interface FillOptions {
  // ... existing fields unchanged ...

  /**
   * Additional providers for string-based model resolution.
   * Keys are provider names; values are ProviderAdapter or AI SDK provider callables.
   * These take priority over globally registered and built-in providers.
   */
  providers?: Record<string, ProviderInput>;
}
```

#### Updated `ProviderName` and `ResolvedModel`

```typescript
// Was: type ProviderName = 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';
// Now: extensible string with built-in defaults for type hints
type BuiltInProviderName = 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';

// ParsedModelId and ResolvedModel use string for provider (not BuiltInProviderName)
interface ParsedModelId {
  provider: string;
  modelId: string;
}

interface ResolvedModel {
  model: LanguageModel;
  provider: string;
  modelId: string;
  /** Adapter-provided tools (e.g., web search) */
  tools?: Record<string, Tool>;
}
```

### Design Decisions

**1. Per-call `providers` only — no global registry.**

The `FillOptions.providers` field is the only way to add custom providers. There is no
`registerProvider()` / global mutable state. This keeps the API stateless, explicit, and
test-friendly. Callers who want to reuse a provider map across calls can simply hold it
in a variable:

```typescript
const myProviders = { deepinfra: createDeepInfra({ apiKey }) };
await fillForm({ model: 'deepinfra/...', providers: myProviders, ... });
await fillForm({ model: 'deepinfra/...', providers: myProviders, ... });
```

**2. `BUILT_IN_PROVIDERS` is exported as a constant.**

Callers can inspect the default providers, compose with them, or override individual
entries. This replaces the need for a registry — the caller controls the full provider
map explicitly.

**3. Adapter-provided tools replace hard-coded `loadWebSearchTools()`.**

The current `loadWebSearchTools()` in `liveAgent.ts` imports 4 provider packages at the
top level and uses a switch statement. With adapters, web search tools come from the
adapter's `.tools` property. For built-in providers, the built-in adapter constructs
these tools internally. This eliminates the switch statement and the tight coupling.

**3. Built-in providers become internal adapters.**

The existing `PROVIDERS` config in `modelResolver.ts` is refactored into built-in
`ProviderAdapter` instances that perform the same dynamic import + env var check logic.
This means the resolution path is uniform for all providers — built-in or custom.

**4. `ProviderName` becomes `string` with a `BuiltInProviderName` alias.**

Code that uses `ProviderName` for type narrowing is updated to use `string`. The
`BuiltInProviderName` alias is kept for internal use where we need to reference the
5 defaults (e.g., in `SUGGESTED_LLMS` keys, `WEB_SEARCH_CONFIG`).

**5. `parseModelId()` no longer validates provider name against a fixed list.**

Instead, it just parses the `provider/model-id` format. Provider validation moves to
`resolveModel()`, which checks the merged provider map (per-call > built-in > error).
This means `parseModelId()` becomes a pure string parser, which is cleaner.

## Implementation Plan

### Phase 1: Types and Model Resolution

Core infrastructure. No behavior changes for existing code paths yet.

- [ ] Add `ProviderAdapter`, `ProviderInput`, `AiSdkProviderCallable`, and
  `BuiltInProviderName` types to `harnessTypes.ts`
- [ ] Add `providers?: Record<string, ProviderInput>` to `FillOptions`
- [ ] Update `ProviderName` to `string` throughout; add `BuiltInProviderName` alias
- [ ] Update `ParsedModelId` and `ResolvedModel` to use `string` provider + optional
  `tools`
- [ ] Add `normalizeProvider()` function in `modelResolver.ts`
- [ ] Add `extractToolsFromProvider()` for duck-typing AI SDK provider `.tools`
- [ ] Refactor `parseModelId()` to be a pure format parser (no provider validation)
- [ ] Update `resolveModel()` to accept optional `providers` map, merge with built-ins,
  and return adapter-provided tools in `ResolvedModel`
- [ ] Convert built-in providers to internal `ProviderAdapter` instances (wrapping
  existing dynamic import + env var logic); export as `BUILT_IN_PROVIDERS`
- [ ] Export new types and `BUILT_IN_PROVIDERS` from `src/index.ts`
- [ ] Write unit tests for all new functions: `normalizeProvider`,
  `extractToolsFromProvider`, updated `parseModelId`, updated `resolveModel` with
  custom providers
- [ ] Update existing `modelResolver.test.ts` tests for the new `parseModelId` behavior
  (no longer throws for unknown providers)
- [ ] Update existing `llms.test.ts` if any interfaces changed

### Phase 2: Integration (LiveAgent, fillForm, CLI)

Wire the new resolution through the full fill pipeline.

- [ ] Update `programmaticFill.ts` `fillForm()` to pass `options.providers` to
  `resolveModel()` and forward adapter tools to `LiveAgent`
- [ ] Update `LiveAgent` constructor to accept adapter-provided tools as a new config
  field (e.g., `providerTools?: Record<string, Tool>`)
- [ ] Replace `loadWebSearchTools()` switch statement with adapter-provided tools;
  keep `loadWebSearchTools()` as an internal helper used only by built-in provider
  adapters
- [ ] Remove top-level imports of `@ai-sdk/openai`, `@ai-sdk/anthropic`,
  `@ai-sdk/google`, `@ai-sdk/xai` from `liveAgent.ts` (move into built-in adapter
  closures)
- [ ] Update `fillFormParallel()` to pass adapter tools through to scoped agents
- [ ] Write integration tests:
  - `fillForm()` with per-call custom provider (mock adapter)
  - `fillForm()` where per-call overrides built-in provider
  - `fillForm()` with custom provider + web search tools
  - Verify built-in providers still work identically (regression)
  - Verify `LanguageModel` direct-pass still works (regression)
  - Verify fill records include correct provider metadata for custom providers
- [ ] Update existing harness tests if constructor signatures changed
- [ ] Regenerate golden tests if wire format or prompts changed

## Testing Strategy

### Unit Tests (Phase 1)

**`modelResolver.test.ts` updates:**
- `parseModelId()` now accepts any provider string — update tests that expected throws
  for unknown providers
- New tests for `normalizeProvider()` with both `ProviderAdapter` and callable inputs
- New tests for `extractToolsFromProvider()` with various `.tools` shapes
- `resolveModel()` with custom providers in the `providers` map (using mock adapters)
- Resolution priority: per-call providers > built-in
- Error messages for truly unresolvable providers (not in any source)

**`llms.test.ts` updates:**
- Verify `SUGGESTED_LLMS` and `WEB_SEARCH_CONFIG` still cover built-in providers
- No breaking changes to display helpers

### Integration Tests (Phase 2)

**`programmaticFill.test.ts` (or new `providerAdapter.test.ts`):**
- End-to-end fill with mock agent + custom provider adapter
- Fill record includes custom provider name
- Web search tools from adapter are available to LiveAgent
- Parallel fill with custom providers
- Per-call providers override built-in (e.g., custom `openai` adapter wins)

### Regression Tests

- All existing unit tests pass unchanged (except `parseModelId` provider validation)
- Golden tests regenerated if wire format changed (unlikely unless prompts change)
- CLI tryscript tests for `models` command updated if output format changes

### Edge Cases to Test

- Provider name with special characters (should be rejected at format level)
- Empty provider name or model ID (existing validation preserved)
- Per-call provider that shadows a built-in (should work — per-call wins)
- Adapter `.model()` throws — error surfaces with context
- Adapter `.tools` is empty object vs undefined
- AI SDK callable without `.tools` property

## Rollout Plan

This is a purely additive, backward-compatible change. No migration needed.

1. Merge to main
2. Publish as a minor version bump (new API surface, no breaking changes)
3. Document in `docs/markform-apis.md` with usage examples
4. Close issue #136

## Open Questions

- **Should the CLI `fill` command accept `--provider name=package` flags?** Deferred to
  a follow-up issue. The programmatic API is the priority.
- **Should `SUGGESTED_LLMS` be extensible?** Custom providers could optionally provide
  suggested models for the `models` command. Low priority — can add later.
- **Should `BUILT_IN_PROVIDERS` be a frozen object?** Probably yes —
  `Object.freeze()` prevents accidental mutation. Callers who want to extend should
  spread into a new object: `{ ...BUILT_IN_PROVIDERS, deepinfra: ... }`.

## References

- [Issue #136: feat: extensible provider support via ProviderAdapter registration](https://github.com/jlevy/markform/issues/136)
- `src/harness/modelResolver.ts` — Current model resolution
- `src/harness/liveAgent.ts` — Web search tool loading
- `src/harness/harnessTypes.ts` — FillOptions, ProviderName types
- `src/harness/programmaticFill.ts` — fillForm() entry point
- `src/llms.ts` — Provider config and web search config
- [Vercel AI SDK Provider docs](https://ai-sdk.dev/providers)
