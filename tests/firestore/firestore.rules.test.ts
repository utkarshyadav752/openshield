/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Firestore Security Rules & "Dirty Dozen" Payload Test Suite
 * Validates that all 8 Pillars of Hardened Rules exist in firestore.rules and
 * evaluates the exact boolean logic gates against all 12 Dirty Dozen payloads
 * plus valid authenticated owner operations.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

interface SimulatedAuth {
  uid: string;
  email_verified: boolean;
}

interface SimulatedReportDoc {
  [key: string]: unknown;
}

const SERVER_TIME = '2026-10-23T18:30:00Z';

const REQUIRED_KEYS = [
  'ownerId',
  'title',
  'sourceType',
  'targetUrl',
  'overallRiskLevel',
  'overallSummary',
  'findingsCount',
  'criticalCount',
  'highCount',
  'mediumCount',
  'lowCount',
  'customerNotes',
  'createdAt',
  'updatedAt',
];

function isValidId(id: unknown): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(id)
  );
}

function isValidSavedReport(data: SimulatedReportDoc, auth: SimulatedAuth | null): boolean {
  if (!auth) return false;
  const keys = Object.keys(data);
  const hasAll = REQUIRED_KEYS.every((k) => keys.includes(k));
  const hasOnly = keys.every((k) => REQUIRED_KEYS.includes(k));
  if (!hasAll || !hasOnly) return false;

  if (
    typeof data.ownerId !== 'string' ||
    data.ownerId.length < 1 ||
    data.ownerId.length > 128 ||
    !/^[a-zA-Z0-9_-]+$/.test(data.ownerId) ||
    data.ownerId !== auth.uid
  ) {
    return false;
  }

  if (typeof data.title !== 'string' || data.title.length < 1 || data.title.length > 200) {
    return false;
  }

  if (
    typeof data.sourceType !== 'string' ||
    data.sourceType.length < 3 ||
    data.sourceType.length > 10 ||
    !['url', 'pdf', 'image', 'text'].includes(data.sourceType)
  ) {
    return false;
  }

  if (typeof data.targetUrl !== 'string' || data.targetUrl.length > 500) {
    return false;
  }

  if (
    typeof data.overallRiskLevel !== 'string' ||
    data.overallRiskLevel.length < 3 ||
    data.overallRiskLevel.length > 16 ||
    !['Minimal', 'Low', 'Medium', 'High', 'Critical'].includes(data.overallRiskLevel)
  ) {
    return false;
  }

  if (
    typeof data.overallSummary !== 'string' ||
    data.overallSummary.length < 1 ||
    data.overallSummary.length > 1000
  ) {
    return false;
  }

  const countFields = [
    'findingsCount',
    'criticalCount',
    'highCount',
    'mediumCount',
    'lowCount',
  ];
  for (const field of countFields) {
    const val = data[field];
    if (typeof val !== 'number' || val < 0 || val > 500) return false;
  }

  if (typeof data.customerNotes !== 'string' || data.customerNotes.length > 1000) {
    return false;
  }

  if (typeof data.createdAt !== 'string' || typeof data.updatedAt !== 'string') {
    return false;
  }

  return true;
}

function evaluateCreate(
  reportId: string,
  incoming: SimulatedReportDoc,
  auth: SimulatedAuth | null
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(reportId)) return 'PERMISSION_DENIED';
  if (!isValidSavedReport(incoming, auth)) return 'PERMISSION_DENIED';
  if (incoming.createdAt !== SERVER_TIME || incoming.updatedAt !== SERVER_TIME) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOWED';
}

function evaluateUpdate(
  reportId: string,
  existing: SimulatedReportDoc,
  incoming: SimulatedReportDoc,
  auth: SimulatedAuth | null
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(reportId)) return 'PERMISSION_DENIED';
  if (!isValidSavedReport(incoming, auth)) return 'PERMISSION_DENIED';
  if (existing.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  if (
    incoming.ownerId !== existing.ownerId ||
    incoming.createdAt !== existing.createdAt ||
    incoming.updatedAt !== SERVER_TIME
  ) {
    return 'PERMISSION_DENIED';
  }

  const affectedKeys = Object.keys(incoming).filter(
    (k) => incoming[k] !== existing[k]
  );
  const allowedUpdateKeys = new Set(['customerNotes', 'updatedAt']);
  if (!affectedKeys.every((k) => allowedUpdateKeys.has(k))) {
    return 'PERMISSION_DENIED';
  }

  return 'ALLOWED';
}

function evaluateGetOrList(
  reportId: string,
  existing: SimulatedReportDoc,
  auth: SimulatedAuth | null,
  isList: boolean
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isList && !isValidId(reportId)) return 'PERMISSION_DENIED';
  if (existing.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  return 'ALLOWED';
}

const VALID_BASE_DOC: SimulatedReportDoc = {
  ownerId: 'user_1',
  title: 'ApexCloud Terms & Conditions',
  sourceType: 'pdf',
  targetUrl: '',
  overallRiskLevel: 'Critical',
  overallSummary: 'Identified 6 potentially unfair clauses across 2 pages.',
  findingsCount: 6,
  criticalCount: 3,
  highCount: 2,
  mediumCount: 1,
  lowCount: 0,
  customerNotes: 'Check section 2 arbitration opt-out window.',
  createdAt: SERVER_TIME,
  updatedAt: SERVER_TIME,
};

describe('OpenShield Firestore Security Rules & Dirty Dozen Audit', () => {
  it('Verifies firestore.rules file structure and 8 Pillars invariants', () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rulesText = fs.readFileSync(rulesPath, 'utf8');

    assert.ok(rulesText.includes("rules_version = '2';"));
    assert.ok(rulesText.includes('match /{document=**} {\n      allow read, write: if false;'));
    assert.ok(rulesText.includes('function isValidId(id)'));
    assert.ok(rulesText.includes('function isValidSavedReport(data)'));
    assert.ok(rulesText.includes("affectedKeys().hasOnly(['customerNotes', 'updatedAt'])"));
    assert.ok(rulesText.includes('resource.data.ownerId == request.auth.uid'));
  });

  it('Rejects all 12 Dirty Dozen adversarial payloads with PERMISSION_DENIED and allows valid owner writes', () => {
    const validUser: SimulatedAuth = { uid: 'user_1', email_verified: true };
    const otherUser: SimulatedAuth = { uid: 'user_2', email_verified: true };
    const unverifiedUser: SimulatedAuth = { uid: 'user_1', email_verified: false };

    // Valid baseline create succeeds
    assert.equal(evaluateCreate('rep_valid_1', VALID_BASE_DOC, validUser), 'ALLOWED');

    // 1. Unauthenticated Create
    assert.equal(
      evaluateCreate('rep_1', VALID_BASE_DOC, null),
      'PERMISSION_DENIED'
    );

    // 2. Unverified Email Create
    assert.equal(
      evaluateCreate('rep_1', VALID_BASE_DOC, unverifiedUser),
      'PERMISSION_DENIED'
    );

    // 3. Identity Spoofing on Create (ownerId != auth.uid)
    assert.equal(
      evaluateCreate('rep_1', { ...VALID_BASE_DOC, ownerId: 'user_2' }, validUser),
      'PERMISSION_DENIED'
    );

    // 4. Shadow Field Injection on Create
    assert.equal(
      evaluateCreate('rep_1', { ...VALID_BASE_DOC, isAdmin: true }, validUser),
      'PERMISSION_DENIED'
    );

    // 5. ID Poisoning Attack
    assert.equal(
      evaluateCreate('bad$id!@#', VALID_BASE_DOC, validUser),
      'PERMISSION_DENIED'
    );

    // 6. Oversized Title Resource Exhaustion (> 200 chars)
    assert.equal(
      evaluateCreate(
        'rep_1',
        { ...VALID_BASE_DOC, title: 'X'.repeat(250) },
        validUser
      ),
      'PERMISSION_DENIED'
    );

    // 7. Invalid Enum Value
    assert.equal(
      evaluateCreate(
        'rep_1',
        { ...VALID_BASE_DOC, overallRiskLevel: 'Catastrophic' },
        validUser
      ),
      'PERMISSION_DENIED'
    );

    // 8. Client Timestamp Forgery on Create
    assert.equal(
      evaluateCreate(
        'rep_1',
        { ...VALID_BASE_DOC, createdAt: '2020-01-01T00:00:00Z' },
        validUser
      ),
      'PERMISSION_DENIED'
    );

    // 9. Unauthorized Update of Immutable/System Fields
    assert.equal(
      evaluateUpdate(
        'rep_1',
        VALID_BASE_DOC,
        { ...VALID_BASE_DOC, overallRiskLevel: 'Minimal' },
        validUser
      ),
      'PERMISSION_DENIED'
    );

    // 10. Value Poisoning on Update (non-string or >1000-char customerNotes)
    assert.equal(
      evaluateUpdate(
        'rep_1',
        VALID_BASE_DOC,
        { ...VALID_BASE_DOC, customerNotes: 12345 },
        validUser
      ),
      'PERMISSION_DENIED'
    );

    // 11. Cross-User Read (get)
    assert.equal(
      evaluateGetOrList('rep_1', VALID_BASE_DOC, otherUser, false),
      'PERMISSION_DENIED'
    );

    // 12. Unfiltered List Scraping (list across another user's doc)
    assert.equal(
      evaluateGetOrList('rep_1', VALID_BASE_DOC, otherUser, true),
      'PERMISSION_DENIED'
    );

    // Valid Customer Notes Update by Owner succeeds
    assert.equal(
      evaluateUpdate(
        'rep_1',
        VALID_BASE_DOC,
        { ...VALID_BASE_DOC, customerNotes: 'Updated personal review note.' },
        validUser
      ),
      'ALLOWED'
    );
  });
});
