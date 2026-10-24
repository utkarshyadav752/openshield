/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Unit tests for OpenShield TTS Speech Builder & Formatter
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildActionPlan } from '../../shared/calculators/action-plan';
import { extractHiddenCostEstimate } from '../../shared/calculators/cost-calculator';
import { scanTextWithRules } from '../../shared/rules/engine';
import { AnalysisReport, RiskLevel } from '../../shared/schemas/analysis';
import {
  buildShortSpokenExcerpt,
  buildSpokenReportSections,
  sanitizeForSpeech,
  sortFindingsForSpeech,
  splitIntoUtteranceChunks,
} from '../../src/utils/ttsSpeechBuilder';

test('sanitizeForSpeech strips markdown symbols, quotes, and decorative bullets', () => {
  const raw = '`**Important**` · [Cancel Link](https://example.com) “quoted clause” #heading';
  const cleaned = sanitizeForSpeech(raw);
  assert.ok(!cleaned.includes('*'));
  assert.ok(!cleaned.includes('`'));
  assert.ok(!cleaned.includes('#'));
  assert.ok(!cleaned.includes('https://example.com'));
  assert.ok(cleaned.includes('Cancel Link'));
  assert.ok(cleaned.includes('quoted clause'));
});

test('buildSpokenReportSections orders overview, cost, high-risk findings first, action plan, and AI assessment notice', () => {
  const sampleText = `
    1. Free Trial & Renewal: Your 7-day free trial automatically converts to a paid monthly subscription of $29.99 without further notice unless you cancel at least 30 days before the renewal date. All payments and subscription fees are final and non-refundable.
    2. Arbitration: Any dispute shall be resolved exclusively by binding individual arbitration, and you waive any right to participate in a class action.
  `;
  const findings = scanTextWithRules(sampleText);
  const hiddenCostEstimate = extractHiddenCostEstimate(sampleText);
  const actionPlan = buildActionPlan({
    findings,
    discoveredLinks: [],
  });

  const report: AnalysisReport = {
    reportId: 'REP-TEST-001',
    title: 'Sample Subscription Agreement',
    scanStatus: 'fallback_text',
    analysisMode: 'rule_based_only',
    timestamp: new Date().toISOString(),
    analyzedCharCount: sampleText.length,
    clausesAnalyzedCount: 4,
    overallRiskLevel: RiskLevel.CRITICAL,
    overallSummary:
      'Detected high-priority automatic renewal, non-refundable fees, and mandatory arbitration clauses.',
    counts: {
      Critical: findings.filter((f) => f.riskLevel === RiskLevel.CRITICAL).length,
      High: findings.filter((f) => f.riskLevel === RiskLevel.HIGH).length,
      Medium: findings.filter((f) => f.riskLevel === RiskLevel.MEDIUM).length,
      Low: findings.filter((f) => f.riskLevel === RiskLevel.LOW).length,
      total: findings.length,
    },
    findings,
    discoveredLinks: [],
    hiddenCostEstimate,
    actionPlan,
    aiDisclosure: 'Hybrid rule and AI analysis.',
    legalDisclaimer:
      'OpenShield provides automated consumer risk screening and does not constitute formal legal advice.',
  };

  const summarySections = buildSpokenReportSections(report, 'summary', 'en');
  assert.ok(summarySections.length >= 4);
  assert.equal(summarySections[0].kind, 'overview');
  assert.equal(summarySections[summarySections.length - 1].kind, 'limitations');
  assert.ok(
    summarySections[summarySections.length - 1].text.includes('not formal legal advice')
  );

  // Full report mode includes every finding sorted by risk priority
  const fullSections = buildSpokenReportSections(report, 'full', 'en');
  const findingSections = fullSections.filter((s) => s.kind === 'finding');
  assert.equal(findingSections.length, report.findings.length);

  // Verify Critical/High come before Medium/Low
  const sorted = sortFindingsForSpeech(report.findings);
  if (sorted.length >= 2) {
    assert.ok(
      sorted[0].riskLevel === RiskLevel.CRITICAL || sorted[0].riskLevel === RiskLevel.HIGH
    );
  }
});

test('splitIntoUtteranceChunks splits long paragraphs cleanly without losing words', () => {
  const longText =
    'First sentence explains the overall risk level of this subscription agreement. Second sentence details the automatic renewal fee of twenty nine dollars per month. Third sentence explains that all payments are strictly final and non-refundable under all circumstances. Fourth sentence reminds the user that this is an automated risk assessment and not legal advice.';
  const chunks = splitIntoUtteranceChunks(longText, 120);
  assert.ok(chunks.length >= 3);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 140);
  }
  assert.equal(chunks.join(' '), longText);
});

test('buildShortSpokenExcerpt truncates lengthy clauses with ellipsis at word boundary', () => {
  const longClause =
    'Unless you notify us in writing at least sixty days prior to the expiration of your initial annual subscription term, this agreement shall automatically renew for successive twelve month periods at our then-current standard enterprise list price.';
  const excerpt = buildShortSpokenExcerpt(longClause, 90);
  assert.ok(excerpt.length <= 95);
  assert.ok(excerpt.endsWith('...'));
});
