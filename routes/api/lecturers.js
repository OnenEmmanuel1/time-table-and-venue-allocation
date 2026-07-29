/**
 * API — Lecturers CRUD
 * Admin-only write access; authenticated users can read.
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

const adminOnly = [isAuthenticated, authorizeRoles('admin')];

/* ── List lecturers ────────────────────────────── */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.id, l.user_id, l.availability_notes, u.name, u.email
       FROM lecturers l
       JOIN users u ON l.user_id = u.id
       ORDER BY u.name`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Lecturers GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch lecturers.' });
  }
});

/* ── Create lecturer ───────────────────────────── */
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, email, availability_notes } = req.body;
    const bcrypt = require('bcryptjs');

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const hash = await bcrypt.hash('password123', 10);

    const [userResult] = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, 'lecturer']
    );

    const [lecResult] = await db.query(
      'INSERT INTO lecturers (user_id, availability_notes) VALUES (?, ?)',
      [userResult.insertId, availability_notes || '']
    );

    return res.status(201).json({ success: true, id: lecResult.insertId, user_id: userResult.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    console.error('Lecturer POST error:', err);
    return res.status(500).json({ error: 'Failed to create lecturer.' });
  }
});

/* ── Update lecturer ───────────────────────────── */
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { name, email, availability_notes } = req.body;

    const [lecRows] = await db.query('SELECT user_id FROM lecturers WHERE id = ?', [req.params.id]);
    if (!lecRows.length) return res.status(404).json({ error: 'Lecturer not found.' });

    await db.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, lecRows[0].user_id]);
    await db.query('UPDATE lecturers SET availability_notes = ? WHERE id = ?', [availability_notes || '', req.params.id]);

    return res.json({ success: true });
  } catch (err) {
    console.error('Lecturer PUT error:', err);
    return res.status(500).json({ error: 'Failed to update lecturer.' });
  }
});

/* ── Delete lecturer ───────────────────────────── */
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const [lecRows] = await db.query('SELECT user_id FROM lecturers WHERE id = ?', [req.params.id]);
    if (!lecRows.length) return res.status(404).json({ error: 'Lecturer not found.' });

    await db.query('DELETE FROM lecturers WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM users WHERE id = ?', [lecRows[0].user_id]);

    return res.json({ success: true });
  } catch (err) {
    console.error('Lecturer DELETE error:', err);
    return res.status(500).json({ error: 'Failed to delete lecturer.' });
  }
});

module.exports = router;
