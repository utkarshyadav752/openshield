/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Hero & Feature 1 — URL and Policy Analyzer Section
 * Includes:
 * - Deep midnight-navy AI cybersecurity hero with responsive mobile-first layout
 * - Static-SVG-first -> Smooth 3D Shield visual centerpiece (`ShieldHeroVisual`)
 * - Instant URL & Policy Analyzer bar, honest error states, text fallback, and presets
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  FileText,
  Globe,
  Loader2,
  Lock,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import {
  SAMPLE_POLICY_PRESETS,
  SamplePolicyPreset,
} from '../../shared/datasets/sample-policies';
import { AnalysisReport } from '../../shared/schemas/analysis';
import { upgradeReportWithBrowserOllamaIfNeeded } from '../utils/ollamaBrowserBridge';
import { AnalysisReportView } from './AnalysisReportView';
import { LocalAiStatusBanner } from './LocalAiStatusBanner';
import { SavedReportsVault } from './SavedReportsVault';
import { ShieldHeroVisual } from './ShieldHeroVisual';

interface UrlAnalyzerSectionProps {
  urlInputRef: React.RefObject<HTMLInputElement | null>;
}

export const UrlAnalyzerSection: React.FC<UrlAnalyzerSectionProps> = ({
  urlInputRef,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);

  const executeAnalysis = async (payload: {
    url?: string;
    text?: string;
    title?: string;
    sampleId?: string;
  }) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setReport(null);
        setErrorMessage(
          data.errorMessage ||
            'Unable to retrieve this URL. You can paste the relevant terms text directly below.'
        );
        if (data.allowPasteFallback) {
          setShowTextFallback(true);
        }
        return;
      }

      const finalReport = await upgradeReportWithBrowserOllamaIfNeeded(
        data.report
      );
      setReport(finalReport);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('openshield:ollama-refresh'));
      }
    } catch {
      setReport(null);
      setErrorMessage(
        'Could not reach the analysis service. Please verify your connection or paste the policy text below.'
      );
      setShowTextFallback(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a website or policy URL to analyze.');
      return;
    }
    setActiveSampleId(null);

    const matchedPreset = SAMPLE_POLICY_PRESETS.find(
      (p) => p.url.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchedPreset) {
      setActiveSampleId(matchedPreset.id);
      executeAnalysis({ sampleId: matchedPreset.id });
      return;
    }

    executeAnalysis({ url: trimmed });
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = textInput.trim();
    if (trimmed.length < 30) {
      setErrorMessage(
        'Please paste at least one complete sentence or paragraph of terms text (minimum 30 characters).'
      );
      return;
    }
    setActiveSampleId(null);
    executeAnalysis({
      text: trimmed,
      title: customTitle.trim() || 'Pasted Policy Text Analysis',
      url: urlInput.trim() || undefined,
    });
  };

  const handleSelectPreset = (preset: SamplePolicyPreset) => {
    setUrlInput(preset.url);
    setActiveSampleId(preset.id);
    setShowTextFallback(false);
    executeAnalysis({ sampleId: preset.id });
  };

  const handleRescan = () => {
    if (activeSampleId) {
      executeAnalysis({ sampleId: activeSampleId });
    } else if (showTextFallback && textInput.trim().length >= 30) {
      executeAnalysis({
        text: textInput.trim(),
        title: customTitle.trim() || 'Pasted Policy Text Analysis',
        url: urlInput.trim() || undefined,
      });
    } else if (urlInput.trim()) {
      executeAnalysis({ url: urlInput.trim() });
    }
  };

  return (
    <section
      id="hero-and-analyzer"
      className="border-b border-slate-200 overflow-hidden"
    >
      {/* Premium Midnight-Navy AI Cybersecurity Hero & Analyze Section */}
      <div className="relative bg-[#060B18] text-white pt-6 pb-10 sm:pt-8 sm:pb-12 lg:pt-10 lg:pb-14 border-b border-slate-800/80">
        {/* Subtle Radial Cyan & Violet Ambient Lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-1/4 w-[480px] h-[480px] rounded-full bg-cyan-500/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/4 w-[420px] h-[420px] rounded-full bg-violet-600/10 blur-3xl"
        />

        <div className="relative max-w-[1160px] mx-auto px-4 sm:px-6">
          {/* Mobile-First Hero Split Grid (2 columns from 768px+ so preview panes stay compact) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Left Column (7 cols): Headline, Value Prop & Primary Actions */}
            <div className="md:col-span-7 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-semibold mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
                <span>01. AI-Powered Consumer Protection &amp; Dark Pattern Intelligence</span>
              </div>

              <h1
                className="font-display font-bold text-white tracking-tight mb-3"
                style={{
                  fontSize: 'clamp(1.85rem, 3.8vw, 3.1rem)',
                  lineHeight: 1.12,
                  textWrap: 'balance',
                }}
              >
                Understand the fine print{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400">
                  before you agree.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-5 max-w-2xl">
                Reveal potentially unfair clauses, hidden subscription renewal traps, and manipulative website patterns in plain English or Hindi—backed by verbatim evidence, financial exposure estimates, and spoken audio summaries.
              </p>

              {/* Mobile-First Primary CTA Row */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <button
                  type="button"
                  data-testid="hero-analyze-terms-cta"
                  onClick={() => {
                    const analyzeSection = document.getElementById('analyze-link');
                    if (analyzeSection) {
                      analyzeSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }
                    setTimeout(() => {
                      urlInputRef.current?.focus({ preventScroll: true });
                    }, 200);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  <span>Analyze Terms</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <a
                  href="#upload-document"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-slate-100 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
                >
                  <UploadCloud className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                  <span>Upload PDF or Image</span>
                </a>
              </div>

              {/* Key Trust & Verification Signals */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/90 max-w-lg text-xs">
                <div>
                  <div className="font-mono font-bold text-cyan-300 text-sm tabular-nums">
                    100% Verbatim
                  </div>
                  <div className="text-slate-400">Zero invented quotes</div>
                </div>
                <div>
                  <div className="font-mono font-bold text-cyan-300 text-sm tabular-nums">
                    17 Rules + AI
                  </div>
                  <div className="text-slate-400">Open-source rulebook</div>
                </div>
                <div>
                  <div className="font-mono font-bold text-cyan-300 text-sm tabular-nums">
                    Audio + Hindi
                  </div>
                  <div className="text-slate-400">Listen to results</div>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Static SVG First -> Smooth 3D Shield Visual */}
            <div className="md:col-span-5 flex items-center justify-center">
              <ShieldHeroVisual />
            </div>
          </div>

          {/* Dedicated Analyze Section Container: SavedReportsVault on Upper Side + Local AI Status + URL/Policy Analyzer Below */}
          <div
            id="analyze-link"
            className="mt-7 pt-6 border-t border-slate-800/90 scroll-mt-20 space-y-4"
          >
            {/* Upper Side of Analyze Section: Optional Private Cloud History & Saved Analysis Reports */}
            <SavedReportsVault variant="dark" id="saved-reports-vault" />

            {/* Local AI (Ollama + gemma3:1b) Connection Status & Troubleshooting */}
            <LocalAiStatusBanner variant="dark" testId="hero-local-ai-status" />

            {/* Lower Side of Analyze Section: Main URL & Policy Analyzer Input Card */}
            <div className="bg-[#0F172A] border border-slate-700/80 rounded-xl p-4 sm:p-6 shadow-xl">
            <form onSubmit={handleUrlSubmit} noValidate>
              <label
                htmlFor="main-policy-url-input"
                className="block text-xs font-semibold text-slate-200 mb-2"
              >
                Website, Terms of Service, Privacy Policy, or Subscription Page URL
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Globe
                    className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    ref={urlInputRef}
                    id="main-policy-url-input"
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste a website or policy URL (e.g., https://www.streambharat.in/terms)…"
                    className="w-full pl-10 pr-4 py-3 min-h-[44px] text-sm text-white bg-[#060B18] border border-slate-700 rounded-lg placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 disabled:opacity-60 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Analyzing…</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze website</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Privacy Reassurance & Mode Toggle */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
                <span>
                  Privacy-first architecture: Only the public URL or policy text you submit is inspected. SSRF and private-network requests are strictly blocked.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTextFallback((prev) => !prev)}
                className="text-cyan-300 font-semibold hover:underline text-left md:text-right whitespace-nowrap shrink-0 cursor-pointer min-h-[36px] inline-flex items-center"
              >
                {showTextFallback
                  ? 'Hide manual text input'
                  : 'Or paste policy text directly'}
              </button>
            </div>

            {/* Honest Error State */}
            {errorMessage && !isLoading && (
              <div
                role="alert"
                data-testid="analyzer-error"
                className="mt-5 p-4 bg-red-950/70 border border-red-500/50 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <h3 className="font-display text-sm font-bold text-white">
                      Unable to complete direct URL scan
                    </h3>
                    <p className="text-xs sm:text-sm text-red-200 mt-1 leading-relaxed">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Direct Policy Text Fallback Panel */}
            {showTextFallback && (
              <form
                onSubmit={handleTextSubmit}
                className="mt-5 pt-5 border-t border-slate-800"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label
                    htmlFor="policy-text-textarea"
                    className="text-xs font-semibold text-slate-200 flex items-center gap-1.5"
                  >
                    <FileText
                      className="w-3.5 h-3.5 text-cyan-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Paste Terms, Subscription, or Privacy Policy Text</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTitle('Sample Subscription & Arbitration Agreement');
                      setTextInput(
                        '1. Automatic Renewal: Your 7-day free trial automatically converts to a paid monthly subscription of $29.99 without further notice. Unless you notify us at least 30 days before the end of the current billing period, your subscription will automatically renew. All payments are final and non-refundable.\n2. Dispute Resolution: Any dispute shall be resolved exclusively through final and binding individual arbitration, and you waive any right to participate in a class action.'
                      );
                    }}
                    className="text-xs text-cyan-300 hover:underline font-medium cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Fill sample clauses
                  </button>
                </div>

                <div className="mb-3">
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Optional document title (e.g., Acme Cloud Subscription Terms)"
                    aria-label="Optional document title"
                    className="w-full px-3.5 py-2.5 min-h-[42px] text-xs text-white bg-[#060B18] border border-slate-700 rounded-lg placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <textarea
                  id="policy-text-textarea"
                  rows={5}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste paragraphs from a Terms of Service, Privacy Policy, Checkout page, or Cancellation policy here…"
                  className="w-full p-3.5 text-sm text-white bg-[#060B18] border border-slate-700 rounded-lg placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none leading-relaxed"
                />

                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2.5 min-h-[44px] text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Analyze policy text
                  </button>
                </div>
              </form>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container below Dark Hero */}
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-10 md:py-14">
        {/* Loading State */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="mb-8 bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs"
          >
            <Loader2
              className="w-7 h-7 text-blue-700 animate-spin mx-auto mb-3"
              aria-hidden="true"
            />
            <h3 className="font-display text-base font-bold text-slate-900">
              Retrieving and analyzing accessible policy terms…
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Validating destination safety, extracting visible clauses, checking known ToS;DR &amp; JustDeleteMe records, and verifying verbatim quotations.
            </p>
          </div>
        )}

        {/* Structured Report Output (Directly below Hero when a scan completes) */}
        {report && !isLoading && (
          <AnalysisReportView
            report={report}
            isRescanning={isLoading}
            onRescan={handleRescan}
          />
        )}

        {/* Quick-Inspect Real Policy Presets */}
        <div className={report ? 'mt-10' : ''}>
          <div className="text-xs font-semibold text-slate-600 mb-3">
            Or inspect a realistic consumer agreement preset to see how OpenShield extracts verbatim evidence, calculates hidden costs, and reads results aloud:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SAMPLE_POLICY_PRESETS.map((preset) => {
              const isSelected = activeSampleId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`sample-preset-${preset.id}`}
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-700 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs text-blue-700 font-semibold mb-1">
                      {preset.badge} · {preset.domain}
                    </div>
                    <div className="font-display text-sm font-bold text-slate-900 mb-1.5">
                      {preset.name}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-900 inline-flex items-center gap-1">
                    <span>Load &amp; analyze terms</span>
                    <ArrowRight
                      className="w-3.5 h-3.5 text-blue-700"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Overview of the 12 Detection Categories */}
        <div className="mt-14 pt-12 border-t border-slate-200">
          <div className="max-w-2xl mb-6">
            <h2 className="font-display text-lg md:text-xl font-bold text-slate-900">
              12 Consumer Risk Categories Inspected on Every Scan
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              OpenShield distinguishes verbatim contractual clauses from inferred interface manipulation patterns, requiring supporting quotes for every alert.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-sm text-slate-700">
            {[
              '01. Hidden fees and drip pricing',
              '02. Automatic subscription renewal',
              '03. Difficult cancellation and refund restrictions',
              '04. Forced arbitration clauses',
              '05. Class-action waivers',
              '06. Broad third-party data-sharing or selling',
              '07. Perpetual or broad content licenses',
              '08. Preselected paid add-ons',
              '09. Misleading countdown timers and scarcity',
              '10. Confirm-shaming and manipulative consent',
              '11. Unexpected trial-to-paid conversions',
              '12. Restrictive account-deletion procedures',
            ].map((item) => (
              <div
                key={item}
                className="py-2.5 border-b border-slate-200/80 font-medium text-slate-800"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
