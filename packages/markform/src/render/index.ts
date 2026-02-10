/**
 * Markform Render — HTML rendering functions for forms and fill records.
 *
 * This is the public API surface for the `markform/render` subpath export.
 * Consumers can import these functions to render forms and fill records
 * with exact visual parity to `markform serve`.
 */

// Utilities
export { escapeHtml, formatDuration, formatTokens } from './renderUtils.js';

// Content renderers
export {
  renderViewContent,
  renderSourceContent,
  renderMarkdownContent,
  renderYamlContent,
  renderJsonContent,
} from './contentRenderers.js';

// Fill record renderer and assets
export {
  renderFillRecordContent,
  FILL_RECORD_STYLES,
  FILL_RECORD_SCRIPTS,
} from './fillRecordRenderer.js';
