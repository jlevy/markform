# Research Brief: Escaping fenced code blocks inside Markform value fences

**Last Updated**: 2025-12-27

**Status**: Complete

**Related**:

- `SPEC.md` — Layer 1 syntax, value fences, and `process=false`

- `docs/project/architecture/current/arch-markform-design.md`

- `packages/markform/src/engine/serialize.ts` — `formatValueFence()` to be updated

- `packages/markform/src/engine/parseHelpers.ts` — `extractFenceValue()` (already
  flexible)

- Markdoc docs: nodes/fence, attributes, process=false

* * *

## Executive Summary

Goal: Decide how to safely serialize values in Markform `value` fences when the value
itself is Markdown that may contain fenced code blocks (backticks or tildes), including
Markdoc tags.
This matters for “Markform-in-Markform” use cases and any field that stores
Markdown literals.

Key findings:

- CommonMark/GFM supports backtick or tilde fences; an outer fence closes on a line with
  the same fence char and at least the same length, indented ≤ 3 spaces.
  Standard practice is to choose an outer fence longer than any run inside, or switch
  fence char (backticks vs tildes).

- Markdoc inherits CommonMark fence behavior and adds `process=false` to disable tag
  processing inside a fence; this solves tag interpretation but not fence-collision.

- We can deterministically choose a “safe” fence (char + length) on serialize by
  scanning the content.
  This avoids escaping content and preserves readability.

Recommendation: Implement a “smart fence selection” serializer:

1. When content contains Markdoc tags, set `process=false` on the fence.

2. Compute the maximum run lengths of both fence chars (`` ` `` and `~`) that occur at
   indentation ≤ 3 at the line start.
   Pick the char with the smaller max-run and emit an outer fence length of `maxRun + 1`
   (minimum 3). Prefer backticks unless that yields a longer fence than choosing tildes.

3. Use as many fence characters as needed—no arbitrary cap.
   Pathological cases are rare.

* * *

## Research Methodology

### Approach

- Reviewed CommonMark/GFM rules for fenced code blocks and nesting behavior.

- Reviewed Markdoc “nodes/fence”, attributes, and `process=false` behavior.

- Derived a deterministic serialization algorithm consistent with SPEC constraints.

### Sources

- CommonMark/GFM fenced code block rules and practice

- Markdoc documentation (overview, nodes, attributes, process=false)

* * *

## Research Findings

### 1. Standard practices in Markdown parsers

**Status**: ✅ Complete

**Details**:

- Fences may use backticks ``` or tildes ~~~ as opening/closing markers.

- A closing fence must use the same marker char and be at least as long as the opening
  fence; it can be indented by at most 3 spaces.

- Content inside a fenced block is literal; however, a content line that begins (indent
  ≤ 3) with a fence equal to or longer than the opening fence will terminate the block.

- Standard ways to include “inner fences” inside an “outer fence”:

  - Use a longer outer fence length than any run inside, e.g. outer ```` while inner
    uses ```.

  - Switch fence char (outer ~~~, inner ```), or vice versa.

  - Indented (4-space) code blocks avoid fence interactions but are less readable and
    not ideal for verbatim round-tripping.

**Implications**: The robust, portable solution is to select an outer fence that cannot
be closed by any inner content—achieved by choosing char and length based on the
content.

* * *

### 2. Behavior of Markdoc and its parser

**Status**: ✅ Complete

**Details**:

- Markdoc supports CommonMark-style fenced code blocks and exposes them as `fence` nodes
  with an info string (language).

- Markdoc adds `process=false` on fences to prevent tag processing within the block;
  this is orthogonal to fence-termination rules.

- Markdoc supports both backtick and tilde fences; fence termination follows the
  CommonMark rule (same char, length ≥ opening, indent ≤ 3).

**Implications**: `process=false` solves "don’t execute `{% ... %}` inside values" but
does not prevent an inner fence from prematurely closing an outer fence if the markers
collide. We still need safe outer fence selection.

* * *

### 3. Markform current implementation

**Status**: ✅ Complete

**Parsing (already flexible):**

- Markform uses `extractFenceValue()` in `parseHelpers.ts` to find `fence` nodes with
  `attributes.language === 'value'` and extract `attributes.content`.

- This is agnostic to fence char (backticks vs tildes) and fence length—whatever the
  markdown parser produces as a valid fence works.

**Serialization (needs update):**

- Currently `formatValueFence()` in `serialize.ts` emits fixed triple-backtick fences:
  `` `\n\`\`\`value\n${content}\n\`\`\`\n` ``

- This is unsafe if content contains lines that would terminate the fence.

**Assessment**: Only the serializer needs to change; the parser is already robust.

* * *

### 4. Options for Markform

**Status**: ✅ Complete

**Option A — Smart fence selection on serialize (CHOSEN)**

- Algorithm (content-local, deterministic, readable):

  1. Detect if content contains Markdoc tag syntax (`/\{%/`). If yes, add
     `process=false` to the fence.

  2. Scan content for max-run lengths of backticks and tildes that occur at indentation
     ≤ 3 at start of line.

  3. Choose the fence char whose `maxRun` is smaller; set outer fence length to `max(3,
     maxRun + 1)`.

  4. If tie, prefer backticks by default (or tildes—pick one convention and document
     it).

  5. Emit fence as, e.g., ````value {% process=false %}`for backticks or`~~~~value {%
     process=false %}` for tildes.

- Pros: Standards-compliant, minimal complexity, preserves literal content, highly
  readable.

- Cons: Requires a short scan during serialization.

**Option B — Always use tildes for `value` fences**

- Use `~~~value` by default; if content has tildes at risk lengths, increase outer tilde
  count (e.g., `~~~~`).

- Pros: Simple rule; avoids backtick collision with typical Markdown code samples.

- Cons: Still needs length-escalation scan for pathological tilde content; less flexible
  than Option A.

**Option C — Base64 (or similar) encoding**

- Encode the value payload and place the encoded text inside a short fence.

- Pros: Eliminates fence collision entirely.

- Cons: Poor readability; breaks “human-readable” design; not aligned with SPEC goals.

**Option D — Indented blocks for values**

- Avoid fences and use 4-space indented blocks.

- Pros: Avoids fence collision.

- Cons: Loses language/info string and `process=false` attachment; worse readability and
  more fragile with surrounding indentation; not aligned with current SPEC.

* * *

## Comparative Analysis

| Criteria | Option A: Smart selection | Option B: Always tildes | Option C: Encode | Option D: Indent |
| --- | --- | --- | --- | --- |
| Readability | High | High | Low | Medium |
| SPEC fit | Excellent | Good | Poor | Poor |
| Robustness | High | Medium | High | Medium |
| Implementation effort | Low/Medium | Low | Low | Medium |
| **Decision** | **CHOSEN** | Rejected | Rejected | Rejected |

* * *

## Best Practices

1. Prefer content-preserving solutions over escaping/encoding.

2. Always add `process=false` when content contains Markdoc tags (`{% ... %}`).

3. Choose an outer fence char/length that provably cannot be closed by content lines
   (indent ≤ 3).

* * *

## Decisions

1. **Fence char preference:** Use adaptive selection (Option A). Default to backticks;
   switch to tildes only when backticks would require a longer fence.
   This keeps typical forms using backticks while handling edge cases gracefully.

2. **Fence length:** No arbitrary cap.
   Use as many fence characters as needed to safely contain the content.
   Pathological cases are rare; adding a cap would mean more code and edge-case testing
   for minimal benefit.

* * *

## Chosen Approach: Option A (Smart Fence Selection)

### Summary

Adopt Option A (smart fence selection) in the serializer, plus `process=false` when
Markdoc tags are present.
Update `SPEC.md` under “Field Values → Value fences” to document this behavior.

### Implementation Rules

1. Default to backticks with length 3.

2. Scan content for the maximum run of each fence char (backticks and tildes) that
   occurs at line start with indent ≤ 3.

3. Pick the char with the smaller max-run; set outer fence length to `max(3, maxRun+1)`.

4. If tie, prefer backticks.

### Examples

**Example 1: Outer fence uses 4 backticks to allow inner triple-backtick block:**

```markdown
````value
Text with an inner fenced code block:

```python
print("hello")
```
```
```

**Example 2: Outer tilde fence to allow backticks inside verbatim:**

```markdown
~~~value
Here is a sample with triple backticks:

```js
console.log("ok");
```
```
```

**Example 3: Value containing Markdoc tags (adds `process=false`):**

```markdown
````value {% process=false %}
Use {% callout %} for emphasis.
```
```

### Rejected Alternatives

- **Option B (always tildes):** Simpler but less flexible; still needs length
  escalation.

- **Option C (encoding):** Eliminates collision but destroys human readability.

- **Option D (indented blocks):** Loses info string and `process=false`; fragile.

* * *

## References

- CommonMark/GFM fenced code block behavior (backticks, tildes, closing rules)

- Markdoc docs: nodes/fence, attributes, and `process=false`

* * *

## Appendices

### Appendix A: Serializer pseudo-code

```ts
function pickFence(value: string): { char: '`' | '~'; len: number; processFalse: boolean } {
  const needsProcessFalse = /\{%/.test(value);
  const maxBacktick = maxRunAtLineStart(value, '`');
  const maxTilde = maxRunAtLineStart(value, '~');

  const btLen = Math.max(3, maxBacktick + 1);
  const tlLen = Math.max(3, maxTilde + 1);

  // Prefer the shorter fence; tie-breaker prefers backticks
  if (btLen <= tlLen) {
    return { char: '`', len: btLen, processFalse: needsProcessFalse };
  }
  return { char: '~', len: tlLen, processFalse: needsProcessFalse };
}

function maxRunAtLineStart(value: string, char: string): number {
  // Match lines starting with 0-3 spaces followed by runs of the fence char
  const pattern = new RegExp(`^( {0,3})(${char}+)`, 'gm');
  let maxRun = 0;
  for (const match of value.matchAll(pattern)) {
    maxRun = Math.max(maxRun, match[2].length);
  }
  return maxRun;
}
```

### Appendix B: Code locations

| File | Function | Purpose |
| --- | --- | --- |
| `packages/markform/src/engine/parseHelpers.ts` | `extractFenceValue()` | Extracts fence content; already flexible |
| `packages/markform/src/engine/serialize.ts` | `formatValueFence()` | Emits fence; needs smart selection |
| `packages/markform/src/engine/serialize.ts` | `serializeStringField()` | Uses `formatValueFence`; will inherit fix |

### Appendix C: Edge cases

- Lines beginning with 1–3 spaces and a fence still close the block if length ≥ opening;
  scan must consider indent ≤ 3.

- Pathological content with very long runs of both chars: use whichever requires the
  shorter fence. No cap needed—just emit as many chars as required.
