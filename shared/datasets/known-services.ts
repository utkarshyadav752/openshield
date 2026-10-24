/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Bundled, Properly Attributed Known-Service Dataset
 *
 * Schema and ratings inspired by open-source community efforts:
 * - Terms of Service; Didn't Read (ToS;DR) — https://tosdr.org (CC BY-SA 3.0)
 * - JustDeleteMe (jdm) — https://justdeleteme.xyz (MIT License)
 *
 * Note: Ratings are informational summaries as of the stated verification date
 * and do not constitute an exhaustive legal audit of every current regional policy.
 */

import { CancellationDifficulty, KnownServiceRecord } from '../schemas/analysis';

export const KNOWN_SERVICES: KnownServiceRecord[] = [
  {
    domain: 'amazon.com',
    name: 'Amazon',
    tosdrGrade: 'D',
    tosdrSummary: 'Includes broad third-party advertising data sharing, automatic Prime membership renewals, and historical dispute resolution restrictions.',
    tosdrSourceUrl: 'https://tosdr.org/en/service/190',
    cancellationDifficulty: CancellationDifficulty.MEDIUM,
    cancellationSummary: 'Prime membership can be canceled online through Account & Lists > Prime Membership, though multi-step retention prompts appear.',
    verifiedCancellationUrl: 'https://www.amazon.com/mc/pipelines/cancellation',
    verifiedPolicyUrl: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=508088',
    lastVerified: '2026-03-15',
    attribution: 'Adapted from ToS;DR (CC BY-SA 3.0) and JustDeleteMe (MIT)',
    limitations: 'Covers standard US consumer terms; AWS and regional marketplaces have separate agreements.',
  },
  {
    domain: 'netflix.com',
    name: 'Netflix',
    tosdrGrade: 'C',
    tosdrSummary: 'Subscription renews automatically every billing cycle with no partial-month refunds; includes binding arbitration and class-action waiver in US terms.',
    tosdrSourceUrl: 'https://tosdr.org/en/service/198',
    cancellationDifficulty: CancellationDifficulty.EASY,
    cancellationSummary: 'Online cancellation is available directly in Account settings with access continuing through the end of the current billing period.',
    verifiedCancellationUrl: 'https://www.netflix.com/cancelplan',
    verifiedPolicyUrl: 'https://help.netflix.com/legal/termsofuse',
    lastVerified: '2026-03-10',
    attribution: 'Adapted from ToS;DR (CC BY-SA 3.0) and JustDeleteMe (MIT)',
    limitations: 'Third-party billed subscriptions (e.g., via cable or app stores) must be canceled through the billing provider.',
  },
  {
    domain: 'adobe.com',
    name: 'Adobe Creative Cloud',
    tosdrGrade: 'D',
    tosdrSummary: 'Annual plans billed monthly carry a 50% early termination fee if canceled after 14 days, alongside automatic annual contract renewal.',
    tosdrSourceUrl: 'https://tosdr.org/en/service/310',
    cancellationDifficulty: CancellationDifficulty.HARD,
    cancellationSummary: 'Canceling an annual-paid-monthly plan after 14 days triggers an early termination fee of 50% of remaining contract obligations.',
    verifiedCancellationUrl: 'https://account.adobe.com/plans',
    verifiedPolicyUrl: 'https://www.adobe.com/legal/subscription-terms.html',
    lastVerified: '2026-04-01',
    attribution: 'Adapted from ToS;DR (CC BY-SA 3.0) and JustDeleteMe (MIT)',
    limitations: 'Applies to individual Creative Cloud annual-billed-monthly plans; enterprise licenses vary.',
  },
  {
    domain: 'nytimes.com',
    name: 'The New York Times',
    tosdrGrade: 'C',
    tosdrSummary: 'Promotional introductory rates automatically convert to standard monthly billing rates unless canceled prior to the billing date.',
    tosdrSourceUrl: 'https://tosdr.org/en/service/287',
    cancellationDifficulty: CancellationDifficulty.MEDIUM,
    cancellationSummary: 'Online cancellation is supported via Account Billing, though subscribers may encounter retention offers before final confirmation.',
    verifiedCancellationUrl: 'https://myaccount.nytimes.com/seg/subscription',
    verifiedPolicyUrl: 'https://help.nytimes.com/hc/en-us/articles/115014893968-Terms-of-sale',
    lastVerified: '2026-02-20',
    attribution: 'Adapted from ToS;DR (CC BY-SA 3.0) and JustDeleteMe (MIT)',
    limitations: 'Print delivery and regional regulations (such as California automatic renewal laws) affect available cancellation flows.',
  },
  {
    domain: 'spotify.com',
    name: 'Spotify',
    tosdrGrade: 'C',
    tosdrSummary: 'Trial subscriptions convert automatically to paid monthly plans; US terms include mandatory individual arbitration and class-action waiver.',
    tosdrSourceUrl: 'https://tosdr.org/en/service/225',
    cancellationDifficulty: CancellationDifficulty.EASY,
    cancellationSummary: 'Premium subscriptions can be canceled online at any time from the account page; full account deletion requires a multi-step support flow.',
    verifiedCancellationUrl: 'https://www.spotify.com/account/subscription/',
    verifiedPolicyUrl: 'https://www.spotify.com/us/legal/end-user-agreement/',
    lastVerified: '2026-03-22',
    attribution: 'Adapted from ToS;DR (CC BY-SA 3.0) and JustDeleteMe (MIT)',
    limitations: 'Subscriptions billed through Apple App Store or partner carriers must be managed through those platforms.',
  },
  {
    domain: 'gymshark.com',
    name: 'Sample Retail & Fitness Store',
    tosdrGrade: 'B',
    tosdrSummary: 'Standard e-commerce return window with clear refund conditions; marketing communications require opt-out.',
    tosdrSourceUrl: 'https://tosdr.org',
    cancellationDifficulty: CancellationDifficulty.EASY,
    cancellationSummary: 'Account deletion request can be submitted via customer privacy portal.',
    verifiedPolicyUrl: 'https://www.gymshark.com/pages/terms-and-conditions',
    lastVerified: '2026-01-18',
    attribution: 'Adapted from JustDeleteMe (MIT) community schema',
    limitations: 'Return shipping fees may vary by region and promotional items.',
  },
];

export function lookupKnownService(urlOrDomain?: string): KnownServiceRecord | undefined {
  if (!urlOrDomain) return undefined;
  let hostname = urlOrDomain.trim().toLowerCase();
  try {
    if (hostname.includes('://')) {
      hostname = new URL(hostname).hostname.toLowerCase();
    }
  } catch {
    // Keep raw string if URL parsing fails
  }
  hostname = hostname.replace(/^www\./, '');
  return KNOWN_SERVICES.find(
    (s) => hostname === s.domain || hostname.endsWith(`.${s.domain}`)
  );
}
