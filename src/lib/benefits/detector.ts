// Benefit Detection Engine
// Real-time rule + scoring engine that inspects a transaction against the
// card benefit catalog and returns qualifying benefits with confidence.

import { BENEFIT_TYPES, scoreConfidence } from "../constants";
import { findCatalogCard, type CatalogBenefit } from "./catalog";
import type { BenefitType, DetectionResult, TxnCategory } from "../types";

export interface DetectionInput {
  amount: number;
  merchant: string;
  mcc?: string;
  category: TxnCategory;
  date: Date;
  cardBankName: string;
  cardName: string;
}

export interface DetectedBenefit extends DetectionResult {
  benefitType: BenefitType;
  cardBenefitTitle: string;
}

/**
 * Core detection algorithm. For a given transaction + card, evaluate every
 * benefit in the card's catalog and return those that qualify, scored by
 * how many of their conditions match.
 */
export function detectBenefits(input: DetectionInput): DetectedBenefit[] {
  const card = findCatalogCard(input.cardBankName, input.cardName);
  if (!card) return [];

  const results: DetectedBenefit[] = [];

  for (const benefit of card.benefits) {
    const matched = matchBenefit(benefit, input);
    if (matched) results.push(matched);
  }

  // Sort: highest confidence first, then highest coverage
  return results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.coverageAmount - a.coverageAmount;
  });
}

function matchBenefit(
  benefit: CatalogBenefit,
  input: DetectionInput
): DetectedBenefit | null {
  const cond = benefit.conditions;
  let matches = 0;
  let checks = 0;
  const reasons: string[] = [];

  // Min amount check (hard gate)
  if (cond.minAmount !== undefined) {
    checks++;
    if (input.amount >= cond.minAmount) {
      matches++;
      reasons.push(
        `Spent ₹${input.amount.toLocaleString("en-IN")} ≥ ₹${cond.minAmount.toLocaleString("en-IN")} threshold`
      );
    } else {
      return null;
    }
  }

  // Category check (hard gate)
  if (cond.categories && cond.categories.length) {
    checks++;
    if (cond.categories.includes(input.category)) {
      matches++;
      reasons.push(`Merchant category "${input.category}" is covered`);
    } else {
      return null;
    }
  }

  // Keyword hint (soft signal)
  if (cond.keywords && cond.keywords.length) {
    checks++;
    const m = input.merchant.toLowerCase();
    const hit = cond.keywords.some((k) => m.includes(k.toLowerCase()));
    if (hit) {
      matches++;
      reasons.push(`Merchant name matches covered keyword`);
    }
  }

  // MCC group check (soft signal, raises confidence)
  if (cond.mcc && cond.mcc.length && input.mcc) {
    checks++;
    if (cond.mcc.includes(input.mcc)) {
      matches++;
      reasons.push(`MCC ${input.mcc} is in the covered group`);
    }
  }

  // Recency check (hard gate) - must still be within window
  const now = new Date();
  const ageDays = (now.getTime() - input.date.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > benefit.windowDays) {
    return null; // outside filing window
  }
  checks++;
  matches++;
  reasons.push(
    `Within ${benefit.windowDays}-day filing window (${Math.max(0, Math.ceil(benefit.windowDays - ageDays))} days left)`
  );

  const confidence = scoreConfidence(matches, checks);
  const expiresAt = new Date(input.date.getTime() + benefit.windowDays * 24 * 60 * 60 * 1000);

  // Coverage estimate - capped to benefit limit
  let coverage = benefit.coverageLimit;
  if (benefit.type === "travel_delay") {
    coverage = Math.min(1500, benefit.coverageLimit);
  } else if (benefit.type === "lost_baggage") {
    coverage = Math.min(input.amount * 2, benefit.coverageLimit);
  } else if (benefit.type === "air_accident") {
    coverage = benefit.coverageLimit;
  } else {
    coverage = Math.min(input.amount, benefit.coverageLimit);
  }

  return {
    benefitType: benefit.type,
    cardBenefitTitle: benefit.title,
    reason: reasons.join(" · "),
    coverageAmount: Math.round(coverage),
    confidence,
    windowDays: benefit.windowDays,
    expiresAt,
  };
}

/**
 * Batch detect over many transactions (e.g. a freshly parsed SMS batch).
 */
export function detectBatch(
  transactions: DetectionInput[]
): { index: number; benefits: DetectedBenefit[] }[] {
  return transactions
    .map((t, index) => ({ index, benefits: detectBenefits(t) }))
    .filter((r) => r.benefits.length > 0);
}

// keep BENEFIT_TYPES referenced for tree-shaking safety
void BENEFIT_TYPES;
