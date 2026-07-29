/**
 * TimetablePro — Timetable Client-Side Logic
 * Grid rendering helpers and filter logic.
 */

(function () {
  'use strict';

  /* Helper: Format time string */
  function fmtTime(timeStr) {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0]);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return h12 + ':' + m + ' ' + ampm;
  }

  /* Expose */
  window.TTV = window.TTV || {};
  window.TTV.fmtTime = fmtTime;
})();
