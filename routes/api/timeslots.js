/**
 * API — Time Slots CRUD
 * Admin-only write access.
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

const adminOnly = [isAuthenticated, authorizeRoles('admin')];

/* ── List time slots ───────────────────────────── */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM time_slots
       ORDER BY FIELD(day, 'Monday','Tuesday','Wednesday','Thursday','Friday'), start_time`
    );
    return res.json(rows);
  } catch (err) {
    console.error('TimeSlots GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch time slots.' });
  }
});

/* ── Create time slot ──────────────────────────── */
router.post('/', adminOnly, async (req, res) => {
  try {
    const { day, start_time, end_time } = req.body;
    if (!day || !start_time || !end_time) {
      return res.status(400).json({ error: 'Day, start time, and end time are required.' });
    }

    const [result] = await db.query(
      'INSERT INTO time_slots (day, start_time, end_time) VALUES (?, ?, ?)',
      [day, start_time, end_time]
    );
    return res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This time slot already exists.' });
    }
    console.error('TimeSlot POST error:', err);
    return res.status(500).json({ error: 'Failed to create time slot.' });
  }
});

/* ── Update time slot ──────────────────────────── */
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { day, start_time, end_time } = req.body;
    await db.query(
      'UPDATE time_slots SET day = ?, start_time = ?, end_time = ? WHERE id = ?',
      [day, start_time, end_time, req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('TimeSlot PUT error:', err);
    return res.status(500).json({ error: 'Failed to update time slot.' });
  }
});

/* ── Delete time slot ──────────────────────────── */
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM time_slots WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('TimeSlot DELETE error:', err);
    return res.status(500).json({ error: 'Failed to delete time slot.' });
  }
});

module.exports = router;
