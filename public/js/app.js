/**
 * TimetablePro — Shared Client-Side Utilities
 * Toast notifications, active sidebar link, helpers.
 */

(function () {
  'use strict';

  /* ── Toast Notifications ─────────────────────── */
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('ttv-toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'ttv-toast ttv-toast-' + type;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      el.style.transition = '0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  /* ── Active Sidebar Link ─────────────────────── */
  function setActiveSidebarLink() {
    const path = window.location.pathname;
    document.querySelectorAll('.ttv-sidebar-link').forEach(link => {
      if (link.getAttribute('href') === path) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /* ── Confirm Dialog Wrapper ──────────────────── */
  function confirmAction(message) {
    return window.confirm(message);
  }

  /* ── Initialize ──────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    setActiveSidebarLink();
  });

  /* ── Expose globals ──────────────────────────── */
  window.TTV = {
    toast,
    confirmAction
  };
})();
