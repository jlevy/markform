/**
 * Custom validators for company-analysis.form.md
 *
 * This file demonstrates common validation patterns that extend beyond
 * the built-in Markform constraints:
 *
 * 1. Word count validation (minWords/maxWords)
 * 2. Sum-to validation for percentage fields
 * 3. Conditional requirement validation
 * 4. Cross-field consistency validation
 * 5. Format validation for structured strings
 *
 * These validators are loaded at runtime via jiti and referenced
 * from fields using the validate=["validator_id"] attribute.
 */

import type { ValidatorContext, ValidationIssue } from 'markform';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Count words in a string (splits on whitespace).
 */
function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Extract percentage value from a string like "Segment: 45%" or "45%".
 */
function extractPercentage(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Get string value from a field, handling null/undefined.
 */
function getStringValue(
  values: Record<string, unknown>,
  fieldId: string
): string | null {
  const field = values[fieldId] as { kind: string; value?: string | null } | undefined;
  if (field?.kind === 'string' && field.value) {
    return field.value;
  }
  return null;
}

/**
 * Get number value from a field, handling null/undefined.
 */
function getNumberValue(
  values: Record<string, unknown>,
  fieldId: string
): number | null {
  const field = values[fieldId] as { kind: string; value?: number | null } | undefined;
  if (field?.kind === 'number' && field.value != null) {
    return field.value;
  }
  return null;
}

/**
 * Get string-list items from a field.
 */
function getStringListItems(
  values: Record<string, unknown>,
  fieldId: string
): string[] {
  const field = values[fieldId] as { kind: string; items?: string[] } | undefined;
  if (field?.kind === 'string_list' && field.items) {
    return field.items;
  }
  return [];
}

/**
 * Get multi-select selections from a field.
 */
function getMultiSelectSelections(
  values: Record<string, unknown>,
  fieldId: string
): string[] {
  const field = values[fieldId] as { kind: string; selected?: string[] } | undefined;
  if (field?.kind === 'multi_select' && field.selected) {
    return field.selected;
  }
  return [];
}

// =============================================================================
// Word Count Validators
// =============================================================================

/**
 * Factory for creating word count validators.
 */
function createWordCountValidator(
  minWords?: number,
  maxWords?: number
): (ctx: ValidatorContext) => ValidationIssue[] {
  return (ctx: ValidatorContext): ValidationIssue[] => {
    const value = getStringValue(ctx.values, ctx.targetId);
    if (!value) return []; // Let required validation handle empty

    const wordCount = countWords(value);

    if (minWords != null && wordCount < minWords) {
      return [
        {
          severity: 'error',
          message: `Field requires at least ${minWords} words (currently ${wordCount})`,
          ref: ctx.targetId,
          source: 'code',
        },
      ];
    }

    if (maxWords != null && wordCount > maxWords) {
      return [
        {
          severity: 'warning',
          message: `Field should have at most ${maxWords} words (currently ${wordCount})`,
          ref: ctx.targetId,
          source: 'code',
        },
      ];
    }

    return [];
  };
}

// =============================================================================
// Sum-To Validators
// =============================================================================

/**
 * Validates that scenario probabilities sum to 100%.
 */
function scenarioProbabilitiesSum100(ctx: ValidatorContext): ValidationIssue[] {
  const base = getNumberValue(ctx.values, 'base_probability');
  const bull = getNumberValue(ctx.values, 'bull_probability');
  const bear = getNumberValue(ctx.values, 'bear_probability');

  // Only validate if at least one probability is set
  if (base == null && bull == null && bear == null) {
    return [];
  }

  const sum = (base ?? 0) + (bull ?? 0) + (bear ?? 0);

  if (Math.abs(sum - 100) > 0.1) {
    return [
      {
        severity: 'error',
        message: `Scenario probabilities must sum to 100% (currently ${sum.toFixed(1)}%)`,
        ref: 'base_probability',
        code: 'SUM_NOT_100',
        source: 'code',
      },
    ];
  }

  return [];
}

/**
 * Validates that revenue segments sum to 100%.
 */
function revenueSegmentsSum100(ctx: ValidatorContext): ValidationIssue[] {
  const segments = getStringListItems(ctx.values, 'revenue_segments');

  if (segments.length === 0) return [];

  const percentages = segments
    .map((item) => extractPercentage(item))
    .filter((p): p is number => p !== null);

  if (percentages.length === 0) {
    return [
      {
        severity: 'warning',
        message:
          'Revenue segments should include percentages (format: "Segment Name: XX%")',
        ref: 'revenue_segments',
        source: 'code',
      },
    ];
  }

  const sum = percentages.reduce((a, b) => a + b, 0);

  if (Math.abs(sum - 100) > 0.1) {
    return [
      {
        severity: 'warning',
        message: `Revenue segments should sum to 100% (currently ${sum.toFixed(1)}%)`,
        ref: 'revenue_segments',
        code: 'SUM_NOT_100',
        source: 'code',
      },
    ];
  }

  return [];
}

/**
 * Validates that margin bridge components are provided and noted.
 */
function marginBridgeConsistency(ctx: ValidatorContext): ValidationIssue[] {
  const mix = getNumberValue(ctx.values, 'margin_mix_bps');
  const pricing = getNumberValue(ctx.values, 'margin_pricing_bps');
  const inputCosts = getNumberValue(ctx.values, 'margin_input_costs_bps');
  const fx = getNumberValue(ctx.values, 'margin_fx_bps');
  const oneOffs = getNumberValue(ctx.values, 'margin_one_offs_bps');

  // Only validate if any margin bridge field is set
  const values = [mix, pricing, inputCosts, fx, oneOffs].filter(
    (v) => v != null
  );
  if (values.length === 0) return [];

  // Just inform about the sum for transparency
  const sum = values.reduce((a, b) => a + (b ?? 0), 0);

  return [
    {
      severity: 'info',
      message: `Margin bridge sum: ${sum} bps. Verify this matches total margin change.`,
      ref: 'margin_mix_bps',
      source: 'code',
    },
  ];
}

// =============================================================================
// Conditional Requirement Validators
// =============================================================================

/**
 * Validates that moat explanation is provided when moats are selected.
 */
function moatExplanationRequired(ctx: ValidatorContext): ValidationIssue[] {
  const moats = getMultiSelectSelections(ctx.values, 'moat_diagnosis');
  const explanation = getStringValue(ctx.values, 'moat_explanation');

  if (moats.length > 0) {
    if (!explanation || explanation.trim().length === 0) {
      return [
        {
          severity: 'error',
          message: 'Moat explanation is required when moat factors are selected',
          ref: 'moat_explanation',
          code: 'CONDITIONAL_REQUIRED',
          source: 'code',
        },
      ];
    }

    // Also check minimum word count for explanation
    const wordCount = countWords(explanation);
    if (wordCount < 25) {
      return [
        {
          severity: 'warning',
          message: `Moat explanation should be at least 25 words (currently ${wordCount})`,
          ref: 'moat_explanation',
          source: 'code',
        },
      ];
    }
  }

  return [];
}

/**
 * Validates that whisper evidence is provided when whisper estimates are given.
 */
function whisperEvidenceRequired(ctx: ValidatorContext): ValidationIssue[] {
  const whisperRevenue = getNumberValue(ctx.values, 'whisper_revenue');
  const whisperEps = getNumberValue(ctx.values, 'whisper_eps');
  const evidence = getStringValue(ctx.values, 'whisper_evidence');

  const hasWhisper = whisperRevenue != null || whisperEps != null;

  if (hasWhisper && (!evidence || evidence.trim().length === 0)) {
    return [
      {
        severity: 'error',
        message: 'Whisper evidence is required when whisper estimates are provided',
        ref: 'whisper_evidence',
        code: 'CONDITIONAL_REQUIRED',
        source: 'code',
      },
    ];
  }

  return [];
}

/**
 * Validates that price change details are provided when "Yes" is selected.
 */
function priceChangeDetailsRequired(ctx: ValidatorContext): ValidationIssue[] {
  const priceChanges = ctx.values['price_changes_recently'] as
    | { kind: string; selected?: string | null }
    | undefined;
  const details = getStringValue(ctx.values, 'price_change_details');

  if (priceChanges?.kind === 'single_select' && priceChanges.selected === 'yes') {
    if (!details || details.trim().length === 0) {
      return [
        {
          severity: 'error',
          message: 'Price change details are required when price changes occurred',
          ref: 'price_change_details',
          code: 'CONDITIONAL_REQUIRED',
          source: 'code',
        },
      ];
    }
  }

  return [];
}

// =============================================================================
// Format Validation
// =============================================================================

/**
 * Validates that KPIs follow the expected format: "KPI Name: Why it matters".
 */
function kpiFormatValidation(ctx: ValidatorContext): ValidationIssue[] {
  const kpis = getStringListItems(ctx.values, 'key_kpis_quarterly');

  if (kpis.length === 0) return [];

  const malformed = kpis.filter((item) => !item.includes(':'));

  if (malformed.length > 0) {
    return [
      {
        severity: 'warning',
        message: `${malformed.length} KPI(s) missing explanation. Format: "KPI Name: Why it matters"`,
        ref: 'key_kpis_quarterly',
        source: 'code',
      },
    ];
  }

  return [];
}

/**
 * Validates that sources follow the expected format with required columns.
 */
function sourcesFormatValidation(ctx: ValidatorContext): ValidationIssue[] {
  const sources = getStringListItems(ctx.values, 'sources_accessed');

  if (sources.length === 0) return [];

  // Expected format: "Date | Source | Type | Link | Takeaways"
  const malformed = sources.filter((item) => {
    const parts = item.split('|').map((p) => p.trim());
    return parts.length < 5 || parts.some((p) => p.length === 0);
  });

  if (malformed.length > 0) {
    return [
      {
        severity: 'warning',
        message: `${malformed.length} source(s) missing required columns. Format: "Date | Source | Type | Link | Takeaways"`,
        ref: 'sources_accessed',
        source: 'code',
      },
    ];
  }

  return [];
}

/**
 * Validates that experts follow the expected format.
 */
function expertsFormatValidation(ctx: ValidatorContext): ValidationIssue[] {
  const experts = getStringListItems(ctx.values, 'experts_list');

  if (experts.length === 0) return [];

  // Expected format: "Name | Angle | Lead time | Hit rate | Tier"
  const malformed = experts.filter((item) => {
    const parts = item.split('|').map((p) => p.trim());
    return parts.length < 5;
  });

  if (malformed.length > 0) {
    return [
      {
        severity: 'warning',
        message: `${malformed.length} expert(s) missing columns. Format: "Name | Angle | Lead time | Hit rate | Tier"`,
        ref: 'experts_list',
        source: 'code',
      },
    ];
  }

  return [];
}

// =============================================================================
// Cross-Field Consistency Validators
// =============================================================================

/**
 * Validates that estimate variance vs consensus is calculated correctly.
 */
function estimateVarianceCheck(ctx: ValidatorContext): ValidationIssue[] {
  const consensusRevenue = getNumberValue(ctx.values, 'consensus_revenue');
  const estimateRevenue = getNumberValue(ctx.values, 'estimate_revenue');
  const statedVariance = getNumberValue(ctx.values, 'variance_vs_consensus');

  if (
    consensusRevenue != null &&
    estimateRevenue != null &&
    statedVariance != null &&
    consensusRevenue !== 0
  ) {
    const calculatedVariance =
      ((estimateRevenue - consensusRevenue) / consensusRevenue) * 100;

    if (Math.abs(calculatedVariance - statedVariance) > 0.5) {
      return [
        {
          severity: 'warning',
          message: `Stated variance (${statedVariance.toFixed(1)}%) differs from calculated (${calculatedVariance.toFixed(1)}%)`,
          ref: 'variance_vs_consensus',
          source: 'code',
        },
      ];
    }
  }

  return [];
}

// =============================================================================
// Exported Validators Registry
// =============================================================================

export const validators: Record<
  string,
  (ctx: ValidatorContext) => ValidationIssue[]
> = {
  // Word count validators
  min_words_25: createWordCountValidator(25),
  min_words_50: createWordCountValidator(50),
  min_words_75: createWordCountValidator(75),
  min_words_100: createWordCountValidator(100),
  max_words_50: createWordCountValidator(undefined, 50),

  // Sum-to validators
  scenario_probs_sum_100: scenarioProbabilitiesSum100,
  revenue_segments_sum_100: revenueSegmentsSum100,
  margin_bridge_consistency: marginBridgeConsistency,

  // Conditional requirement validators
  moat_explanation_required: moatExplanationRequired,
  whisper_evidence_required: whisperEvidenceRequired,
  price_change_details_required: priceChangeDetailsRequired,

  // Format validators
  kpi_format: kpiFormatValidation,
  sources_format: sourcesFormatValidation,
  experts_format: expertsFormatValidation,

  // Cross-field consistency
  estimate_variance_check: estimateVarianceCheck,
};
