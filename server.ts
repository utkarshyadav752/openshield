/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Full-Stack Server (Express + Vite Middleware)
 * Serves the public OpenShield web application, local Ollama (gemma3:1b) AI status & proxy routes,
 * document text extraction, and Chrome Extension source bundle on port 3000.
 */

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { analyzePolicyInput } from './server/src/analyzer-service';
import {
  analyzeUploadedDocument,
  createSampleContractPdfBuffer,
  createSampleContractPngBuffer,
  validateAndExtractDocument,
} from './server/src/document-analyzer';
import {
  analyzeTextWithOllama,
  checkOllamaStatus,
  generateWithOllama,
} from './server/src/ollama-service';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '16mb' }));

  // Local AI (Ollama + gemma3:1b) Prompt Generation Endpoint
  // Accepts { prompt } from the frontend, validates input, and forwards to
  // POST http://localhost:11434/api/generate with { model: "gemma3:1b", prompt, stream: false }
  app.post('/api/ollama', async (req, res) => {
    try {
      const rawPrompt = req.body?.prompt;
      if (typeof rawPrompt !== 'string' || !rawPrompt.trim()) {
        res.status(400).json({
          ok: false,
          errorCode: 'EMPTY_PROMPT',
          errorMessage:
            'Please provide a non-empty "prompt" string in the JSON request body.',
        });
        return;
      }

      const result = await generateWithOllama(rawPrompt);

      if (!result.ok) {
        const statusCode =
          result.errorCode === 'EMPTY_PROMPT'
            ? 400
            : result.errorCode === 'PROMPT_TOO_LONG'
            ? 413
            : 200;

        res.status(statusCode).json({
          ok: false,
          model: result.model,
          baseUrl: result.baseUrl,
          endpoint: result.endpoint,
          errorCode: result.errorCode || 'OLLAMA_OFFLINE',
          errorMessage:
            result.errorMessage ||
            'Could not reach local Ollama (gemma3:1b) at http://localhost:11434/api/generate.',
          troubleshootingCommand: result.troubleshootingCommand,
        });
        return;
      }

      res.status(200).json({
        ok: true,
        model: result.model,
        baseUrl: result.baseUrl,
        endpoint: result.endpoint,
        response: result.response,
        createdAt: result.createdAt,
        latencyMs: result.latencyMs,
      });
    } catch {
      res.status(500).json({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage:
          'An unexpected server error occurred while calling local Ollama (/api/generate).',
      });
    }
  });

  // Local AI (Ollama + gemma3:1b) Health & Readiness Check
  app.get('/api/ollama/status', async (req, res) => {
    try {
      const verifyGeneration =
        req.query?.verifyGeneration === 'true' ||
        req.query?.verifyGeneration === '1';
      const status = await checkOllamaStatus({ verifyGeneration });
      res.status(200).json(status);
    } catch {
      res.status(500).json({
        ok: false,
        state: 'error',
        statusLabel: 'Ollama connection error',
        message: 'Unexpected error while checking local Ollama server status.',
      });
    }
  });

  // Direct Local Ollama (gemma3:1b) Inference Endpoint
  // Strictly requires local Ollama + gemma3:1b; never pretends analysis succeeded when Ollama fails.
  app.post('/api/ollama/analyze', async (req, res) => {
    try {
      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      if (text.length < 30) {
        res.status(400).json({
          ok: false,
          errorCode: 'TEXT_TOO_SHORT',
          errorMessage:
            'Please provide at least 30 characters of contract or policy text for local gemma3:1b analysis.',
        });
        return;
      }

      const result = await analyzeTextWithOllama(text);
      if (!result.ok) {
        res.status(503).json({
          ok: false,
          errorCode: result.runtimeStatus.status.toUpperCase(),
          errorMessage:
            result.runtimeStatus.errorMessage ||
            'Local Ollama (gemma3:1b) analysis failed.',
          runtimeStatus: result.runtimeStatus,
        });
        return;
      }

      res.status(200).json({
        ok: true,
        findings: result.findings,
        runtimeStatus: result.runtimeStatus,
      });
    } catch {
      res.status(500).json({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'An unexpected error occurred while communicating with local Ollama.',
      });
    }
  });

  // Feature 1 API: Analyze a Website / Policy URL or Pasted Text
  app.post('/api/analyze', async (req, res) => {
    try {
      const result = await analyzePolicyInput({
        url: req.body?.url,
        text: req.body?.text,
        title: req.body?.title,
        sampleId: req.body?.sampleId,
        requireLocalAi: Boolean(req.body?.requireLocalAi),
      });

      if (!result.ok) {
        res.status(422).json(result);
        return;
      }

      res.status(200).json(result);
    } catch {
      res.status(500).json({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'An unexpected server error occurred during policy analysis.',
      });
    }
  });

  // Feature 2 Step A API: Extract & Sanitize Text from Uploaded PDF or Image for User Review
  app.post('/api/extract-document', async (req, res) => {
    try {
      const extraction = await validateAndExtractDocument({
        mode: req.body?.mode,
        fileName: req.body?.fileName,
        mimeType: req.body?.mimeType,
        fileSize: req.body?.fileSize,
        base64Data: req.body?.base64Data,
        text: req.body?.text,
        title: req.body?.title,
      });

      if (!extraction.ok) {
        res.status(422).json(extraction);
        return;
      }

      res.status(200).json(extraction);
    } catch {
      res.status(500).json({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'An unexpected error occurred while extracting text from the document.',
      });
    }
  });

  // Feature 2 Step B API: Upload & Analyze Document (PDF, Image, or Pasted Text)
  app.post('/api/analyze-document', async (req, res) => {
    try {
      const result = await analyzeUploadedDocument({
        mode: req.body?.mode,
        fileName: req.body?.fileName,
        mimeType: req.body?.mimeType,
        fileSize: req.body?.fileSize,
        base64Data: req.body?.base64Data,
        text: req.body?.text,
        title: req.body?.title,
      });

      if (!result.ok) {
        res.status(422).json(result);
        return;
      }

      res.status(200).json(result);
    } catch {
      res.status(500).json({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'An unexpected server error occurred while analyzing the document.',
      });
    }
  });

  // Sample PDF / Image Generator for 1-Click Customer Testing
  app.get('/api/sample-document/:type', (req, res) => {
    const type = req.params.type;
    if (type === 'pdf') {
      const buf = createSampleContractPdfBuffer();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="ApexCloud_Enterprise_Terms_2026.pdf"'
      );
      res.send(buf);
      return;
    }
    if (type === 'image') {
      const buf = createSampleContractPngBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="FitPulse_Membership_Contract_Scan.png"'
      );
      res.send(buf);
      return;
    }
    res.status(404).json({ ok: false, errorMessage: 'Unknown sample document type' });
  });

  // Feature 3 API: Inspect or download real Chrome Extension (Manifest V3) files
  app.get('/api/extension/files', async (_req, res) => {
    try {
      const extDir = path.resolve(process.cwd(), 'extension');
      const fileNames = [
        'manifest.json',
        'content-script.js',
        'service-worker.js',
        'popup.html',
        'popup.css',
        'popup.js',
      ];

      const files: Record<string, string> = {};
      for (const name of fileNames) {
        files[name] = await fs.readFile(path.join(extDir, name), 'utf-8');
      }

      res.status(200).json({ ok: true, files });
    } catch {
      res.status(500).json({
        ok: false,
        errorMessage: 'Unable to read extension source files.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenShield server running on http://localhost:${PORT}`);
  });
}

startServer();
