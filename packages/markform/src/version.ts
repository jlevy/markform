/**
 * Markform version constant.
 *
 * Extracted to its own module to avoid import cycles: index.ts re-exports
 * fillForm from programmaticFill.ts, so programmaticFill.ts cannot import
 * from index.ts. Internal modules import VERSION from here; index.ts
 * re-exports it for the public API.
 */

// Build-time injected by tsdown (see tsdown.config.ts)
declare const __MARKFORM_VERSION__: string;

/** Markform version (injected at build time). */
export const VERSION: string =
  typeof __MARKFORM_VERSION__ !== 'undefined' ? __MARKFORM_VERSION__ : 'development';
