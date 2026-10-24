/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Manifest V3 Background Service Worker
 * Manages extension badge counts per tab and coordinates local known-site lookups.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'OPENSHIELD_UPDATE_BADGE') {
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    const count = Number(message.count) || 0;
    const paused = Boolean(message.paused);

    if (typeof tabId === 'number') {
      if (paused) {
        chrome.action.setBadgeText({ tabId, text: 'OFF' });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#64748B' });
      } else if (count > 0) {
        chrome.action.setBadgeText({ tabId, text: String(count) });
        chrome.action.setBadgeBackgroundColor({
          tabId,
          color: message.hasCriticalOrHigh ? '#DC2626' : '#D97706',
        });
      } else {
        chrome.action.setBadgeText({ tabId, text: '' });
      }
    }
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
