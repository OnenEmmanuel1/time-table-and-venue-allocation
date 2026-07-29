/**
 * API — Authentication
 * POST /api/auth/login   → validate credentials, create session
 * POST /api/auth/logout  → destroy session
 */

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../../config/db');

/* ── Login ─────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    /* If the user is a lecturer, fetch their lecturer record id */
    let lecturerId = null;
    if (user.role === 'lecturer') {
      const [lecRows] = await db.query('SELECT id FROM lecturers WHERE user_id = ?', [user.id]);
      if (lecRows.length) lecturerId = lecRows[0].id;
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      level: user.level,
      lecturerId
    };

    /* Determine redirect URL based on role */
    const redirectMap = {
      admin:    '/admin/dashboard',
      hod:      '/hod/dashboard',
      lecturer: '/lecturer/dashboard',
      student:  '/student/dashboard'
    };

    return res.json({
      success: true,
      redirect: redirectMap[user.role] || '/',
      user: req.session.user
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

/* ── Logout ────────────────────────────────────── */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    return res.json({ success: true, redirect: '/login' });
  });
});

module.exports = router;
