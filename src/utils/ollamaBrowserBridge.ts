/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Dual-Mode Local Ollama Bridge (Backend Proxy + Direct Browser Localhost Fallback)
 *
 * Why this module exists:
 * 1. When OpenShield runs locally on the user's Windows PC (`npm run dev` on http://localhost:3000),
 *    the Express backend (`server.ts`) communicates directly with http://localhost:11434 (or 127.0.0.1:11434).
 * 2. When the user opens OpenShield via a hosted preview URL while Ollama is running on their own
 *    Windows PC, the remote server container cannot reach the user's localhost—but the user's
 *    web browser CAN reach http://localhost:11434 (when OLLAMA_ORIGINS="*" is set).
 *
 * This bridge checks the backend first and seamlessly falls back to a direct browser-to-localhost
 * Ollama connection, while preserving the deterministic rule engine if Ollama is unreachable.
 */

import {
  analyzeTextWithOllama,
  checkOllamaStatus,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  generateWithOllama,
  OllamaGenerateResult,
  OllamaHealthStatus,
  OLLAMA_SETUP_COMMANDS,
} from '../../server/src/ollama-service';
import { buildRuleBasedReport } from '../../shared/rules/engine';
import { AnalysisReport } from '../../shared/schemas/analysis';

/**
 * Determines whether the browser is viewing OpenShield from a local server
 * (`http://localhost:3000` / `127.0.0.1`) or a cloud-hosted preview (`*.run.app`, etc.).
 */
export function detectPreviewEnvironment(
  hostnameOverride?: string
): 'local_preview' | 'cloud_preview' {
  const host = (
    hostnameOverride ??
    (typeof window !== 'undefined' && window.location
      ? window.location.hostname
      : 'localhost')
  )
    .trim()
    .toLowerCase();

  if (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]'
  ) {
    return 'local_preview';
  }
  return 'cloud_preview';
}

export interface UnifiedOllamaStatusOptions {
  tryBrowserLocalhost?: boolean;
  verifyGeneration?: boolean;
  hostname?: string;
}

/**
 * Sends a prompt from the frontend to our same-origin backend endpoint POST /api/ollama,
 * which validates the input and calls POST http://localhost:11434/api/generate
 * with { model: "gemma3:1b", prompt, stream: false }.
 * If the backend is running in a remote cloud preview (OLLAMA_OFFLINE) and allowBrowserFallback
 * is enabled, falls back to calling POST http://localhost:11434/api/generate from the browser.
 */
export async function sendPromptToBackendOllama(
  prompt: string,
  fetchImpl?: typeof fetch,
  options?: { allowBrowserFallback?: boolean }
): Promise<OllamaGenerateResult> {
  const fetchFn = fetchImpl || globalThis.fetch;
  const trimmed = typeof prompt === 'string' ? prompt.trim() : '';

  if (!trimmed) {
    return {
      ok: false,
      model: DEFAULT_OLLAMA_MODEL,
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      endpoint: `${DEFAULT_OLLAMA_BASE_URL}/api/generate`,
      response: '',
      latencyMs: 0,
      errorCode: 'EMPTY_PROMPT',
      errorMessage: 'Please enter a question or contract clause before submitting.',
    };
  }

  try {
    const res = await fetchFn('/api/ollama', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ prompt: trimmed }),
    });

    const data = (await res.json()) as OllamaGenerateResult;
    const isOk = Boolean(data.ok && res.ok);

    if (isOk) {
      return {
        ok: true,
        model: data.model || DEFAULT_OLLAMA_MODEL,
        baseUrl: data.baseUrl || DEFAULT_OLLAMA_BASE_URL,
        endpoint: data.endpoint || `${DEFAULT_OLLAMA_BASE_URL}/api/generate`,
        response: data.response || '',
        createdAt: data.createdAt,
        latencyMs: Number(data.latencyMs || 0),
      };
    }

    if (
      options?.allowBrowserFallback &&
      (!data.errorCode || data.errorCode === 'OLLAMA_OFFLINE')
    ) {
      const browserGen = await generateWithOllama(trimmed, {
        baseUrl: DEFAULT_OLLAMA_BASE_URL,
        model: DEFAULT_OLLAMA_MODEL,
        fetchImpl: fetchFn,
      });
      if (browserGen.ok || browserGen.errorCode === 'MODEL_MISSING') {
        return browserGen;
      }
    }

    return {
      ok: false,
      model: data.model || DEFAULT_OLLAMA_MODEL,
      baseUrl: data.baseUrl || DEFAULT_OLLAMA_BASE_URL,
      endpoint: data.endpoint || `${DEFAULT_OLLAMA_BASE_URL}/api/generate`,
      response: data.response || '',
      createdAt: data.createdAt,
      latencyMs: Number(data.latencyMs || 0),
      errorCode: data.errorCode || 'OLLAMA_OFFLINE',
      errorMessage: data.errorMessage,
      troubleshootingCommand:
        data.troubleshootingCommand || OLLAMA_SETUP_COMMANDS.runModel,
    };
  } catch {
    if (options?.allowBrowserFallback) {
      const browserGen = await generateWithOllama(trimmed, {
        baseUrl: DEFAULT_OLLAMA_BASE_URL,
        model: DEFAULT_OLLAMA_MODEL,
        fetchImpl: fetchFn,
      });
      if (browserGen.ok || browserGen.errorCode === 'MODEL_MISSING') {
        return browserGen;
      }
    }

    return {
      ok: false,
      model: DEFAULT_OLLAMA_MODEL,
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      endpoint: `${DEFAULT_OLLAMA_BASE_URL}/api/generate`,
      response: '',
      latencyMs: 0,
      errorCode: 'OLLAMA_OFFLINE',
      errorMessage:
        'Could not reach the backend /api/ollama endpoint. Make sure the local server is running ("npm run dev").',
      troubleshootingCommand: OLLAMA_SETUP_COMMANDS.runModel,
    };
  }
}

/**
 * Checks local Ollama readiness via the same-origin backend proxy (/api/ollama/status)
 * and, when requested (e.g. via Retry Connection, Verify Generation, or custom fetchImpl),
 * also probes http://localhost:11434/api/tags (and /api/generate) directly from the browser.
 * Distinguishes clearly between a local browser preview (localhost:3000) and a cloud-hosted preview.
 */
export async function fetchUnifiedOllamaStatus(
  fetchImpl?: typeof fetch,
  options?: UnifiedOllamaStatusOptions
): Promise<OllamaHealthStatus> {
  const fetchFn = fetchImpl || globalThis.fetch;
  const previewEnv = detectPreviewEnvironment(options?.hostname);
  const statusUrl = options?.verifyGeneration
    ? '/api/ollama/status?verifyGeneration=true'
    : '/api/ollama/status';
  let backendStatus: OllamaHealthStatus | null = null;

  try {
    const res = await fetchFn(statusUrl);
    if (res.ok) {
      backendStatus = (await res.json()) as OllamaHealthStatus;
      if (
        backendStatus.state === 'ready' ||
        backendStatus.state === 'model_missing'
      ) {
        return {
          ...backendStatus,
          previewEnvironment: previewEnv,
          connectionMode: 'backend_proxy',
        };
      }
    }
  } catch {
    backendStatus = null;
  }

  const shouldProbeBrowserDirect = Boolean(
    fetchImpl || options?.tryBrowserLocalhost || options?.verifyGeneration
  );

  if (shouldProbeBrowserDirect) {
    const directBrowserStatus = await checkOllamaStatus({
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      model: DEFAULT_OLLAMA_MODEL,
      timeoutMs: 3200,
      fetchImpl: fetchFn,
      verifyGeneration: options?.verifyGeneration,
    });

    if (
      directBrowserStatus.state === 'ready' ||
      directBrowserStatus.state === 'model_missing'
    ) {
      return {
        ...directBrowserStatus,
        previewEnvironment: previewEnv,
        connectionMode: 'browser_direct',
      };
    }

    if (previewEnv === 'cloud_preview') {
      return {
        ...directBrowserStatus,
        previewEnvironment: 'cloud_preview',
        connectionMode: 'none',
        commands: OLLAMA_SETUP_COMMANDS,
        message:
          'Cloud-Hosted Preview detected: The remote cloud backend cannot reach your Windows PC’s localhost, and your browser’s direct request to http://localhost:11434/api/tags was blocked by CORS or unreachable. Even when http://localhost:11434 says "Ollama is running" in another tab, browsers block cloud origins unless you run `$env:OLLAMA_ORIGINS="*"; ollama serve` in PowerShell—or run OpenShield locally via `npm run dev` on http://localhost:3000.',
      };
    }

    return {
      ...(backendStatus || directBrowserStatus),
      previewEnvironment: previewEnv,
      connectionMode: 'none',
      commands: OLLAMA_SETUP_COMMANDS,
    };
  }

  if (backendStatus) {
    if (previewEnv === 'cloud_preview' && backendStatus.state === 'offline') {
      return {
        ...backendStatus,
        previewEnvironment: 'cloud_preview',
        connectionMode: 'none',
        commands: OLLAMA_SETUP_COMMANDS,
        message:
          'Cloud-Hosted Preview detected: This preview is running on a remote cloud server where backend "localhost" is the cloud container, not your Windows PC. Click "Retry Connection" to probe http://localhost:11434 from your browser (requires OLLAMA_ORIGINS="*"), or run OpenShield locally with "npm run dev" at http://localhost:3000.',
      };
    }

    return {
      ...backendStatus,
      previewEnvironment: previewEnv,
      connectionMode: 'none',
      commands: OLLAMA_SETUP_COMMANDS,
    };
  }

  const fallbackOffline = await checkOllamaStatus({
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    model: DEFAULT_OLLAMA_MODEL,
    timeoutMs: 2500,
    fetchImpl: fetchFn,
  });

  return {
    ...fallbackOffline,
    previewEnvironment: previewEnv,
    connectionMode: 'none',
    commands: OLLAMA_SETUP_COMMANDS,
  };
}

/**
 * Upgrades a rule-based-only report when a custom fetchImpl is provided or when local
 * Ollama analysis succeeded.
 */
export async function upgradeReportWithBrowserOllamaIfNeeded(
  report: AnalysisReport,
  fetchImpl?: typeof fetch
): Promise<AnalysisReport> {
  if (report.localAiStatus?.status === 'succeeded' || !fetchImpl) {
    return report;
  }

  const sourceText = (report.extractedText || '').trim();
  if (sourceText.length < 30) {
    return report;
  }

  const browserAi = await analyzeTextWithOllama(sourceText, {
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    model: DEFAULT_OLLAMA_MODEL,
    timeoutMs: 22000,
    fetchImpl,
  });

  if (browserAi.ok && browserAi.runtimeStatus.status === 'succeeded') {
    const aiDisclosure = `Analyzed locally on your machine using Ollama (${browserAi.runtimeStatus.model} at ${browserAi.runtimeStatus.baseUrl}) combined with OpenShield deterministic open-source rule verification. Every finding is verified against verbatim sentences in the source text—zero external cloud AI APIs were used.`;

    const upgraded = buildRuleBasedReport({
      text: sourceText,
      title: report.title,
      targetUrl: report.targetUrl,
      documentType: report.documentType,
      fileName: report.fileName,
      pageCount: report.pageCount,
      promptInjectionDetected: report.promptInjectionDetected,
      scanStatus: report.scanStatus,
      discoveredLinks: report.discoveredLinks,
      additionalFindings: browserAi.findings,
      analysisMode: 'hybrid_ai_and_rules',
      aiDisclosure,
      localAiStatus: browserAi.runtimeStatus,
    });

    return {
      ...upgraded,
      reportId: report.reportId,
    };
  }

  if (browserAi.runtimeStatus.status === 'model_missing') {
    return {
      ...report,
      localAiStatus: browserAi.runtimeStatus,
    };
  }

  return report;
}
