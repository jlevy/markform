/**
 * Execution plan computation for parallel form filling.
 *
 * Partitions a form's top-level items into a loose-serial pool and
 * zero or more parallel batches, grouped by order level.
 */

import type { ExecutionPlan, ExecutionPlanItem, ParallelBatch, ParsedForm } from './coreTypes.js';

/**
 * Compute an execution plan from a parsed form.
 *
 * Walks top-level items (groups, or individual fields in implicit groups)
 * in document order and partitions them by their `parallel` attribute:
 * - Items without `parallel` go to the loose-serial pool.
 * - Items with the same `parallel` value form a parallel batch.
 *
 * Also computes distinct order levels across all items.
 */
export function computeExecutionPlan(form: ParsedForm): ExecutionPlan {
  const looseSerial: ExecutionPlanItem[] = [];
  const batchMap = new Map<string, ExecutionPlanItem[]>();
  const orderSet = new Set<number>();

  for (const group of form.schema.groups) {
    if (group.implicit) {
      // Implicit group: each child field is a top-level item
      for (const field of group.children) {
        const order = field.order ?? 0;
        orderSet.add(order);
        const item: ExecutionPlanItem = {
          itemId: field.id,
          itemType: 'field',
          order,
        };
        if (field.parallel) {
          const list = batchMap.get(field.parallel) ?? [];
          list.push(item);
          batchMap.set(field.parallel, list);
        } else {
          looseSerial.push(item);
        }
      }
    } else {
      // Explicit group: the group is the item
      const order = group.order ?? 0;
      orderSet.add(order);
      const item: ExecutionPlanItem = {
        itemId: group.id,
        itemType: 'group',
        order,
      };
      if (group.parallel) {
        const list = batchMap.get(group.parallel) ?? [];
        list.push(item);
        batchMap.set(group.parallel, list);
      } else {
        looseSerial.push(item);
      }
    }
  }

  const parallelBatches: ParallelBatch[] = [];
  for (const [batchId, items] of batchMap) {
    parallelBatches.push({ batchId, items });
  }

  const orderLevels = [...orderSet].sort((a, b) => a - b);

  return { looseSerial, parallelBatches, orderLevels };
}
