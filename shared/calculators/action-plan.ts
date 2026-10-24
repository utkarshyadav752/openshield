/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Action Plan Generator ("What should you do next?")
 * Produces prioritized, evidence-backed consumer recommendations in English and Hindi
 * linked directly to detected clauses and verified official cancellation/policy URLs.
 */

import {
  AnalysisFinding,
  ClauseCategory,
  DiscoveredPolicyLink,
  KnownServiceRecord,
  RiskLevel,
} from '../schemas/analysis';

export interface ActionPlanItem {
  id: string;
  priority: 'High Priority' | 'Recommended' | 'Good Practice';
  priorityHi: string;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  supportingFindingId?: string;
  supportingQuote?: string;
  verifiedUrl?: string;
  verifiedUrlLabel?: string;
}

export function buildActionPlan(params: {
  findings: AnalysisFinding[];
  knownService?: KnownServiceRecord;
  discoveredLinks: DiscoveredPolicyLink[];
}): ActionPlanItem[] {
  const items: ActionPlanItem[] = [];
  const seenCategories = new Set<ClauseCategory>();

  const cancellationLink =
    params.knownService?.verifiedCancellationUrl ||
    params.discoveredLinks.find((l) => l.type === 'cancellation')?.url;

  const privacyLink =
    params.knownService?.verifiedPolicyUrl ||
    params.discoveredLinks.find((l) => l.type === 'privacy')?.url;

  for (const finding of params.findings) {
    if (seenCategories.has(finding.category)) continue;
    seenCategories.add(finding.category);

    const isHighPriority =
      finding.riskLevel === RiskLevel.CRITICAL ||
      finding.riskLevel === RiskLevel.HIGH;

    const priority: ActionPlanItem['priority'] = isHighPriority
      ? 'High Priority'
      : 'Recommended';
    const priorityHi = isHighPriority ? 'उच्च प्राथमिकता' : 'अनुशंसित';

    switch (finding.category) {
      case ClauseCategory.TRIAL_CONVERSION:
        items.push({
          id: `act_trial_${items.length + 1}`,
          priority: 'High Priority',
          priorityHi: 'उच्च प्राथमिकता',
          title: 'Set a reminder at least 48 hours before the trial expires',
          titleHi: 'ट्रायल समाप्त होने से कम से कम 48 घंटे पहले रिमाइंडर सेट करें',
          description:
            'Confirm the exact trial expiration date and check whether cancelling early terminates your trial access immediately.',
          descriptionHi:
            'ट्रायल समाप्त होने की सटीक तारीख की पुष्टि करें और जाँचें कि क्या पहले रद्द करने से ट्रायल तुरंत समाप्त हो जाता है।',
          supportingFindingId: finding.id,
          supportingQuote: finding.evidenceQuote,
          verifiedUrl: cancellationLink,
          verifiedUrlLabel: cancellationLink
            ? 'Official Cancellation / Plan Page'
            : undefined,
        });
        break;

      case ClauseCategory.AUTO_RENEWAL:
        items.push({
          id: `act_renew_${items.length + 1}`,
          priority: 'High Priority',
          priorityHi: 'उच्च प्राथमिकता',
          title: 'Verify the renewal date, notice window, and recurring price',
          titleHi: 'नवीनीकरण तिथि, नोटिस अवधि और आवर्ती शुल्क की पुष्टि करें',
          description:
            'Check how many days in advance you must cancel before the renewal date and inspect your card or UPI AutoPay mandate settings.',
          descriptionHi:
            'जाँचें कि नवीनीकरण से कितने दिन पहले रद्द करना आवश्यक है और अपने कार्ड या UPI AutoPay मैंडेट सेटिंग्स की समीक्षा करें।',
          supportingFindingId: finding.id,
          supportingQuote: finding.evidenceQuote,
          verifiedUrl: cancellationLink,
          verifiedUrlLabel: cancellationLink
            ? 'Verified Cancellation Page'
            : undefined,
        });
        break;

      case ClauseCategory.CANCELLATION_RESTRICTIONS:
      case ClauseCategory.NON_REFUNDABLE:
        items.push({
          id: `act_cancel_${items.length + 1}`,
          priority,
          priorityHi,
          title: 'Review the cancellation procedure and refund exceptions before paying',
          titleHi: 'भुगतान से पहले रद्दीकरण प्रक्रिया और रिफंड अपवादों की जाँच करें',
          description:
            'Check whether online self-service cancellation is available and whether cancelling mid-term triggers an early termination fee or forfeits unused time.',
          descriptionHi:
            'पुष्टि करें कि क्या ऑनलाइन रद्दीकरण उपलब्ध है और क्या बीच में रद्द करने पर कोई अतिरिक्त शुल्क लगता है।',
          supportingFindingId: finding.id,
          supportingQuote: finding.evidenceQuote,
          verifiedUrl: cancellationLink,
          verifiedUrlLabel: cancellationLink
            ? 'Official Cancellation Instructions'
            : undefined,
        });
        break;

      case ClauseCategory.FORCED_ARBITRATION:
      case ClauseCategory.CLASS_ACTION_WAIVER:
      case ClauseCategory.DISPUTE_RESTRICTIONS:
        items.push({
          id: `act_dispute_${items.length + 1}`,
          priority: 'High Priority',
          priorityHi: 'उच्च प्राथमिकता',
          title: 'Check for a 30-day arbitration opt-out procedure in the dispute section',
          titleHi: 'विवाद समाधान अनुभाग में 30-दिन के ऑप्ट-आउट विकल्प की जाँच करें',
          description:
            'Many binding arbitration clauses allow you to opt out by sending a brief written notice within 30 days of account creation.',
          descriptionHi:
            'कई अनुबंधों में खाता बनाने के 30 दिनों के भीतर लिखित सूचना भेजकर मध्यस्थता (Arbitration) से बाहर निकलने का विकल्प होता है।',
          supportingFindingId: finding.id,
          supportingQuote: finding.evidenceQuote,
        });
        break;

      case ClauseCategory.HIDDEN_FEES:
      case ClauseCategory.PRESELECTED_ADDONS:
        items.push({
          id: `act_fees_${items.length + 1}`,
          priority: 'High Priority',
          priorityHi: 'उच्च प्राथमिकता',
          title: 'Inspect the final itemized checkout total and uncheck optional add-ons',
          titleHi: 'अंतिम बिल की जाँच करें और पहले से चुने गए वैकल्पिक ऐड-ऑन हटाएँ',
          description:
            'Review every line item and pre-selected checkbox before submitting payment to avoid unintended warranty, shipping protection, or service charges.',
          descriptionHi:
            'भुगतान करने से पहले कार्ट के प्रत्येक शुल्क और पहले से टिक किए गए बॉक्स की जाँच करें।',
          supportingFindingId: finding.id,
          supportingQuote: finding.evidenceQuote,
        });
        break;

      case ClauseCategory.DATA_SHARING:
        items.push({
          id: `act_privacy_${items.length + 1}`,
          priority,
          priorityHi,
          title: 'Review privacy settings and opt out of third-party ad or data sharing',
          titleHi: 'गोपनीयता सेटिंग्स देखें और तृतीय-पक्ष डेटा साझाकरण से ऑप्ट-आउट करें',
          description:
            'Look for a "Do Not Sell or Share My Personal Information" or consent withdrawal control in your account privacy settings.',
          descriptionHi:
            'अपने खाते की गोपनीयता सेटिंग्स में डेटा शेयरिंग या विज्ञापन ट्रैकिंग बंद करने के विकल्प की जाँच करें।',
          supportingFindingId: finding.id,
          supportingQuote: finding.evidenceQuote,
          verifiedUrl: privacyLink,
          verifiedUrlLabel: privacyLink ? 'Official Privacy Policy' : undefined,
        });
        break;

      default:
        items.push({
          id: `act_gen_${items.length + 1}`,
          priority,
          priorityHi,
          title: `Clarify "${finding.title}" before agreeing`,
          titleHi: `सहमति देने से पहले "${finding.title}" की शर्त स्पष्ट करें`,
          description: finding.whatToCheck,
          descriptionHi:
            'इस प्रावधान के प्रभाव की पुष्टि करें और आवश्यकता होने पर सेवा प्रदाता से लिखित स्पष्टीकरण मांगें।',
          supportingFindingId: finding.id,
          supportingQuote: finding.evidenceQuote,
        });
        break;
    }
  }

  // Always include saving a dated copy of the reviewed terms as a best-practice step
  items.push({
    id: 'act_save_copy',
    priority: 'Good Practice',
    priorityHi: 'अच्छा अभ्यास',
    title: 'Download or save a dated copy of the terms you reviewed today',
    titleHi: 'आज समीक्षा की गई शर्तों की तारीख-सहित एक प्रति सुरक्षित रखें',
    description:
      'Because online terms can be updated over time, keeping a copy of the agreement and price disclosures as they existed when you signed up protects your records.',
    descriptionHi:
      'चूँकि ऑनलाइन शर्तें समय के साथ बदल सकती हैं, साइन-अप के समय लागू शर्तों की एक प्रति सुरक्षित रखना भविष्य के लिए उपयोगी होता है।',
  });

  return items;
}
