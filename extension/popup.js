/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Extension Popup Controller
 * Communicates with content.js in the active tab to display real-time
 * findings, rescan the page, pause scanning for the current domain,
 * toggle highlights, and dismiss individual warnings.
 */

const siteDomainEl = document.getElementById('siteDomain');
const pauseSiteToggle = document.getElementById('pauseSiteToggle');
const highlightToggle = document.getElementById('highlightToggle');
const rescanBtn = document.getElementById('rescanBtn');
const findingCountBadge = document.getElementById('findingCountBadge');
const findingsListEl = document.getElementById('findingsList');
const knownServiceBox = document.getElementById('knownServiceBox');
const policyLinksSection = document.getElementById('policyLinksSection');
const policyLinksList = document.getElementById('policyLinksList');

let activeTabId = null;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderState(data) {
  if (!data) {
    siteDomainEl.textContent = 'Restricted Browser Page';
    findingsListEl.innerHTML = `
      <div class="os-empty">
        <strong>Cannot inspect this tab</strong>
        <p style="margin-top:4px;font-size:12px;">Browser internal pages (such as chrome:// settings) do not allow extension content scripts. Open any regular http:// or https:// website to scan.</p>
      </div>
    `;
    return;
  }

  siteDomainEl.textContent = data.domain || 'Current Webpage';
  pauseSiteToggle.checked = Boolean(data.paused);
  highlightToggle.checked = data.highlightsEnabled !== false;

  if (data.knownService) {
    const ks = data.knownService;
    knownServiceBox.classList.remove('hidden');
    knownServiceBox.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:#0F172A;margin-bottom:3px;">
        ${escapeHtml(ks.name)} · Known Service Rating: Grade ${escapeHtml(ks.tosdrGrade || 'N/A')}
      </div>
      <div style="font-size:11.5px;color:#475569;margin-bottom:4px;">
        ${escapeHtml(ks.tosdrSummary)}
      </div>
      <div style="font-size:11px;color:#64748B;">
        Cancellation difficulty: <strong>${escapeHtml(ks.cancellationDifficulty)}</strong> · Verified ${escapeHtml(ks.lastVerified)}
      </div>
      ${
        ks.verifiedCancellationUrl
          ? `<div style="margin-top:6px;"><a href="${escapeHtml(ks.verifiedCancellationUrl)}" target="_blank" rel="noopener noreferrer" style="color:#1D4ED8;font-size:11.5px;font-weight:600;">Open verified cancellation page →</a></div>`
          : ''
      }
    `;
  } else {
    knownServiceBox.classList.add('hidden');
  }

  if (data.paused) {
    findingCountBadge.textContent = 'Paused';
    findingsListEl.innerHTML = `
      <div class="os-empty">
        <strong>Protection paused on ${escapeHtml(data.domain)}</strong>
        <p style="margin-top:4px;font-size:12px;">Uncheck "Pause on this site" above to resume local scanning.</p>
      </div>
    `;
    return;
  }

  const findings = Array.isArray(data.findings) ? data.findings : [];
  findingCountBadge.textContent = `${findings.length} ${findings.length === 1 ? 'warning' : 'warnings'}`;

  if (findings.length === 0) {
    findingsListEl.innerHTML = `
      <div class="os-empty">
        <strong>No suspicious patterns detected</strong>
        <p style="margin-top:4px;font-size:12px;">OpenShield scanned the visible page text and button styles without matching any high-risk terms or manipulative urgency traps.</p>
      </div>
    `;
  } else {
    findingsListEl.innerHTML = findings
      .map((f) => {
        const riskClass =
          f.riskLevel === 'Critical' || f.riskLevel === 'High'
            ? 'os-risk-high'
            : f.riskLevel === 'Medium'
            ? 'os-risk-medium'
            : 'os-risk-low';

        return `
          <article class="os-card">
            <div class="os-card-header">
              <span class="os-card-title">${escapeHtml(f.title)}</span>
              <button class="os-dismiss-btn" data-dismiss-id="${escapeHtml(f.id)}" type="button">Dismiss</button>
            </div>
            <div class="os-meta-line">
              <span class="${riskClass}">${escapeHtml(f.riskLevel)} Risk</span> · <span>${escapeHtml(f.nature)}</span> · <span>Confidence: ${escapeHtml(f.confidence)}</span>
            </div>
            <p style="font-size:12px;color:#334155;">${escapeHtml(f.explanation)}</p>
            <blockquote class="os-quote">"${escapeHtml(f.evidenceQuote)}"</blockquote>
            <p style="font-size:11.5px;color:#475569;"><strong>Check next:</strong> ${escapeHtml(f.whatToCheck)}</p>
          </article>
        `;
      })
      .join('');

    findingsListEl.querySelectorAll('[data-dismiss-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const findingId = btn.getAttribute('data-dismiss-id');
        if (activeTabId && findingId) {
          chrome.tabs.sendMessage(
            activeTabId,
            { type: 'OPENSHIELD_DISMISS_FINDING', findingId },
            () => refreshPopupState()
          );
        }
      });
    });
  }

  const links = Array.isArray(data.discoveredLinks) ? data.discoveredLinks : [];
  if (links.length > 0) {
    policyLinksSection.classList.remove('hidden');
    policyLinksList.innerHTML = links
      .map(
        (l) => `
          <a class="os-link-item" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
            <span>${escapeHtml(l.label)}</span>
            <span style="font-size:11px;color:#64748B;">${escapeHtml(l.type)}</span>
          </a>
        `
      )
      .join('');
  } else {
    policyLinksSection.classList.add('hidden');
  }
}

function refreshPopupState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      renderState(null);
      return;
    }
    activeTabId = tab.id;
    chrome.tabs.sendMessage(activeTabId, { type: 'OPENSHIELD_GET_STATE' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        renderState(null);
        return;
      }
      renderState(response);
    });
  });
}

rescanBtn.addEventListener('click', () => {
  if (!activeTabId) return;
  chrome.tabs.sendMessage(activeTabId, { type: 'OPENSHIELD_RESCAN' }, () => {
    refreshPopupState();
  });
});

pauseSiteToggle.addEventListener('change', () => {
  if (!activeTabId) return;
  chrome.tabs.sendMessage(
    activeTabId,
    { type: 'OPENSHIELD_TOGGLE_PAUSE', paused: pauseSiteToggle.checked },
    () => refreshPopupState()
  );
});

highlightToggle.addEventListener('change', () => {
  if (!activeTabId) return;
  chrome.tabs.sendMessage(
    activeTabId,
    {
      type: 'OPENSHIELD_TOGGLE_HIGHLIGHTS',
      highlightsEnabled: highlightToggle.checked,
    },
    () => refreshPopupState()
  );
});

document.addEventListener('DOMContentLoaded', refreshPopupState);
