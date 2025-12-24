/**
 * Harness module exports.
 */

export { FormHarness, createHarness } from "./harness.js";
export { MockAgent, createMockAgent } from "./mockAgent.js";
export { LiveAgent, createLiveAgent } from "./liveAgent.js";
export type { LiveAgentConfig } from "./liveAgent.js";
export { parseModelId, resolveModel } from "./modelResolver.js";
export type { ParsedModelId, ResolvedModel, ProviderName } from "./modelResolver.js";
export type { Agent } from "./mockAgent.js";
export { fillForm } from "./programmaticFill.js";
export type {
  FillOptions,
  FillResult,
  FillStatus,
  TurnProgress,
  InputContext,
  RawFieldValue,
} from "./programmaticFill.js";
