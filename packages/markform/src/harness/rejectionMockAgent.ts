/**
 * Rejection Mock Agent - Mock agent that intentionally generates wrong patches first.
 *
 * Used for golden testing the rejection feedback system. Follows the proper pattern:
 * 1. First turn: Generates a type-mismatched patch (e.g., set_string for table field)
 * 2. Patch gets rejected, harness records rejectedPatches with fieldKind, columnIds
 * 3. Next turn: Sees previousRejections and generates the correct patch
 *
 * This tests the complete rejection → feedback → recovery workflow.
 */

import type {
  Field,
  Id,
  InspectIssue,
  Patch,
  ParsedForm,
  PatchRejection,
} from '../engine/coreTypes.js';
import type { Agent, AgentResponse } from './harnessTypes.js';
import { MockAgent } from './mockAgent.js';

// =============================================================================
// Rejection Mock Agent Implementation
// =============================================================================

/**
 * Mock agent that intentionally generates wrong patches for testing.
 *
 * For table fields:
 * - First attempt: Generates set_string (wrong type) → gets rejected
 * - Subsequent attempts: After seeing rejection feedback, generates set_table (correct)
 *
 * This simulates an LLM learning from its mistakes through rejection feedback.
 */
export class RejectionMockAgent implements Agent {
  private correctAgent: MockAgent;
  private rejectedFieldIds = new Set<Id>();
  private fieldMap: Map<Id, Field>;

  /**
   * Create a rejection mock agent from a completed form.
   *
   * @param completedForm - A fully-filled form to use as source of correct values
   */
  constructor(completedForm: ParsedForm) {
    this.correctAgent = new MockAgent(completedForm);

    // Build field map for quick lookup
    this.fieldMap = new Map();
    for (const group of completedForm.schema.groups) {
      for (const field of group.children) {
        this.fieldMap.set(field.id, field);
      }
    }
  }

  /**
   * Invoke the fill_form tool. For table fields that haven't been rejected yet,
   * intentionally generates wrong patch type. After seeing rejection feedback,
   * generates the correct patch.
   */
  async fillFormTool(
    issues: InspectIssue[],
    form: ParsedForm,
    maxPatches: number,
    previousRejections?: PatchRejection[],
  ): Promise<AgentResponse> {
    // Track fields that were rejected so we know to correct them
    if (previousRejections) {
      for (const rejection of previousRejections) {
        if (rejection.fieldId) {
          this.rejectedFieldIds.add(rejection.fieldId);
        }
      }
    }

    const patches: Patch[] = [];
    const addressedFields = new Set<Id>();

    // Process issues in priority order
    for (const issue of issues) {
      if (patches.length >= maxPatches) break;
      if (issue.scope !== 'field') continue;

      const fieldId = issue.ref;
      if (addressedFields.has(fieldId)) continue;

      const field = this.fieldMap.get(fieldId);
      if (!field) continue;

      // For table fields: make a mistake first, then correct after rejection
      if (field.kind === 'table' && !this.rejectedFieldIds.has(fieldId)) {
        // First attempt: intentionally send set_string for a table field
        patches.push({
          op: 'set_string',
          fieldId,
          value: 'Intentional type mismatch - testing rejection feedback',
        });
        addressedFields.add(fieldId);
        continue;
      }

      // For all other cases (or after rejection), use correct agent
      const correctResponse = await this.correctAgent.fillFormTool([issue], form, 1);
      if (correctResponse.patches.length > 0) {
        patches.push(correctResponse.patches[0]!);
        addressedFields.add(fieldId);
      }
    }

    return Promise.resolve({ patches });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a rejection mock agent from a completed form.
 *
 * @param completedForm - A fully-filled form to use as source of correct values
 * @returns A new RejectionMockAgent instance
 */
export function createRejectionMockAgent(completedForm: ParsedForm): RejectionMockAgent {
  return new RejectionMockAgent(completedForm);
}
