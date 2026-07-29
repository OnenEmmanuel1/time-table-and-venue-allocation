/**
 * Page Routes — Lecturer
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const TimetableEngine = require('../../engine/ttvEngine');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

router.use(isAuthenticated, authorizeRoles('lecturer'));

/* ── Dashboard ─────────────────────────────────── */
router.get('/dashboard', async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const entries = await engine.getTimetable({
      lecturerId: req.session.user.lecturerId
    });
    res.render('lecturer/dashboard', {
      title: 'Lecturer Dashboard — TimetablePro',
      user: req.session.user,
      totalClasses: entries.length
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load dashboard.', user: req.session.user });
  }
});

/* ── Personal schedule ─────────────────────────── */
router.get('/schedule', async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const entries = await engine.getTimetable({
      lecturerId: req.session.user.lecturerId
    });
    res.render('lecturer/schedule', {
      title: 'My Schedule — TimetablePro',
      user: req.session.user,
      entries
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load schedule.', user: req.session.user });
  }
});

module.exports = router;
