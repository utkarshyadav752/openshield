/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Unit Tests for Dark Pattern Taxonomy & Extension Detection Patterns
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { scanTextWithRules } from '../../shared/rules/engine';
import { ClauseCategory, DarkPatternTaxonomy } from '../../shared/schemas/analysis';

test('detects confirm-shaming, countdown urgency, drip pricing, and preselected add-ons', () => {
  const checkoutPageText = `
    Order Summary
    Advertised item prices exclude mandatory service fees; a surcharge of 14% will be assessed at final billing.
    Shipping protection ($6.99) has been automatically added to your bag.
    Offer expires in 04:59 — act now! Only 2 left at this price — 38 people have this in their cart right now.
    No thanks, I prefer paying full price and accept full financial risk.
  `;

  const findings = scanTextWithRules(checkoutPageText);

  const taxonomies = findings.map((f) => f.taxonomy);
  const categories = findings.map((f) => f.category);

  assert.equal(taxonomies.includes(DarkPatternTaxonomy.SNEAKING), true);
  assert.equal(taxonomies.includes(DarkPatternTaxonomy.URGENCY), true);
  assert.equal(taxonomies.includes(DarkPatternTaxonomy.CONFIRM_SHAMING), true);

  assert.equal(categories.includes(ClauseCategory.HIDDEN_FEES), true);
  assert.equal(categories.includes(ClauseCategory.PRESELECTED_ADDONS), true);
  assert.equal(categories.includes(ClauseCategory.COUNTDOWN_SCARCITY), true);
  assert.equal(categories.includes(ClauseCategory.CONFIRM_SHAMING), true);
});

test('detects perpetual content license and restrictive account deletion rules', () => {
  const termsText = `
    User Content
    By uploading content, you grant us an irrevocable, perpetual, worldwide, royalty-free, sublicensable license to use, reproduce, modify, adapt, publish, monetize, and train artificial intelligence models on your files.

    Account Termination
    Deactivating your account does not stop recurring subscription billing. To delete your account, you must submit a notarized affidavit.
  `;

  const findings = scanTextWithRules(termsText);
  const categories = findings.map((f) => f.category);

  assert.equal(categories.includes(ClauseCategory.CONTENT_LICENSE), true);
  assert.equal(categories.includes(ClauseCategory.ACCOUNT_DELETION), true);
});
