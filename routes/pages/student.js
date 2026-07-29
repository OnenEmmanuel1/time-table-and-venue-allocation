/**
 * Page Routes — Student
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const TimetableEngine = require('../../engine/ttvEngine');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

router.use(isAuthenticated, authorizeRoles('student'));

/* ── Dashboard ─────────────────────────────────── */
router.get('/dashboard', async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const entries = await engine.getTimetable({
      status: 'published',
      level: req.session.user.level
    });
    res.render('student/dashboard', {
      title: 'Student Dashboard — TimetablePro',
      user: req.session.user,
      totalClasses: entries.length
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load dashboard.', user: req.session.user });
  }
});

/* ── Level timetable ───────────────────────────── */
router.get('/timetable', async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const entries = await engine.getTimetable({
      status: 'published',
      level: req.session.user.level
    });
    res.render('student/timetable', {
      title: `Level ${req.session.user.level} Timetable — TimetablePro`,
      user: req.session.user,
      entries
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load timetable.', user: req.session.user });
  }
});

module.exports = router;
