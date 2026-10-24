/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Content Script
 * Performs local, privacy-preserving DOM scanning with:
 * - Throttled & debounced MutationObserver with subtree filtering and recursion protection
 * - Computed-style visual interference analysis between consent/checkout action pairs
 * - Policy & cancellation link discovery
 * - Reversible, accessible highlighting that never modifies user consent or clicks controls
 */

(() => {
  if (window.__OPENSHIELD_CONTENT_INITIALIZED__) return;
  window.__OPENSHIELD_CONTENT_INITIALIZED__ = true;

  const CONSTANTS = window.OPENSHIELD_CONSTANTS || {
    DEBOUNCE_MS: 450,
    MAX_NODES_PER_PASS: 800,
    MAX_MUTATION_PASSES: 35,
    HIGHLIGHT_ATTR: 'data-openshield-finding-id',
    HIGHLIGHT_CLASS: 'openshield-flagged-element',
    IGNORE_TAGS: new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS', 'CODE', 'PRE', 'TEXTAREA', 'INPUT']),
    RULES: [],
  };

  let state = {
    paused: false,
    highlightsEnabled: true,
    findings: [],
    dismissedIds: new Set(),
    seenFingerprints: new Set(),
    discoveredLinks: [],
    knownService: null,
    mutationPassCount: 0,
    lastScanTimestamp: null,
  };

  let observer = null;
  let debounceTimer = null;
  let isApplyingHighlights = false;

  function getDomain() {
    return (window.location.hostname || '').replace(/^www\./, '').toLowerCase();
  }

  async function loadSitesDataset() {
    try {
      const url = chrome.runtime.getURL('sites.json');
      const res = await fetch(url);
      const sites = await res.json();
      const domain = getDomain();
      state.knownService =
        sites.find((s) => domain === s.domain || domain.endsWith(`.${s.domain}`)) ||
        null;
    } catch {
      state.knownService = null;
    }
  }

  function parseLuminance(rgbString) {
    const match = (rgbString || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return { r: 255, g: 255, b: 255, a: 1, lum: 1 };
    const r = Number(match[1]) / 255;
    const g = Number(match[2]) / 255;
    const b = Number(match[3]) / 255;
    const a = match[4] !== undefined ? Number(match[4]) : 1;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return { r, g, b, a, lum };
  }

  /**
   * Inspects consent/checkout action button pairs using computed styles
   * to detect visual interference (e.g. tiny, low-contrast, or low-opacity reject option).
   */
  function scanVisualInterference(root = document.body) {
    if (!root) return;
    const interactiveEls = Array.from(
      root.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')
    ).slice(0, 120);

    const acceptPatterns = /\b(?:accept\s+all|agree\s+and\s+continue|yes,\s+upgrade|start\s+paid\s+membership|claim\s+offer|keep\s+protection)\b/i;
    const declinePatterns = /\b(?:reject\s+all|decline|no\s+thanks|manage\s+preferences|continue\s+without|opt\s+out|skip\s+protection)\b/i;

    for (const acceptEl of interactiveEls) {
      const acceptText = (acceptEl.textContent || acceptEl.value || '').replace(/\s+/g, ' ').trim();
      if (!acceptText || acceptText.length > 70 || !acceptPatterns.test(acceptText)) continue;

      const container = acceptEl.closest('div, section, form, dialog, aside') || acceptEl.parentElement;
      if (!container) continue;

      const siblingControls = Array.from(
        container.querySelectorAll('button, a, [role="button"], span')
      );

      for (const declineEl of siblingControls) {
        if (declineEl === acceptEl) continue;
        const declineText = (declineEl.textContent || '').replace(/\s+/g, ' ').trim();
        if (!declineText || declineText.length > 90 || !declinePatterns.test(declineText)) continue;

        const acceptStyle = window.getComputedStyle(acceptEl);
        const declineStyle = window.getComputedStyle(declineEl);
        const acceptRect = acceptEl.getBoundingClientRect();
        const declineRect = declineEl.getBoundingClientRect();

        if (acceptRect.width === 0 || declineRect.width === 0) continue;

        const acceptOpacity = parseFloat(acceptStyle.opacity || '1');
        const declineOpacity = parseFloat(declineStyle.opacity || '1');
        const acceptFont = parseFloat(acceptStyle.fontSize || '14');
        const declineFont = parseFloat(declineStyle.fontSize || '14');
        const declineColor = parseLuminance(declineStyle.color);

        const isLowVisibility =
          declineOpacity < 0.65 ||
          declineColor.a < 0.6 ||
          acceptFont >= declineFont * 1.35 ||
          acceptRect.width * acceptRect.height >= declineRect.width * declineRect.height * 3.2;

        if (isLowVisibility) {
          const fingerprint = `EXT_VISUAL_INTERFERENCE::${acceptText.toLowerCase()}::${declineText.toLowerCase()}`;
          if (state.seenFingerprints.has(fingerprint)) continue;
          state.seenFingerprints.add(fingerprint);

          const findingId = `finding_${state.findings.length + 1}`;
          state.findings.push({
            id: findingId,
            ruleId: 'EXT_VISUAL_INTERFERENCE',
            title: 'Visual interference in consent or checkout choices',
            category: 'Confirm-shaming and manipulative consent interfaces',
            taxonomy: 'Visual interference',
            riskLevel: 'Medium',
            nature: 'Inferred Pattern Risk',
            confidence: 'Medium',
            evidenceQuote: `Primary action "${acceptText}" (${Math.round(acceptFont)}px) paired with visually de-emphasized option "${declineText}" (${Math.round(declineFont)}px, opacity ${declineOpacity.toFixed(2)}).`,
            explanation:
              'Computed-style comparison shows the decline or privacy-preserving action has significantly lower size, contrast, or opacity than the accept button.',
            whyItMatters:
              'Asymmetric visual weighting steers users toward accepting tracking or paid upgrades by making the opt-out harder to notice.',
            whatToCheck:
              'Inspect the smaller or lighter-colored option ("' + declineText + '") if you prefer to decline.',
            source: 'DOM & Computed-Style Inspection',
          });

          applyElementHighlight(declineEl, findingId, 'Medium');
        }
      }
    }
  }

  function applyElementHighlight(el, findingId, riskLevel) {
    if (!el || !el.setAttribute) return;
    isApplyingHighlights = true;
    try {
      el.setAttribute(CONSTANTS.HIGHLIGHT_ATTR, findingId);
      el.setAttribute('data-openshield-risk', riskLevel);
      if (state.highlightsEnabled && !state.paused && !state.dismissedIds.has(findingId)) {
        el.classList.add(CONSTANTS.HIGHLIGHT_CLASS);
      }
    } finally {
      isApplyingHighlights = false;
    }
  }

  function refreshAllHighlights() {
    isApplyingHighlights = true;
    try {
      const flagged = document.querySelectorAll(`[${CONSTANTS.HIGHLIGHT_ATTR}]`);
      flagged.forEach((el) => {
        const id = el.getAttribute(CONSTANTS.HIGHLIGHT_ATTR);
        if (state.highlightsEnabled && !state.paused && !state.dismissedIds.has(id)) {
          el.classList.add(CONSTANTS.HIGHLIGHT_CLASS);
        } else {
          el.classList.remove(CONSTANTS.HIGHLIGHT_CLASS);
        }
      });
    } finally {
      isApplyingHighlights = false;
    }
  }

  function scanPolicyLinks() {
    const anchors = Array.from(document.querySelectorAll('a[href]')).slice(0, 250);
    const currentDomain = getDomain();
    const seen = new Set();
    const links = [];

    for (const a of anchors) {
      const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
      const rawHref = a.getAttribute('href') || '';
      if (!text || text.length > 70 || !rawHref) continue;

      let resolved;
      try {
        resolved = new URL(rawHref, window.location.href);
        if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
      } catch {
        continue;
      }

      const urlStr = resolved.toString();
      if (seen.has(urlStr)) continue;

      const targetHost = resolved.hostname.replace(/^www\./, '').toLowerCase();
      const verifiedSameDomain =
        targetHost === currentDomain || targetHost.endsWith(`.${currentDomain}`);

      const combined = `${text} ${rawHref}`.toLowerCase();
      let type = null;
      if (/\b(?:cancel|unsubscribe|delete[-_\s]?account)\b/.test(combined)) {
        type = 'cancellation';
      } else if (/\b(?:refund|return[-_\s]?policy)\b/.test(combined)) {
        type = 'refunds';
      } else if (/\b(?:subscription|billing[-_\s]?terms)\b/.test(combined)) {
        type = 'subscription';
      } else if (/\b(?:privacy[-_\s]?policy|privacy[-_\s]?notice)\b/.test(combined)) {
        type = 'privacy';
      } else if (/\b(?:terms[-_\s]?of[-_\s]?(?:service|use|sale)|terms[-_\s]?and[-_\s]?conditions)\b/.test(combined)) {
        type = 'terms';
      }

      if (type && verifiedSameDomain) {
        seen.add(urlStr);
        links.push({ label: text, url: urlStr, type, verifiedSameDomain });
      }
      if (links.length >= 8) break;
    }

    state.discoveredLinks = links;
  }

  function scanSubtree(rootNode = document.body) {
    if (state.paused || !rootNode) return;

    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (CONSTANTS.IGNORE_TAGS.has(node.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.hasAttribute && node.hasAttribute(CONSTANTS.HIGHLIGHT_ATTR)) {
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let inspected = 0;
    let current = walker.currentNode;

    while (current && inspected < CONSTANTS.MAX_NODES_PER_PASS) {
      inspected++;
      // Inspect leaf-like text containers (p, li, span, div, label, small, td)
      if (current.children && current.children.length <= 3) {
        const text = (current.innerText || current.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length >= 20 && text.length <= 650) {
          for (const rule of CONSTANTS.RULES) {
            if (rule.negativePattern && rule.negativePattern.test(text)) continue;
            if (rule.pattern.test(text)) {
              const fingerprint = `${rule.id}::${text.toLowerCase().slice(0, 100)}`;
              if (state.seenFingerprints.has(fingerprint)) continue;
              state.seenFingerprints.add(fingerprint);

              const findingId = `finding_${state.findings.length + 1}`;
              state.findings.push({
                id: findingId,
                ruleId: rule.id,
                title: rule.title,
                category: rule.category,
                taxonomy: rule.taxonomy,
                riskLevel: rule.riskLevel,
                nature: rule.nature,
                confidence: rule.confidence,
                evidenceQuote: text.length > 280 ? `${text.slice(0, 277)}...` : text,
                explanation: rule.explanation,
                whyItMatters: rule.whyItMatters,
                whatToCheck: rule.whatToCheck,
                source: 'Deterministic Rule Engine',
              });

              applyElementHighlight(current, findingId, rule.riskLevel);
            }
          }
        }
      }
      current = walker.nextNode();
    }

    scanVisualInterference(rootNode);
    scanPolicyLinks();
    state.lastScanTimestamp = new Date().toISOString();
    notifyBadgeUpdate();
  }

  function getActiveFindings() {
    return state.findings.filter((f) => !state.dismissedIds.has(f.id));
  }

  function notifyBadgeUpdate() {
    const active = getActiveFindings();
    const hasCriticalOrHigh = active.some(
      (f) => f.riskLevel === 'Critical' || f.riskLevel === 'High'
    );
    try {
      chrome.runtime.sendMessage({
        type: 'OPENSHIELD_UPDATE_BADGE',
        count: active.length,
        paused: state.paused,
        hasCriticalOrHigh,
      });
    } catch {
      // Ignore when extension context is invalidated
    }
  }

  function setupMutationObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      if (state.paused || isApplyingHighlights) return;
      if (state.mutationPassCount >= CONSTANTS.MAX_MUTATION_PASSES) return;

      const hasRelevantAddition = mutations.some((m) =>
        Array.from(m.addedNodes || []).some(
          (n) =>
            n.nodeType === Node.ELEMENT_NODE &&
            !CONSTANTS.IGNORE_TAGS.has(n.tagName) &&
            !(n.classList && n.classList.contains(CONSTANTS.HIGHLIGHT_CLASS))
        )
      );

      if (!hasRelevantAddition) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.mutationPassCount++;
        scanSubtree(document.body);
      }, CONSTANTS.DEBOUNCE_MS);
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  function teardownObserver() {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function performFullRescan() {
    state.findings = [];
    state.seenFingerprints.clear();
    state.mutationPassCount = 0;

    isApplyingHighlights = true;
    try {
      document.querySelectorAll(`[${CONSTANTS.HIGHLIGHT_ATTR}]`).forEach((el) => {
        el.removeAttribute(CONSTANTS.HIGHLIGHT_ATTR);
        el.removeAttribute('data-openshield-risk');
        el.classList.remove(CONSTANTS.HIGHLIGHT_CLASS);
      });
    } finally {
      isApplyingHighlights = false;
    }

    if (!state.paused) {
      scanSubtree(document.body);
      setupMutationObserver();
    } else {
      teardownObserver();
      notifyBadgeUpdate();
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === 'OPENSHIELD_GET_STATE') {
      sendResponse({
        domain: getDomain(),
        url: window.location.href,
        paused: state.paused,
        highlightsEnabled: state.highlightsEnabled,
        findings: getActiveFindings(),
        dismissedCount: state.dismissedIds.size,
        discoveredLinks: state.discoveredLinks,
        knownService: state.knownService,
        lastScanTimestamp: state.lastScanTimestamp,
      });
      return true;
    }

    if (message.type === 'OPENSHIELD_RESCAN') {
      performFullRescan();
      sendResponse({
        ok: true,
        findings: getActiveFindings(),
        lastScanTimestamp: state.lastScanTimestamp,
      });
      return true;
    }

    if (message.type === 'OPENSHIELD_TOGGLE_PAUSE') {
      state.paused = Boolean(message.paused);
      const domainKey = `paused_${getDomain()}`;
      chrome.storage?.local?.set({ [domainKey]: state.paused });
      if (state.paused) {
        teardownObserver();
      } else {
        performFullRescan();
      }
      refreshAllHighlights();
      notifyBadgeUpdate();
      sendResponse({ ok: true, paused: state.paused, findings: getActiveFindings() });
      return true;
    }

    if (message.type === 'OPENSHIELD_TOGGLE_HIGHLIGHTS') {
      state.highlightsEnabled = Boolean(message.highlightsEnabled);
      refreshAllHighlights();
      sendResponse({ ok: true, highlightsEnabled: state.highlightsEnabled });
      return true;
    }

    if (message.type === 'OPENSHIELD_DISMISS_FINDING') {
      if (message.findingId) {
        state.dismissedIds.add(message.findingId);
        refreshAllHighlights();
        notifyBadgeUpdate();
      }
      sendResponse({ ok: true, findings: getActiveFindings() });
      return true;
    }

    return false;
  });

  async function init() {
    await loadSitesDataset();
    const domainKey = `paused_${getDomain()}`;
    chrome.storage?.local?.get([domainKey], (res) => {
      state.paused = Boolean(res && res[domainKey]);
      if (!state.paused) {
        scanSubtree(document.body);
        setupMutationObserver();
      } else {
        notifyBadgeUpdate();
      }
    });
  }

  init();
})();
