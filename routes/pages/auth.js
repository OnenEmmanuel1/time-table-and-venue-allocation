/**
 * Page Routes — Authentication
 * GET /login  → render login page
 * GET /logout → destroy session, redirect
 * GET /       → redirect to role-based dashboard
 */

const express = require('express');
const router  = express.Router();

/* ── Home redirect ─────────────────────────────── */
router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const map = {
    admin:    '/admin/dashboard',
    hod:      '/hod/dashboard',
    lecturer: '/lecturer/dashboard',
    student:  '/student/dashboard'
  };
  return res.redirect(map[req.session.user.role] || '/login');
});

/* ── Login page ────────────────────────────────── */
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Login — TimetablePro', error: null });
});

/* ── Logout ────────────────────────────────────── */
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
