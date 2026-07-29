/**
 * API — Courses CRUD
 * All routes require Admin role.
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

const adminOnly = [isAuthenticated, authorizeRoles('admin')];

/* ── List all courses ──────────────────────────── */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, l.id AS lid, u.name AS lecturer_name
       FROM courses c
       LEFT JOIN lecturers l ON c.lecturer_id = l.id
       LEFT JOIN users u ON l.user_id = u.id
       ORDER BY c.level, c.code`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Courses GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch courses.' });
  }
});

/* ── Create course ─────────────────────────────── */
router.post('/', adminOnly, async (req, res) => {
  try {
    const { code, title, unit, level, lecturer_id, expected_students } = req.body;

    if (!code || !title || !level) {
      return res.status(400).json({ error: 'Code, title, and level are required.' });
    }

    const [result] = await db.query(
      'INSERT INTO courses (code, title, unit, level, lecturer_id, expected_students) VALUES (?, ?, ?, ?, ?, ?)',
      [code, title, unit || 3, level, lecturer_id || null, expected_students || 0]
    );

    return res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A course with this code already exists.' });
    }
    console.error('Course POST error:', err);
    return res.status(500).json({ error: 'Failed to create course.' });
  }
});

/* ── Update course ─────────────────────────────── */
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { code, title, unit, level, lecturer_id, expected_students } = req.body;

    await db.query(
      'UPDATE courses SET code = ?, title = ?, unit = ?, level = ?, lecturer_id = ?, expected_students = ? WHERE id = ?',
      [code, title, unit, level, lecturer_id || null, expected_students, req.params.id]
    );

    return res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Course code already in use.' });
    }
    console.error('Course PUT error:', err);
    return res.status(500).json({ error: 'Failed to update course.' });
  }
});

/* ── Delete course ─────────────────────────────── */
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM courses WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Course DELETE error:', err);
    return res.status(500).json({ error: 'Failed to delete course.' });
  }
});

module.exports = router;
