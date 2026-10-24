/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Deterministic & Hybrid Analysis Engine
 * Extracts exact supporting sentences, section headings, page numbers, policy links,
 * hidden cost estimates, prioritized action plans, India consumer law references,
 * Hindi plain-language translations, and deduplicated findings without fabricating evidence.
 */

import { buildActionPlan } from '../calculators/action-plan';
import { extractHiddenCostEstimate } from '../calculators/cost-calculator';
import {
  HINDI_CLAUSE_TRANSLATIONS,
  INDIA_LEGAL_REFERENCES,
} from '../datasets/india-consumer-law';
import { lookupKnownService } from '../datasets/known-services';
import {
  AnalysisFinding,
  AnalysisReport,
  DetectionSource,
  DiscoveredPolicyLink,
  RiskCounts,
  RiskLevel,
} from '../schemas/analysis';
import { DETECTION_RULES } from './clause-rules';

export interface SentenceBlock {
  sentence: string;
  sectionHeading: string;
  pageNumber?: number;
}

/**
 * Splits a document or webpage text into clean sentences while tracking
 * the nearest preceding section heading and page number markers (e.g. "--- Page 2 ---" or "[Page 2]").
 */
export function extractSentenceBlocks(rawText: string): SentenceBlock[] {
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();

  if (!normalized) return [];

  const lines = normalized.split('\n');
  let currentHeading = 'General Document Body';
  let currentPage: number | undefined = undefined;
  const blocks: SentenceBlock[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect explicit page markers inserted by PDF extractor (e.g. "--- Page 1 ---" or "[Page 2]")
    const pageMatch = line.match(
      /^(?:---\s*Page\s+(\d+)\s*---|\[Page\s+(\d+)\]|Page\s+(\d+)\s+of\s+\d+)$/i
    );
    if (pageMatch) {
      currentPage = Number(pageMatch[1] || pageMatch[2] || pageMatch[3]);
      currentHeading = `Page ${currentPage}`;
      continue;
    }

    // Detect section headings (e.g., "1. Subscription Terms", "SECTION 8: ARBITRATION", "# Billing Policy")
    const isHeading =
      line.length <= 95 &&
      (/^(?:#{1,4}\s+|(?:section|article|clause|part)\s+\d+[:.\s-]*|\d+(?:\.\d+)?[.)]\s+)[A-Z]/i.test(
        line
      ) ||
        (/^[A-Z][A-Z0-9\s,&/-]{4,70}$/.test(line) && !/[.?!]$/.test(line)));

    if (isHeading) {
      const cleanHeading = line.replace(/^#{1,4}\s+/, '').trim();
      currentHeading = currentPage
        ? `Page ${currentPage} · ${cleanHeading}`
        : cleanHeading;
      continue;
    }

    // Split paragraph into individual sentences
    const sentences = line
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'(₹$€£])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 18);

    if (sentences.length === 0 && line.length >= 18) {
      blocks.push({
        sentence: line,
        sectionHeading: currentHeading,
        pageNumber: currentPage,
      });
    } else {
      for (const sentence of sentences) {
        blocks.push({
          sentence,
          sectionHeading: currentHeading,
          pageNumber: currentPage,
        });
      }
    }
  }

  return blocks;
}

/**
 * Runs the deterministic rule engine over extracted text blocks,
 * suppressing duplicate findings and requiring exact verbatim quotes.
 */
export function scanTextWithRules(
  rawText: string,
  sourceLabel?: string
): AnalysisFinding[] {
  const blocks = extractSentenceBlocks(rawText);
  const findings: AnalysisFinding[] = [];
  const seenRuleQuotes = new Set<string>();
  const countPerRule = new Map<string, number>();

  for (const block of blocks) {
    const { sentence, sectionHeading, pageNumber } = block;

    for (const rule of DETECTION_RULES) {
      const currentCount = countPerRule.get(rule.id) ?? 0;
      if (currentCount >= 2) continue;

      if (
        rule.negativePatterns &&
        rule.negativePatterns.some((neg) => neg.test(sentence))
      ) {
        continue;
      }

      const matched = rule.patterns.some((pattern) => pattern.test(sentence));
      if (!matched) continue;

      const normalizedQuoteKey = `${rule.id}::${sentence.toLowerCase().slice(0, 120)}`;
      if (seenRuleQuotes.has(normalizedQuoteKey)) continue;

      seenRuleQuotes.add(normalizedQuoteKey);
      countPerRule.set(rule.id, currentCount + 1);

      const cleanQuote =
        sentence.length > 360 ? `${sentence.slice(0, 357).trim()}...` : sentence;

      const originalSourceReference = [
        sourceLabel || 'Submitted Source Document',
        pageNumber ? `Page ${pageNumber}` : null,
        sectionHeading,
      ]
        .filter(Boolean)
        .join(' · ');

      const hi = HINDI_CLAUSE_TRANSLATIONS[rule.category];

      findings.push({
        id: `${rule.id}_${findings.length + 1}`,
        ruleId: rule.id,
        title: rule.title,
        titleHi: hi?.titleHi,
        category: rule.category,
        taxonomy: rule.taxonomy,
        riskLevel: rule.riskLevel,
        nature: rule.nature,
        explanation: rule.explanation,
        explanationHi: hi?.explanationHi,
        evidenceQuote: cleanQuote,
        sectionLocation: sectionHeading,
        pageNumber,
        whyItMatters: rule.whyItMatters,
        whyItMattersHi: hi?.whyItMattersHi,
        whatRemainsUnclear: rule.whatRemainsUnclear,
        whatRemainsUnclearHi: hi?.whatRemainsUnclearHi,
        whatToCheck: rule.whatToCheck,
        whatToCheckHi: hi?.whatToCheckHi,
        confidence: rule.confidence,
        limitations: rule.limitations,
        source: DetectionSource.RULE_ENGINE,
        originalSourceReference,
        indiaLegalContext: INDIA_LEGAL_REFERENCES[rule.category],
      });
    }
  }

  const weight: Record<RiskLevel, number> = {
    [RiskLevel.CRITICAL]: 4,
    [RiskLevel.HIGH]: 3,
    [RiskLevel.MEDIUM]: 2,
    [RiskLevel.LOW]: 1,
  };

  return findings.sort((a, b) => weight[b.riskLevel] - weight[a.riskLevel]);
}

export function calculateRiskCounts(findings: AnalysisFinding[]): RiskCounts {
  const counts: RiskCounts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    total: findings.length,
  };

  for (const f of findings) {
    counts[f.riskLevel] = (counts[f.riskLevel] || 0) + 1;
  }
  return counts;
}

export function summarizeOverallRisk(counts: RiskCounts): {
  overallRiskLevel: RiskLevel | 'Minimal';
  overallSummary: string;
  overallSummaryHi: string;
} {
  if (counts.total === 0) {
    return {
      overallRiskLevel: 'Minimal',
      overallSummary:
        'The scan found no matching concerns among the inspected clauses. This does not guarantee that the document is free of legal risk—always verify billing cadence, renewal dates, and cancellation procedures before agreeing.',
      overallSummaryHi:
        'जांचे गए खंडों (clauses) में कोई प्रमुख जोखिम नहीं मिला। इसका यह अर्थ नहीं है कि दस्तावेज़ पूरी तरह जोखिम-मुक्त है—सहमति देने से पहले हमेशा बिलिंग चक्र, नवीनीकरण (renewal) तिथि और रद्दीकरण (cancellation) प्रक्रिया की जांच करें।',
    };
  }

  if (counts.Critical > 0) {
    return {
      overallRiskLevel: RiskLevel.CRITICAL,
      overallSummary: `Detected ${counts.total} notable provision${counts.total === 1 ? '' : 's'}, including ${counts.Critical} critical provision${counts.Critical === 1 ? '' : 's'} requiring particularly careful review (such as binding arbitration, class-action waivers, or penalty clauses) and ${counts.High} high-risk billing or data terms.`,
      overallSummaryHi: `कुल ${counts.total} महत्वपूर्ण प्रावधान मिले हैं, जिनमें ${counts.Critical} गंभीर (Critical) प्रावधान (जैसे बाध्यकारी मध्यस्थता या दंड शुल्क) और ${counts.High} उच्च-जोखिम (High-Risk) बिलिंग या डेटा शर्तें शामिल हैं। भुगतान या सहमति से पहले इनकी सावधानीपूर्वक जांच करें।`,
    };
  }

  if (counts.High > 0) {
    return {
      overallRiskLevel: RiskLevel.HIGH,
      overallSummary: `Identified ${counts.total} finding${counts.total === 1 ? '' : 's'}, including ${counts.High} high-impact billing, renewal, cancellation, or data-sharing provision${counts.High === 1 ? '' : 's'}. Check renewal deadlines and refund conditions carefully.`,
      overallSummaryHi: `कुल ${counts.total} निष्कर्ष मिले हैं, जिनमें ${counts.High} उच्च-प्रभाव वाले बिलिंग, ऑटो-रिन्यूअल, रद्दीकरण या डेटा-साझाकरण प्रावधान शामिल हैं। नवीनीकरण की समय-सीमा और रिफंड शर्तों को ध्यान से पढ़ें।`,
    };
  }

  if (counts.Medium > 0) {
    return {
      overallRiskLevel: RiskLevel.MEDIUM,
      overallSummary: `Found ${counts.total} moderate-risk provision${counts.total === 1 ? '' : 's'} worth reviewing before agreeing. Inspect the highlighted quotes for licensing scope, unilateral modification rights, or liability caps.`,
      overallSummaryHi: `सहमति देने से पहले समीक्षा करने योग्य ${counts.total} मध्यम-जोखिम (Medium-Risk) प्रावधान मिले हैं। लाइसेंसिंग अधिकार, एकतरफा शर्त बदलाव और दायित्व सीमाओं के लिए उद्धरणों (quotes) की जांच करें।`,
    };
  }

  return {
    overallRiskLevel: RiskLevel.LOW,
    overallSummary: `Found ${counts.total} low-severity informational item${counts.total === 1 ? '' : 's'} with limited concern identified. Standard consumer precautions apply.`,
    overallSummaryHi: `सीमित चिंता वाले ${counts.total} सामान्य सूचनात्मक बिंदु मिले हैं। सामान्य उपभोक्ता सावधानियां लागू होती हैं।`,
  };
}

/**
 * Extracts relevant policy, subscription, refund, and cancellation links from HTML.
 */
export function extractPolicyLinksFromHtml(
  html: string,
  baseUrl?: string
): DiscoveredPolicyLink[] {
  const links: DiscoveredPolicyLink[] = [];
  const seenUrls = new Set<string>();
  const anchorRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let baseHostname = '';
  try {
    if (baseUrl) baseHostname = new URL(baseUrl).hostname.replace(/^www\./, '');
  } catch {
    baseHostname = '';
  }

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    const rawText = match[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!rawHref || !rawText || rawText.length > 80) continue;
    if (/^(?:javascript:|mailto:|tel:)/i.test(rawHref)) continue;

    let resolvedUrl = rawHref;
    let sameDomain = false;
    try {
      if (baseUrl) {
        const u = new URL(rawHref, baseUrl);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
        resolvedUrl = u.toString();
        const targetHost = u.hostname.replace(/^www\./, '');
        sameDomain = Boolean(
          baseHostname &&
            (targetHost === baseHostname ||
              targetHost.endsWith(`.${baseHostname}`))
        );
      }
    } catch {
      continue;
    }

    if (seenUrls.has(resolvedUrl)) continue;

    const combined = `${rawText} ${rawHref}`.toLowerCase();
    let type: DiscoveredPolicyLink['type'] | null = null;

    if (
      /\b(?:cancel|unsubscribe|termination|delete[-_\s]?account)\b/.test(
        combined
      )
    ) {
      type = 'cancellation';
    } else if (
      /\b(?:refund|return[-_\s]?policy|money[-_\s]?back)\b/.test(combined)
    ) {
      type = 'refunds';
    } else if (
      /\b(?:subscription|billing[-_\s]?terms|auto[-_\s]?renew|pricing[-_\s]?terms)\b/.test(
        combined
      )
    ) {
      type = 'subscription';
    } else if (
      /\b(?:privacy[-_\s]?policy|privacy[-_\s]?notice|data[-_\s]?protection|do[-_\s]?not[-_\s]?sell)\b/.test(
        combined
      )
    ) {
      type = 'privacy';
    } else if (
      /\b(?:terms[-_\s]?of[-_\s]?(?:service|use|sale)|terms[-_\s]?and[-_\s]?conditions|user[-_\s]?agreement|legal)\b/.test(
        combined
      )
    ) {
      type = 'terms';
    }

    if (type) {
      seenUrls.add(resolvedUrl);
      links.push({
        label: rawText,
        url: resolvedUrl,
        type,
        verifiedSameDomain: sameDomain,
      });
    }
    if (links.length >= 10) break;
  }

  return links;
}

/**
 * Builds a complete, validated AnalysisReport from text and optional metadata.
 */
export function buildRuleBasedReport(params: {
  text: string;
  title?: string;
  targetUrl?: string;
  documentType?: AnalysisReport['documentType'];
  fileName?: string;
  pageCount?: number;
  promptInjectionDetected?: boolean;
  scanStatus?: AnalysisReport['scanStatus'];
  discoveredLinks?: DiscoveredPolicyLink[];
  additionalFindings?: AnalysisFinding[];
  analysisMode?: AnalysisReport['analysisMode'];
  aiDisclosure?: string;
  localAiStatus?: AnalysisReport['localAiStatus'];
}): AnalysisReport {
  const blocks = extractSentenceBlocks(params.text);
  const sourceLabel =
    params.targetUrl || params.fileName || params.title || 'Submitted Document';
  const ruleFindings = scanTextWithRules(params.text, sourceLabel);
  const mergedFindings = [...ruleFindings];

  if (params.additionalFindings && params.additionalFindings.length > 0) {
    const existingQuotes = new Set(
      mergedFindings.map((f) => f.evidenceQuote.toLowerCase().slice(0, 80))
    );
    for (const extra of params.additionalFindings) {
      // Only include AI-extracted findings if the exact supporting quote actually exists in the source text
      const normalizedSource = params.text.replace(/\s+/g, ' ').toLowerCase();
      const normalizedQuote = extra.evidenceQuote
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      if (
        normalizedQuote.length >= 20 &&
        normalizedSource.includes(
          normalizedQuote.slice(0, Math.min(60, normalizedQuote.length))
        ) &&
        !existingQuotes.has(normalizedQuote.slice(0, 80))
      ) {
        existingQuotes.add(normalizedQuote.slice(0, 80));
        const hi = HINDI_CLAUSE_TRANSLATIONS[extra.category];
        mergedFindings.push({
          ...extra,
          titleHi: extra.titleHi || hi?.titleHi,
          explanationHi: extra.explanationHi || hi?.explanationHi,
          whyItMattersHi: extra.whyItMattersHi || hi?.whyItMattersHi,
          whatRemainsUnclear:
            extra.whatRemainsUnclear ||
            'Whether any local statutory consumer protections, account-tier exceptions, or separate checkout disclosures modify this clause.',
          whatRemainsUnclearHi:
            extra.whatRemainsUnclearHi || hi?.whatRemainsUnclearHi,
          whatToCheckHi: extra.whatToCheckHi || hi?.whatToCheckHi,
          originalSourceReference:
            extra.originalSourceReference ||
            `${sourceLabel} · ${extra.sectionLocation}`,
          indiaLegalContext:
            extra.indiaLegalContext || INDIA_LEGAL_REFERENCES[extra.category],
        });
      }
    }
  }

  const counts = calculateRiskCounts(mergedFindings);
  const { overallRiskLevel, overallSummary, overallSummaryHi } =
    summarizeOverallRisk(counts);
  const knownService = lookupKnownService(params.targetUrl);
  const discoveredLinks = params.discoveredLinks || [];
  const hiddenCostEstimate = extractHiddenCostEstimate(params.text);
  const actionPlan = buildActionPlan({
    findings: mergedFindings,
    knownService,
    discoveredLinks,
  });

  let domain: string | undefined;
  try {
    if (params.targetUrl) {
      domain = new URL(params.targetUrl).hostname.replace(/^www\./, '');
    }
  } catch {
    domain = undefined;
  }

  return {
    reportId: `os_${Date.now().toString(36)}`,
    targetUrl: params.targetUrl,
    domain,
    title:
      params.title ||
      params.fileName ||
      knownService?.name ||
      (domain ? `Policy Analysis — ${domain}` : 'Document & Terms Analysis'),
    documentType: params.documentType || (params.targetUrl ? 'url' : 'text'),
    fileName: params.fileName,
    pageCount: params.pageCount,
    clausesAnalyzedCount: Math.max(1, blocks.length),
    extractedText: params.text,
    promptInjectionDetected: params.promptInjectionDetected,
    scanStatus: params.scanStatus || 'completed',
    timestamp: new Date().toISOString(),
    analysisMode: params.analysisMode || 'rule_based_only',
    aiDisclosure:
      params.aiDisclosure ||
      'Analyzed using OpenShield deterministic open-source rule patterns. Every finding is matched directly against verbatim sentences in the retrieved document.',
    localAiStatus: params.localAiStatus,
    overallRiskLevel,
    overallSummary,
    overallSummaryHi,
    legalDisclaimer:
      'OpenShield provides automated informational screening indicators of contractual terms and interface patterns. Findings distinguish verbatim detected clauses from inferred risks and do not constitute formal legal advice or a definitive legal judgment.',
    counts,
    findings: mergedFindings,
    knownService,
    discoveredLinks,
    analyzedCharCount: params.text.length,
    hiddenCostEstimate,
    actionPlan,
  };
}
