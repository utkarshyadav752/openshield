/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Feature 2 — Live Browser Extension Section & Checkout Trap Detector
 * Provides a multi-scenario interactive browser extension simulator,
 * advertised-vs-checkout price discrepancy detector, countdown timer reset observer,
 * element-highlighting locator, reversible protection controls, and
 * clean unpacked installation instructions.
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Crosshair,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  PauseCircle,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { lookupKnownService } from '../../shared/datasets/known-services';
import { scanTextWithRules } from '../../shared/rules/engine';
import {
  AnalysisFinding,
  ClauseCategory,
  ConfidenceLevel,
  DarkPatternTaxonomy,
  DetectionSource,
  FindingNature,
  RiskLevel,
} from '../../shared/schemas/analysis';

interface SimulatedDomBlock {
  id: string;
  heading: string;
  text: string;
  interactiveAddon?: boolean;
}

interface ScenarioConfig {
  id: 'subscription' | 'flashcart' | 'streambharat' | 'clean';
  label: string;
  url: string;
  domainForLookup?: string;
  pageTitle: string;
  pageSubtitle: string;
  hasVisualInterference: boolean;
  priceDiscrepancy?: {
    advertisedPrice: string;
    checkoutTotal: string;
    explanation: string;
  };
  countdownObservation?: string;
  blocks: SimulatedDomBlock[];
  verifiedLinks: Array<{ label: string; url: string; type: string }>;
}

const SCENARIOS: Record<ScenarioConfig['id'], ScenarioConfig> = {
  subscription: {
    id: 'subscription',
    label: 'Subscription Checkout',
    url: 'https://checkout.creativepro-cloud.com/subscribe',
    domainForLookup: 'https://www.adobe.com',
    pageTitle: 'CreativePro All-Apps — 7-Day Trial Checkout',
    pageSubtitle:
      'Simulated checkout page demonstrating hidden auto-renewal, trial conversion, and visual interference',
    hasVisualInterference: true,
    blocks: [
      {
        id: 'sub_node_1',
        heading: 'Trial-to-Paid Conversion Disclosure',
        text: 'Your 7-day free trial automatically converts to a paid monthly subscription of $29.99 without further notice. Canceling during the trial period immediately terminates your trial access.',
      },
      {
        id: 'sub_node_2',
        heading: 'Automatic Contract Renewal Clause',
        text: 'Unless you notify us at least 30 days before the end of the current billing period, your subscription will automatically renew for successive annual terms.',
      },
      {
        id: 'sub_node_3',
        heading: 'Dispute Resolution & Class Waiver',
        text: 'Any dispute shall be resolved exclusively through final and binding individual arbitration, and you waive any right to participate in a class action.',
      },
      {
        id: 'sub_node_4',
        heading: 'Confirm-Shaming Decline Option',
        text: 'No thanks, I prefer paying full price and accept full financial risk.',
      },
    ],
    verifiedLinks: [
      {
        label: 'Verified Plan Cancellation Page',
        url: 'https://account.adobe.com/plans',
        type: 'cancellation',
      },
      {
        label: 'Subscription & Cancellation Terms',
        url: 'https://www.adobe.com/legal/subscription-terms.html',
        type: 'subscription',
      },
    ],
  },
  flashcart: {
    id: 'flashcart',
    label: 'Flash Sale Cart',
    url: 'https://shop.flashcart-express.com/cart',
    domainForLookup: 'https://www.amazon.com',
    pageTitle: 'FlashCart Express — Order Summary',
    pageSubtitle:
      'Simulated retail cart demonstrating drip pricing, countdown pressure, and pre-checked add-ons',
    hasVisualInterference: false,
    priceDiscrepancy: {
      advertisedPrice: '$49.00',
      checkoutTotal: '$70.85 (+44.6%)',
      explanation:
        'Checkout total adds a pre-checked $14.99 VIP protection plan and a mandatory 14% ($6.86) processing surcharge not shown in the advertised item price.',
    },
    countdownObservation:
      'Countdown timer ("03:42") observed on page; OpenShield monitors whether timer resets artificially upon refresh.',
    blocks: [
      {
        id: 'cart_node_1',
        heading: 'High-Pressure Urgency & Scarcity Banner',
        text: 'Offer expires in 03:42 — act now! Only 2 left at this price — 41 people have this in their cart right now.',
      },
      {
        id: 'cart_node_2',
        heading: 'Pre-Selected Paid Protection Add-On',
        text: 'Shipping protection ($6.99) has been automatically added to your bag. Uncheck this box if you do not wish to purchase the optional $14.99 VIP protection plan.',
        interactiveAddon: true,
      },
      {
        id: 'cart_node_3',
        heading: 'Mandatory Drip Surcharge Disclosure',
        text: 'Advertised item prices exclude mandatory service fees; a non-refundable processing fee and a surcharge of 14% will be assessed at final billing.',
      },
    ],
    verifiedLinks: [
      {
        label: 'Membership Cancellation Pipeline',
        url: 'https://www.amazon.com/mc/pipelines/cancellation',
        type: 'cancellation',
      },
      {
        label: 'Conditions of Use & Refund Policy',
        url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=508088',
        type: 'refunds',
      },
    ],
  },
  streambharat: {
    id: 'streambharat',
    label: 'India INR Checkout (₹999/mo)',
    url: 'https://checkout.streambharat.in/pro-pass',
    domainForLookup: undefined,
    pageTitle: 'StreamBharat Pro Pass — UPI AutoPay Checkout',
    pageSubtitle:
      'Simulated Indian subscription checkout with ₹999/mo auto-debit, ₹250 drip processing fee, and pre-selected add-on',
    hasVisualInterference: true,
    priceDiscrepancy: {
      advertisedPrice: '₹999 / month',
      checkoutTotal: '₹1,448 first billing (+₹449 extra)',
      explanation:
        'Checkout summary adds a mandatory ₹250 non-refundable processing fee plus a pre-selected ₹199 mentor protection add-on on top of the advertised ₹999 plan.',
    },
    countdownObservation:
      'Timer ("Offer expires in 04:59") observed resetting to 04:59 across DOM state checks — flagged as a high-pressure urgency indicator.',
    blocks: [
      {
        id: 'inr_node_1',
        heading: 'UPI AutoPay Trial-to-Paid Conversion',
        text: 'Your 7-day free trial automatically converts to a paid monthly subscription of ₹999 per month without further notice unless you cancel at least 48 hours before the trial period expires.',
      },
      {
        id: 'inr_node_2',
        heading: 'Drip Processing Fee & Preselected Add-On',
        text: 'Advertised item prices exclude mandatory service fees; a non-refundable processing fee of ₹250 will be assessed at final billing. Uncheck this box if you do not wish to purchase the optional ₹199 mentor protection plan.',
        interactiveAddon: true,
      },
      {
        id: 'inr_node_3',
        heading: 'Non-Refundable & Call-Center Cancellation Rule',
        text: 'All payments and subscription fees are final and non-refundable, and there are no refunds or credits for partial or unused subscription periods. Cancellation requests must be submitted by calling our customer retention desk.',
      },
    ],
    verifiedLinks: [
      {
        label: 'Manage UPI AutoPay & Cancel Pass',
        url: 'https://www.streambharat.in/account/cancel',
        type: 'cancellation',
      },
      {
        label: 'India Consumer Refund Policy',
        url: 'https://www.streambharat.in/legal/refunds',
        type: 'refunds',
      },
    ],
  },
  clean: {
    id: 'clean',
    label: 'Transparent Site (Safe)',
    url: 'https://www.honest-notes-app.org/pricing',
    domainForLookup: undefined,
    pageTitle: 'HonestNotes — Simple One-Time Purchase',
    pageSubtitle:
      'Simulated consumer-friendly page with transparent pricing and zero dark patterns',
    hasVisualInterference: false,
    blocks: [
      {
        id: 'clean_node_1',
        heading: 'One-Time Purchase Guarantee',
        text: 'This is a one-time purchase with no recurring billing and never auto-renews. We have no hidden fees and zero processing fees at checkout.',
      },
      {
        id: 'clean_node_2',
        heading: 'Straightforward Privacy Commitment',
        text: 'We never sell or rent your personal information to third-party advertisers. You can export your notes and delete your account online at any time.',
      },
    ],
    verifiedLinks: [
      {
        label: 'Plain-English Privacy Policy',
        url: 'https://example.com/privacy',
        type: 'privacy',
      },
    ],
  },
};

const VISUAL_INTERFERENCE_FINDING: AnalysisFinding = {
  id: 'EXT_VISUAL_INTERFERENCE_1',
  ruleId: 'EXT_VISUAL_INTERFERENCE',
  title: 'Visual interference in consent or checkout choices',
  category: ClauseCategory.CONFIRM_SHAMING,
  taxonomy: DarkPatternTaxonomy.VISUAL_INTERFERENCE,
  riskLevel: RiskLevel.MEDIUM,
  nature: FindingNature.INFERRED_RISK,
  confidence: ConfidenceLevel.MEDIUM,
  explanation:
    'Computed-style comparison shows the decline option ("No thanks, continue without protection") uses 11px low-contrast text (opacity 0.52) next to a prominent 15px high-contrast primary accept button.',
  evidenceQuote:
    'Primary button "Accept All & Start VIP Trial" (15px, #1D4ED8) paired with de-emphasized opt-out "No thanks, continue without protection" (11px, opacity 0.52).',
  sectionLocation: 'Checkout Action Bar (Computed Style Inspection)',
  whyItMatters:
    'Asymmetric visual weighting steers customers toward paid upgrades or tracking consent by making the opt-out option harder to see.',
  whatRemainsUnclear:
    'Whether clicking the low-contrast link immediately declines all optional add-ons without further retention modals.',
  whatToCheck:
    'Review the smaller secondary link carefully if you want to continue without adding the subscription.',
  limitations:
    'Style asymmetry is treated as an indicator for review rather than conclusive proof of manipulation.',
  source: DetectionSource.COMPUTED_STYLE,
  originalSourceReference: 'Checkout Action Bar · Computed Style Inspection',
};

export const ChromeExtensionSection: React.FC = () => {
  const [activeScenarioId, setActiveScenarioId] =
    useState<ScenarioConfig['id']>('subscription');
  const [dynamicBannerInjected, setDynamicBannerInjected] = useState(false);
  const [addonPrechecked, setAddonPrechecked] = useState(true);
  const [isPausedOnSite, setIsPausedOnSite] = useState(false);
  const [highlightsEnabled, setHighlightsEnabled] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [popupFilter, setPopupFilter] = useState<'ALL' | 'CLAUSES' | 'PATTERNS'>('ALL');
  const [focusedQuoteSnippet, setFocusedQuoteSnippet] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(1);
  const [lastScannedAt, setLastScannedAt] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const currentScenario = SCENARIOS[activeScenarioId];

  // Build active DOM blocks for the current scenario
  const activeDomBlocks: SimulatedDomBlock[] = [
    ...currentScenario.blocks.filter((b) => {
      if (b.interactiveAddon && !addonPrechecked) return false;
      return true;
    }),
    ...(dynamicBannerInjected && activeScenarioId !== 'clean'
      ? [
          {
            id: 'dom_node_dynamic_retention',
            heading:
              'Dynamic Retention Offer Modal (Captured via Throttled MutationObserver)',
            text: 'Should you cancel after 14 days, you will be charged 50% of your remaining contract obligation as a non-refundable early termination fee of 50%.',
          },
        ]
      : []),
  ];

  const combinedSandboxText = activeDomBlocks
    .map((b) => `${b.heading}\n${b.text}`)
    .join('\n\n');

  const rawRuleFindings = scanTextWithRules(combinedSandboxText, currentScenario.url);
  const allSandboxFindings: AnalysisFinding[] = [
    ...rawRuleFindings,
    ...(currentScenario.hasVisualInterference ? [VISUAL_INTERFERENCE_FINDING] : []),
  ];

  const undismissedFindings = isPausedOnSite
    ? []
    : allSandboxFindings.filter((f) => !dismissedIds.includes(f.id));

  const filteredPopupFindings = undismissedFindings.filter((f) => {
    if (popupFilter === 'CLAUSES') {
      return f.nature === FindingNature.DETECTED_CLAUSE;
    }
    if (popupFilter === 'PATTERNS') {
      return f.nature === FindingNature.INFERRED_RISK;
    }
    return true;
  });

  const knownService = lookupKnownService(currentScenario.domainForLookup);

  const handleSelectScenario = (id: ScenarioConfig['id']) => {
    setActiveScenarioId(id);
    setDynamicBannerInjected(false);
    setAddonPrechecked(true);
    setDismissedIds([]);
    setFocusedQuoteSnippet(null);
    setPopupFilter('ALL');
    setScanCount(1);
    setLastScannedAt(
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  };

  const handleRescanSandbox = () => {
    setDismissedIds([]);
    setFocusedQuoteSnippet(null);
    setScanCount((c) => c + 1);
    setLastScannedAt(
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  };

  const handleInjectDynamicMutation = () => {
    if (dynamicBannerInjected || activeScenarioId === 'clean') return;
    setDynamicBannerInjected(true);
    setScanCount((c) => c + 1);
    setLastScannedAt(
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  };

  const handleDownloadExtensionBundle = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch('/api/extension/files');
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.files)) return;

      const bundleJson = JSON.stringify(
        {
          product: 'OpenShield Manifest V3 Browser Extension',
          version: '1.1.0',
          compatibleBrowsers: ['Google Chrome', 'Brave', 'Microsoft Edge', 'Chromium'],
          instructions: [
            '1. Save each file in this package into an /extension folder on your computer.',
            '2. Open chrome://extensions (or brave://extensions / edge://extensions).',
            '3. Enable Developer mode in the top-right corner.',
            '4. Click Load unpacked and select your /extension folder.',
          ],
          files: data.files,
        },
        null,
        2
      );

      const blob = new Blob([bundleJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'openshield-browser-extension-mv3.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section
      id="browser-extension"
      className="py-16 md:py-24 bg-[#F8FAFC]"
    >
      <div id="chrome-extension" className="max-w-[1160px] mx-auto px-6">
        {/* Section Heading */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mb-2">
              <span className="font-semibold text-blue-700">
                02. Live Browser Protection &amp; Checkout Trap Detector (Manifest V3)
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-emerald-800">
                Privacy-First: All scanning happens locally in the browser
              </span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Real-time protection while you browse and check out.
            </h2>
            <p className="text-base text-slate-600 mt-2 leading-relaxed">
              The OpenShield browser extension scans visible page text, advertised-vs-checkout price discrepancies, resetting countdown timers, dynamic checkout modals, and button contrast asymmetries locally in Chrome, Brave, and Edge.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadExtensionBundle}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>
                {isDownloading ? 'Preparing Package…' : 'Download Browser Extension'}
              </span>
            </button>
          </div>
        </div>

        {/* Scenario Switcher Toolbar for the Live Browser Extension Simulator */}
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-900 block">
              Interactive Browser Extension &amp; Checkout Trap Simulator
            </span>
            <span className="text-xs text-slate-500">
              Switch between simulated websites below to see how the OpenShield extension popup and page highlighter respond in real time:
            </span>
          </div>

          <div
            role="group"
            aria-label="Select simulated webpage scenario"
            className="inline-flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0"
          >
            {(['subscription', 'flashcart', 'streambharat', 'clean'] as const).map(
              (scenKey) => {
                const scen = SCENARIOS[scenKey];
                const isSelected = activeScenarioId === scenKey;
                return (
                  <button
                    key={scenKey}
                    type="button"
                    data-testid={`ext-scenario-${scenKey}`}
                    onClick={() => handleSelectScenario(scenKey)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {scen.label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Interactive Live Browser Extension Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column (7 cols): Simulated Live Webpage Being Inspected */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl flex flex-col justify-between overflow-hidden">
            <div>
              {/* Simulated Browser Address Bar */}
              <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-700 font-mono truncate">
                  <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                  <span className="truncate">{currentScenario.url}</span>
                </div>

                {activeScenarioId !== 'clean' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleInjectDynamicMutation}
                      disabled={dynamicBannerInjected || isPausedOnSite}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50 border border-slate-300 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {dynamicBannerInjected
                          ? 'Dynamic Modal Active'
                          : 'Trigger Dynamic Modal'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Simulated Webpage Body */}
              <div className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs text-slate-500">
                      {currentScenario.pageSubtitle}
                    </span>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      {currentScenario.pageTitle}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums shrink-0">
                    DOM scans: {scanCount}
                  </span>
                </div>

                {/* Live Price Discrepancy & Countdown Observation Callout (when present) */}
                {!isPausedOnSite &&
                  (currentScenario.priceDiscrepancy ||
                    currentScenario.countdownObservation) && (
                    <div
                      data-testid="checkout-trap-telemetry"
                      className="p-3.5 bg-red-50/70 border border-red-200 rounded-lg text-xs text-slate-800 space-y-1.5"
                    >
                      {currentScenario.priceDiscrepancy && (
                        <div>
                          <strong className="text-red-800 font-semibold">
                            Checkout Price Discrepancy Detected:
                          </strong>{' '}
                          Advertised{' '}
                          <span className="font-mono font-semibold">
                            {currentScenario.priceDiscrepancy.advertisedPrice}
                          </span>{' '}
                          → Final Checkout{' '}
                          <span className="font-mono font-bold text-red-700">
                            {currentScenario.priceDiscrepancy.checkoutTotal}
                          </span>
                          . {currentScenario.priceDiscrepancy.explanation}
                        </div>
                      )}
                      {currentScenario.countdownObservation && (
                        <div className="flex items-start gap-1.5 text-amber-900">
                          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>Timer Inspection:</strong>{' '}
                            {currentScenario.countdownObservation}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                {activeDomBlocks.map((block) => {
                  const isSafeScenario = activeScenarioId === 'clean';
                  const isHighlighted =
                    !isSafeScenario && highlightsEnabled && !isPausedOnSite;
                  const isFocused =
                    focusedQuoteSnippet !== null &&
                    block.text
                      .toLowerCase()
                      .includes(focusedQuoteSnippet.toLowerCase().slice(0, 35));

                  return (
                    <div
                      key={block.id}
                      className={`p-4 rounded-lg transition-colors ${
                        isFocused
                          ? 'bg-amber-100/90 border-2 border-blue-700'
                          : isHighlighted
                          ? 'bg-amber-50/70 border border-dashed border-red-500'
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                        <span className="font-semibold text-slate-800">
                          {block.heading}
                        </span>
                        {isHighlighted && (
                          <span className="text-red-700 font-medium whitespace-nowrap">
                            Highlighted by Browser Extension
                          </span>
                        )}
                      </div>

                      {block.interactiveAddon && (
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addonPrechecked}
                            onChange={(e) => setAddonPrechecked(e.target.checked)}
                            className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                          />
                          <span>
                            {activeScenarioId === 'streambharat'
                              ? 'Add Priority Mentor Protection (₹199) — pre-checked by store'
                              : 'Add VIP Order Protection ($14.99) — pre-checked by store'}
                          </span>
                        </label>
                      )}

                      <p className="text-xs md:text-sm text-slate-800 leading-relaxed">
                        {block.text}
                      </p>
                    </div>
                  );
                })}

                {/* Simulated Option When User Unchecks the Preselected Add-on */}
                {(activeScenarioId === 'flashcart' ||
                  activeScenarioId === 'streambharat') &&
                  !addonPrechecked && (
                    <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                      <span>
                        You unchecked the pre-selected paid add-on. The extension updated its live warning count automatically.
                      </span>
                      <button
                        type="button"
                        onClick={() => setAddonPrechecked(true)}
                        className="font-semibold underline ml-3 whitespace-nowrap cursor-pointer"
                      >
                        Restore add-on
                      </button>
                    </div>
                  )}

                {/* Simulated Computed-Style Visual Interference Buttons */}
                {currentScenario.hasVisualInterference && (
                  <div
                    className={`p-4 rounded-lg transition-colors ${
                      focusedQuoteSnippet?.includes('Accept All')
                        ? 'bg-amber-100/90 border-2 border-blue-700'
                        : highlightsEnabled && !isPausedOnSite
                        ? 'bg-amber-50/50 border border-dashed border-amber-600'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                      <span className="font-semibold text-slate-800">
                        Consent &amp; Upgrade Action Pair (Computed-Style Check)
                      </span>
                      {highlightsEnabled && !isPausedOnSite && (
                        <span className="text-amber-800 font-medium">
                          Style Asymmetry Flagged
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <span className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold text-white bg-blue-700 rounded-lg select-none">
                        {activeScenarioId === 'streambharat'
                          ? 'Accept All & Start ₹999/mo AutoPay Trial'
                          : 'Accept All & Start VIP Trial ($29.99/mo)'}
                      </span>
                      <span
                        className="text-[11px] text-slate-500 opacity-55 underline select-none"
                        title="Low-contrast, smaller font size detected via getComputedStyle"
                      >
                        No thanks, continue without protection
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
              <span>
                Non-interference guarantee: The browser extension never clicks buttons, alters carts, or changes settings without your action.
              </span>
              <span className="font-mono text-slate-700 tabular-nums">
                Scanned {lastScannedAt}
              </span>
            </div>
          </div>

          {/* Right Column (5 cols): Live Interactive Browser Extension Popup UI */}
          <div
            data-testid="extension-popup-preview"
            className="lg:col-span-5 bg-white border border-slate-300 rounded-xl shadow-xs flex flex-col justify-between overflow-hidden"
          >
            <div>
              {/* Extension Popup Header */}
              <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isPausedOnSite ? (
                    <Shield className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  ) : undismissedFindings.length === 0 ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                  )}
                  <span className="font-display text-sm font-bold text-slate-900">
                    OpenShield Browser Extension
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-800 tabular-nums">
                    [{isPausedOnSite ? 'PAUSED' : undismissedFindings.length}]
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRescanSandbox}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Rescan page</span>
                </button>
              </div>

              {/* Visual Privacy-First Badge & Local Scanning Reassurance */}
              <div
                role="note"
                data-testid="popup-privacy-first-badge"
                className="px-5 py-2.5 bg-emerald-50/90 border-b border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-950"
              >
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-emerald-300 rounded-md font-semibold text-[11px] text-emerald-800 whitespace-nowrap shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span>Privacy-First</span>
                </span>
                <span className="text-[11.5px] font-medium text-emerald-900">
                  All analysis occurs locally on your machine.
                </span>
              </div>

              {/* Site Controls Bar */}
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsPausedOnSite((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  {isPausedOnSite ? (
                    <>
                      <PlayCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span>Resume protection on site</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-4 h-4 text-slate-500" aria-hidden="true" />
                      <span>Pause on this site</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setHighlightsEnabled((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  {highlightsEnabled ? (
                    <>
                      <Eye className="w-4 h-4 text-blue-700" aria-hidden="true" />
                      <span>Page highlights: On</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4 text-slate-400" aria-hidden="true" />
                      <span>Page highlights: Off</span>
                    </>
                  )}
                </button>
              </div>

              {/* Popup Category Filter Bar */}
              {!isPausedOnSite && undismissedFindings.length > 0 && (
                <div className="px-5 pt-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Filter warnings:
                  </span>
                  <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                    {(
                      [
                        { key: 'ALL', label: `All (${undismissedFindings.length})` },
                        {
                          key: 'CLAUSES',
                          label: `Clauses (${
                            undismissedFindings.filter(
                              (f) => f.nature === FindingNature.DETECTED_CLAUSE
                            ).length
                          })`,
                        },
                        {
                          key: 'PATTERNS',
                          label: `UI Patterns (${
                            undismissedFindings.filter(
                              (f) => f.nature === FindingNature.INFERRED_RISK
                            ).length
                          })`,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setPopupFilter(tab.key)}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                          popupFilter === tab.key
                            ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Known Service Rating Summary inside Popup */}
              {knownService && !isPausedOnSite && (
                <div className="mx-5 mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div className="font-semibold text-slate-900">
                    Known Service Rating: Grade {knownService.tosdrGrade || 'N/A'} · Cancellation:{' '}
                    <span className="uppercase text-red-700">
                      {knownService.cancellationDifficulty}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {knownService.cancellationSummary}
                  </p>
                </div>
              )}

              {/* Findings List inside Popup */}
              <div className="p-5 max-h-[340px] overflow-y-auto space-y-3">
                {isPausedOnSite ? (
                  <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-semibold text-slate-900">
                      Scanning is paused for this website
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      All page highlights and MutationObserver listeners are paused. Click "Resume protection on site" above to re-enable.
                    </p>
                  </div>
                ) : undismissedFindings.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-lg">
                    <CheckCircle2
                      className="w-6 h-6 text-emerald-600 mx-auto mb-1.5"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-semibold text-slate-900">
                      {activeScenarioId === 'clean'
                        ? 'No suspicious terms or dark patterns detected'
                        : 'All warnings dismissed on this page'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {activeScenarioId === 'clean'
                        ? 'OpenShield inspected visible text and button styles without matching any unfair renewal traps or pressure tactics.'
                        : 'Click "Rescan page" in the popup header to restore all warnings.'}
                    </p>
                  </div>
                ) : filteredPopupFindings.length === 0 ? (
                  <div className="p-5 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                    No warnings in this filter category. Select "All" above.
                  </div>
                ) : (
                  filteredPopupFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-display text-xs font-bold text-slate-900">
                          {finding.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setFocusedQuoteSnippet((prev) =>
                                prev === finding.evidenceQuote
                                  ? null
                                  : finding.evidenceQuote
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
                            title="Highlight this clause on the webpage"
                          >
                            <Crosshair className="w-3 h-3" aria-hidden="true" />
                            <span>Locate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDismissedIds((prev) => [...prev, finding.id])
                            }
                            aria-label={`Dismiss ${finding.title}`}
                            className="text-[11px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 mb-1.5">
                        <span className="font-semibold text-red-700">
                          {finding.riskLevel} Risk
                        </span>{' '}
                        · {finding.nature} · Confidence: {finding.confidence}
                      </div>
                      <p className="text-xs text-slate-700 mb-2">
                        {finding.explanation}
                      </p>
                      <blockquote className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                        “{finding.evidenceQuote}”
                      </blockquote>
                    </div>
                  ))
                )}
              </div>

              {/* Verified Policy & Cancellation Links inside Popup */}
              {currentScenario.verifiedLinks.length > 0 && !isPausedOnSite && (
                <div className="px-5 pb-4 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                    Verified Policy &amp; Cancellation Destinations:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentScenario.verifiedLinks.map((lnk) => (
                      <a
                        key={lnk.url}
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
                      >
                        <span>{lnk.label}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between gap-2">
              <span>
                <strong className="font-semibold text-slate-800">Privacy-First:</strong> All scanning happens locally in the browser
              </span>
              <span className="shrink-0">Manifest V3</span>
            </div>
          </div>
        </div>

        {/* Unpacked Browser Extension Installation Instructions */}
        <div className="mt-10 bg-white border border-slate-200 rounded-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                How to Install the OpenShield Browser Extension (Chrome, Brave &amp; Edge)
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Load the unpacked Manifest V3 extension directly from the{' '}
                <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                  /extension
                </code>{' '}
                folder in seconds.
              </p>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              Compatible with Chrome · Brave · Edge · Chromium
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div>
              <div className="font-mono text-xs font-bold text-blue-700 mb-1">
                01. Open Extensions Manager
              </div>
              <h4 className="font-display text-sm font-bold text-slate-900 mb-1">
                Open your browser’s extension settings
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Navigate to <code className="font-mono">chrome://extensions</code> (or{' '}
                <code className="font-mono">brave://extensions</code> /{' '}
                <code className="font-mono">edge://extensions</code>) and toggle on{' '}
                <strong>Developer mode</strong> in the top-right corner.
              </p>
            </div>

            <div>
              <div className="font-mono text-xs font-bold text-blue-700 mb-1">
                02. Load Unpacked Extension
              </div>
              <h4 className="font-display text-sm font-bold text-slate-900 mb-1">
                Select the /extension directory
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Click <strong>Load unpacked</strong> in the top-left bar and choose the{' '}
                <code className="font-mono">/extension</code> folder included in this project.
              </p>
            </div>

            <div>
              <div className="font-mono text-xs font-bold text-blue-700 mb-1">
                03. Browse Protected
              </div>
              <h4 className="font-display text-sm font-bold text-slate-900 mb-1">
                Pin OpenShield to your toolbar
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Click the OpenShield icon on any checkout, sign-up, or subscription page to review flagged terms, jump to verified cancellation pages, or pause scanning on specific sites.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
