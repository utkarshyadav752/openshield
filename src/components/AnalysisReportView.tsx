/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Structured Analysis Report Component
 * Includes:
 * - English / हिंदी (Hindi) Plain-Language Toggle (preserving verbatim quotes)
 * - Hidden Cost & Financial Exposure Calculator (1, 3, 6, 12, 24 months)
 * - OpenShield Action Plan ("What should you do next?") interactive checklist
 * - Side-by-Side Clause Translator ("Original clause", "In plain English", "Why it matters", "What remains unclear", "What to check")
 * - Verifiable India Consumer & Digital Law Context
 * - Interactive Jump-to-Extracted-Text viewer & local False-Positive Feedback loop
 */

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  Calculator,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Flag,
  Globe,
  HelpCircle,
  Info,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { ActionPlanItem } from '../../shared/calculators/action-plan';
import {
  calculatePeriodCostProjection,
  formatCurrencyAmount,
} from '../../shared/calculators/cost-calculator';
import {
  AnalysisFinding,
  AnalysisReport,
  FindingNature,
  RiskLevel,
} from '../../shared/schemas/analysis';
import { useFirebase } from '../context/FirebaseContext';
import { SpokenSection } from '../utils/ttsSpeechBuilder';
import { ListenToResultsPanel } from './ListenToResultsPanel';

interface AnalysisReportViewProps {
  report: AnalysisReport;
  isRescanning: boolean;
  onRescan: () => void;
  onAnalyzeAnother?: () => void;
  testId?: string;
}

const PERIOD_OPTIONS = [1, 3, 6, 12, 24] as const;

export const AnalysisReportView: React.FC<AnalysisReportViewProps> = ({
  report,
  isRescanning,
  onRescan,
  onAnalyzeAnother,
  testId = 'analysis-report',
}) => {
  const { user, signIn, saveReport } = useFirebase();
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [selectedPeriodMonths, setSelectedPeriodMonths] = useState<number>(12);
  const [completedActionIds, setCompletedActionIds] = useState<Record<string, boolean>>({});
  const [flaggedFalsePositives, setFlaggedFalsePositives] = useState<Record<string, boolean>>({});
  const [highlightedQuote, setHighlightedQuote] = useState<string | null>(null);
  const [showExtractedText, setShowExtractedText] = useState<boolean>(
    Boolean(report.documentType)
  );
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedActionPlan, setCopiedActionPlan] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [savedCloudId, setSavedCloudId] = useState<string | null>(null);
  const [saveCloudError, setSaveCloudError] = useState<string | null>(null);
  const [activeSpokenSection, setActiveSpokenSection] =
    useState<SpokenSection | null>(null);
  const extractedTextContainerRef = useRef<HTMLDivElement | null>(null);
  const highlightedSpanRef = useRef<HTMLElement | null>(null);

  const handleActiveSpokenSectionChange = React.useCallback(
    (section: SpokenSection | null) => {
      setActiveSpokenSection(section);
      if (section?.findingId && typeof document !== 'undefined') {
        const el = document.querySelector(
          `[data-testid="finding-card-${section.findingId}"]`
        );
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    },
    []
  );

  const handleSaveToFirebase = async () => {
    if (savedCloudId || isSavingCloud) return;
    setSaveCloudError(null);
    setIsSavingCloud(true);
    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await signIn();
      }
      if (!activeUser) {
        setIsSavingCloud(false);
        return;
      }
      const docId = await saveReport(report);
      setSavedCloudId(docId);
    } catch {
      setSaveCloudError('Unable to save report. Please verify your account has a verified email.');
    } finally {
      setIsSavingCloud(false);
    }
  };

  const toggleActionCompleted = (id: string) => {
    setCompletedActionIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleFalsePositiveFlag = (id: string) => {
    setFlaggedFalsePositives((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredFindings =
    selectedRiskFilter === 'ALL'
      ? report.findings
      : report.findings.filter((f) => f.riskLevel === selectedRiskFilter);

  const getRiskTextStyle = (level: RiskLevel | 'Minimal') => {
    switch (level) {
      case RiskLevel.CRITICAL:
        return 'text-red-700 font-semibold';
      case RiskLevel.HIGH:
        return 'text-red-600 font-semibold';
      case RiskLevel.MEDIUM:
        return 'text-amber-700 font-semibold';
      case RiskLevel.LOW:
        return 'text-blue-700 font-semibold';
      default:
        return 'text-emerald-700 font-semibold';
    }
  };

  const getPriorityStyle = (priority: ActionPlanItem['priority']) => {
    switch (priority) {
      case 'High Priority':
        return 'text-red-700 font-semibold';
      case 'Recommended':
        return 'text-amber-800 font-semibold';
      default:
        return 'text-blue-700 font-semibold';
    }
  };

  const handleJumpToExtractedText = (quote: string) => {
    setShowExtractedText(true);
    setHighlightedQuote(quote);
    setTimeout(() => {
      if (highlightedSpanRef.current) {
        highlightedSpanRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } else if (extractedTextContainerRef.current) {
        extractedTextContainerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }, 80);
  };

  const buildPlainTextSummary = (): string => {
    const lines: string[] = [
      `OPENSHIELD ANALYSIS REPORT — ${report.fileName || report.title}`,
      `Generated: ${new Date(report.timestamp).toLocaleString()}`,
      `Overall Screening Indicator: ${report.overallRiskLevel}`,
      ...(report.pageCount ? [`Pages Analyzed: ${report.pageCount}`] : []),
      ...(report.clausesAnalyzedCount
        ? [`Clauses Analyzed: ${report.clausesAnalyzedCount}`]
        : []),
      `Total Findings: ${report.counts.total} (Critical: ${report.counts.Critical}, High: ${report.counts.High}, Medium: ${report.counts.Medium}, Low: ${report.counts.Low})`,
      '',
      `Summary: ${language === 'hi' && report.overallSummaryHi ? report.overallSummaryHi : report.overallSummary}`,
      '',
    ];

    if (report.hiddenCostEstimate?.hasCalculableFinancials) {
      const est = report.hiddenCostEstimate;
      lines.push('HIDDEN COST ESTIMATE:');
      if (est.recurringAmount !== undefined && est.billingFrequency) {
        lines.push(
          `  Recurring Charge: ${formatCurrencyAmount(est.recurringAmount, est.currencySymbol, est.currencyCode)} (${est.billingFrequency})`
        );
      }
      if (est.estimatedAnnualCost !== undefined) {
        lines.push(
          `  Estimated 12-Month Commitment: ${formatCurrencyAmount(est.estimatedAnnualCost, est.currencySymbol, est.currencyCode)}`
        );
      }
      lines.push('');
    }

    if (report.actionPlan && report.actionPlan.length > 0) {
      lines.push('ACTION PLAN (WHAT SHOULD YOU DO NEXT?):');
      report.actionPlan.forEach((step, idx) => {
        const status = completedActionIds[step.id] ? '[COMPLETED]' : '[SUGGESTED]';
        lines.push(`${idx + 1}. ${status} [${step.priority}] ${step.title}: ${step.description}`);
      });
      lines.push('');
    }

    lines.push('FINDINGS:');
    if (report.findings.length === 0) {
      lines.push('No potentially unfair or restrictive clauses matched.');
    } else {
      report.findings.forEach((f, idx) => {
        lines.push(
          `${idx + 1}. [${f.riskLevel.toUpperCase()}] ${f.title} (${
            f.pageNumber ? `Page ${f.pageNumber} · ` : ''
          }${f.sectionLocation})`
        );
        lines.push(`   Original Clause Quote: "${f.evidenceQuote}"`);
        lines.push(`   In Plain English: ${f.explanation}`);
        lines.push(`   Why It Matters: ${f.whyItMatters}`);
        if (f.whatRemainsUnclear) {
          lines.push(`   What Remains Unclear: ${f.whatRemainsUnclear}`);
        }
        lines.push(`   What To Check: ${f.whatToCheck}`);
        lines.push(`   Confidence: ${f.confidence}`);
        lines.push('');
      });
    }

    lines.push(`Limitations & Disclaimer: ${report.legalDisclaimer}`);
    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    try {
      const text = buildPlainTextSummary();
      await navigator.clipboard.writeText(text);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    } catch {
      setCopiedReport(false);
    }
  };

  const handleCopyActionPlan = async () => {
    if (!report.actionPlan || report.actionPlan.length === 0) return;
    try {
      const text = report.actionPlan
        .map((item, idx) => {
          const done = completedActionIds[item.id] ? '[✓ Completed]' : '[ ] Suggested';
          const title = language === 'hi' && item.titleHi ? item.titleHi : item.title;
          const desc =
            language === 'hi' && item.descriptionHi
              ? item.descriptionHi
              : item.description;
          return `${idx + 1}. ${done} (${item.priority}) ${title} — ${desc}`;
        })
        .join('\n');
      await navigator.clipboard.writeText(text);
      setCopiedActionPlan(true);
      setTimeout(() => setCopiedActionPlan(false), 2500);
    } catch {
      setCopiedActionPlan(false);
    }
  };

  const handleDownloadReport = () => {
    const text = buildPlainTextSummary();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (report.fileName || report.title || 'openshield-report')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-|-$/g, '');
    a.href = url;
    a.download = `${safeName || 'openshield'}-analysis-report.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderHighlightedExtractedText = () => {
    const fullText = report.extractedText || '';
    if (!fullText) return null;

    if (!highlightedQuote) {
      return <span className="whitespace-pre-wrap">{fullText}</span>;
    }

    const idx = fullText.toLowerCase().indexOf(highlightedQuote.toLowerCase());
    if (idx === -1) {
      const snippet = highlightedQuote.slice(0, 45).toLowerCase();
      const fallbackIdx = snippet ? fullText.toLowerCase().indexOf(snippet) : -1;
      if (fallbackIdx === -1) {
        return <span className="whitespace-pre-wrap">{fullText}</span>;
      }
      const before = fullText.slice(0, fallbackIdx);
      const match = fullText.slice(fallbackIdx, fallbackIdx + highlightedQuote.length);
      const after = fullText.slice(fallbackIdx + highlightedQuote.length);
      return (
        <span className="whitespace-pre-wrap">
          {before}
          <mark
            ref={highlightedSpanRef}
            className="bg-amber-200 text-slate-950 font-semibold px-1 py-0.5 rounded border border-amber-400"
          >
            {match}
          </mark>
          {after}
        </span>
      );
    }

    const before = fullText.slice(0, idx);
    const match = fullText.slice(idx, idx + highlightedQuote.length);
    const after = fullText.slice(idx + highlightedQuote.length);

    return (
      <span className="whitespace-pre-wrap">
        {before}
        <mark
          ref={highlightedSpanRef}
          className="bg-amber-200 text-slate-950 font-semibold px-1 py-0.5 rounded border border-amber-400"
        >
          {match}
        </mark>
        {after}
      </span>
    );
  };

  const costEstimate = report.hiddenCostEstimate;
  const periodProjection = costEstimate?.hasCalculableFinancials
    ? calculatePeriodCostProjection(costEstimate, selectedPeriodMonths)
    : null;

  return (
    <div
      data-testid={testId}
      className="mt-8 bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-xs"
    >
      {/* Local AI (Ollama + gemma3:1b) Transparent Execution Status Banner (shown only when local AI inference succeeded) */}
      {report.localAiStatus?.status === 'succeeded' && (
        <div
          data-testid="report-local-ai-status"
          className="mb-6 p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-emerald-50/75 border-emerald-200 text-emerald-950"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2
              className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <strong className="font-semibold block">
                {`Local AI Inference Completed (${report.localAiStatus.model} via ${report.localAiStatus.baseUrl})`}
              </strong>
              <span className="opacity-90">
                {`Evaluated locally on your machine with ${report.localAiStatus.model} (${report.localAiStatus.aiFindingsCount} AI-extracted clause(s) verified against verbatim source text) plus OpenShield's 17 deterministic rules. Automated AI assessment is not legal advice.`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Injection Security Notice (when adversarial instructions were neutralized) */}
      {report.promptInjectionDetected && (
        <div
          role="alert"
          data-testid="prompt-injection-notice"
          className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-950"
        >
          <AlertTriangle
            className="w-4 h-4 text-amber-700 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold block text-amber-900">
              Adversarial Prompt-Injection Text Neutralized
            </strong>
            <span className="text-amber-800">
              This document contained embedded instructions attempting to override automated analysis (e.g., instructing the scanner to ignore clauses or mark the agreement as safe). OpenShield isolated those instructions as untrusted text and completed a full clause-by-clause inspection.
            </span>
          </div>
        </div>
      )}

      {/* 1. Document / Website Overview & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2 tabular-nums">
            <span>
              Status:{' '}
              <strong className="text-slate-700 font-medium">
                {report.documentType
                  ? `Document Analysis Completed (${report.documentType.toUpperCase()})`
                  : report.scanStatus === 'fallback_text'
                  ? 'Direct Text Analysis Completed'
                  : 'Live Page Analysis Completed'}
              </strong>
            </span>
            {report.pageCount !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Pages: <strong className="text-slate-700">{report.pageCount}</strong>
                </span>
              </>
            )}
            {report.clausesAnalyzedCount !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Clauses analyzed:{' '}
                  <strong className="text-slate-700">{report.clausesAnalyzedCount}</strong>
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{report.analyzedCharCount.toLocaleString()} characters inspected</span>
          </div>

          <h3 className="font-display text-xl md:text-2xl font-bold text-slate-900">
            {report.fileName || report.title}
          </h3>

          {report.targetUrl && (
            <p className="text-xs text-slate-500 mt-1 break-all">
              Source URL:{' '}
              <a
                href={report.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:underline inline-flex items-center gap-1"
              >
                {report.targetUrl}
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            </p>
          )}
        </div>

        {/* Report Actions: Language Toggle (English | हिंदी), Save to Account, Copy, Download, Analyze Another / Rescan */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* English / Hindi Language Toggle */}
          <div
            role="group"
            aria-label="Explanation language selector"
            className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-300 rounded-lg"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1 shrink-0" aria-hidden="true" />
            <button
              type="button"
              data-testid="lang-toggle-en"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                language === 'en'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              data-testid="lang-toggle-hi"
              onClick={() => setLanguage('hi')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                language === 'hi'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              हिंदी (Hindi)
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveToFirebase}
            disabled={isSavingCloud || Boolean(savedCloudId)}
            data-testid="save-report-cloud-btn"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-75 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {savedCloudId ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>Saved to account</span>
              </>
            ) : (
              <>
                <BookmarkPlus className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                <span>{isSavingCloud ? 'Saving…' : 'Save report'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedReport ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>Copied report</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>Copy report</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Download report</span>
          </button>

          <button
            type="button"
            data-testid="report-rescan-btn"
            onClick={onRescan}
            disabled={isRescanning}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[38px] text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRescanning ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isRescanning ? 'Rescanning…' : 'Rescan'}</span>
          </button>

          {onAnalyzeAnother && (
            <button
              type="button"
              onClick={onAnalyzeAnother}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Analyze another document</span>
            </button>
          )}
        </div>
      </div>

      {/* Audio "Listen to Results" Control Bar (Web Speech API) */}
      <ListenToResultsPanel
        report={report}
        language={language}
        onActiveSectionChange={handleActiveSpokenSectionChange}
      />

      {/* Hindi Language Integrity Banner */}
      {language === 'hi' && (
        <div
          data-testid="hindi-language-notice"
          className="mt-4 p-3 bg-blue-50/75 border border-blue-200 rounded-lg text-xs text-slate-800 flex items-center justify-between gap-2"
        >
          <span>
            <strong>हिंदी अनुवाद मोड सक्रिय (Hindi Mode Active):</strong> सभी स्पष्टीकरण, प्रभाव और कार्य-योजना सरल हिंदी में दिखाए जा रहे हैं। कानूनी सटीकता के लिए मूल दस्तावेज़ के उद्धरण (Original Clause Quotes) अपने मूल रूप में अपरिवर्तित रखे गए हैं।
          </span>
        </div>
      )}

      {/* 2. Overall Risk Summary & Honest Screening Labels */}
      {saveCloudError && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          {saveCloudError}
        </div>
      )}
      <div className="py-6 border-b border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 mb-2">
              {report.overallRiskLevel === 'Minimal' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
              )}
              <span className="text-sm font-semibold text-slate-900">
                {language === 'hi'
                  ? 'कुल जोखिम सारांश (Overall Risk Summary):'
                  : 'Overall Risk Summary:'}{' '}
                <span className={getRiskTextStyle(report.overallRiskLevel)}>
                  {report.overallRiskLevel}
                </span>
              </span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {language === 'hi' && report.overallSummaryHi
                ? report.overallSummaryHi
                : report.overallSummary}
            </p>
            <p className="text-xs text-slate-500 mt-3">
              <strong className="font-semibold text-slate-700">Important limitations:</strong>{' '}
              {report.legalDisclaimer}
            </p>
          </div>

          {/* 3. Risk Summary Breakdown with Screening Definitions */}
          <div className="lg:col-span-5 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5 tabular-nums">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-red-700">Critical:</span>{' '}
                <span className="text-slate-600">
                  {language === 'hi'
                    ? 'विशेष सावधानीपूर्वक समीक्षा आवश्यक'
                    : 'Requires particularly careful review'}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-red-700">
                {report.counts.Critical}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-red-600">High:</span>{' '}
                <span className="text-slate-600">
                  {language === 'hi'
                    ? 'संभावित रूप से महत्वपूर्ण उपभोक्ता जोखिम'
                    : 'Potentially significant consumer risk'}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-red-600">
                {report.counts.High}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-amber-700">Medium:</span>{' '}
                <span className="text-slate-600">
                  {language === 'hi'
                    ? 'सहमति देने से पहले जांचने योग्य'
                    : 'Worth reviewing before agreeing'}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-amber-700">
                {report.counts.Medium}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-blue-700">Low:</span>{' '}
                <span className="text-slate-600">
                  {language === 'hi' ? 'सीमित चिंता की पहचान' : 'Limited concern identified'}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-blue-700">
                {report.counts.Low}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Hidden Cost & Financial Exposure Calculator */}
      {costEstimate && (
        <div
          data-testid="hidden-cost-calculator"
          className="py-6 border-b border-slate-200"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
              <div>
                <h4 className="font-display text-base font-bold text-slate-900">
                  {language === 'hi'
                    ? 'छुपे हुए शुल्क और कुल लागत कैलकुलेटर (Hidden Cost Calculator)'
                    : 'Hidden Cost & Financial Commitment Calculator'}
                </h4>
                <p className="text-xs text-slate-500">
                  {language === 'hi'
                    ? 'केवल दस्तावेज़ में स्पष्ट रूप से उल्लिखित मूल्यों, ट्रायल शर्तों और अतिरिक्त शुल्कों पर आधारित।'
                    : 'Calculated strictly from explicit prices, trial conversions, and stated fees found in the source text.'}
                </p>
              </div>
            </div>

            {costEstimate.recurringAmount !== undefined && (
              <div
                role="group"
                aria-label="Select commitment period in months"
                className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
              >
                <span className="text-xs text-slate-500 px-2 font-medium">
                  {language === 'hi' ? 'अवधि:' : 'Period:'}
                </span>
                {PERIOD_OPTIONS.map((months) => (
                  <button
                    key={months}
                    type="button"
                    data-testid={`cost-period-${months}`}
                    onClick={() => setSelectedPeriodMonths(months)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer tabular-nums ${
                      selectedPeriodMonths === months
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {months}m
                  </button>
                ))}
              </div>
            )}
          </div>

          {!costEstimate.hasCalculableFinancials ? (
            <div
              data-testid="no-pricing-data-notice"
              className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600"
            >
              <strong className="text-slate-800">
                No explicit numeric prices detected in this excerpt:
              </strong>{' '}
              OpenShield never guesses or fabricates prices. Check the live checkout summary for current plan rates.
            </div>
          ) : (
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5 space-y-5">
              {/* Top Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">
                    {language === 'hi' ? 'प्रारंभिक भुगतान / ट्रायल' : 'Initial / Trial Entry'}
                  </div>
                  <div className="font-mono text-lg font-bold text-slate-900">
                    {costEstimate.trialDurationDays !== undefined
                      ? `${costEstimate.trialDurationDays}-day free trial`
                      : costEstimate.setupFeeAmount !== undefined
                      ? formatCurrencyAmount(
                          costEstimate.setupFeeAmount,
                          costEstimate.currencySymbol,
                          costEstimate.currencyCode
                        )
                      : 'Standard Billing'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {costEstimate.trialDurationDays !== undefined
                      ? 'Auto-converts unless cancelled early'
                      : 'Upfront payment + stated setup fees'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">
                    {language === 'hi' ? 'आवर्ती शुल्क (Recurring)' : 'Recurring Payment'}
                  </div>
                  <div className="font-mono text-lg font-bold text-slate-900">
                    {costEstimate.recurringAmount !== undefined
                      ? `${formatCurrencyAmount(
                          costEstimate.recurringAmount,
                          costEstimate.currencySymbol,
                          costEstimate.currencyCode
                        )} / ${
                          costEstimate.billingFrequency === 'monthly'
                            ? 'mo'
                            : costEstimate.billingFrequency === 'annual'
                            ? 'yr'
                            : costEstimate.billingFrequency || 'cycle'
                        }`
                      : 'One-time / Fee only'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 capitalize">
                    {costEstimate.billingFrequency
                      ? `Billed ${costEstimate.billingFrequency}`
                      : 'Check checkout summary for cycle'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <div className="text-xs font-semibold text-blue-700 mb-1">
                    {language === 'hi'
                      ? `${selectedPeriodMonths} महीने की अनुमानित लागत`
                      : `Projected ${selectedPeriodMonths}-Month Cost`}
                  </div>
                  <div
                    data-testid="projected-period-total"
                    className="font-mono text-xl font-bold text-blue-800"
                  >
                    {periodProjection
                      ? periodProjection.formattedTotalWithAddons
                      : 'Varies'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {periodProjection && periodProjection.preselectedAddonsIncluded > 0
                      ? `Base: ${periodProjection.formattedTotalWithoutAddons} + add-ons`
                      : `Over ${selectedPeriodMonths} month(s)`}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">
                    {language === 'hi'
                      ? 'अनुमानित वार्षिक प्रतिबद्धता (12m)'
                      : 'Estimated Annual Commitment (12m)'}
                  </div>
                  <div
                    data-testid="estimated-annual-cost"
                    className="font-mono text-lg font-bold text-slate-900"
                  >
                    {costEstimate.estimatedAnnualCost !== undefined
                      ? formatCurrencyAmount(
                          costEstimate.estimatedAnnualCost,
                          costEstimate.currencySymbol,
                          costEstimate.currencyCode
                        )
                      : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    12-month recurring base commitment
                  </div>
                </div>
              </div>

              {/* Stated Fees, Add-ons & Cancellation Conditions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-900 mb-2">
                    Stated Fees, Add-Ons &amp; Penalties ({costEstimate.statedFees.length})
                  </div>
                  {costEstimate.statedFees.length === 0 ? (
                    <p className="text-slate-500">
                      No separate setup fees, preselected add-ons, or percentage surcharges were explicitly stated in the text.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {costEstimate.statedFees.map((fee) => (
                        <li key={fee.id} className="text-slate-700">
                          <div className="flex items-center justify-between font-medium text-slate-900">
                            <span>{fee.label}</span>
                            <span className="font-mono">{fee.displayAmount}</span>
                          </div>
                          <p className="text-slate-500 italic mt-0.5 line-clamp-2">
                            “{fee.evidenceQuote}”
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="font-semibold text-slate-900">
                    Cancellation &amp; Refund Conditions + Assumptions
                  </div>
                  {costEstimate.cancellationConditions.map((cond, idx) => (
                    <p key={`c_${idx}`} className="text-slate-700">
                      <strong className="text-slate-900">Cancellation:</strong> {cond}
                    </p>
                  ))}
                  {costEstimate.refundLimitations.map((lim, idx) => (
                    <p key={`r_${idx}`} className="text-slate-700">
                      <strong className="text-slate-900">Refund policy:</strong> {lim}
                    </p>
                  ))}
                  <div className="pt-2 border-t border-slate-100 text-slate-500 space-y-1">
                    {costEstimate.calculationAssumptions.map((assump, idx) => (
                      <p key={`a_${idx}`}>• {assump}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. OpenShield Action Plan ("What should you do next?") */}
      {report.actionPlan && report.actionPlan.length > 0 && (
        <div
          data-testid="openshield-action-plan"
          className="py-6 border-b border-slate-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
              <div>
                <h4 className="font-display text-base font-bold text-slate-900">
                  {language === 'hi'
                    ? 'OpenShield कार्य योजना — आगे आपको क्या करना चाहिए?'
                    : 'OpenShield Action Plan — What should you do next?'}
                </h4>
                <p className="text-xs text-slate-500">
                  {language === 'hi'
                    ? 'पाए गए जोखिमों के आधार पर प्राथमिकता क्रम में व्यावहारिक कदम। पूरा होने पर चेकबॉक्स टिक करें।'
                    : 'Prioritized consumer checklist linked directly to detected clauses. Check off steps as you complete them.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyActionPlan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer self-start shrink-0"
            >
              {copiedActionPlan ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copied action plan</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>Copy action plan</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {report.actionPlan.map((step) => {
              const isCompleted = Boolean(completedActionIds[step.id]);
              const titleText =
                language === 'hi' && step.titleHi ? step.titleHi : step.title;
              const detailText =
                language === 'hi' && step.descriptionHi
                  ? step.descriptionHi
                  : step.description;

              return (
                <div
                  key={step.id}
                  data-testid={`action-plan-item-${step.id}`}
                  className={`p-4 rounded-lg border transition-colors ${
                    isCompleted
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-slate-50/75 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`chk-${step.id}`}
                      checked={isCompleted}
                      onChange={() => toggleActionCompleted(step.id)}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={getPriorityStyle(step.priority)}>
                            {language === 'hi' ? step.priorityHi : step.priority}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="text-slate-500 font-medium">
                            {isCompleted
                              ? language === 'hi'
                                ? 'आपके द्वारा पूर्ण चिह्नित (Completed by you)'
                                : 'Marked completed by you'
                              : language === 'hi'
                              ? 'सुझाया गया कदम (Suggested action)'
                              : 'Suggested action'}
                          </span>
                        </div>

                        {step.verifiedUrl && step.verifiedUrlLabel && (
                          <a
                            href={step.verifiedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                          >
                            <span>{step.verifiedUrlLabel}</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>

                      <label
                        htmlFor={`chk-${step.id}`}
                        className={`font-display text-sm font-bold block cursor-pointer ${
                          isCompleted ? 'line-through text-slate-500' : 'text-slate-900'
                        }`}
                      >
                        {titleText}
                      </label>
                      <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                        {detailText}
                      </p>

                      {step.supportingQuote && (
                        <p className="text-xs text-slate-500 italic mt-1.5 truncate">
                          Triggered by clause: “{step.supportingQuote}”
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Known Service Rating & Cancellation Difficulty (if recognized in dataset) */}
      {report.knownService && (
        <div className="py-5 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
            <h4 className="font-display text-sm font-bold text-slate-900">
              Known Service Reference: {report.knownService.name}
            </h4>
            <div className="text-xs text-slate-500 tabular-nums">
              <span>
                ToS;DR Class:{' '}
                <strong className="text-slate-800">
                  Grade {report.knownService.tosdrGrade || 'Unrated'}
                </strong>
              </span>
              <span aria-hidden="true"> · </span>
              <span>
                Cancellation Difficulty:{' '}
                <strong className="text-slate-800 uppercase">
                  {report.knownService.cancellationDifficulty}
                </strong>
              </span>
              <span aria-hidden="true"> · </span>
              <span>Last Verified: {report.knownService.lastVerified}</span>
            </div>
          </div>
          <p className="text-sm text-slate-700">
            {report.knownService.tosdrSummary} {report.knownService.cancellationSummary}
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
            <span>Source: {report.knownService.attribution}</span>
            <span aria-hidden="true">·</span>
            <span>Limitation: {report.knownService.limitations}</span>
            {report.knownService.verifiedCancellationUrl && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={report.knownService.verifiedCancellationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 font-semibold hover:underline inline-flex items-center gap-1"
                >
                  Verified Cancellation Page
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* 7. Filter Controls & Individual Clause Translator Finding Cards */}
      <div className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h4 className="font-display text-base font-bold text-slate-900 tabular-nums">
              {language === 'hi'
                ? `साक्ष्य-आधारित निष्कर्ष और क्लॉज़ ट्रांसलेटर (${filteredFindings.length})`
                : `Evidence-Backed Findings & Clause Translator (${filteredFindings.length})`}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Every finding pairs the verbatim original clause with a plain-language translation, consumer impact, what remains unclear, and India statutory context.
            </p>
          </div>

          {/* Interactive Filter Controls */}
          <div
            role="group"
            aria-label="Filter findings by risk level"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
          >
            {(['ALL', RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW] as const).map(
              (level) => {
                const count =
                  level === 'ALL'
                    ? report.counts.total
                    : report.counts[level];
                const active = selectedRiskFilter === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSelectedRiskFilter(level)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {level === 'ALL' ? `All (${count})` : `${level} (${count})`}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-900">
              {report.counts.total === 0
                ? 'No harsh, hidden, or unfair clauses matched in this document'
                : `No findings match the "${selectedRiskFilter}" filter`}
            </p>
            <p className="text-xs text-slate-600 mt-1 max-w-lg mx-auto">
              {report.counts.total === 0
                ? 'OpenShield only reports findings when supported by actual sentences in the provided document. Always check renewal dates and cancellation steps before agreeing.'
                : 'Select "All" above to view findings across other risk levels.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
            {filteredFindings.map((finding: AnalysisFinding) => {
              const isFlaggedFp = Boolean(flaggedFalsePositives[finding.id]);
              const displayTitle =
                language === 'hi' && finding.titleHi ? finding.titleHi : finding.title;
              const displayExplanation =
                language === 'hi' && finding.explanationHi
                  ? finding.explanationHi
                  : finding.explanation;
              const displayWhyItMatters =
                language === 'hi' && finding.whyItMattersHi
                  ? finding.whyItMattersHi
                  : finding.whyItMatters;
              const displayUnclear =
                language === 'hi' && finding.whatRemainsUnclearHi
                  ? finding.whatRemainsUnclearHi
                  : finding.whatRemainsUnclear ||
                    'Whether regional statutory consumer rights or account-tier exceptions override this clause.';
              const displayWhatToCheck =
                language === 'hi' && finding.whatToCheckHi
                  ? finding.whatToCheckHi
                  : finding.whatToCheck;

              const isBeingSpoken =
                activeSpokenSection?.findingId === finding.id;

              return (
                <article
                  key={finding.id}
                  data-testid={`finding-card-${finding.id}`}
                  data-spoken-active={isBeingSpoken ? 'true' : 'false'}
                  className={`py-6 first:pt-4 last:pb-4 transition-all ${
                    isFlaggedFp ? 'opacity-60' : ''
                  } ${
                    isBeingSpoken
                      ? 'bg-cyan-50/60 ring-2 ring-cyan-500 rounded-xl px-4 my-2'
                      : ''
                  }`}
                >
                  {/* Clean unboxed metadata header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={getRiskTextStyle(finding.riskLevel)}>
                        Risk: {finding.riskLevel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-slate-700">
                        {finding.nature === FindingNature.DETECTED_CLAUSE
                          ? 'Detected Clause'
                          : 'Inferred Risk'}
                      </span>
                      {finding.pageNumber !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-800">
                            Page {finding.pageNumber}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>Location: {finding.sectionLocation}</span>
                      <span aria-hidden="true">·</span>
                      <span>Confidence: {finding.confidence}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-400">ID: {finding.ruleId}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {report.extractedText && (
                        <button
                          type="button"
                          onClick={() => handleJumpToExtractedText(finding.evidenceQuote)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Jump to extracted text</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleFalsePositiveFlag(finding.id)}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer whitespace-nowrap shrink-0"
                        title="Flag or unflag this finding locally if you believe the clause is benign in context"
                      >
                        <Flag className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {isFlaggedFp
                            ? 'Marked as false positive (undo)'
                            : 'Flag false positive'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <h5 className="font-display text-base font-bold text-slate-900 mb-3">
                    {displayTitle}
                  </h5>

                  {/* Side-by-Side Clause Translator Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-3">
                    {/* Left: Original Verbatim Clause */}
                    <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 mb-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText
                              className="w-3.5 h-3.5 text-slate-500 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              {language === 'hi'
                                ? 'मूल दस्तावेज़ उद्धरण (Original Clause)'
                                : 'Original Clause (Verbatim Quote)'}
                            </span>
                          </span>
                        </div>
                        <blockquote className="text-sm text-slate-800 italic leading-relaxed">
                          “{finding.evidenceQuote}”
                        </blockquote>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                        Source reference:{' '}
                        {finding.originalSourceReference || finding.sectionLocation}
                      </div>
                    </div>

                    {/* Right: Plain Language Translation & Structured Breakdown */}
                    <div className="lg:col-span-7 bg-[#F8FAFC] border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
                      <div>
                        <span className="font-semibold text-slate-900 block text-xs uppercase tracking-wider text-blue-800 mb-0.5">
                          {language === 'hi'
                            ? 'सरल हिंदी में (In Plain Language)'
                            : 'In Plain English'}
                        </span>
                        <p className="text-slate-800 leading-relaxed">
                          {displayExplanation}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 text-xs">
                        <div>
                          <span className="font-semibold text-slate-900 block mb-0.5">
                            {language === 'hi'
                              ? 'यह क्यों महत्वपूर्ण है (Why it matters):'
                              : 'Why it matters:'}
                          </span>
                          <span className="text-slate-600 leading-relaxed">
                            {displayWhyItMatters}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-slate-900 block mb-0.5">
                            {language === 'hi'
                              ? 'आगे क्या जांचें (What to check):'
                              : 'What to check:'}
                          </span>
                          <span className="text-slate-600 leading-relaxed">
                            {displayWhatToCheck}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 text-xs flex items-start gap-1.5 text-slate-600">
                        <HelpCircle
                          className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <strong className="font-semibold text-slate-800">
                            {language === 'hi'
                              ? 'क्या अस्पष्ट है (What remains unclear): '
                              : 'What remains unclear: '}
                          </strong>
                          <span>{displayUnclear}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* India Consumer Protection & Regulatory Context (when available) */}
                  {finding.indiaLegalContext && (
                    <div className="mt-2.5 p-3 bg-slate-50/80 border border-slate-200 rounded-lg text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <Scale
                          className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <strong className="font-semibold text-slate-800">
                            India Consumer Law Reference ({finding.indiaLegalContext.statuteName}):
                          </strong>{' '}
                          <span>
                            {language === 'hi'
                              ? finding.indiaLegalContext.relevanceSummaryHi
                              : finding.indiaLegalContext.relevanceSummary}
                          </span>{' '}
                          <span className="text-slate-500">
                            ({finding.indiaLegalContext.uncertaintyNote})
                          </span>
                        </div>
                      </div>
                      <a
                        href={finding.indiaLegalContext.officialSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0"
                      >
                        <span>Official Reference</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 mt-2">
                    Analysis limitation: {finding.limitations}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* 8. Extracted Document Text Viewer (Interactive Jump Target) */}
      {report.extractedText && (
        <div
          ref={extractedTextContainerRef}
          className="mt-6 pt-6 border-t border-slate-200"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="font-display text-sm font-bold text-slate-900">
                Extracted Document Text
              </h4>
              <p className="text-xs text-slate-500">
                Click “Jump to extracted text” on any finding card above to highlight the exact clause in context.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowExtractedText((prev) => !prev)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {showExtractedText ? 'Hide extracted text' : 'Show extracted text'}
            </button>
          </div>

          {showExtractedText && (
            <div
              data-testid="extracted-text-viewer"
              className="max-h-72 overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800 leading-relaxed"
            >
              {renderHighlightedExtractedText()}
            </div>
          )}
        </div>
      )}

      {/* 9. Discovered Policy & Cancellation Links */}
      {report.discoveredLinks && report.discoveredLinks.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h4 className="font-display text-sm font-bold text-slate-900 mb-3">
            Detected Policy, Subscription &amp; Cancellation Links
          </h4>
          <div className="flex flex-wrap gap-3">
            {report.discoveredLinks.map((link, idx) => (
              <a
                key={`${link.url}_${idx}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <span>{link.label}</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="text-slate-500 capitalize">{link.type}</span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 10. Provenance & Privacy Disclosure Footer */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{report.aiDisclosure}</span>
      </div>
    </div>
  );
};
