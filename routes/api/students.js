/**
 * API — Students CRUD
 * Admin-only write access; authenticated users can read.
 */

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../../config/db');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

const adminOnly = [isAuthenticated, authorizeRoles('admin')];

/* ── List students ─────────────────────────────── */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, role, level, created_at
       FROM users
       WHERE role = 'student'
       ORDER BY level ASC, name ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Students GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch students.' });
  }
});

/* ── Create student ────────────────────────────── */
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, email, level, password } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const studentLevel = parseInt(level) || 100;
    const rawPassword = password && password.trim() ? password.trim() : 'password123';
    const hash = await bcrypt.hash(rawPassword, 10);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role, level) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hash, 'student', studentLevel]
    );

    return res.status(201).json({
      success: true,
      id: result.insertId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      level: studentLevel
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    console.error('Student POST error:', err);
    return res.status(500).json({ error: 'Failed to create student.' });
  }
});

/* ── Update student ────────────────────────────── */
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { name, email, level, password } = req.body;
    const studentId = parseInt(req.params.id);

    const [rows] = await db.query('SELECT id, role FROM users WHERE id = ? AND role = "student"', [studentId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const studentLevel = parseInt(level) || 100;

    if (password && password.trim()) {
      const hash = await bcrypt.hash(password.trim(), 10);
      await db.query(
        'UPDATE users SET name = ?, email = ?, level = ?, password_hash = ? WHERE id = ?',
        [name.trim(), email.trim().toLowerCase(), studentLevel, hash, studentId]
      );
    } else {
      await db.query(
        'UPDATE users SET name = ?, email = ?, level = ? WHERE id = ?',
        [name.trim(), email.trim().toLowerCase(), studentLevel, studentId]
      );
    }

    return res.json({ success: true, message: 'Student updated successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    console.error('Student PUT error:', err);
    return res.status(500).json({ error: 'Failed to update student.' });
  }
});

/* ── Delete student ────────────────────────────── */
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);

    const [rows] = await db.query('SELECT id FROM users WHERE id = ? AND role = "student"', [studentId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [studentId]);

    return res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) {
    console.error('Student DELETE error:', err);
    return res.status(500).json({ error: 'Failed to delete student.' });
  }
});

module.exports = router;
