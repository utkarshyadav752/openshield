/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Standalone Website Entry Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('heroAnalyzeForm');
  const input = document.getElementById('heroUrlInput');

  if (form && input) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const targetUrl = input.value.trim();
      if (!targetUrl) return;
      const params = new URLSearchParams({ url: targetUrl });
      window.location.href = `analyzer.html?${params.toString()}`;
    });
  }
});
