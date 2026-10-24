/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Unit Tests for OpenShield Detection Rules, False-Positive Exclusions,
 * Duplicate Suppression, and Verbatim Evidence Verification.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRuleBasedReport,
  extractPolicyLinksFromHtml,
  scanTextWithRules,
} from '../../shared/rules/engine';
import {
  ClauseCategory,
  ConfidenceLevel,
  DarkPatternTaxonomy,
  DetectionSource,
  FindingNature,
  RiskLevel,
} from '../../shared/schemas/analysis';
import { lookupKnownService } from '../../shared/datasets/known-services';

test('detects automatic renewal, trial conversion, and binding arbitration clauses', () => {
  const policyText = `
    Section 1. Trial and Renewal
    Your 7-day free trial automatically converts to a paid monthly subscription of $29.99 without further notice.
    Unless you notify us at least 30 days before the end of the current billing period, your subscription will automatically renew.

    Section 2. Dispute Resolution
    Any dispute shall be resolved exclusively through final and binding individual arbitration, and you waive any right to participate in a class action.
  `;

  const findings = scanTextWithRules(policyText);
  const categories = findings.map((f) => f.category);

  assert.equal(categories.includes(ClauseCategory.TRIAL_CONVERSION), true);
  assert.equal(categories.includes(ClauseCategory.AUTO_RENEWAL), true);
  assert.equal(categories.includes(ClauseCategory.FORCED_ARBITRATION), true);
  assert.equal(categories.includes(ClauseCategory.CLASS_ACTION_WAIVER), true);

  // Verify section location tracking works
  const arbFinding = findings.find(
    (f) => f.category === ClauseCategory.FORCED_ARBITRATION
  );
  assert.ok(arbFinding);
  assert.equal(arbFinding.sectionLocation, 'Section 2. Dispute Resolution');
  assert.equal(arbFinding.riskLevel, RiskLevel.CRITICAL);
});

test('prevents false positives on benign consumer-friendly sentences', () => {
  const friendlyText = `
    1. Billing & Transparency
    This is a one-time purchase with no recurring billing and never auto-renews.
    We have no hidden fees and zero processing fees at checkout.
    We never sell or rent your personal information to third-party advertisers.
    No credit card required for trial access, and your trial expires automatically with zero charge.
  `;

  const findings = scanTextWithRules(friendlyText);
  assert.equal(findings.length, 0);
});

test('suppresses duplicate identical findings within the same document', () => {
  const repeatedText = `
    Your subscription will continue to renew automatically each month until canceled.
    Your subscription will continue to renew automatically each month until canceled.
    Your subscription will continue to renew automatically each month until canceled.
  `;

  const findings = scanTextWithRules(repeatedText);
  const autoRenewFindings = findings.filter(
    (f) => f.category === ClauseCategory.AUTO_RENEWAL
  );
  assert.equal(autoRenewFindings.length, 1);
});

test('rejects AI findings whose evidence quote does not exist verbatim in source text', () => {
  const sourceText =
    'All sales are final and non-refundable once the digital license key has been revealed.';

  const report = buildRuleBasedReport({
    text: sourceText,
    additionalFindings: [
      {
        id: 'AI_FAKE_1',
        ruleId: 'AI_FAKE',
        title: 'Fabricated AI Clause',
        category: ClauseCategory.FORCED_ARBITRATION,
        taxonomy: DarkPatternTaxonomy.LEGAL_TERMS,
        riskLevel: RiskLevel.CRITICAL,
        nature: FindingNature.DETECTED_CLAUSE,
        explanation: 'Should be rejected because quote is not in sourceText.',
        evidenceQuote:
          'You agree to mandatory arbitration in Geneva under international rules.',
        sectionLocation: 'Section 99',
        whyItMatters: 'N/A',
        whatToCheck: 'N/A',
        confidence: ConfidenceLevel.HIGH,
        limitations: 'N/A',
        source: DetectionSource.HYBRID_AI,
      },
    ],
  });

  assert.equal(
    report.findings.some((f) => f.id === 'AI_FAKE_1'),
    false
  );
  assert.equal(report.findings.length, 1);
  assert.equal(
    report.findings[0].category,
    ClauseCategory.CANCELLATION_RESTRICTIONS
  );
});

test('looks up known service records and extracts verified policy links', () => {
  const adobeRecord = lookupKnownService('https://www.adobe.com/legal/terms.html');
  assert.ok(adobeRecord);
  assert.equal(adobeRecord.name, 'Adobe Creative Cloud');
  assert.equal(adobeRecord.cancellationDifficulty, 'hard');

  const html = `
    <footer>
      <a href="/legal/terms-of-service">Terms of Service</a>
      <a href="https://example.com/account/cancel">Cancel Subscription</a>
      <a href="javascript:alert(1)">Malicious Link</a>
    </footer>
  `;
  const links = extractPolicyLinksFromHtml(html, 'https://example.com/home');
  assert.equal(links.length, 2);
  assert.equal(links[0].type, 'terms');
  assert.equal(links[1].type, 'cancellation');
  assert.equal(links[1].verifiedSameDomain, true);
});
