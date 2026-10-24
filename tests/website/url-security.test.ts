/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Unit Tests for URL Validation, SSRF Hardening, and HTML Extraction
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractVisibleTextFromHtml,
  isPrivateOrReservedIp,
  validateUrlSyntaxAndHost,
} from '../../server/src/url-security';

test('blocks loopback, private IPv4/IPv6 ranges, and cloud metadata IPs', () => {
  // Blocked private & reserved IPs
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('172.16.5.4'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.100'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('0.0.0.0'), true);
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('fd00::1'), true);
  assert.equal(isPrivateOrReservedIp('fe80::1'), true);

  // Public routable IPs
  assert.equal(isPrivateOrReservedIp('93.184.216.34'), false);
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
});

test('validates URL protocols and rejects localhost, internal domains, and credentials', () => {
  assert.equal(validateUrlSyntaxAndHost('http://localhost:3000/admin').valid, false);
  assert.equal(
    validateUrlSyntaxAndHost('http://localhost:3000/admin').errorCode,
    'SSRF_BLOCKED'
  );

  assert.equal(validateUrlSyntaxAndHost('http://127.0.0.1/secret').valid, false);
  assert.equal(validateUrlSyntaxAndHost('http://169.254.169.254/latest/meta-data/').valid, false);
  assert.equal(validateUrlSyntaxAndHost('http://internal.corp.local/terms').valid, false);
  assert.equal(validateUrlSyntaxAndHost('file:///etc/passwd').valid, false);
  assert.equal(validateUrlSyntaxAndHost('javascript:alert(1)').valid, false);
  assert.equal(validateUrlSyntaxAndHost('https://user:pass@example.com/terms').valid, false);

  const validPublic = validateUrlSyntaxAndHost('https://example.com/legal/terms');
  assert.equal(validPublic.valid, true);
});

test('strips script and style blocks when extracting visible text from HTML', () => {
  const html = `
    <html>
      <head>
        <title>Sample Terms Page</title>
        <style>body { color: red; }</style>
        <script>window.secret = "do not include";</script>
      </head>
      <body>
        <h1>Terms of Service</h1>
        <p>Your subscription will automatically renew each year.</p>
      </body>
    </html>
  `;

  const extracted = extractVisibleTextFromHtml(html);
  assert.equal(extracted.title, 'Sample Terms Page');
  assert.equal(extracted.text.includes('window.secret'), false);
  assert.equal(
    extracted.text.includes('Your subscription will automatically renew each year.'),
    true
  );
});
