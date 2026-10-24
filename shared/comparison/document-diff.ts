/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Deterministic Document Comparison Engine
 * Performs actual clause-by-clause text comparison between two versions of an agreement,
 * ignoring pure whitespace/formatting differences while highlighting added, removed,
 * and modified provisions across pricing, renewal, cancellation, data sharing, and disputes.
 */

export type DiffChangeCategory =
  | 'Changed prices'
  | 'Changed renewal conditions'
  | 'Changed cancellation or refund provisions'
  | 'Changed data-sharing language'
  | 'Changed liability or dispute-resolution provisions'
  | 'General clause change';

export interface ClauseDiffEntry {
  id: string;
  changeType: 'added' | 'removed' | 'modified';
  category: DiffChangeCategory;
  sectionHeading: string;
  beforeText?: string;
  afterText?: string;
  summary: string;
}

export interface DocumentComparisonReport {
  identicalMeaning: boolean;
  formattingOnlyDifference: boolean;
  totalChanges: number;
  counts: {
    added: number;
    removed: number;
    modified: number;
    priceChanges: number;
    renewalChanges: number;
    cancellationChanges: number;
    dataSharingChanges: number;
    disputeOrLiabilityChanges: number;
  };
  entries: ClauseDiffEntry[];
}

interface ParsedClause {
  raw: string;
  normalized: string;
  tokens: Set<string>;
  section: string;
}

function normalizeClauseText(str: string): string {
  return str
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .toLowerCase();
}

function tokenizeClause(normalized: string): Set<string> {
  const words = normalized
    .replace(/[^a-z0-9₹$€£.%]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  return new Set(words);
}

function splitIntoClauses(text: string): ParsedClause[] {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  let currentSection = 'General Terms';
  const clauses: ParsedClause[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const isHeading =
      line.length <= 90 &&
      (/^(?:#{1,4}\s+|(?:section|article|clause)\s+\d+[:.\s-]*|\d+[.)]\s+)[A-Z]/i.test(
        line
      ) ||
        (/^[A-Z][A-Z0-9\s,&/-]{4,65}$/.test(line) && !/[.?!]$/.test(line)));

    if (isHeading) {
      currentSection = line.replace(/^#{1,4}\s+/, '').trim();
      continue;
    }

    const sentences = line
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'(₹$])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 15);

    const targets = sentences.length > 0 ? sentences : [line];
    for (const s of targets) {
      const normalized = normalizeClauseText(s);
      if (normalized.length < 12) continue;
      clauses.push({
        raw: s,
        normalized,
        tokens: tokenizeClause(normalized),
        section: currentSection,
      });
    }
  }

  return clauses;
}

function computeTokenSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function classifyChangeCategory(
  beforeText = '',
  afterText = ''
): DiffChangeCategory {
  const combined = `${beforeText} ${afterText}`.toLowerCase();

  if (
    /(?:₹|\$|€|£|rs\.?|inr|usd|\bprice\b|\bfee\b|\bsurcharge\b|\bcharge\b|\brate\b|\b\d+(?:\.\d{2})?\s*\/\s*(?:month|year|mo|yr))/i.test(
      combined
    ) &&
    !/\b(?:arbitration|class\s+action)\b/i.test(combined)
  ) {
    return 'Changed prices';
  }

  if (/\b(?:renew|auto-renew|automatic\s+renewal|billing\s+cycle|trial)\b/i.test(combined)) {
    return 'Changed renewal conditions';
  }

  if (/\b(?:cancel|cancellation|refund|non-refundable|termination)\b/i.test(combined)) {
    return 'Changed cancellation or refund provisions';
  }

  if (
    /\b(?:privacy|third-party|data\s+broker|advertising|personal\s+data|personal\s+information|share|sell)\b/i.test(
      combined
    )
  ) {
    return 'Changed data-sharing language';
  }

  if (
    /\b(?:arbitration|class\s+action|dispute|liability|indemnify|court|jurisdiction|damages)\b/i.test(
      combined
    )
  ) {
    return 'Changed liability or dispute-resolution provisions';
  }

  return 'General clause change';
}

/**
 * Compares Version A (original policy) and Version B (updated policy) deterministically.
 */
export function comparePolicyDocuments(
  versionAText: string,
  versionBText: string
): DocumentComparisonReport {
  const rawTrimmedA = (versionAText || '').trim();
  const rawTrimmedB = (versionBText || '').trim();

  const normFullA = normalizeClauseText(rawTrimmedA);
  const normFullB = normalizeClauseText(rawTrimmedB);

  if (normFullA === normFullB) {
    return {
      identicalMeaning: true,
      formattingOnlyDifference: rawTrimmedA !== rawTrimmedB,
      totalChanges: 0,
      counts: {
        added: 0,
        removed: 0,
        modified: 0,
        priceChanges: 0,
        renewalChanges: 0,
        cancellationChanges: 0,
        dataSharingChanges: 0,
        disputeOrLiabilityChanges: 0,
      },
      entries: [],
    };
  }

  const clausesA = splitIntoClauses(rawTrimmedA);
  const clausesB = splitIntoClauses(rawTrimmedB);

  const matchedAIndices = new Set<number>();
  const matchedBIndices = new Set<number>();

  // 1. Exact normalized matches (ignore unchanged sentences)
  for (let i = 0; i < clausesA.length; i++) {
    for (let j = 0; j < clausesB.length; j++) {
      if (matchedBIndices.has(j)) continue;
      if (clausesA[i].normalized === clausesB[j].normalized) {
        matchedAIndices.add(i);
        matchedBIndices.add(j);
        break;
      }
    }
  }

  const entries: ClauseDiffEntry[] = [];

  // 2. Detect Modified Clauses (high token overlap between unmatched A and unmatched B)
  for (let i = 0; i < clausesA.length; i++) {
    if (matchedAIndices.has(i)) continue;

    let bestJ = -1;
    let bestSim = 0;
    for (let j = 0; j < clausesB.length; j++) {
      if (matchedBIndices.has(j)) continue;
      const sim = computeTokenSimilarity(clausesA[i].tokens, clausesB[j].tokens);
      if (sim > bestSim) {
        bestSim = sim;
        bestJ = j;
      }
    }

    if (bestJ !== -1 && bestSim >= 0.35) {
      matchedAIndices.add(i);
      matchedBIndices.add(bestJ);
      const category = classifyChangeCategory(
        clausesA[i].raw,
        clausesB[bestJ].raw
      );
      entries.push({
        id: `diff_mod_${entries.length + 1}`,
        changeType: 'modified',
        category,
        sectionHeading: clausesB[bestJ].section || clausesA[i].section,
        beforeText: clausesA[i].raw,
        afterText: clausesB[bestJ].raw,
        summary: `Updated wording in ${
          clausesB[bestJ].section || 'Document'
        } (${category.toLowerCase()}).`,
      });
    }
  }

  // 3. Remaining unmatched in A -> Removed clauses
  for (let i = 0; i < clausesA.length; i++) {
    if (matchedAIndices.has(i)) continue;
    const category = classifyChangeCategory(clausesA[i].raw, '');
    entries.push({
      id: `diff_rem_${entries.length + 1}`,
      changeType: 'removed',
      category,
      sectionHeading: clausesA[i].section,
      beforeText: clausesA[i].raw,
      summary: `Removed clause from ${clausesA[i].section} (${category.toLowerCase()}).`,
    });
  }

  // 4. Remaining unmatched in B -> Added clauses
  for (let j = 0; j < clausesB.length; j++) {
    if (matchedBIndices.has(j)) continue;
    const category = classifyChangeCategory('', clausesB[j].raw);
    entries.push({
      id: `diff_add_${entries.length + 1}`,
      changeType: 'added',
      category,
      sectionHeading: clausesB[j].section,
      afterText: clausesB[j].raw,
      summary: `Added new clause in ${clausesB[j].section} (${category.toLowerCase()}).`,
    });
  }

  const counts = {
    added: entries.filter((e) => e.changeType === 'added').length,
    removed: entries.filter((e) => e.changeType === 'removed').length,
    modified: entries.filter((e) => e.changeType === 'modified').length,
    priceChanges: entries.filter((e) => e.category === 'Changed prices').length,
    renewalChanges: entries.filter(
      (e) => e.category === 'Changed renewal conditions'
    ).length,
    cancellationChanges: entries.filter(
      (e) => e.category === 'Changed cancellation or refund provisions'
    ).length,
    dataSharingChanges: entries.filter(
      (e) => e.category === 'Changed data-sharing language'
    ).length,
    disputeOrLiabilityChanges: entries.filter(
      (e) => e.category === 'Changed liability or dispute-resolution provisions'
    ).length,
  };

  return {
    identicalMeaning: entries.length === 0,
    formattingOnlyDifference: entries.length === 0 && rawTrimmedA !== rawTrimmedB,
    totalChanges: entries.length,
    counts,
    entries,
  };
}

export const SAMPLE_COMPARISON_VERSION_A = `Section 1. Subscription Pricing & Renewal
Your monthly subscription is priced at ₹799 per month and renews automatically unless you cancel at least 7 days before the next billing date.
You may cancel your subscription online at any time and receive a pro-rata refund for unused days in your billing cycle.

Section 2. Privacy & Dispute Resolution
We do not sell or share your personal information with third-party data brokers or ad networks.
Any dispute may be brought in the consumer courts or civil courts of your local jurisdiction.`;

export const SAMPLE_COMPARISON_VERSION_B = `Section 1. Subscription Pricing & Renewal
Your monthly subscription is priced at ₹999 per month and renews automatically unless you cancel at least 30 days before the next billing date.
All subscription fees are strictly non-refundable and no partial refunds or credits will be issued upon cancellation.

Section 2. Privacy & Dispute Resolution
We may share and sell your personal contact and browsing data with third-party advertising networks and data brokers for cross-context behavioral advertising.
Any dispute arising under this Agreement shall be resolved exclusively by binding individual arbitration, and you waive any right to participate in a class action.`;
