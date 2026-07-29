/**
 * Page Routes — Head of Department (HOD)
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const TimetableEngine = require('../../engine/ttvEngine');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

router.use(isAuthenticated, authorizeRoles('hod'));

/* ── Dashboard ─────────────────────────────────── */
router.get('/dashboard', async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const stats = await engine.getStats();
    res.render('hod/dashboard', {
      title: 'HOD Dashboard — TimetablePro',
      user: req.session.user,
      stats
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load dashboard.', user: req.session.user });
  }
});

/* ── Timetable view & approval ─────────────────── */
router.get('/timetable', async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const entries = await engine.getTimetable();
    res.render('hod/timetable', {
      title: 'Review Timetable — TimetablePro',
      user: req.session.user,
      entries
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load timetable.', user: req.session.user });
  }
});

module.exports = router;
