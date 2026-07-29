/**
 * API — Timetable Generation, Publication & Modification
 * Delegates all business logic to engine/ttvEngine.js
 */

const express          = require('express');
const router           = express.Router();
const db               = require('../../config/db');
const TimetableEngine  = require('../../engine/ttvEngine');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

const adminOnly    = [isAuthenticated, authorizeRoles('admin')];
const adminOrHOD   = [isAuthenticated, authorizeRoles('admin', 'hod')];

/* ── Generate timetable (Admin) ────────────────── */
router.post('/generate', adminOnly, async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const result = await engine.generateTimetable();

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({
      success: true,
      message: `Timetable generated successfully with ${result.entries.length} entries.`,
      entries: result.entries,
      conflictsResolved: result.conflictsResolved.length
    });
  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: 'Failed to generate timetable.' });
  }
});

/* ── Approve / Publish (HOD) ───────────────────── */
router.post('/approve', adminOrHOD, async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const result = await engine.publishTimetable();

    if (result.count === 0) {
      return res.status(400).json({ error: 'No draft timetable to approve.' });
    }

    return res.json({
      success: true,
      message: `${result.count} entries published successfully.`
    });
  } catch (err) {
    console.error('Approve error:', err);
    return res.status(500).json({ error: 'Failed to approve timetable.' });
  }
});

/* ── Modify single entry (Admin post-publication) ─ */
router.put('/entry/:id', adminOnly, async (req, res) => {
  try {
    const { time_slot_id, venue_id } = req.body;

    if (!time_slot_id || !venue_id) {
      return res.status(400).json({ error: 'Time slot and venue are required.' });
    }

    const engine = new TimetableEngine(db);
    const result = await engine.reassignEntry(
      parseInt(req.params.id),
      parseInt(time_slot_id),
      parseInt(venue_id)
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('Reassign error:', err);
    return res.status(500).json({ error: 'Failed to reassign entry.' });
  }
});

/* ── Get timetable entries ─────────────────────── */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const filters = {};

    if (req.query.status)      filters.status     = req.query.status;
    if (req.query.level)       filters.level       = parseInt(req.query.level);
    if (req.query.lecturer_id) filters.lecturerId  = parseInt(req.query.lecturer_id);

    /* Students can only see published entries for their level */
    if (req.session.user.role === 'student') {
      filters.status = 'published';
      filters.level  = req.session.user.level;
    }

    /* Lecturers see only their entries */
    if (req.session.user.role === 'lecturer') {
      filters.lecturerId = req.session.user.lecturerId;
    }

    const entries = await engine.getTimetable(filters);
    return res.json(entries);
  } catch (err) {
    console.error('Timetable GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch timetable.' });
  }
});

/* ── Get conflict log ──────────────────────────── */
router.get('/conflicts', adminOnly, async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const logs = await engine.getConflictLogs();
    return res.json(logs);
  } catch (err) {
    console.error('Conflicts GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch conflict logs.' });
  }
});

/* ── Get statistics ────────────────────────────── */
router.get('/stats', adminOrHOD, async (req, res) => {
  try {
    const engine = new TimetableEngine(db);
    const stats = await engine.getStats();
    return res.json(stats);
  } catch (err) {
    console.error('Stats GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

module.exports = router;
