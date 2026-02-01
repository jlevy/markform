# Feature: Proper URL Auto-Linking in Rendered Content

**Date:** 2026-01-28
**Author:** Claude
**Status:** Approved

## Overview

Implement reliable URL auto-linking in Markform's rendered view, ensuring bare URLs in text
content are converted to clickable links with abbreviated display text, while maintaining
XSS safety and properly handling markdown links.

## Goals

- Auto-detect bare URLs (http://, https://, www.) in string fields and text content
- Convert bare URLs to clickable `<a>` tags with abbreviated display (e.g., `example.com/path...`)
- Handle markdown-style links `[text](url)` properly (don't double-process)
- Ensure XSS safety by properly escaping all user content
- Be consistent across all text rendering contexts (string fields, string lists, table cells, markdown content)
- **All rendered URLs must have consistent copy-link tooltip behavior** (same as URL fields)
- Implement using proper Markdown parser mechanisms where possible
- Keep URL detection logic in a **single, clean, standalone function**
- Implement in a testable, maintainable way

## Non-Goals

- Full markdown rendering (bold, italic, etc.) - only URL handling
- Changing how Markdoc parses form structure
- Email address auto-linking (mailto:)
- FTP or other URL schemes - **only http://, https://, www.** supported

## Background

Current issues identified:
1. Table URL columns were storing markdown link format `[text](url)` but parsing returned the raw string, causing broken links pointing to localhost
2. Bare URLs in string fields appeared as unclickable text
3. The initial fix used hacky placeholder-based approach that was hard to maintain
4. XSS vulnerability was introduced by not escaping non-URL text

## Approaches Evaluated

### Approach 1: Regex-based (Current Implementation)

**How it works:**
1. Escape all HTML first
2. Convert markdown links `[text](url)` to `<a>` tags via regex
3. Convert bare URLs using regex with negative lookbehind to skip already-processed URLs

**Pros:**
- Simple, no additional dependencies
- Fast execution
- Matches existing `formatInlineMarkdown` pattern in serve.ts

**Cons:**
- Regex can have edge cases
- Harder to extend for more markdown features
- Requires careful ordering of operations

### Approach 2: Use Markdoc for Inline Parsing

**How it works:**
1. Parse text content with `Markdoc.parse()` to get AST
2. Walk AST to find link nodes and text nodes
3. For text nodes, detect bare URLs and insert synthetic link nodes
4. Render AST to HTML

**Pros:**
- Leverages existing dependency
- Proper AST-based parsing
- Easier to extend for other markdown features

**Cons:**
- Markdoc is designed for full documents, not inline snippets
- May be overkill for just link handling
- Would need custom transform to detect bare URLs in text nodes

### Approach 3: Use a Lightweight Inline Markdown Library

**How it works:**
1. Add a dependency like `marked` or `snarkdown` (small inline parser)
2. Configure it to only process links
3. Add custom extension for bare URL detection

**Pros:**
- Purpose-built for inline markdown
- Battle-tested edge case handling
- Extensible

**Cons:**
- Adds new dependency
- May have features we don't need

### Approach 4: Two-Pass Parsing

**How it works:**
1. First pass: Identify all markdown links and their positions
2. Second pass: For text outside markdown links, detect bare URLs
3. Build final HTML by combining both

**Pros:**
- Clear separation of concerns
- No negative lookbehind regex needed
- Easier to debug

**Cons:**
- More code
- Need to handle position tracking carefully

## Recommended Approach

**Hybrid Approach using Markdoc for links + regex for bare URLs:**

1. Use Markdoc's AST to properly identify markdown links (leveraging existing dependency)
2. For bare URL detection, use regex on text nodes (Markdoc doesn't auto-link bare URLs)
3. Keep all URL processing logic in a **single standalone module** (`urlFormat.ts`)

Key requirements:
- Single clean function for URL processing
- XSS safety via HTML escaping before URL detection
- All URLs get `url-link` class and `data-url` attribute for copy-link tooltip
- Only http://, https://, www. URLs supported

## Implementation Plan

### Phase 1: Core URL Processing Module (`urlFormat.ts`)

- [ ] Create single `formatTextWithUrls(text, escapeHtml)` function
- [ ] Escape all HTML first for XSS safety
- [ ] Convert markdown links `[text](url)` to `<a>` tags with `url-link` class
- [ ] Detect bare URLs (http://, https://, www. only) and convert to `<a>` tags
- [ ] All `<a>` tags get `data-url` attribute for copy-link tooltip
- [ ] Handle edge cases: query params, trailing punctuation, etc.

### Phase 2: Consistent URL Rendering in serve.ts

- [ ] String field rendering uses `formatTextWithUrls`
- [ ] String list item rendering uses `formatTextWithUrls`
- [ ] Table cell rendering (non-URL columns) uses `formatTextWithUrls`
- [ ] `formatInlineMarkdown` uses same bare URL detection
- [ ] All URLs render with consistent styling and copy-link behavior

### Phase 3: Table URL Column Parsing Fix

- [ ] Fix `parseCellValue` to extract URL from markdown link format
- [ ] Ensure round-trip: serialize URL as markdown → parse back → get original URL

## Testing Strategy

### Unit Tests for URL Parsing

Create a comprehensive test document with various URL formats:

```
# Test Cases for URL Auto-Linking

## Bare URLs
- Simple: https://example.com
- With path: https://example.com/path/to/page
- With query: https://example.com/search?q=test&page=2
- With fragment: https://example.com/docs#section
- HTTP: http://example.com
- WWW: www.example.com

## Markdown Links
- Basic: [Example](https://example.com)
- With path: [Docs](https://example.com/docs/api)
- Abbreviated text: [example.com/docs...](https://example.com/docs/really/long/path)

## Mixed Content
- Text with bare URL: Check https://example.com for more
- Text with markdown link: See [the docs](https://example.com) for info
- Both: Visit https://example.com or [click here](https://other.com)
- Multiple bare: https://a.com and https://b.com

## Edge Cases
- URL at end of sentence: Visit https://example.com.
- URL with comma: See https://example.com, then continue
- URL in parens: (https://example.com)
- Trailing punctuation: https://example.com!

## XSS Prevention
- Script tag: <script>alert('xss')</script> https://example.com
- Image onerror: <img onerror=alert(1)> https://example.com
- HTML in link text: [<b>bold</b>](https://example.com)
```

### Golden Tests

- Create golden test files with input markdown and expected HTML output
- Test each rendering context (string fields, table cells, markdown content)

### Integration Tests

- Test full form rendering with tables containing URL columns
- Verify links in rendered view point to correct destinations

## Decisions Made

1. **URL schemes**: Only http://, https://, www. supported (no ftp://, mailto:)
2. **Copy URL tooltip**: YES - all auto-linked URLs get copy-link tooltip behavior, consistent with URL fields
3. **Implementation**: Single standalone function in `urlFormat.ts` for clean, testable code

## Open Questions

1. Should URL abbreviation length be configurable? (Current default: 12 chars for path)

## References

- PR #115: Original fix with XSS issue
- Bugbot comment on XSS vulnerability
- Markdoc documentation: https://markdoc.dev
