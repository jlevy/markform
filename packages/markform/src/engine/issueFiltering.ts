/**
 * Issue filtering utilities for inspect issues.
 *
 * Extracted from FormHarness for shared use by the `next` command
 * and the harness itself.
 */

import type { InspectIssue, ParsedForm } from './coreTypes.js';

/**
 * Extract field ID from an issue ref based on its scope.
 *
 * - field scope: ref IS the fieldId
 * - option/column/cell scope: ref is "fieldId.subId" — extract the prefix
 * - form/group scope: no field ID available
 */
export function getFieldIdFromRef(ref: string, scope: InspectIssue['scope']): string | undefined {
  if (scope === 'field') {
    return ref;
  }
  if (scope === 'option' || scope === 'column' || scope === 'cell') {
    const dotIndex = ref.indexOf('.');
    return dotIndex > 0 ? ref.slice(0, dotIndex) : undefined;
  }
  return undefined;
}

/**
 * Get the parent group ID for a field from the form's ID index.
 */
export function getGroupForField(form: ParsedForm, fieldId: string): string | undefined {
  const entry = form.idIndex.get(fieldId);
  if (!entry) {
    return undefined;
  }

  if (entry.parentId) {
    const parentEntry = form.idIndex.get(entry.parentId);
    if (parentEntry?.nodeType === 'group') {
      return entry.parentId;
    }
  }

  return undefined;
}

/**
 * Filter issues by order level.
 *
 * Only includes issues for fields at the current (lowest incomplete) order level.
 * Fields at higher order levels are deferred until all lower-order fields are complete.
 * If no order attributes are used, all issues pass through (all at order 0).
 */
export function filterIssuesByOrder(issues: InspectIssue[], form: ParsedForm): InspectIssue[] {
  // Build a map: fieldId → effective order
  const fieldOrderMap = new Map<string, number>();
  for (const group of form.schema.groups) {
    const groupOrder = group.order ?? 0;
    for (const field of group.children) {
      fieldOrderMap.set(field.id, field.order ?? groupOrder);
    }
  }

  // Find all distinct order levels that still have open issues
  const openOrderLevels = new Set<number>();
  for (const issue of issues) {
    const fieldId = getFieldIdFromRef(issue.ref, issue.scope);
    if (fieldId) {
      const order = fieldOrderMap.get(fieldId) ?? 0;
      openOrderLevels.add(order);
    } else if (issue.scope === 'form') {
      openOrderLevels.add(0);
    }
  }

  if (openOrderLevels.size <= 1) {
    return issues;
  }

  const currentOrder = Math.min(...openOrderLevels);

  return issues.filter((issue) => {
    if (issue.scope === 'form') {
      return true;
    }
    const fieldId = getFieldIdFromRef(issue.ref, issue.scope);
    if (!fieldId) {
      return true;
    }
    const order = fieldOrderMap.get(fieldId) ?? 0;
    return order === currentOrder;
  });
}

/**
 * Filter issues based on maxFields and maxGroups limits.
 *
 * Issues are processed in priority order. An issue is included if:
 * - Adding it doesn't exceed the field limit (for field/option scoped issues)
 * - Adding it doesn't exceed the group limit
 *
 * Form-level issues are always included.
 */
export function filterIssuesByScope(
  issues: InspectIssue[],
  form: ParsedForm,
  maxFields?: number,
  maxGroups?: number,
): InspectIssue[] {
  if (maxFields === undefined && maxGroups === undefined) {
    return issues;
  }

  const result: InspectIssue[] = [];
  const seenFields = new Set<string>();
  const seenGroups = new Set<string>();

  for (const issue of issues) {
    if (issue.scope === 'form') {
      result.push(issue);
      continue;
    }

    const fieldId = getFieldIdFromRef(issue.ref, issue.scope);
    const groupId = fieldId ? getGroupForField(form, fieldId) : undefined;

    if (maxFields !== undefined && fieldId) {
      if (!seenFields.has(fieldId) && seenFields.size >= maxFields) {
        continue;
      }
    }

    if (maxGroups !== undefined && groupId) {
      if (!seenGroups.has(groupId) && seenGroups.size >= maxGroups) {
        continue;
      }
    }

    result.push(issue);
    if (fieldId) {
      seenFields.add(fieldId);
    }
    if (groupId) {
      seenGroups.add(groupId);
    }
  }

  return result;
}
