/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Text-to-Speech (TTS) Speech Script Builder & Formatter
 *
 * Builds clean, natural-sounding spoken sections from an AnalysisReport for:
 * - 'summary' mode: Concise structured overview (Overall risk summary -> High/Critical findings ->
 *   Medium/Low overview -> Recommended actions -> Limitations & AI assessment disclaimer).
 * - 'full' mode: Complete section-by-section walkthrough in priority order with short verbatim excerpts,
 *   plain-English explanations, why it matters, recommended checks, action plan, and limitations.
 *
 * Never reads raw JSON, markdown symbols, UI labels, or decorative characters.
 */

import { formatCurrencyAmount } from '../../shared/calculators/cost-calculator';
import {
  AnalysisFinding,
  AnalysisReport,
  RiskLevel,
} from '../../shared/schemas/analysis';

export type ListeningMode = 'summary' | 'full';

export type SpokenSectionKind =
  | 'overview'
  | 'cost_summary'
  | 'finding'
  | 'action_plan'
  | 'limitations';

export interface SpokenSection {
  id: string;
  kind: SpokenSectionKind;
  label: string;
  text: string;
  findingId?: string;
  riskLevel?: RiskLevel;
}

const MAX_EXCERPT_CHARS = 180;
const MAX_UTTERANCE_CHARS = 260;

/**
 * Cleans text for natural speech synthesis by removing markdown, decorative bullets,
 * brackets, excessive punctuation, and raw code tokens.
 */
export function sanitizeForSpeech(input: string): string {
  if (!input) return '';
  return input
    .replace(/[`*_~#>|]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[“”"]/g, '')
    .replace(/[·•▪▸►]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncates long verbatim legal quotes to a concise, listenable excerpt.
 */
export function buildShortSpokenExcerpt(quote: string, maxChars = MAX_EXCERPT_CHARS): string {
  const cleaned = sanitizeForSpeech(quote);
  if (cleaned.length <= maxChars) {
    return cleaned;
  }
  const sliced = cleaned.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  const safeCut = lastSpace > maxChars * 0.6 ? sliced.slice(0, lastSpace) : sliced;
  return `${safeCut}...`;
}

const RISK_PRIORITY_WEIGHT: Record<RiskLevel, number> = {
  [RiskLevel.CRITICAL]: 0,
  [RiskLevel.HIGH]: 1,
  [RiskLevel.MEDIUM]: 2,
  [RiskLevel.LOW]: 3,
};

/**
 * Sorts findings so Critical and High-risk findings are spoken first,
 * followed by Medium and Low-risk findings.
 */
export function sortFindingsForSpeech(findings: AnalysisFinding[]): AnalysisFinding[] {
  return [...findings].sort((a, b) => {
    const diff = RISK_PRIORITY_WEIGHT[a.riskLevel] - RISK_PRIORITY_WEIGHT[b.riskLevel];
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Splits a long spoken section into smaller sentence chunks so browser speechSynthesis
 * engines never cut off mid-paragraph.
 */
export function splitIntoUtteranceChunks(
  text: string,
  maxChunkChars = MAX_UTTERANCE_CHARS
): string[] {
  const cleaned = sanitizeForSpeech(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxChunkChars) return [cleaned];

  const sentences = cleaned
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (!current) {
      if (sentence.length <= maxChunkChars) {
        current = sentence;
      } else {
        // Hard split on commas or words if a single sentence is very long
        const words = sentence.split(' ');
        let temp = '';
        for (const word of words) {
          if ((temp + ' ' + word).trim().length > maxChunkChars) {
            if (temp) chunks.push(temp.trim());
            temp = word;
          } else {
            temp = (temp + ' ' + word).trim();
          }
        }
        current = temp;
      }
    } else if ((current + ' ' + sentence).length <= maxChunkChars) {
      current = `${current} ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Builds the ordered list of spoken sections for an AnalysisReport.
 *
 * Logical order:
 * 1. Overall risk summary & counts
 * 2. Financial commitment summary (if calculable prices exist)
 * 3. High-risk / Critical findings first, then Medium and Low-risk findings
 *    (with short clause excerpt, plain-English explanation, and recommended check)
 * 4. Recommended user actions (Action Plan)
 * 5. Important limitations & AI-generated assessment reminder
 */
export function buildSpokenReportSections(
  report: AnalysisReport,
  mode: ListeningMode = 'summary',
  language: 'en' | 'hi' = 'en'
): SpokenSection[] {
  const sections: SpokenSection[] = [];
  const docTitle = sanitizeForSpeech(report.fileName || report.title || 'Analyzed Document');
  const sortedFindings = sortFindingsForSpeech(report.findings);
  const highPriorityFindings = sortedFindings.filter(
    (f) => f.riskLevel === RiskLevel.CRITICAL || f.riskLevel === RiskLevel.HIGH
  );
  const mediumLowFindings = sortedFindings.filter(
    (f) => f.riskLevel === RiskLevel.MEDIUM || f.riskLevel === RiskLevel.LOW
  );

  // 1. Overall Risk Summary
  const summaryText =
    language === 'hi' && report.overallSummaryHi
      ? sanitizeForSpeech(report.overallSummaryHi)
      : sanitizeForSpeech(report.overallSummary);

  const overviewSpeech =
    language === 'hi'
      ? `ओपनशील्ड विश्लेषण रिपोर्ट: ${docTitle}। कुल जोखिम स्तर: ${report.overallRiskLevel}। कुल ${report.counts.total} जोखिम बिंदु मिले हैं, जिनमें ${report.counts.Critical} गंभीर और ${report.counts.High} उच्च जोखिम शामिल हैं। ${summaryText}`
      : `OpenShield Analysis for ${docTitle}. Overall risk level is ${report.overallRiskLevel}, with ${report.counts.total} total findings: ${report.counts.Critical} critical, ${report.counts.High} high, ${report.counts.Medium} medium, and ${report.counts.Low} low risk. ${summaryText}`;

  sections.push({
    id: 'section-overview',
    kind: 'overview',
    label: language === 'hi' ? 'कुल जोखिम सारांश' : 'Overall Risk Summary',
    text: overviewSpeech,
  });

  // 2. Hidden Cost & Financial Exposure Summary (if present)
  if (report.hiddenCostEstimate?.hasCalculableFinancials) {
    const est = report.hiddenCostEstimate;
    const parts: string[] = [];
    if (est.recurringAmount !== undefined && est.billingFrequency) {
      const formatted = formatCurrencyAmount(
        est.recurringAmount,
        est.currencySymbol,
        est.currencyCode
      );
      parts.push(
        language === 'hi'
          ? `आवर्ती शुल्क ${formatted} प्रति ${est.billingFrequency} है।`
          : `Stated recurring charge is ${formatted} billed ${est.billingFrequency}.`
      );
    }
    if (est.estimatedAnnualCost !== undefined) {
      const annual = formatCurrencyAmount(
        est.estimatedAnnualCost,
        est.currencySymbol,
        est.currencyCode
      );
      parts.push(
        language === 'hi'
          ? `बारह महीने की अनुमानित लागत ${annual} है।`
          : `Estimated 12-month base commitment is ${annual}.`
      );
    }
    if (est.statedFees.length > 0) {
      const feeSummary = est.statedFees
        .slice(0, 2)
        .map((f) => `${sanitizeForSpeech(f.label)} (${sanitizeForSpeech(f.displayAmount)})`)
        .join(', ');
      parts.push(
        language === 'hi'
          ? `अतिरिक्त उल्लिखित शुल्क: ${feeSummary}।`
          : `Additional stated fees include ${feeSummary}.`
      );
    }

    if (parts.length > 0) {
      sections.push({
        id: 'section-cost',
        kind: 'cost_summary',
        label: language === 'hi' ? 'वित्तीय लागत अनुमान' : 'Financial Cost Estimate',
        text: parts.join(' '),
      });
    }
  }

  // 3. Findings (Ordered: Critical/High first, then Medium/Low)
  if (mode === 'summary') {
    // In summary mode: speak up to top 3 Critical/High findings individually,
    // and summarize remaining Medium/Low findings concisely so the summary stays focused.
    const topFindings =
      highPriorityFindings.length > 0
        ? highPriorityFindings.slice(0, 3)
        : sortedFindings.slice(0, 2);

    topFindings.forEach((finding, idx) => {
      const title =
        language === 'hi' && finding.titleHi
          ? sanitizeForSpeech(finding.titleHi)
          : sanitizeForSpeech(finding.title);
      const explanation =
        language === 'hi' && finding.explanationHi
          ? sanitizeForSpeech(finding.explanationHi)
          : sanitizeForSpeech(finding.explanation);
      const check =
        language === 'hi' && finding.whatToCheckHi
          ? sanitizeForSpeech(finding.whatToCheckHi)
          : sanitizeForSpeech(finding.whatToCheck);
      const excerpt = buildShortSpokenExcerpt(finding.evidenceQuote, 130);

      const findingSpeech =
        language === 'hi'
          ? `मुख्य निष्कर्ष ${idx + 1}, जोखिम स्तर ${finding.riskLevel}: ${title}। सरल शब्दों में: ${explanation}। दस्तावेज़ का अंश: ${excerpt}। क्या जांचें: ${check}`
          : `Key finding ${idx + 1}, ${finding.riskLevel} risk: ${title}. In plain English: ${explanation} Supporting clause excerpt: ${excerpt} Recommended check: ${check}`;

      sections.push({
        id: `section-finding-${finding.id}`,
        kind: 'finding',
        label: `${finding.riskLevel}: ${title}`,
        text: findingSpeech,
        findingId: finding.id,
        riskLevel: finding.riskLevel,
      });
    });

    if (mediumLowFindings.length > 0 && highPriorityFindings.length > 0) {
      const titles = mediumLowFindings
        .slice(0, 3)
        .map((f) =>
          language === 'hi' && f.titleHi
            ? sanitizeForSpeech(f.titleHi)
            : sanitizeForSpeech(f.title)
        )
        .join(', ');
      sections.push({
        id: 'section-medium-low-rollup',
        kind: 'finding',
        label:
          language === 'hi'
            ? `अन्य मध्यम और कम जोखिम (${mediumLowFindings.length})`
            : `Additional Medium & Low Findings (${mediumLowFindings.length})`,
        text:
          language === 'hi'
            ? `इसके अतिरिक्त ${mediumLowFindings.length} मध्यम या कम जोखिम वाले बिंदु मिले हैं, जिनमें ${titles} शामिल हैं। सभी विवरण सुनने के लिए फुल रिपोर्ट मोड चुनें।`
            : `There are also ${mediumLowFindings.length} medium or low risk findings, including ${titles}. Switch to Full Report mode to hear every clause in detail.`,
        findingId: mediumLowFindings[0]?.id,
        riskLevel: mediumLowFindings[0]?.riskLevel,
      });
    }
  } else {
    // Full Report mode: read every finding in priority order (Critical -> High -> Medium -> Low)
    sortedFindings.forEach((finding, idx) => {
      const title =
        language === 'hi' && finding.titleHi
          ? sanitizeForSpeech(finding.titleHi)
          : sanitizeForSpeech(finding.title);
      const explanation =
        language === 'hi' && finding.explanationHi
          ? sanitizeForSpeech(finding.explanationHi)
          : sanitizeForSpeech(finding.explanation);
      const whyItMatters =
        language === 'hi' && finding.whyItMattersHi
          ? sanitizeForSpeech(finding.whyItMattersHi)
          : sanitizeForSpeech(finding.whyItMatters);
      const check =
        language === 'hi' && finding.whatToCheckHi
          ? sanitizeForSpeech(finding.whatToCheckHi)
          : sanitizeForSpeech(finding.whatToCheck);
      const excerpt = buildShortSpokenExcerpt(finding.evidenceQuote, 180);

      const findingSpeech =
        language === 'hi'
          ? `निष्कर्ष ${idx + 1} कुल ${sortedFindings.length} में से। जोखिम स्तर ${finding.riskLevel}: ${title}। मूल क्लॉज़ का अंश: ${excerpt}। सरल हिंदी में अर्थ: ${explanation}। यह क्यों महत्वपूर्ण है: ${whyItMatters}। आगे क्या जांचें: ${check}`
          : `Finding ${idx + 1} of ${sortedFindings.length}. ${finding.riskLevel} risk: ${title}. Clause excerpt: ${excerpt} In plain English: ${explanation} Why it matters: ${whyItMatters} What to check: ${check}`;

      sections.push({
        id: `section-finding-${finding.id}`,
        kind: 'finding',
        label: `${idx + 1}. ${finding.riskLevel}: ${title}`,
        text: findingSpeech,
        findingId: finding.id,
        riskLevel: finding.riskLevel,
      });
    });
  }

  // 4. Recommended User Actions (Action Plan)
  if (report.actionPlan && report.actionPlan.length > 0) {
    const stepsToSpeak =
      mode === 'summary' ? report.actionPlan.slice(0, 3) : report.actionPlan;
    const stepSentences = stepsToSpeak.map((step, idx) => {
      const stTitle =
        language === 'hi' && step.titleHi
          ? sanitizeForSpeech(step.titleHi)
          : sanitizeForSpeech(step.title);
      const stDesc =
        language === 'hi' && step.descriptionHi
          ? sanitizeForSpeech(step.descriptionHi)
          : sanitizeForSpeech(step.description);
      return language === 'hi'
        ? `कदम ${idx + 1}: ${stTitle}। ${stDesc}`
        : `Step ${idx + 1}: ${stTitle}. ${stDesc}`;
    });

    sections.push({
      id: 'section-action-plan',
      kind: 'action_plan',
      label: language === 'hi' ? 'सुझाए गए कदम (Action Plan)' : 'Recommended Next Steps',
      text:
        language === 'hi'
          ? `आगे आपको क्या करना चाहिए: ${stepSentences.join(' ')}`
          : `Recommended next steps: ${stepSentences.join(' ')}`,
    });
  }

  // 5. Important Limitations & AI Assessment Reminder
  const disclaimerText =
    language === 'hi'
      ? 'महत्वपूर्ण सूचना और सीमाएं: यह परिणाम ओपनशील्ड का एक स्वचालित और एआई-सहायता प्राप्त उपभोक्ता जोखिम मूल्यांकन है, यह औपचारिक कानूनी सलाह नहीं है। किसी भी अनुबंध को स्वीकार करने से पहले मूल शर्तों और रद्दीकरण नियमों की स्वयं पुष्टि करें।'
      : `Important limitations and reminder: This output is an automated and AI-assisted consumer risk assessment from OpenShield, not formal legal advice. ${sanitizeForSpeech(
          report.legalDisclaimer
        )}`;

  sections.push({
    id: 'section-limitations',
    kind: 'limitations',
    label: language === 'hi' ? 'सीमाएं और अस्वीकरण' : 'Limitations & AI Assessment Notice',
    text: disclaimerText,
  });

  return sections;
}
