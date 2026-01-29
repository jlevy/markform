---
close_reason: null
closed_at: 2025-12-24T01:29:35.359Z
created_at: 2025-12-24T01:23:51.696Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.257Z
    original_id: markform-144
id: is-01kg3xaa34xsfmrrwyzxt35saq
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Add groups-per-turn and fields-per-turn harness options
type: is
updated_at: 2025-12-24T01:29:35.359Z
version: 1
---
Add CLI flags and API options to control how many groups and fields the agent can fill per conversation turn.

## Approach

The harness should filter issues **before** giving them to the agent:

1. Inspect form to get priority-ranked list of all issues
2. Build candidate list by iterating issues in priority order:
   - Track unique groups and fields seen
   - Add issue if adding it keeps us within `maxGroupsPerTurn` AND `maxFieldsPerTurn`
   - Stop once we can't add more without exceeding limits
3. Give this filtered candidate list to the agent

This way the agent **never even sees** issues beyond the per-turn limits.

## Current Behavior

The harness (`packages/markform/src/harness/harness.ts`) currently has:
- `maxIssues`: 10 - limits issues shown to agent per turn
- `maxPatchesPerTurn`: 20 - limits patches agent can submit per turn
- `maxTurns`: 50 - limits total turns

## Proposed New Options

### `maxFieldsPerTurn` (default: unlimited)
- Limits issues to only cover N unique fields per turn
- CLI flag: `--max-fields <n>`

### `maxGroupsPerTurn` (default: unlimited)  
- Limits issues to only cover N unique groups per turn
- Requires mapping field refs to their parent groups
- CLI flag: `--max-groups <n>`

## Implementation

### Issue filtering in `step()`
```typescript
// After getting prioritized issues from inspect()
const candidateIssues: InspectIssue[] = [];
const seenFields = new Set<string>();
const seenGroups = new Set<string>();

for (const issue of prioritizedIssues) {
  const fieldId = getFieldId(issue.ref);
  const groupId = getGroupForField(fieldId, form);
  
  // Check if adding this issue would exceed limits
  const newField = !seenFields.has(fieldId);
  const newGroup = !seenGroups.has(groupId);
  
  if (newField && seenFields.size >= config.maxFieldsPerTurn) continue;
  if (newGroup && seenGroups.size >= config.maxGroupsPerTurn) continue;
  
  candidateIssues.push(issue);
  seenFields.add(fieldId);
  seenGroups.add(groupId);
}
```

### HarnessConfig changes
```typescript
interface HarnessConfig {
  maxIssues: number;
  maxPatchesPerTurn: number;
  maxTurns: number;
  maxFieldsPerTurn?: number;  // NEW - default unlimited
  maxGroupsPerTurn?: number;  // NEW - default unlimited
}
```

### Files to modify
- `packages/markform/src/harness/harness.ts` - Filter issues in `step()`
- `packages/markform/src/engine/types.ts` - Add to HarnessConfig
- `packages/markform/src/cli/commands/fill.ts` - Add CLI flags
- `README.md` - Add multi-turn example

## README Example

Show multi-turn filling even with simple form:
```bash
# Fill one field at a time (forces multiple turns)
pnpm markform fill examples/simple/simple.form.md \
  --agent=live --model=openai/gpt-5.2 \
  --max-fields 1

# Fill one group at a time
pnpm markform fill examples/simple/simple.form.md \
  --agent=live --model=openai/gpt-5.2 \
  --max-groups 1
```

## Use Cases
- Pacing: Fill one group/field at a time for complex forms
- Testing: Verify agent handles incremental fills correctly
- Debugging: Watch agent progress step by step
- Cost control: Limit scope of each LLM call
