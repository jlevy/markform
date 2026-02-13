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

1. **`modelResolver.ts`** — `PROVIDERS` constant (L19-45) maps 5 provider names to their
   npm packages, env vars, and factory function names. `parseModelId()` (L58-97) rejects
   any provider not in this map at L81-91.

2. **`harnessTypes.ts`** — `ProviderName` (L196) is a string literal union
   (`'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek'`). Used in `ParsedModelId`
   (L201-204), `ResolvedModel` (L209-213), and throughout the harness.

3. **`liveAgent.ts`** — Top-level imports of 4 provider SDKs (L11-14:
   `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/xai`).
   `loadWebSearchTools()` (L787-815) uses a hard-coded switch to create web search tools
   from each provider's `.tools` property.

4. **`llms.ts`** — `WEB_SEARCH_CONFIG` (L104-129) is keyed by provider name. Helper
   functions `hasWebSearchSupport()` (L134) and `getWebSearchConfig()` (L142) provide
   feature detection.

5. **`programmaticFill.ts`** — `fillForm()` (L460-482) resolves model strings via
   `resolveModel()`, then passes the provider string to `createLiveAgent()` (L544-557).
   When `model` is a `LanguageModel` instance, provider is `undefined`, disabling web
   search and losing provider metadata in fill records.

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
   * These take priority over built-in providers.
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

**4. Built-in providers become internal adapters.**

The existing `PROVIDERS` config in `modelResolver.ts` is refactored into built-in
`ProviderAdapter` instances that perform the same dynamic import + env var check logic.
This means the resolution path is uniform for all providers — built-in or custom.

**5. `ProviderName` becomes `string` with a `BuiltInProviderName` alias.**

Code that uses `ProviderName` for type narrowing is updated to use `string`. The
`BuiltInProviderName` alias is kept for internal use where we need to reference the
5 defaults (e.g., in `SUGGESTED_LLMS` keys, `WEB_SEARCH_CONFIG`).

**6. `parseModelId()` no longer validates provider name against a fixed list.**

Instead, it just parses the `provider/model-id` format. Provider validation moves to
`resolveModel()`, which checks the merged provider map (per-call > built-in > error).
This means `parseModelId()` becomes a pure string parser, which is cleaner.

## Detailed Implementation Plan

### Bead 1: Add new types to `harnessTypes.ts`

**File:** `src/harness/harnessTypes.ts`

**Changes:**

1. **Rename `ProviderName` to `BuiltInProviderName` (L196)**

   ```typescript
   // Before (L196):
   export type ProviderName = 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';

   // After:
   export type BuiltInProviderName = 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';

   /**
    * @deprecated Use `BuiltInProviderName` for built-in providers or `string` for any provider.
    */
   export type ProviderName = BuiltInProviderName;
   ```

2. **Widen `ParsedModelId.provider` to `string` (L201-204)**

   ```typescript
   // Before:
   export interface ParsedModelId {
     provider: ProviderName;
     modelId: string;
   }

   // After:
   export interface ParsedModelId {
     provider: string;
     modelId: string;
   }
   ```

3. **Add `tools?` to `ResolvedModel` and widen `provider` (L209-213)**

   ```typescript
   // Before:
   export interface ResolvedModel {
     model: LanguageModel;
     provider: ProviderName;
     modelId: string;
   }

   // After:
   export interface ResolvedModel {
     model: LanguageModel;
     provider: string;
     modelId: string;
     /** Adapter-provided tools (e.g., web search) */
     tools?: Record<string, Tool>;
   }
   ```

4. **Add new types after `ProviderInfo` (after L221)**

   ```typescript
   /**
    * Adapter for an AI provider. Clients import their own @ai-sdk/* package,
    * configure it, and pass the adapter to markform.
    *
    * The interface is designed to match AI SDK provider shape exactly,
    * so providers can often be passed directly without wrapping.
    */
   export interface ProviderAdapter {
     /** Resolve a model name to a LanguageModel instance */
     model(modelId: string): LanguageModel;
     /** Optional provider-specific tools (e.g., web search) */
     tools?: Record<string, Tool>;
   }

   /**
    * AI SDK providers are callable: provider(modelId) => LanguageModel.
    * They may also have a .tools property with tool factories.
    */
   export type AiSdkProviderCallable = ((modelId: string) => LanguageModel) & {
     tools?: Record<string, (...args: unknown[]) => Tool>;
   };

   /**
    * A ProviderInput is either:
    * - A ProviderAdapter (explicit adapter with `.model()` method)
    * - An AI SDK provider callable (auto-normalized via `normalizeProvider()`)
    */
   export type ProviderInput = ProviderAdapter | AiSdkProviderCallable;
   ```

5. **Add `providers?` to `FillOptions` (after L417, before `_testAgent`)**

   ```typescript
   /**
    * Additional providers for string-based model resolution.
    * Keys are provider names (the part before the `/` in model IDs).
    * Values are ProviderAdapter objects or AI SDK provider callables.
    * These take priority over built-in providers.
    *
    * @example
    * ```typescript
    * import { createDeepInfra } from '@ai-sdk/deepinfra';
    * await fillForm({
    *   model: 'deepinfra/meta-llama/Llama-3.3-70B-Instruct-Turbo',
    *   providers: { deepinfra: createDeepInfra({ apiKey: '...' }) },
    *   ...
    * });
    * ```
    */
   providers?: Record<string, ProviderInput>;
   ```

**Test impact:** No test changes needed — additive only.

---

### Bead 2: Make `parseModelId()` a pure format parser

**File:** `src/harness/modelResolver.ts`

**Changes:**

1. **Remove provider validation from `parseModelId()` (delete L81-91)**

   The function currently checks `supportedProviders.includes(provider)` and throws.
   Remove this block entirely so `parseModelId()` accepts any `provider/model-id` string.

   ```typescript
   // Before (L58-97):
   export function parseModelId(modelIdString: string): ParsedModelId {
     const slashIndex = modelIdString.indexOf('/');
     if (slashIndex === -1) { /* ... throw ... */ }

     const provider = modelIdString.slice(0, slashIndex);
     const modelId = modelIdString.slice(slashIndex + 1);

     if (!provider || !modelId) { /* ... throw ... */ }

     // DELETE this block (L81-91):
     const supportedProviders = Object.keys(PROVIDERS);
     if (!supportedProviders.includes(provider)) {
       throw new MarkformConfigError(...);
     }

     return {
       provider: provider as ProviderName,  // CHANGE: remove cast
       modelId,
     };
   }

   // After:
   export function parseModelId(modelIdString: string): ParsedModelId {
     const slashIndex = modelIdString.indexOf('/');
     if (slashIndex === -1) { /* ... throw (unchanged) ... */ }

     const provider = modelIdString.slice(0, slashIndex);
     const modelId = modelIdString.slice(slashIndex + 1);

     if (!provider || !modelId) { /* ... throw (unchanged) ... */ }

     return { provider, modelId };
   }
   ```

**Test impact:** `modelResolver.test.ts` — update tests at the "unknown provider"
section that expect throws. They should now return `{ provider: 'firebase', modelId }`
etc. instead of throwing. Add new assertions that unknown providers parse successfully.

---

### Bead 3: Add `normalizeProvider()`, `extractToolsFromProvider()`, and
`BUILT_IN_PROVIDERS`

**File:** `src/harness/modelResolver.ts`

**Changes:**

1. **Add imports at top of file**

   ```typescript
   import type { Tool } from 'ai';
   import type {
     AiSdkProviderCallable,
     BuiltInProviderName,
     ParsedModelId,
     ProviderAdapter,
     ProviderInfo,
     ProviderInput,
     ProviderName,
     ResolvedModel,
   } from './harnessTypes.js';
   ```

2. **Add `normalizeProvider()` (new function, after PROVIDERS constant)**

   ```typescript
   /**
    * Normalize a ProviderInput to a ProviderAdapter.
    * AI SDK provider callables are wrapped in an adapter shape.
    */
   export function normalizeProvider(input: ProviderInput): ProviderAdapter {
     if (typeof input === 'function') {
       return {
         model: (id: string) => input(id),
         tools: extractToolsFromProvider(input),
       };
     }
     // Already a ProviderAdapter (has .model method)
     if ('model' in input && typeof input.model === 'function') {
       return input;
     }
     throw new MarkformConfigError(
       'Invalid provider: must be a ProviderAdapter (with .model() method) or an AI SDK provider callable',
       { option: 'providers', expectedType: 'ProviderAdapter | callable', receivedValue: typeof input },
     );
   }
   ```

3. **Add `extractToolsFromProvider()` (new function)**

   ```typescript
   /**
    * Known web search tool names from AI SDK providers.
    * Used for best-effort auto-extraction when normalizing callables.
    */
   const KNOWN_WEB_SEARCH_TOOLS = ['webSearch', 'webSearch_20250305', 'googleSearch', 'webSearchPreview'];

   /**
    * Extract web search tools from an AI SDK provider callable.
    * Duck-types the `.tools` property looking for known tool factory names.
    */
   export function extractToolsFromProvider(
     provider: AiSdkProviderCallable,
   ): Record<string, Tool> | undefined {
     const providerTools = provider.tools;
     if (!providerTools || typeof providerTools !== 'object') return undefined;

     const extracted: Record<string, Tool> = {};
     for (const toolName of KNOWN_WEB_SEARCH_TOOLS) {
       const factory = providerTools[toolName];
       if (typeof factory === 'function') {
         try {
           const tool = factory({});
           if (tool) {
             // Normalize to consistent key: 'web_search' for most, 'google_search' for Google
             const key = toolName === 'googleSearch' ? 'google_search' : 'web_search';
             extracted[key] = tool as Tool;
             break; // Only need one web search tool
           }
         } catch {
           // Tool factory failed — skip silently
         }
       }
     }

     return Object.keys(extracted).length > 0 ? extracted : undefined;
   }
   ```

4. **Create `BUILT_IN_PROVIDERS` (new export, replaces current usage of `PROVIDERS`)**

   Each built-in provider is a `ProviderAdapter` that wraps the existing dynamic import +
   env var check logic. The `PROVIDERS` constant is kept as internal config but
   `BUILT_IN_PROVIDERS` is the public API.

   ```typescript
   /**
    * Internal config for built-in providers. Maps provider name to npm package,
    * env var, and factory function name.
    */
   const BUILT_IN_PROVIDER_CONFIG: Record<
     BuiltInProviderName,
     { package: string; envVar: string; createFn: string }
   > = {
     anthropic: { package: '@ai-sdk/anthropic', envVar: 'ANTHROPIC_API_KEY', createFn: 'createAnthropic' },
     openai: { package: '@ai-sdk/openai', envVar: 'OPENAI_API_KEY', createFn: 'createOpenAI' },
     google: { package: '@ai-sdk/google', envVar: 'GOOGLE_GENERATIVE_AI_API_KEY', createFn: 'createGoogleGenerativeAI' },
     xai: { package: '@ai-sdk/xai', envVar: 'XAI_API_KEY', createFn: 'createXai' },
     deepseek: { package: '@ai-sdk/deepseek', envVar: 'DEEPSEEK_API_KEY', createFn: 'createDeepSeek' },
   };

   /**
    * Create a built-in ProviderAdapter that performs dynamic import + env var validation.
    * This is the adapter form of the existing resolveModel() logic.
    */
   function createBuiltInAdapter(name: BuiltInProviderName): ProviderAdapter {
     const config = BUILT_IN_PROVIDER_CONFIG[name];
     return {
       model(modelId: string): LanguageModel {
         // Synchronous validation — actual import happens in resolveModel
         // This adapter is used by resolveModel(), not called directly by consumers
         throw new Error(
           `Built-in adapter for "${name}" should be resolved via resolveModel(), not called directly.`
         );
       },
     };
   }

   /**
    * Built-in providers available by default.
    * Exported so callers can inspect, compose, or override.
    *
    * Note: Built-in providers use async dynamic imports internally and are resolved
    * through `resolveModel()`. The adapters here are markers — the actual resolution
    * logic (env var check, dynamic import, factory call) lives in `resolveModel()`.
    */
   export const BUILT_IN_PROVIDERS: Readonly<Record<BuiltInProviderName, BuiltInProviderName>> =
     Object.freeze({
       anthropic: 'anthropic',
       openai: 'openai',
       google: 'google',
       xai: 'xai',
       deepseek: 'deepseek',
     });
   ```

   **Note on approach:** Built-in providers require async dynamic import + env var
   validation, which doesn't fit the synchronous `ProviderAdapter.model()` interface.
   Rather than making `ProviderAdapter.model()` async (which would complicate the
   consumer API), the built-in resolution path remains in `resolveModel()` as-is.
   `BUILT_IN_PROVIDERS` is exported as a simple name map so callers know what's available.
   The `resolveModel()` function checks custom providers first, then falls back to the
   built-in resolution path.

5. **Update `resolveModel()` to accept optional `providers` map**

   ```typescript
   // Before (L108):
   export async function resolveModel(modelIdString: string): Promise<ResolvedModel>

   // After:
   export async function resolveModel(
     modelIdString: string,
     providers?: Record<string, ProviderInput>,
   ): Promise<ResolvedModel>
   ```

   **New logic at the top of `resolveModel()` (after `parseModelId`):**

   ```typescript
   const { provider, modelId } = parseModelId(modelIdString);

   // 1. Check per-call custom providers first
   if (providers && provider in providers) {
     const adapter = normalizeProvider(providers[provider]);
     try {
       const model = adapter.model(modelId);
       return { model, provider, modelId, tools: adapter.tools };
     } catch (error) {
       const message = error instanceof Error ? error.message : String(error);
       throw new MarkformConfigError(
         `Custom provider "${provider}" failed to resolve model "${modelId}": ${message}`,
         { option: 'model', expectedType: 'valid model ID', receivedValue: modelIdString },
       );
     }
   }

   // 2. Fall back to built-in provider resolution
   const builtInConfig = BUILT_IN_PROVIDER_CONFIG[provider as BuiltInProviderName];
   if (!builtInConfig) {
     const builtInNames = Object.keys(BUILT_IN_PROVIDER_CONFIG);
     throw new MarkformConfigError(
       `Unknown provider: "${provider}". ` +
         `Built-in providers: ${builtInNames.join(', ')}. ` +
         `To use a custom provider, pass it via the \`providers\` option.`,
       { option: 'model', expectedType: `provider name or custom provider`, receivedValue: provider },
     );
   }

   // ... rest of existing built-in resolution logic (env var check, dynamic import, etc.)
   // Replace references to PROVIDERS[provider] with builtInConfig
   ```

6. **Rename `PROVIDERS` to `BUILT_IN_PROVIDER_CONFIG`** throughout the file.

7. **Update `getProviderNames()` and `getProviderInfo()`** to use
   `BUILT_IN_PROVIDER_CONFIG`.

**Test impact:**
- `modelResolver.test.ts` — update "unknown provider" tests, add tests for
  `normalizeProvider()`, `extractToolsFromProvider()`, and `resolveModel()` with custom
  providers.

---

### Bead 4: Wire providers through `fillForm()` in `programmaticFill.ts`

**File:** `src/harness/programmaticFill.ts`

**Changes:**

1. **Pass `options.providers` to `resolveModel()` (L466)**

   ```typescript
   // Before (L466):
   const resolved = await resolveModel(options.model);

   // After:
   const resolved = await resolveModel(options.model, options.providers);
   ```

2. **Forward `resolved.tools` to `createLiveAgent()` (L544-557)**

   Store adapter tools alongside provider:

   ```typescript
   // Before (L460-482):
   let model: LanguageModel | undefined;
   let provider: string | undefined;
   // ...
   const resolved = await resolveModel(options.model);
   model = resolved.model;
   provider = resolved.provider;

   // After:
   let model: LanguageModel | undefined;
   let provider: string | undefined;
   let providerTools: Record<string, Tool> | undefined;
   // ...
   const resolved = await resolveModel(options.model, options.providers);
   model = resolved.model;
   provider = resolved.provider;
   providerTools = resolved.tools;
   ```

   Then pass to `createLiveAgent()`:

   ```typescript
   // Before (L547-557):
   createLiveAgent({
     model: model!,
     systemPromptAddition: options.systemPromptAddition,
     targetRole: targetRoles[0] ?? AGENT_ROLE,
     provider,
     enableWebSearch: options.enableWebSearch,
     additionalTools: options.additionalTools,
     // ...
   });

   // After:
   createLiveAgent({
     model: model!,
     systemPromptAddition: options.systemPromptAddition,
     targetRole: targetRoles[0] ?? AGENT_ROLE,
     provider,
     enableWebSearch: options.enableWebSearch,
     additionalTools: options.additionalTools,
     providerTools,  // NEW: adapter-provided tools (e.g., web search)
     // ...
   });
   ```

**Test impact:** Minimal — existing integration tests use `_testAgent` which bypasses
model resolution. Add new integration tests with mock adapter.

---

### Bead 5: Update `LiveAgent` to accept adapter-provided tools

**File:** `src/harness/liveAgent.ts`

**Changes:**

1. **Add `providerTools?` to `LiveAgentConfig` in `harnessTypes.ts` (L126-185)**

   ```typescript
   // Add to LiveAgentConfig interface:
   /** Provider-adapter-supplied tools (e.g., web search from custom providers) */
   providerTools?: Record<string, Tool>;
   ```

2. **Update `LiveAgent` constructor (L71-90) to use adapter tools**

   ```typescript
   // Before (L86-89):
   if (this.enableWebSearch && this.provider) {
     this.webSearchTools = loadWebSearchTools(this.provider);
   }

   // After:
   if (this.enableWebSearch) {
     if (config.providerTools) {
       // Custom provider supplied its own tools (from ProviderAdapter)
       this.webSearchTools = config.providerTools;
     } else if (this.provider) {
       // Built-in provider — use existing loadWebSearchTools()
       this.webSearchTools = loadWebSearchTools(this.provider);
     }
   }
   ```

   This keeps `loadWebSearchTools()` in place for built-in providers (Phase 1
   compatibility). The top-level imports of `@ai-sdk/openai` etc. remain for now — they
   can be refactored in a follow-up if desired, but removing them is not required for
   this feature.

**Test impact:** Update `liveAgent.test.ts` to test `providerTools` config field.

---

### Bead 6: Export new types from `index.ts`

**File:** `src/index.ts`

**Changes:**

1. **Add type exports (after L370)**

   ```typescript
   export type {
     ProviderAdapter,
     ProviderInput,
     BuiltInProviderName,
   } from './harness/harnessTypes.js';
   ```

2. **Add value export**

   ```typescript
   export { BUILT_IN_PROVIDERS } from './harness/modelResolver.js';
   ```

**Test impact:** Update `index.test.ts` to verify new exports are accessible.

---

### Bead 7: Unit tests for new functions

**File:** `tests/unit/harness/modelResolver.test.ts` (update existing)

**New test sections:**

```typescript
describe('parseModelId - extensible providers', () => {
  it('should parse unknown provider without throwing', () => {
    const result = parseModelId('deepinfra/meta-llama/Llama-3.3-70B');
    expect(result.provider).toBe('deepinfra');
    expect(result.modelId).toBe('meta-llama/Llama-3.3-70B');
  });

  it('should still reject invalid format (no slash)', () => {
    expect(() => parseModelId('no-slash')).toThrow();
  });

  it('should still reject empty provider', () => {
    expect(() => parseModelId('/model-id')).toThrow();
  });

  it('should still reject empty model ID', () => {
    expect(() => parseModelId('provider/')).toThrow();
  });
});

describe('normalizeProvider', () => {
  it('should pass through a ProviderAdapter unchanged', () => {
    const adapter: ProviderAdapter = {
      model: (id) => ({ modelId: id } as LanguageModel),
    };
    const result = normalizeProvider(adapter);
    expect(result).toBe(adapter);
  });

  it('should wrap a callable into a ProviderAdapter', () => {
    const callable = ((id: string) => ({ modelId: id })) as AiSdkProviderCallable;
    const result = normalizeProvider(callable);
    expect(typeof result.model).toBe('function');
  });

  it('should extract tools from a callable with .tools', () => {
    const callable = Object.assign(
      (id: string) => ({ modelId: id } as LanguageModel),
      { tools: { webSearch: () => ({ type: 'web_search' }) } },
    ) as AiSdkProviderCallable;
    const result = normalizeProvider(callable);
    expect(result.tools).toBeDefined();
    expect(result.tools!['web_search']).toBeDefined();
  });
});

describe('extractToolsFromProvider', () => {
  it('should return undefined for callable without .tools', () => {
    const callable = ((id: string) => ({ modelId: id })) as AiSdkProviderCallable;
    expect(extractToolsFromProvider(callable)).toBeUndefined();
  });

  it('should extract webSearch tool', () => {
    const callable = Object.assign(
      (id: string) => ({ modelId: id } as LanguageModel),
      { tools: { webSearch: () => ({ type: 'web_search' }) } },
    ) as AiSdkProviderCallable;
    const result = extractToolsFromProvider(callable);
    expect(result).toBeDefined();
    expect(result!['web_search']).toBeDefined();
  });

  it('should extract googleSearch tool with correct key', () => {
    const callable = Object.assign(
      (id: string) => ({ modelId: id } as LanguageModel),
      { tools: { googleSearch: () => ({ type: 'google_search' }) } },
    ) as AiSdkProviderCallable;
    const result = extractToolsFromProvider(callable);
    expect(result).toBeDefined();
    expect(result!['google_search']).toBeDefined();
  });

  it('should handle tool factory that throws', () => {
    const callable = Object.assign(
      (id: string) => ({ modelId: id } as LanguageModel),
      { tools: { webSearch: () => { throw new Error('no api key'); } } },
    ) as AiSdkProviderCallable;
    const result = extractToolsFromProvider(callable);
    expect(result).toBeUndefined();
  });
});

describe('resolveModel with custom providers', () => {
  it('should resolve via custom provider when matched', async () => {
    const mockModel = { modelId: 'test-model' } as LanguageModel;
    const providers = {
      custom: { model: () => mockModel } as ProviderAdapter,
    };
    const result = await resolveModel('custom/test-model', providers);
    expect(result.model).toBe(mockModel);
    expect(result.provider).toBe('custom');
    expect(result.modelId).toBe('test-model');
  });

  it('should include adapter tools in result', async () => {
    const mockModel = { modelId: 'test-model' } as LanguageModel;
    const mockTools = { web_search: {} as Tool };
    const providers = {
      custom: { model: () => mockModel, tools: mockTools } as ProviderAdapter,
    };
    const result = await resolveModel('custom/test-model', providers);
    expect(result.tools).toBe(mockTools);
  });

  it('should prefer custom provider over built-in', async () => {
    const mockModel = { modelId: 'custom-openai' } as LanguageModel;
    const providers = {
      openai: { model: () => mockModel } as ProviderAdapter,
    };
    const result = await resolveModel('openai/gpt-4o', providers);
    expect(result.model).toBe(mockModel);
  });

  it('should throw for unknown provider without custom provider', async () => {
    await expect(resolveModel('unknown/model')).rejects.toThrow(/Unknown provider/);
    await expect(resolveModel('unknown/model')).rejects.toThrow(/providers.*option/);
  });
});
```

**Update existing tests:**

- Tests that expect `parseModelId('firebase/model')` to throw should be updated to
  expect success: `{ provider: 'firebase', modelId: 'model' }`.
- The error message test should move to `resolveModel()` tests.

---

### Bead 8: Integration tests for custom providers through `fillForm()`

**File:** `tests/unit/harness/programmaticFill.test.ts` (or new file
`tests/integration/customProviders.test.ts`)

**Tests:**

```typescript
describe('fillForm with custom providers', () => {
  it('should resolve model via custom provider adapter', async () => {
    // Use _testAgent + providers to verify the provider path is hit
    // The mock agent handles filling; we just verify provider metadata
    const result = await fillForm({
      form: simpleFormMd,
      model: 'custom/test-model',
      providers: {
        custom: {
          model: (id) => createMockLanguageModel(id),
        },
      },
      _testAgent: createMockAgent(),
      enableWebSearch: false,
      captureWireFormat: false,
      recordFill: true,
    });
    expect(result.status.ok).toBe(true);
    // Verify provider metadata is captured in fill record
    expect(result.record?.provider).toBe('custom');
  });

  it('should pass adapter tools to LiveAgent when enableWebSearch is true', async () => {
    const mockTools = { web_search: createMockTool() };
    const result = await fillForm({
      form: simpleFormMd,
      model: 'custom/test-model',
      providers: {
        custom: {
          model: (id) => createMockLanguageModel(id),
          tools: mockTools,
        },
      },
      enableWebSearch: true,
      captureWireFormat: false,
      recordFill: false,
      _testAgent: createMockAgent(),
    });
    expect(result.status.ok).toBe(true);
  });

  it('should still work with built-in providers (regression)', async () => {
    // This test verifies backward compatibility
    // Uses _testAgent so no actual LLM call is made
    const result = await fillForm({
      form: simpleFormMd,
      model: 'anthropic/claude-sonnet-4-5',
      _testAgent: createMockAgent(),
      enableWebSearch: false,
      captureWireFormat: false,
      recordFill: false,
    });
    expect(result.status.ok).toBe(true);
  });

  it('should still work with direct LanguageModel (regression)', async () => {
    const result = await fillForm({
      form: simpleFormMd,
      model: createMockLanguageModel('test'),
      _testAgent: createMockAgent(),
      enableWebSearch: false,
      captureWireFormat: false,
      recordFill: false,
    });
    expect(result.status.ok).toBe(true);
  });
});
```

---

## Testing Strategy

### Unit Tests (Bead 7)

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

### Integration Tests (Bead 8)

**`programmaticFill.test.ts` (or new `customProviders.test.ts`):**
- End-to-end fill with mock agent + custom provider adapter
- Fill record includes custom provider name
- Web search tools from adapter are available to LiveAgent
- Per-call providers override built-in (e.g., custom `openai` adapter wins)

### Regression Tests

- All existing unit tests pass (except `parseModelId` provider validation updates)
- Golden tests should not be affected (no prompt or wire format changes)
- CLI tryscript tests should not be affected

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
