/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Ultimate Differentiation & Feature Upgrade Unit Test Suite
 * Verifies:
 * 1. Hidden Cost Calculator (INR ₹999/mo -> ₹11,988 for 12m, trial conversions, fees, missing prices)
 * 2. Action Plan Generator ("What should you do next?" priorities, Hindi translations, verified links)
 * 3. Policy Version Comparison Engine (added, removed, modified clauses, and formatting-only diffs)
 * 4. Evidence-First Engine, India Consumer Law Context & Verbatim Quote Integrity in Hindi mode
 * 5. Open-Source Rulebook Transparency Metadata completeness across all 17 rules
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildActionPlan } from '../../shared/calculators/action-plan';
import {
  calculatePeriodCostProjection,
  extractHiddenCostEstimate,
  formatCurrencyAmount,
} from '../../shared/calculators/cost-calculator';
import {
  comparePolicyDocuments,
  SAMPLE_COMPARISON_VERSION_A,
  SAMPLE_COMPARISON_VERSION_B,
} from '../../shared/comparison/document-diff';
import {
  HINDI_CLAUSE_TRANSLATIONS,
  INDIA_LEGAL_REFERENCES,
} from '../../shared/datasets/india-consumer-law';
import { SAMPLE_POLICY_PRESETS } from '../../shared/datasets/sample-policies';
import { DETECTION_RULES } from '../../shared/rules/clause-rules';
import { buildRuleBasedReport, scanTextWithRules } from '../../shared/rules/engine';
import { ClauseCategory } from '../../shared/schemas/analysis';

describe('Part 3 — Hidden Cost & Financial Commitment Calculator', () => {
  it('calculates ₹999/month subscription accurately as ₹11,988 for 12 months', () => {
    const policyText =
      'Your subscription of ₹999 per month will automatically renew each month unless you cancel before your billing date.';
    const estimate = extractHiddenCostEstimate(policyText);

    assert.equal(estimate.hasCalculableFinancials, true);
    assert.equal(estimate.hasCalculableRecurringCost, true);
    assert.equal(estimate.currencySymbol, '₹');
    assert.equal(estimate.currencyCode, 'INR');
    assert.equal(estimate.recurringAmount, 999);
    assert.equal(estimate.billingFrequency, 'monthly');
    assert.equal(estimate.estimatedAnnualCost, 11988);

    const proj12 = calculatePeriodCostProjection(estimate, 12);
    assert.equal(proj12.estimatedTotalWithoutAddons, 11988);
    assert.equal(proj12.formattedTotalWithoutAddons, '₹11,988');

    const proj6 = calculatePeriodCostProjection(estimate, 6);
    assert.equal(proj6.estimatedTotalWithoutAddons, 5994);

    const proj24 = calculatePeriodCostProjection(estimate, 24);
    assert.equal(proj24.estimatedTotalWithoutAddons, 23976);
  });

  it('extracts trial duration, recurring price, setup fee, and preselected add-on in India INR sample', () => {
    const inrPreset = SAMPLE_POLICY_PRESETS.find((p) => p.id === 'streambharat-inr');
    assert.ok(inrPreset, 'Expected streambharat-inr preset to exist');

    const plainText = inrPreset.htmlContent.replace(/<[^>]+>/g, ' ');
    const estimate = extractHiddenCostEstimate(plainText);

    assert.equal(estimate.hasCalculableFinancials, true);
    assert.equal(estimate.trialDurationDays, 7);
    assert.equal(estimate.recurringAmount, 999);
    assert.equal(estimate.currencyCode, 'INR');
    assert.ok(estimate.statedFees.length >= 2, 'Should extract ₹250 processing fee and ₹199 add-on');
    assert.equal(estimate.estimatedAnnualCost, 11988);

    const proj12 = calculatePeriodCostProjection(estimate, 12);
    assert.equal(
      formatCurrencyAmount(proj12.baseRecurringTotal, estimate.currencySymbol, estimate.currencyCode),
      '₹11,988'
    );
  });

  it('does not guess or fabricate numbers when no explicit prices exist in the text', () => {
    const textWithoutPrices =
      'We may share your personal information with advertising partners. Any dispute shall be resolved through binding individual arbitration.';
    const estimate = extractHiddenCostEstimate(textWithoutPrices);

    assert.equal(estimate.hasCalculableFinancials, false);
    assert.equal(estimate.hasCalculableRecurringCost, false);
    assert.equal(estimate.recurringAmount, undefined);
    assert.equal(estimate.estimatedAnnualCost, undefined);
    assert.equal(estimate.statedFees.length, 0);
  });
});

describe('Part 4 — OpenShield Action Plan Generator', () => {
  it('generates prioritized checklist items with both English and Hindi guidance and verified links', () => {
    const streamPreset = SAMPLE_POLICY_PRESETS[0];
    const text = streamPreset.htmlContent.replace(/<[^>]+>/g, ' ');
    const report = buildRuleBasedReport({
      text,
      targetUrl: streamPreset.url,
      discoveredLinks: [
        {
          label: 'Cancel Subscription',
          url: 'https://www.netflix.com/cancelplan',
          type: 'cancellation',
          verifiedSameDomain: true,
        },
      ],
    });

    assert.ok(report.actionPlan && report.actionPlan.length >= 3);
    const highPrioritySteps = report.actionPlan.filter(
      (step) => step.priority === 'High Priority'
    );
    assert.ok(highPrioritySteps.length >= 1, 'Expected at least 1 High Priority step');

    for (const step of report.actionPlan) {
      assert.ok(step.title.length > 5);
      assert.ok(step.description.length > 10);
      assert.ok(step.titleHi && step.titleHi.length > 5, 'Expected Hindi action title');
      assert.ok(step.descriptionHi && step.descriptionHi.length > 10, 'Expected Hindi action detail');
    }
  });

  it('returns Good Practice verification guidance when 0 risk clauses are found', () => {
    const plan = buildActionPlan({ findings: [], discoveredLinks: [] });
    assert.equal(plan.length, 1);
    assert.equal(plan[0].priority, 'Good Practice');
    assert.ok(plan[0].titleHi.length > 5);
  });
});

describe('Part 6 — Policy Version Comparison Engine (Document Diff)', () => {
  it('detects modified, added, and removed clauses between Version A and Version B', () => {
    const diffReport = comparePolicyDocuments(
      SAMPLE_COMPARISON_VERSION_A,
      SAMPLE_COMPARISON_VERSION_B
    );

    assert.equal(diffReport.identicalMeaning, false);
    assert.ok(diffReport.entries.length >= 2, 'Should detect multiple clause changes');
    assert.ok(
      diffReport.counts.modified + diffReport.counts.added >= 2,
      'Should detect modified or added clauses'
    );
  });

  it('ignores formatting-only differences when both versions contain identical clauses', () => {
    const versionA =
      'Section 1. Renewal\nYour subscription of $19.99 per month automatically renews each month unless you cancel before your billing date.';
    const versionB =
      'Section 1. Renewal\n\n   Your subscription of $19.99 per month automatically renews each month unless you cancel before your billing date.   ';

    const diffReport = comparePolicyDocuments(versionA, versionB);
    assert.equal(diffReport.identicalMeaning, true);
    assert.equal(diffReport.formattingOnlyDifference, true);
    assert.equal(diffReport.entries.length, 0);
    assert.equal(diffReport.counts.added, 0);
    assert.equal(diffReport.counts.modified, 0);
    assert.equal(diffReport.counts.removed, 0);
  });
});

describe('Part 2, Part 8 & Part 9 — Evidence-First Engine, Hindi Translations, India Law & Rulebook Metadata', () => {
  it('populates Hindi translations, India statutory context, whatRemainsUnclear, and originalSourceReference without altering verbatim quotes', () => {
    const text =
      'Section 4. Billing & Disputes\nYour 7-day free trial automatically converts to a paid monthly subscription of ₹999 per month unless you cancel 24 hours before expiry.';
    const findings = scanTextWithRules(text, 'StreamBharat Terms');

    assert.ok(findings.length >= 1);
    for (const f of findings) {
      assert.ok(
        text.includes(f.evidenceQuote),
        'Evidence quote must remain an exact verbatim substring of the original text'
      );
      assert.ok(f.whatRemainsUnclear && f.whatRemainsUnclear.length > 10);
      assert.ok(f.originalSourceReference?.includes('StreamBharat Terms'));
      assert.ok(f.titleHi && f.titleHi.length > 5, 'Finding must include Hindi title');
      assert.ok(
        f.explanationHi && f.explanationHi.length > 10,
        'Finding must include Hindi plain-language explanation'
      );
      assert.ok(f.indiaLegalContext, 'Finding must include India statutory context');
      assert.ok(f.indiaLegalContext.officialSourceUrl.startsWith('https://'));
    }
  });

  it('covers all 17 ClauseCategory values in INDIA_LEGAL_REFERENCES and HINDI_CLAUSE_TRANSLATIONS', () => {
    for (const category of Object.values(ClauseCategory)) {
      assert.ok(
        INDIA_LEGAL_REFERENCES[category],
        `Missing INDIA_LEGAL_REFERENCES for ${category}`
      );
      assert.ok(
        HINDI_CLAUSE_TRANSLATIONS[category],
        `Missing HINDI_CLAUSE_TRANSLATIONS for ${category}`
      );
    }
  });

  it('includes complete Open-Source Transparency metadata on every rule in DETECTION_RULES', () => {
    assert.equal(DETECTION_RULES.length, 17);
    for (const rule of DETECTION_RULES) {
      assert.ok(rule.version, `Missing version on ${rule.id}`);
      assert.ok(rule.license === 'MIT', `Expected MIT license on ${rule.id}`);
      assert.ok(
        rule.matchingLogicSummary && rule.matchingLogicSummary.length > 15,
        `Missing matchingLogicSummary on ${rule.id}`
      );
      assert.ok(
        rule.evidenceRequirements && rule.evidenceRequirements.length > 15,
        `Missing evidenceRequirements on ${rule.id}`
      );
      assert.ok(
        rule.falsePositiveConsiderations && rule.falsePositiveConsiderations.length > 15,
        `Missing falsePositiveConsiderations on ${rule.id}`
      );
      assert.ok(
        Array.isArray(rule.sourceReferences) && rule.sourceReferences.length >= 1,
        `Missing sourceReferences on ${rule.id}`
      );
      assert.ok(rule.positiveExample && rule.positiveExample.length > 15);
      assert.ok(rule.negativeExample && rule.negativeExample.length > 15);
    }
  });
});
