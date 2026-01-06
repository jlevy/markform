/**
 * Tool Parsing Utilities - Extract structured information from tool inputs/outputs.
 *
 * Provides helpers to parse web search results from various providers (OpenAI,
 * Anthropic, Google, XAI) into a consistent format for logging and callbacks.
 */

import type { ToolType, WebSearchResult } from './harnessTypes.js';
import { FILL_FORM_TOOL_NAME } from './toolApi.js';

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of top results to include in summary */
const MAX_TOP_RESULTS = 8;

/** Web search tool names across providers */
const WEB_SEARCH_TOOL_NAMES = ['web_search', 'webSearch', 'google_search', 'googleSearch'];

// =============================================================================
// Tool Type Detection
// =============================================================================

/**
 * Determine the tool type from its name.
 */
export function getToolType(toolName: string): ToolType {
  if (toolName === FILL_FORM_TOOL_NAME) {
    return 'fill_form';
  }
  if (WEB_SEARCH_TOOL_NAMES.includes(toolName) || toolName.toLowerCase().includes('search')) {
    return 'web_search';
  }
  return 'custom';
}

// =============================================================================
// Query Extraction
// =============================================================================

/**
 * Extract search query from tool input.
 *
 * Handles various input formats from different providers.
 */
export function extractSearchQuery(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined;

  const obj = input as Record<string, unknown>;

  // Direct query field (most common)
  if (typeof obj.query === 'string') {
    return obj.query;
  }

  // OpenAI format: { search_query: "..." }
  if (typeof obj.search_query === 'string') {
    return obj.search_query;
  }

  // Nested query object
  if (obj.query && typeof obj.query === 'object') {
    const queryObj = obj.query as Record<string, unknown>;
    if (typeof queryObj.text === 'string') {
      return queryObj.text;
    }
  }

  return undefined;
}

// =============================================================================
// Result Extraction
// =============================================================================

/**
 * Parsed web search results with summary information.
 */
export interface ParsedWebSearchResults {
  /** Total number of results */
  resultCount: number;
  /** Source domains (e.g., "imdb.com, wikipedia.org") */
  sources: string;
  /** Top result titles with "..." for more */
  topResults: string;
  /** Full structured results */
  fullResults: WebSearchResult[];
}

/**
 * Extract domain from URL.
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Extract web search results from tool output.
 *
 * Handles various output formats from different providers:
 * - OpenAI: { results: [...] } or { web_search_results: [...] }
 * - Anthropic: { results: [...] }
 * - Google: { results: [...] }
 * - XAI: { results: [...] }
 */
export function extractWebSearchResults(output: unknown): ParsedWebSearchResults | undefined {
  if (!output || typeof output !== 'object') return undefined;

  const obj = output as Record<string, unknown>;

  // Find the results array
  let results: unknown[] | undefined;

  if (Array.isArray(obj.results)) {
    results = obj.results;
  } else if (Array.isArray(obj.web_search_results)) {
    results = obj.web_search_results;
  } else if (Array.isArray(obj.organic_results)) {
    results = obj.organic_results;
  } else if (Array.isArray(output)) {
    // Direct array of results
    results = output;
  }

  if (!results || results.length === 0) {
    return {
      resultCount: 0,
      sources: '',
      topResults: '(no results)',
      fullResults: [],
    };
  }

  // Parse individual results
  const fullResults: WebSearchResult[] = [];
  const domains = new Set<string>();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result || typeof result !== 'object') continue;

    const r = result as Record<string, unknown>;
    const title =
      (typeof r.title === 'string' ? r.title : '') || (typeof r.name === 'string' ? r.name : '');
    const url =
      (typeof r.url === 'string' ? r.url : '') || (typeof r.link === 'string' ? r.link : '');
    const snippet =
      typeof r.snippet === 'string'
        ? r.snippet
        : typeof r.description === 'string'
          ? r.description
          : undefined;

    if (title || url) {
      fullResults.push({
        index: i + 1,
        title: title || '(untitled)',
        url,
        snippet,
      });

      if (url) {
        domains.add(extractDomain(url));
      }
    }
  }

  // Build sources summary (unique domains)
  const domainList = Array.from(domains).slice(0, 5);
  const sources = domainList.join(', ') + (domains.size > 5 ? ', ...' : '');

  // Build top results summary
  const topTitles = fullResults.slice(0, MAX_TOP_RESULTS).map((r) => `"${r.title}"`);
  const topResults = topTitles.join(', ') + (fullResults.length > MAX_TOP_RESULTS ? ', ...' : '');

  return {
    resultCount: fullResults.length,
    sources,
    topResults,
    fullResults,
  };
}

// =============================================================================
// Tool Info Extraction
// =============================================================================

/**
 * Structured tool start information.
 */
export interface ToolStartInfo {
  name: string;
  input: unknown;
  toolType: ToolType;
  query?: string;
}

/**
 * Structured tool end information.
 */
export interface ToolEndInfo {
  name: string;
  output: unknown;
  durationMs: number;
  error?: string;
  toolType: ToolType;
  resultCount?: number;
  sources?: string;
  topResults?: string;
  fullResults?: WebSearchResult[];
}

/**
 * Extract structured information for tool start callback.
 */
export function extractToolStartInfo(name: string, input: unknown): ToolStartInfo {
  const toolType = getToolType(name);
  const info: ToolStartInfo = { name, input, toolType };

  if (toolType === 'web_search') {
    const query = extractSearchQuery(input);
    if (query) {
      info.query = query;
    }
  }

  return info;
}

/**
 * Extract structured information for tool end callback.
 */
export function extractToolEndInfo(
  name: string,
  output: unknown,
  durationMs: number,
  error?: string,
): ToolEndInfo {
  const toolType = getToolType(name);
  const info: ToolEndInfo = { name, output, durationMs, toolType };

  if (error) {
    info.error = error;
    return info;
  }

  if (toolType === 'web_search') {
    const results = extractWebSearchResults(output);
    if (results) {
      info.resultCount = results.resultCount;
      info.sources = results.sources;
      info.topResults = results.topResults;
      info.fullResults = results.fullResults;
    }
  }

  return info;
}
