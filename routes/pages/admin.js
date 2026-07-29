/**
 * Page Routes — Admin
 * All routes require the 'admin' role.
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const TimetableEngine = require('../../engine/ttvEngine');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

router.use(isAuthenticated, authorizeRoles('admin'));

/* ── Dashboard ─────────────────────────────────── */
router.get('/dashboard', async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const stats = await engine.getStats();
    res.render('admin/dashboard', {
      title: 'Admin Dashboard — TimetablePro',
      user: req.session.user,
      stats
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load dashboard.', user: req.session.user });
  }
});

/* ── Courses management ────────────────────────── */
router.get('/courses', async (req, res) => {
  try {
    const [courses] = await db.query(
      `SELECT c.*, u.name AS lecturer_name
       FROM courses c
       LEFT JOIN lecturers l ON c.lecturer_id = l.id
       LEFT JOIN users u ON l.user_id = u.id
       ORDER BY c.level, c.code`
    );
    const [lecturers] = await db.query(
      `SELECT l.id, u.name FROM lecturers l JOIN users u ON l.user_id = u.id ORDER BY u.name`
    );
    res.render('admin/courses', {
      title: 'Manage Courses — TimetablePro',
      user: req.session.user,
      courses,
      lecturers
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load courses.', user: req.session.user });
  }
});

/* ── Lecturers management ──────────────────────── */
router.get('/lecturers', async (req, res) => {
  try {
    const [lecturers] = await db.query(
      `SELECT l.id, l.user_id, l.availability_notes, u.name, u.email
       FROM lecturers l JOIN users u ON l.user_id = u.id ORDER BY u.name`
    );
    res.render('admin/lecturers', {
      title: 'Manage Lecturers — TimetablePro',
      user: req.session.user,
      lecturers
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load lecturers.', user: req.session.user });
  }
});

/* ── Venues management ─────────────────────────── */
router.get('/venues', async (req, res) => {
  try {
    const [venues] = await db.query('SELECT * FROM venues ORDER BY name');
    res.render('admin/venues', {
      title: 'Manage Venues — TimetablePro',
      user: req.session.user,
      venues
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load venues.', user: req.session.user });
  }
});

/* ── Time Slots management ─────────────────────── */
router.get('/timeslots', async (req, res) => {
  try {
    const [timeslots] = await db.query(
      `SELECT * FROM time_slots
       ORDER BY FIELD(day,'Monday','Tuesday','Wednesday','Thursday','Friday'), start_time`
    );
    res.render('admin/timeslots', {
      title: 'Manage Time Slots — TimetablePro',
      user: req.session.user,
      timeslots
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load time slots.', user: req.session.user });
  }
});

/* ── Timetable view & generation ───────────────── */
router.get('/timetable', async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const entries = await engine.getTimetable();
    const [venues] = await db.query('SELECT * FROM venues ORDER BY name');
    const [timeslots] = await db.query(
      `SELECT * FROM time_slots
       ORDER BY FIELD(day,'Monday','Tuesday','Wednesday','Thursday','Friday'), start_time`
    );
    res.render('admin/timetable', {
      title: 'Timetable — TimetablePro',
      user: req.session.user,
      entries,
      venues,
      timeslots
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load timetable.', user: req.session.user });
  }
});

/* ── Conflict log ──────────────────────────────── */
router.get('/conflicts', async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const logs = await engine.getConflictLogs();
    res.render('admin/conflicts', {
      title: 'Conflict Log — TimetablePro',
      user: req.session.user,
      logs
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Failed to load conflicts.', user: req.session.user });
  }
});

module.exports = router;
