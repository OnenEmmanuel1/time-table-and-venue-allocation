/**
 * TimetablePro — Admin Client-Side Logic
 * Handles CRUD operations via fetch API calls.
 */

(function () {
  'use strict';

  /* ── Generic API helper ──────────────────────── */
  async function apiCall(url, method = 'GET', body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    return res.json();
  }

  /* Expose for inline scripts */
  window.TTV = window.TTV || {};
  window.TTV.api = apiCall;
})();
