/**
 * Research module - Web search enabled form filling.
 *
 * This module provides the research API for filling forms with
 * information gathered from web searches.
 */

// Core API
export { runResearch } from './runResearch.js';
export type { ResearchOptions } from './runResearch.js';

// Types
export type { ResearchResult, ResearchStatus } from './researchTypes.js';

// Validation
export { isResearchForm, validateResearchForm } from './researchFormValidation.js';
