/**
 * API — Venues CRUD
 * Admin-only write access.
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { isAuthenticated, authorizeRoles } = require('../../middleware/auth');

const adminOnly = [isAuthenticated, authorizeRoles('admin')];

/* ── List venues ───────────────────────────────── */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM venues ORDER BY name');
    return res.json(rows);
  } catch (err) {
    console.error('Venues GET error:', err);
    return res.status(500).json({ error: 'Failed to fetch venues.' });
  }
});

/* ── Create venue ──────────────────────────────── */
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, capacity } = req.body;
    if (!name || !capacity) {
      return res.status(400).json({ error: 'Name and capacity are required.' });
    }

    const [result] = await db.query(
      'INSERT INTO venues (name, capacity) VALUES (?, ?)',
      [name, parseInt(capacity)]
    );
    return res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Venue name already exists.' });
    }
    console.error('Venue POST error:', err);
    return res.status(500).json({ error: 'Failed to create venue.' });
  }
});

/* ── Update venue ──────────────────────────────── */
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { name, capacity } = req.body;
    await db.query('UPDATE venues SET name = ?, capacity = ? WHERE id = ?',
      [name, parseInt(capacity), req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Venue PUT error:', err);
    return res.status(500).json({ error: 'Failed to update venue.' });
  }
});

/* ── Delete venue ──────────────────────────────── */
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM venues WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Venue DELETE error:', err);
    return res.status(500).json({ error: 'Failed to delete venue.' });
  }
});

module.exports = router;
