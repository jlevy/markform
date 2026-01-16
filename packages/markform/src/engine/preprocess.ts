/**
 * Preprocessor for HTML comment syntax in Markform files.
 *
 * Transforms HTML comment-style directives (`<!-- f:tag -->`) to Markdoc syntax (`{% tag %}`)
 * before parsing. This enables forms to render cleanly on GitHub and standard Markdown editors.
 *
 * The preprocessor is always-on with no configuration required.
 */

import type { SyntaxStyle } from './coreTypes.js';

// Re-export for convenience
export type { SyntaxStyle } from './coreTypes.js';

// =============================================================================
// State Machine for Code Block Detection
// =============================================================================

/** Parser state for tracking code blocks */
const enum State {
  NORMAL = 0,
  FENCED_CODE = 1,
}

/**
 * Check if position is at the start of a line (or at position 0).
 */
function isAtLineStart(input: string, pos: number): boolean {
  return pos === 0 || input[pos - 1] === '\n';
}

/**
 * Check if position is in leading whitespace of a line.
 * Returns true if all characters between the last newline (or start) and pos are spaces.
 */
export function isInLeadingWhitespace(input: string, pos: number): boolean {
  let j = pos - 1;
  while (j >= 0 && input[j] !== '\n') {
    if (input[j] !== ' ' && input[j] !== '\t') {
      return false;
    }
    j--;
  }
  return true;
}

/**
 * Match a fenced code block opening at the given position.
 * Returns fence info if found, null otherwise.
 * Handles 0-3 leading spaces per CommonMark spec.
 */
function matchFenceOpening(
  input: string,
  pos: number,
): { char: string; length: number; fullMatch: string } | null {
  // Check for 0-3 leading spaces (4+ spaces = indented code block, not fence)
  let indent = 0;
  let i = pos;
  while (i < input.length && input[i] === ' ') {
    indent++;
    i++;
  }

  // 4+ spaces means this is not a fenced code block per CommonMark
  if (indent >= 4) {
    return null;
  }

  // Check for fence character (` or ~)
  const fenceChar = input[i];
  if (fenceChar !== '`' && fenceChar !== '~') {
    return null;
  }

  // Count consecutive fence characters (need at least 3)
  let fenceLength = 0;
  while (i + fenceLength < input.length && input[i + fenceLength] === fenceChar) {
    fenceLength++;
  }

  if (fenceLength < 3) {
    return null;
  }

  // Find end of line to get full match
  let endOfLine = i + fenceLength;
  while (endOfLine < input.length && input[endOfLine] !== '\n') {
    endOfLine++;
  }
  // Include the newline if present
  if (endOfLine < input.length) {
    endOfLine++;
  }

  return {
    char: fenceChar,
    length: fenceLength,
    fullMatch: input.slice(pos, endOfLine),
  };
}

/**
 * Check if position matches a closing fence for the given opening fence.
 */
function matchFenceClosing(
  input: string,
  pos: number,
  fenceChar: string,
  fenceLength: number,
): boolean {
  // Check for 0-3 leading spaces
  let indent = 0;
  let i = pos;
  while (indent < 4 && i < input.length && input[i] === ' ') {
    indent++;
    i++;
  }

  // Check for matching fence character
  if (input[i] !== fenceChar) {
    return false;
  }

  // Count consecutive fence characters (need at least fenceLength)
  let closingLength = 0;
  while (i + closingLength < input.length && input[i + closingLength] === fenceChar) {
    closingLength++;
  }

  if (closingLength < fenceLength) {
    return false;
  }

  // Rest of line must be whitespace only (or end of string)
  let afterFence = i + closingLength;
  while (afterFence < input.length && input[afterFence] !== '\n') {
    if (input[afterFence] !== ' ' && input[afterFence] !== '\t') {
      return false;
    }
    afterFence++;
  }

  return true;
}

/**
 * Find the end of an inline code span starting at the given position.
 * Returns the position after the closing backticks, or -1 if not a valid span.
 */
export function findInlineCodeEnd(input: string, pos: number): number {
  // Count opening backticks
  let openCount = 0;
  let i = pos;
  while (i < input.length && input[i] === '`') {
    openCount++;
    i++;
  }

  if (openCount === 0) {
    return -1;
  }

  // Look for matching closing backticks
  while (i < input.length) {
    if (input[i] === '`') {
      let closeCount = 0;
      while (i < input.length && input[i] === '`') {
        closeCount++;
        i++;
      }
      if (closeCount === openCount) {
        return i;
      }
      // Not a match, continue searching
    } else if (input[i] === '\n') {
      // Inline code can span lines but not across blank lines
      i++;
    } else {
      i++;
    }
  }

  return -1;
}

// =============================================================================
// Preprocessor
// =============================================================================

/**
 * Transform HTML comment syntax to Markdoc syntax.
 *
 * Patterns transformed:
 * - `<!-- f:tagname ... -->` → `{% tagname ... %}`
 * - `<!-- /f:tagname -->` → `{% /tagname %}`
 * - `<!-- f:tagname ... /-->` → `{% tagname ... /%}`
 * - `<!-- #id -->` → `{% #id %}`
 * - `<!-- .class -->` → `{% .class %}`
 *
 * Code blocks (fenced and inline) are preserved unchanged.
 *
 * @param input - The markdown content
 * @returns The preprocessed content with Markdoc syntax
 */
export function preprocessCommentSyntax(input: string): string {
  let output = '';
  let state: State = State.NORMAL;
  let fenceChar = '';
  let fenceLength = 0;
  let i = 0;

  while (i < input.length) {
    switch (state) {
      case State.NORMAL: {
        // Check for fenced code block at line start
        if (isAtLineStart(input, i)) {
          const fence = matchFenceOpening(input, i);
          if (fence) {
            state = State.FENCED_CODE;
            fenceChar = fence.char;
            fenceLength = fence.length;
            output += fence.fullMatch;
            i += fence.fullMatch.length;
            continue;
          }
        }

        // Check for inline code (skip it entirely to preserve content)
        // For 3+ backticks at line start, skip - they might be fence-like patterns
        // For 1-2 backticks, always treat as inline code regardless of position
        if (input[i] === '`') {
          let backtickCount = 0;
          let j = i;
          while (j < input.length && input[j] === '`') {
            backtickCount++;
            j++;
          }
          const skipInlineCode = backtickCount >= 3 && isInLeadingWhitespace(input, i);
          if (!skipInlineCode) {
            const end = findInlineCodeEnd(input, i);
            if (end !== -1) {
              output += input.slice(i, end);
              i = end;
              continue;
            }
          }
        }

        // Check for HTML comment directive
        if (input.slice(i, i + 4) === '<!--') {
          const endComment = input.indexOf('-->', i + 4);
          if (endComment !== -1) {
            const interior = input.slice(i + 4, endComment).trim();

            // Check for f: namespace prefix (opening tags)
            if (interior.startsWith('f:')) {
              const tagContent = interior.slice(2); // Remove 'f:'
              if (tagContent.endsWith('/')) {
                // Self-closing: <!-- f:tag /--> → {% tag /%}
                output += '{% ' + tagContent.slice(0, -1).trim() + ' /%}';
              } else {
                output += '{% ' + tagContent + ' %}';
              }
              i = endComment + 3;
              continue;
            }

            // Check for /f: closing tag
            if (interior.startsWith('/f:')) {
              const tagName = interior.slice(3); // Remove '/f:'
              output += '{% /' + tagName + ' %}';
              i = endComment + 3;
              continue;
            }

            // Check for #id or .class annotations
            if (interior.startsWith('#') || interior.startsWith('.')) {
              output += '{% ' + interior + ' %}';
              i = endComment + 3;
              continue;
            }

            // Not a Markform directive - pass through unchanged
          }
        }

        output += input[i];
        i++;
        break;
      }

      case State.FENCED_CODE: {
        // Check for fence close at line start
        if (isAtLineStart(input, i) && matchFenceClosing(input, i, fenceChar, fenceLength)) {
          // Find end of closing fence line
          let endLine = i;
          while (endLine < input.length && input[endLine] !== '\n') {
            endLine++;
          }
          if (endLine < input.length) {
            endLine++; // Include newline
          }
          output += input.slice(i, endLine);
          i = endLine;
          state = State.NORMAL;
          fenceChar = '';
          fenceLength = 0;
          continue;
        }

        output += input[i];
        i++;
        break;
      }
    }
  }

  return output;
}

// =============================================================================
// Syntax Detection
// =============================================================================

/**
 * Detect which syntax style is used in a document.
 *
 * Scans for the first occurrence of either HTML comment syntax (`<!-- f:`, `<!-- #`, `<!-- .`)
 * or Markdoc syntax (`{%`). Returns the style of whichever appears first.
 *
 * Code blocks (fenced and inline) are skipped to avoid false positives from examples.
 *
 * @param input - The markdown content
 * @returns The detected syntax style, defaults to 'tags' if ambiguous
 */
export function detectSyntaxStyle(input: string): SyntaxStyle {
  let state: State = State.NORMAL;
  let fenceChar = '';
  let fenceLength = 0;
  let i = 0;

  while (i < input.length) {
    switch (state) {
      case State.NORMAL: {
        // Check for fenced code block at line start
        if (isAtLineStart(input, i)) {
          const fence = matchFenceOpening(input, i);
          if (fence) {
            state = State.FENCED_CODE;
            fenceChar = fence.char;
            fenceLength = fence.length;
            i += fence.fullMatch.length;
            continue;
          }
        }

        // Check for inline code (skip it entirely)
        // For 3+ backticks at line start, skip - they might be fence-like patterns
        if (input[i] === '`') {
          let backtickCount = 0;
          let j = i;
          while (j < input.length && input[j] === '`') {
            backtickCount++;
            j++;
          }
          const skipInlineCode = backtickCount >= 3 && isInLeadingWhitespace(input, i);
          if (!skipInlineCode) {
            const end = findInlineCodeEnd(input, i);
            if (end !== -1) {
              i = end;
              continue;
            }
          }
        }

        // Check for HTML comment patterns
        if (input.slice(i, i + 7) === '<!-- f:' || input.slice(i, i + 8) === '<!-- /f:') {
          return 'comments';
        }
        if (input.slice(i, i + 6) === '<!-- #' || input.slice(i, i + 6) === '<!-- .') {
          return 'comments';
        }

        // Check for Markdoc pattern
        if (input.slice(i, i + 2) === '{%') {
          return 'tags';
        }

        i++;
        break;
      }

      case State.FENCED_CODE: {
        // Check for fence close at line start
        if (isAtLineStart(input, i) && matchFenceClosing(input, i, fenceChar, fenceLength)) {
          // Find end of closing fence line
          let endLine = i;
          while (endLine < input.length && input[endLine] !== '\n') {
            endLine++;
          }
          if (endLine < input.length) {
            endLine++; // Include newline
          }
          i = endLine;
          state = State.NORMAL;
          fenceChar = '';
          fenceLength = 0;
          continue;
        }

        i++;
        break;
      }
    }
  }

  // No syntax markers found, default to tags
  return 'tags';
}

// =============================================================================
// Syntax Consistency Validation
// =============================================================================

/**
 * A violation found when validating syntax consistency.
 */
export interface SyntaxViolation {
  /** 1-indexed line number where the violation was found */
  line: number;
  /** The pattern that violated the expected syntax */
  pattern: string;
  /** The syntax style that was found (opposite of expected) */
  foundSyntax: SyntaxStyle;
}

/**
 * Validate that a document uses only the specified syntax style.
 *
 * Scans the document for patterns of the "wrong" syntax and returns violations.
 * Code blocks (fenced and inline) are skipped.
 *
 * @param input - The markdown content
 * @param expectedSyntax - The syntax style that should be used
 * @returns Array of violations (empty if document is consistent)
 */
export function validateSyntaxConsistency(
  input: string,
  expectedSyntax: SyntaxStyle,
): SyntaxViolation[] {
  const violations: SyntaxViolation[] = [];
  let state: State = State.NORMAL;
  let fenceChar = '';
  let fenceLength = 0;
  let i = 0;
  let lineNumber = 1;

  while (i < input.length) {
    // Track line numbers
    if (input[i] === '\n') {
      lineNumber++;
    }

    switch (state) {
      case State.NORMAL: {
        // Check for fenced code block at line start
        if (isAtLineStart(input, i)) {
          const fence = matchFenceOpening(input, i);
          if (fence) {
            state = State.FENCED_CODE;
            fenceChar = fence.char;
            fenceLength = fence.length;
            // Count newlines in the fence line
            for (const ch of fence.fullMatch) {
              if (ch === '\n') lineNumber++;
            }
            i += fence.fullMatch.length;
            continue;
          }
        }

        // Check for inline code (skip it entirely)
        // For 3+ backticks at line start, skip - they might be fence-like patterns
        if (input[i] === '`') {
          let backtickCount = 0;
          let k = i;
          while (k < input.length && input[k] === '`') {
            backtickCount++;
            k++;
          }
          const skipInlineCode = backtickCount >= 3 && isInLeadingWhitespace(input, i);
          if (!skipInlineCode) {
            const end = findInlineCodeEnd(input, i);
            if (end !== -1) {
              // Count newlines in the inline code
              for (let m = i; m < end; m++) {
                if (input[m] === '\n') lineNumber++;
              }
              i = end;
              continue;
            }
          }
        }

        // Check for violations based on expected syntax
        if (expectedSyntax === 'comments') {
          // Looking for Markdoc syntax violations
          if (input.slice(i, i + 2) === '{%') {
            // Find the end of this tag to get the pattern
            const endTag = input.indexOf('%}', i + 2);
            if (endTag !== -1) {
              const pattern = input.slice(i, endTag + 2);
              violations.push({
                line: lineNumber,
                pattern,
                foundSyntax: 'tags',
              });
            }
          }
        } else {
          // expectedSyntax === 'tags'
          // Looking for HTML comment syntax violations
          if (input.slice(i, i + 7) === '<!-- f:' || input.slice(i, i + 8) === '<!-- /f:') {
            const endComment = input.indexOf('-->', i + 4);
            if (endComment !== -1) {
              const pattern = input.slice(i, endComment + 3);
              violations.push({
                line: lineNumber,
                pattern,
                foundSyntax: 'comments',
              });
            }
          } else if (input.slice(i, i + 6) === '<!-- #' || input.slice(i, i + 6) === '<!-- .') {
            const endComment = input.indexOf('-->', i + 4);
            if (endComment !== -1) {
              const interior = input.slice(i + 4, endComment).trim();
              // Only flag if it's actually an annotation (starts with # or . only)
              if (/^[#.][a-zA-Z_-]/.test(interior)) {
                const pattern = input.slice(i, endComment + 3);
                violations.push({
                  line: lineNumber,
                  pattern,
                  foundSyntax: 'comments',
                });
              }
            }
          }
        }

        i++;
        break;
      }

      case State.FENCED_CODE: {
        // Check for fence close at line start
        if (isAtLineStart(input, i) && matchFenceClosing(input, i, fenceChar, fenceLength)) {
          // Find end of closing fence line
          let endLine = i;
          while (endLine < input.length && input[endLine] !== '\n') {
            endLine++;
          }
          if (endLine < input.length) {
            endLine++; // Include newline
            lineNumber++;
          }
          i = endLine;
          state = State.NORMAL;
          fenceChar = '';
          fenceLength = 0;
          continue;
        }

        i++;
        break;
      }
    }
  }

  return violations;
}
