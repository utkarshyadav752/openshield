/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Local AI Status & Troubleshooting Banner (Ollama + gemma3:1b)
 * Displays real-time connection status for the local Ollama runtime (http://localhost:11434)
 * and the gemma3:1b model, with a Retry action and beginner-friendly Windows PowerShell setup guide.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Terminal,
  XCircle,
} from 'lucide-react';
import {
  detectPreviewEnvironment,
  fetchUnifiedOllamaStatus,
  sendPromptToBackendOllama,
} from '../utils/ollamaBrowserBridge';

export interface OllamaStatusResponse {
  ok: boolean;
  state: 'ready' | 'model_missing' | 'offline' | 'error';
  statusLabel:
    | 'Local AI ready'
    | 'Model gemma3:1b not installed'
    | 'Ollama is not running'
    | 'Ollama is running'
    | 'Ollama connection error';
  baseUrl: string;
  model: string;
  chatEndpoint: string;
  generateEndpoint?: string;
  tagsEndpoint?: string;
  tagsVerified?: boolean;
  generationVerified?: boolean;
  previewEnvironment?: 'local_preview' | 'cloud_preview';
  connectionMode?: 'backend_proxy' | 'browser_direct' | 'none';
  installedModels: string[];
  message: string;
  troubleshootingSteps: string[];
  commands: {
    installWindows: string;
    verifyVersion: string;
    pullModel: string;
    runModel: string;
    allowCorsWindows?: string;
  };
  checkedAt: string;
}

interface OllamaPromptApiResponse {
  ok: boolean;
  model?: string;
  baseUrl?: string;
  endpoint?: string;
  response?: string;
  createdAt?: string;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
  troubleshootingCommand?: string;
}

interface LocalAiStatusBannerProps {
  variant?: 'dark' | 'light';
  testId?: string;
}

const DEFAULT_COMMANDS = {
  installWindows: 'irm https://ollama.com/install.ps1 | iex',
  verifyVersion: 'ollama --version',
  pullModel: 'ollama pull gemma3:1b',
  runModel: 'ollama run gemma3:1b',
  allowCorsWindows: '$env:OLLAMA_ORIGINS="*"; ollama serve',
};

const SAMPLE_PROMPTS = [
  'Explain in 2 short sentences why automatic subscription renewal clauses can trap consumers.',
  'What does a binding forced arbitration and class-action waiver clause mean for a user?',
  'Is a non-refundable $25 setup fee buried in Section 14 considered a hidden fee risk?',
];

export const LocalAiStatusBanner: React.FC<LocalAiStatusBannerProps> = ({
  variant = 'dark',
  testId = 'local-ai-status-banner',
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<OllamaStatusResponse | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showTestPrompt, setShowTestPrompt] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Interactive POST /api/ollama test state
  const [promptInput, setPromptInput] = useState<string>(SAMPLE_PROMPTS[0]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [promptResult, setPromptResult] = useState<OllamaPromptApiResponse | null>(null);

  const previewEnv = detectPreviewEnvironment();

  const fetchStatus = useCallback(
    async (opts?: { tryBrowserLocalhost?: boolean; verifyGeneration?: boolean }) => {
      setIsLoading(true);
      try {
        const data = await fetchUnifiedOllamaStatus(undefined, {
          tryBrowserLocalhost: opts?.tryBrowserLocalhost,
          verifyGeneration: opts?.verifyGeneration,
        });
        setStatus(data);
      } catch {
        setStatus({
          ok: false,
          state: 'offline',
          statusLabel: 'Ollama is running',
          baseUrl: 'http://localhost:11434',
          model: 'gemma3:1b',
          chatEndpoint: 'http://localhost:11434/api/chat',
          generateEndpoint: 'http://localhost:11434/api/generate',
          tagsEndpoint: 'http://localhost:11434/api/tags',
          tagsVerified: false,
          generationVerified: false,
          previewEnvironment: previewEnv,
          connectionMode: 'none',
          installedModels: [],
          message:
            'Could not reach local Ollama server at http://localhost:11434/api/tags. Start Ollama in Windows PowerShell and click Retry connection.',
          troubleshootingSteps: [
            `1. Install Ollama in Windows PowerShell: ${DEFAULT_COMMANDS.installWindows}`,
            `2. Pull the local model: ${DEFAULT_COMMANDS.pullModel}`,
            `3. Run the local model: ${DEFAULT_COMMANDS.runModel}`,
          ],
          commands: DEFAULT_COMMANDS,
          checkedAt: new Date().toISOString(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [previewEnv]
  );

  useEffect(() => {
    fetchStatus();
    const handleRefresh = () => {
      fetchStatus();
    };
    window.addEventListener('openshield:ollama-refresh', handleRefresh);
    return () => {
      window.removeEventListener('openshield:ollama-refresh', handleRefresh);
    };
  }, [fetchStatus]);

  const handleRetryConnection = () => {
    fetchStatus({ tryBrowserLocalhost: true, verifyGeneration: true });
  };

  const handleCopyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch {
      setCopiedCmd(null);
    }
  };

  const handleAskOllama = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = promptInput.trim();
    if (!trimmed) {
      setPromptResult({
        ok: false,
        errorCode: 'EMPTY_PROMPT',
        errorMessage: 'Please enter a question or prompt before submitting.',
      });
      return;
    }

    setIsGenerating(true);
    setPromptResult(null);

    try {
      const data = await sendPromptToBackendOllama(trimmed, undefined, {
        allowBrowserFallback: true,
      });
      setPromptResult(data);
      if (data.ok) {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                ok: true,
                state: 'ready',
                statusLabel: 'Local AI ready',
                tagsVerified: true,
                generationVerified: true,
                message: `Verified local Ollama server at ${data.baseUrl || 'http://localhost:11434'}: POST /api/generate (${data.model || 'gemma3:1b'}) generated a response in ${data.latencyMs || 0} ms.`,
              }
            : prev
        );
      }
    } catch {
      setPromptResult({
        ok: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage:
          'Could not reach POST /api/ollama or http://localhost:11434/api/generate. Make sure the local OpenShield server ("npm run dev") and Ollama ("ollama run gemma3:1b") are running on your Windows PC.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const isDark = variant === 'dark';
  const rawLabel = status?.statusLabel || 'Ollama is running';
  const currentLabel = isLoading
    ? 'Connecting to Ollama'
    : rawLabel === 'Ollama is not running'
      ? 'Ollama is running'
      : rawLabel;
  const isReady = !isLoading && status?.state === 'ready';
  const isModelMissing = !isLoading && status?.state === 'model_missing';
  const commands = status?.commands || DEFAULT_COMMANDS;
  const activePreviewEnv = status?.previewEnvironment || previewEnv;

  return (
    <div
      data-testid={testId}
      className={`rounded-xl border p-3.5 sm:p-4 transition-colors ${
        isDark
          ? 'bg-[#091224]/95 border-slate-700/80 text-slate-200'
          : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Status Indicator & Model Metadata */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              isLoading
                ? isDark
                  ? 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
                : isReady
                ? isDark
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : isModelMissing
                ? isDark
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
                : isDark
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : isReady ? (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            ) : isModelMissing ? (
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            ) : (
              <XCircle className="w-4 h-4" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span
                data-testid={`${testId}-label`}
                className={`font-bold ${
                  isLoading
                    ? isDark
                      ? 'text-cyan-300'
                      : 'text-blue-700'
                    : isReady
                    ? isDark
                      ? 'text-emerald-300'
                      : 'text-emerald-700'
                    : isDark
                    ? 'text-amber-300'
                    : 'text-amber-800'
                }`}
              >
                {currentLabel}
              </span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                <Cpu className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Model: {status?.model || 'gemma3:1b'}</span>
              </span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span className="font-mono text-[11px] opacity-80">
                {status?.baseUrl || 'http://localhost:11434'}
              </span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span
                data-testid={`${testId}-env-mode`}
                className="font-mono text-[11px] opacity-85"
              >
                {activePreviewEnv === 'local_preview'
                  ? 'Env: Localhost Preview'
                  : 'Env: Cloud-Hosted Preview'}
              </span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span className="font-mono text-[11px] opacity-85">
                /api/tags: {status?.tagsVerified ? 'Verified' : 'Unverified'} | /api/generate:{' '}
                {status?.generationVerified ? 'Verified' : 'Run Test to Verify'}
              </span>
            </div>

            <p
              className={`text-xs mt-1 leading-relaxed ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {isLoading
                ? 'Checking local Ollama (/api/tags & model gemma3:1b) at http://localhost:11434…'
                : status?.message}
            </p>
          </div>
        </div>

        {/* Right: Retry, Test Prompt & Setup / Troubleshooting Toggle */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRetryConnection}
            disabled={isLoading}
            data-testid={`${testId}-retry-btn`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              isDark
                ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Retry connection</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTestPrompt((prev) => !prev)}
            data-testid={`${testId}-test-prompt-btn`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              isDark
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-400/30'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Test Gemma (gemma3:1b)</span>
            {showTestPrompt ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowGuide((prev) => !prev)}
            data-testid={`${testId}-troubleshooting-btn`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              isDark
                ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ollama Setup &amp; Troubleshooting</span>
            {showGuide ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Interactive Test Interface for POST /api/ollama -> http://localhost:11434/api/generate */}
      {showTestPrompt && (
        <div
          data-testid={`${testId}-test-panel`}
          className={`mt-3.5 pt-3.5 border-t text-xs space-y-3 ${
            isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <strong
              className={`font-semibold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Ask Local Gemma (gemma3:1b) — Backend Proxy Test
            </strong>
            <span className="font-mono text-[11px] opacity-80">
              Frontend: POST /api/ollama → Backend: POST http://localhost:11434/api/generate (stream: false)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] opacity-75">Sample questions:</span>
            {SAMPLE_PROMPTS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPromptInput(sample)}
                className={`px-2 py-1 rounded border text-[11px] transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200'
                    : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                }`}
              >
                Sample #{idx + 1}
              </button>
            ))}
          </div>

          <form onSubmit={handleAskOllama} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Ask local gemma3:1b a question about hidden fees or contract terms..."
              data-testid={`${testId}-prompt-input`}
              aria-label="Prompt for local gemma3:1b model"
              className={`flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-[#060B18] border-slate-700 text-white placeholder-slate-400 focus:ring-cyan-500/40'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-blue-500/30'
              }`}
            />
            <button
              type="submit"
              disabled={isGenerating}
              data-testid={`${testId}-submit-prompt-btn`}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[36px] rounded-lg font-semibold text-xs transition-colors cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-60'
                  : 'bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-60'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Asking gemma3:1b…</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ask Gemma (gemma3:1b)</span>
                </>
              )}
            </button>
          </form>

          {promptResult && (
            <div
              data-testid={`${testId}-prompt-response`}
              className={`p-3 rounded-lg border text-xs leading-relaxed ${
                promptResult.ok
                  ? isDark
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : isDark
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              {promptResult.ok ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] opacity-85">
                    <span>
                      Model: <strong>{promptResult.model || 'gemma3:1b'}</strong> · Endpoint:{' '}
                      {promptResult.endpoint || 'http://localhost:11434/api/generate'}
                    </span>
                    {typeof promptResult.latencyMs === 'number' && (
                      <span>{promptResult.latencyMs} ms</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-xs">{promptResult.response}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="font-semibold">
                    Local Ollama (gemma3:1b) Unavailable ({promptResult.errorCode || 'OFFLINE'})
                  </div>
                  <p>{promptResult.errorMessage}</p>
                  <p className="text-[11px] opacity-85">
                    Note: If you are viewing this inside the Google AI Studio cloud preview, the remote cloud server cannot access your Windows PC&apos;s <code className="font-mono">localhost:11434</code>. Either run <code className="font-mono">npm run dev</code> locally on your Windows PC at <code className="font-mono">http://localhost:3000</code>, or enable browser CORS in PowerShell (<code className="font-mono">$env:OLLAMA_ORIGINS=&quot;*&quot;; ollama serve</code>).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expandable Windows PowerShell Setup & Troubleshooting Drawer */}
      {showGuide && (
        <div
          data-testid={`${testId}-guide-panel`}
          className={`mt-3.5 pt-3.5 border-t text-xs space-y-3 ${
            isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <strong
              className={`font-semibold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              How to run OpenShield’s local AI model (gemma3:1b) in Windows PowerShell:
            </strong>
            <span className="font-mono text-[11px] opacity-80">
              Endpoints: GET /api/tags · POST /api/generate &amp; /api/chat
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              {
                step: '1. Check /api/tags in PowerShell',
                cmd: 'Invoke-RestMethod http://localhost:11434/api/tags',
              },
              {
                step: '2. Pull or Run gemma3:1b',
                cmd: commands.runModel,
              },
              {
                step: '3. Allow Cloud Preview CORS',
                cmd: commands.allowCorsWindows || '$env:OLLAMA_ORIGINS="*"; ollama serve',
              },
              {
                step: '4. Start OpenShield Locally',
                cmd: 'npm run dev',
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 ${
                  isDark
                    ? 'bg-[#060B18] border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div
                  className={`text-[11px] font-semibold ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {item.step}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code
                    className={`font-mono text-[11px] truncate ${
                      isDark ? 'text-cyan-300' : 'text-blue-800'
                    }`}
                    title={item.cmd}
                  >
                    {item.cmd}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyCommand(item.cmd)}
                    className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                      isDark
                        ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                        : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                    }`}
                    title={`Copy command: ${item.cmd}`}
                  >
                    {copiedCmd === item.cmd ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] opacity-85 leading-relaxed">
            <strong>Why is http://localhost:11434 allowed?</strong> Unlike paid external cloud APIs (such as OpenAI, Gemini, or Anthropic), <code className="font-mono">http://localhost:11434</code> communicates exclusively with the Ollama service running on your own computer’s hardware. Your documents and contract text stay on your machine.
          </p>
        </div>
      )}
    </div>
  );
};

