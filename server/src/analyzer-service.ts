/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Backend Analyzer Service (100% Local Ollama + Deterministic Rules)
 * Performs SSRF-safe URL fetching, text normalization, local Ollama (gemma3:1b)
 * inference, and deterministic open-source rule evaluation.
 *
 * Zero External AI Policy:
 * - Does not use OpenAI, Gemini, Anthropic, Groq, or any paid/cloud AI API.
 * - Connects exclusively to the local Ollama runtime (http://localhost:11434, model gemma3:1b).
 * - Never pretends local AI succeeded when Ollama is offline or gemma3:1b is missing.
 */

import { SAMPLE_POLICY_PRESETS } from '../../shared/datasets/sample-policies';
import {
  buildRuleBasedReport,
  extractPolicyLinksFromHtml,
} from '../../shared/rules/engine';
import {
  AnalysisFinding,
  AnalysisReport,
  ClauseCategory,
  ConfidenceLevel,
  DarkPatternTaxonomy,
  DetectionSource,
  DiscoveredPolicyLink,
  FindingNature,
  LocalAiRuntimeReportStatus,
  RiskLevel,
} from '../../shared/schemas/analysis';
import {
  analyzeTextWithOllama,
  getOllamaConfig,
  OLLAMA_SETUP_COMMANDS,
} from './ollama-service';
import {
  extractVisibleTextFromHtml,
  fetchUrlSafely,
} from './url-security';

export interface AnalyzeRequestPayload {
  url?: string;
  text?: string;
  title?: string;
  sampleId?: string;
  requireLocalAi?: boolean;
}

export interface AnalyzeServiceResponse {
  ok: boolean;
  report?: AnalysisReport;
  errorCode?: string;
  errorMessage?: string;
  allowPasteFallback?: boolean;
  localAiStatus?: LocalAiRuntimeReportStatus;
}

/**
 * Normalizes custom aiGeneratorOverride results (used in unit tests) into AnalysisFinding[].
 */
async function extractFindingsFromOverride(
  text: string,
  aiGeneratorOverride: (text: string) => Promise<unknown>
): Promise<{
  findings: AnalysisFinding[];
  runtimeStatus: LocalAiRuntimeReportStatus;
}> {
  const config = getOllamaConfig();
  try {
    const raw = await aiGeneratorOverride(text);
    const parsedItems = Array.isArray(raw)
      ? raw
      : raw &&
        typeof raw === 'object' &&
        Array.isArray((raw as Record<string, unknown>).findings)
      ? ((raw as Record<string, unknown>).findings as unknown[])
      : [];

    const findings: AnalysisFinding[] = parsedItems
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item, idx) => ({
        id: `ollama_override_${idx + 1}`,
        ruleId: `OLLAMA_GEMMA3_${idx + 1}`,
        title: String(item.title || 'Unusual Contractual Provision'),
        category: Object.values(ClauseCategory).includes(item.category as ClauseCategory)
          ? (item.category as ClauseCategory)
          : ClauseCategory.UNILATERAL_CHANGES,
        taxonomy: DarkPatternTaxonomy.LEGAL_TERMS,
        riskLevel: Object.values(RiskLevel).includes(item.riskLevel as RiskLevel)
          ? (item.riskLevel as RiskLevel)
          : RiskLevel.MEDIUM,
        nature: FindingNature.DETECTED_CLAUSE,
        explanation: String(item.explanation || ''),
        evidenceQuote: String(item.evidenceQuote || ''),
        sectionLocation: String(item.sectionLocation || 'Extracted Policy Text'),
        whyItMatters: String(item.whyItMatters || ''),
        whatToCheck: String(item.whatToCheck || ''),
        confidence: ConfidenceLevel.MEDIUM,
        limitations:
          'Extracted via local AI analysis and verified against source text.',
        source: DetectionSource.HYBRID_AI,
      }));

    return {
      findings,
      runtimeStatus: {
        provider: 'ollama',
        model: config.model,
        baseUrl: config.baseUrl,
        status: 'succeeded',
        aiFindingsCount: findings.length,
      },
    };
  } catch (err: unknown) {
    return {
      findings: [],
      runtimeStatus: {
        provider: 'ollama',
        model: config.model,
        baseUrl: config.baseUrl,
        status: 'ollama_offline',
        aiFindingsCount: 0,
        errorMessage:
          err instanceof Error
            ? err.message
            : `Local Ollama (${config.model}) inference failed.`,
        troubleshootingCommand: OLLAMA_SETUP_COMMANDS.runModel,
      },
    };
  }
}

export async function runHybridAnalysis(params: {
  text: string;
  title?: string;
  targetUrl?: string;
  scanStatus?: AnalysisReport['scanStatus'];
  discoveredLinks?: DiscoveredPolicyLink[];
  documentType?: AnalysisReport['documentType'];
  fileName?: string;
  pageCount?: number;
  promptInjectionDetected?: boolean;
  aiGeneratorOverride?: (text: string) => Promise<unknown>;
  ollamaFetchImpl?: typeof fetch;
}): Promise<AnalysisReport> {
  let aiFindings: AnalysisFinding[] = [];
  let localAiStatus: LocalAiRuntimeReportStatus;

  if (params.aiGeneratorOverride) {
    const overrideRes = await extractFindingsFromOverride(
      params.text,
      params.aiGeneratorOverride
    );
    aiFindings = overrideRes.findings;
    localAiStatus = overrideRes.runtimeStatus;
  } else {
    const ollamaRes = await analyzeTextWithOllama(params.text, {
      fetchImpl: params.ollamaFetchImpl,
    });
    aiFindings = ollamaRes.findings;
    localAiStatus = ollamaRes.runtimeStatus;
  }

  const ollamaSucceeded = localAiStatus.status === 'succeeded';

  const aiDisclosure = ollamaSucceeded
    ? `Analyzed locally on your machine using Ollama (${localAiStatus.model} at ${localAiStatus.baseUrl}) combined with OpenShield deterministic open-source rule verification. Every finding is verified against verbatim sentences in the source text—zero external cloud AI APIs were used.`
    : `Local Ollama AI (${localAiStatus.model} at ${localAiStatus.baseUrl}) was not reachable (${localAiStatus.errorMessage || localAiStatus.status}). This report was generated using OpenShield's local deterministic 17-rule engine without pretending AI inference ran. Start Ollama ("${OLLAMA_SETUP_COMMANDS.runModel}") and rescan to include local AI inference.`;

  return buildRuleBasedReport({
    text: params.text,
    title: params.title,
    targetUrl: params.targetUrl,
    documentType: params.documentType,
    fileName: params.fileName,
    pageCount: params.pageCount,
    promptInjectionDetected: params.promptInjectionDetected,
    scanStatus: params.scanStatus || 'completed',
    discoveredLinks: params.discoveredLinks || [],
    additionalFindings: aiFindings,
    analysisMode: ollamaSucceeded ? 'hybrid_ai_and_rules' : 'rule_based_only',
    aiDisclosure,
    localAiStatus,
  });
}

export async function analyzePolicyInput(
  payload: AnalyzeRequestPayload
): Promise<AnalyzeServiceResponse> {
  // 1. Sample Preset Inspection
  if (payload.sampleId) {
    const preset = SAMPLE_POLICY_PRESETS.find((p) => p.id === payload.sampleId);
    if (!preset) {
      return {
        ok: false,
        errorCode: 'INVALID_SAMPLE',
        errorMessage: 'Requested sample policy preset was not found.',
      };
    }
    const { text: cleanText, title: extractedTitle } =
      extractVisibleTextFromHtml(preset.htmlContent);
    const links = extractPolicyLinksFromHtml(preset.htmlContent, preset.url);
    const report = await runHybridAnalysis({
      text: cleanText,
      title: preset.name || extractedTitle,
      targetUrl: preset.url,
      scanStatus: 'completed',
      discoveredLinks: links,
    });

    if (
      payload.requireLocalAi &&
      report.localAiStatus &&
      report.localAiStatus.status !== 'succeeded'
    ) {
      return {
        ok: false,
        errorCode: report.localAiStatus.status.toUpperCase(),
        errorMessage:
          report.localAiStatus.errorMessage ||
          'Local Ollama AI (gemma3:1b) is not running.',
        localAiStatus: report.localAiStatus,
      };
    }

    return { ok: true, report, localAiStatus: report.localAiStatus };
  }

  // 2. Direct Pasted Policy Text Analysis
  if (payload.text && payload.text.trim().length > 0) {
    const trimmed = payload.text.trim();
    if (trimmed.length < 30) {
      return {
        ok: false,
        errorCode: 'TEXT_TOO_SHORT',
        errorMessage:
          'Please paste at least one complete clause or paragraph (minimum 30 characters) for accurate evidence extraction.',
      };
    }
    if (trimmed.length > 150000) {
      return {
        ok: false,
        errorCode: 'TEXT_TOO_LONG',
        errorMessage:
          'Input text exceeds the 150,000-character limit. Please paste the relevant sections of the Terms & Conditions.',
      };
    }

    const report = await runHybridAnalysis({
      text: trimmed,
      title: payload.title?.trim() || 'Pasted Policy Text Analysis',
      targetUrl: payload.url?.trim() || undefined,
      scanStatus: 'fallback_text',
    });

    if (
      payload.requireLocalAi &&
      report.localAiStatus &&
      report.localAiStatus.status !== 'succeeded'
    ) {
      return {
        ok: false,
        errorCode: report.localAiStatus.status.toUpperCase(),
        errorMessage:
          report.localAiStatus.errorMessage ||
          'Local Ollama AI (gemma3:1b) is not running.',
        localAiStatus: report.localAiStatus,
      };
    }

    return { ok: true, report, localAiStatus: report.localAiStatus };
  }

  // 3. Live Website / Policy URL Analysis
  if (payload.url && payload.url.trim().length > 0) {
    const fetchResult = await fetchUrlSafely(payload.url);
    if (!fetchResult.ok || !fetchResult.text) {
      return {
        ok: false,
        errorCode: fetchResult.errorCode || 'FETCH_ERROR',
        errorMessage:
          fetchResult.errorMessage ||
          'Unable to fetch the requested URL. Paste the policy text directly below to analyze it.',
        allowPasteFallback: true,
      };
    }

    const discoveredLinks = extractPolicyLinksFromHtml(
      fetchResult.html || '',
      fetchResult.finalUrl
    );
    const report = await runHybridAnalysis({
      text: fetchResult.text,
      title: fetchResult.title,
      targetUrl: fetchResult.finalUrl,
      scanStatus: 'completed',
      discoveredLinks,
    });

    if (
      payload.requireLocalAi &&
      report.localAiStatus &&
      report.localAiStatus.status !== 'succeeded'
    ) {
      return {
        ok: false,
        errorCode: report.localAiStatus.status.toUpperCase(),
        errorMessage:
          report.localAiStatus.errorMessage ||
          'Local Ollama AI (gemma3:1b) is not running.',
        localAiStatus: report.localAiStatus,
      };
    }

    return { ok: true, report, localAiStatus: report.localAiStatus };
  }

  return {
    ok: false,
    errorCode: 'MISSING_INPUT',
    errorMessage:
      'Please enter a website URL or paste Terms & Conditions text to analyze.',
  };
}
