/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Standalone Analyzer Client Script
 * Connects to /api/analyze on the OpenShield backend.
 */

const analyzerForm = document.getElementById('analyzerForm');
const analyzerUrlInput = document.getElementById('analyzerUrlInput');
const analyzerTextInput = document.getElementById('analyzerTextInput');
const analyzeTextBtn = document.getElementById('analyzeTextBtn');
const reportOutput = document.getElementById('reportOutput');

function escapeText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function runAnalysis(payload) {
  reportOutput.innerHTML = `<div class="report-card">Analyzing accessible policy terms and verifying evidence quotes…</div>`;
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      reportOutput.innerHTML = `
        <div class="report-card" style="border-color:#FCA5A5;">
          <strong>Could not complete URL retrieval</strong>
          <p style="margin-top:0.5rem;">${escapeText(data.errorMessage || 'Unable to access URL. Paste the policy text directly above.')}</p>
        </div>
      `;
      return;
    }

    const report = data.report;
    const findingsHtml = (report.findings || [])
      .map(
        (f) => `
        <article class="report-card">
          <h3>${escapeText(f.title)}</h3>
          <p style="font-size:0.85rem;color:#64748B;margin-top:0.25rem;">
            Risk: <strong>${escapeText(f.riskLevel)}</strong> · ${escapeText(f.nature)} · Section: ${escapeText(f.sectionLocation)} · Confidence: ${escapeText(f.confidence)}
          </p>
          <blockquote class="quote-box">"${escapeText(f.evidenceQuote)}"</blockquote>
          <p><strong>Why it matters:</strong> ${escapeText(f.whyItMatters)}</p>
          <p style="margin-top:0.35rem;"><strong>What to check:</strong> ${escapeText(f.whatToCheck)}</p>
        </article>
      `
      )
      .join('');

    reportOutput.innerHTML = `
      <div class="report-card">
        <h2>${escapeText(report.title)}</h2>
        <p style="font-size:0.85rem;color:#64748B;">
          Scanned at ${escapeText(new Date(report.timestamp).toLocaleString())} · Overall Risk: <strong>${escapeText(report.overallRiskLevel)}</strong>
        </p>
        <p style="margin-top:0.5rem;">${escapeText(report.overallSummary)}</p>
      </div>
      ${findingsHtml || '<div class="report-card">No high-risk clauses matched in the analyzed text.</div>'}
    `;
  } catch {
    reportOutput.innerHTML = `<div class="report-card">Network error connecting to analysis server.</div>`;
  }
}

if (analyzerForm) {
  analyzerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = analyzerUrlInput.value.trim();
    if (url) runAnalysis({ url });
  });
}

if (analyzeTextBtn) {
  analyzeTextBtn.addEventListener('click', () => {
    const text = analyzerTextInput.value.trim();
    if (text) runAnalysis({ text });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  if (urlParam && analyzerUrlInput) {
    analyzerUrlInput.value = urlParam;
    runAnalysis({ url: urlParam });
  }
});
