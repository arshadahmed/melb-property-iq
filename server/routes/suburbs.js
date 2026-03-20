const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');

// GET /api/suburbs — all suburbs with stats
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM suburb_stats ORDER BY score DESC`).all();
  res.json(rows);
});

// GET /api/suburbs/leaderboard
router.get('/leaderboard', (req, res) => {
  const db    = getDb();
  const limit = parseInt(req.query.limit) || 10;
  const rows  = db.prepare(`SELECT * FROM suburb_stats ORDER BY score DESC LIMIT ?`).all(limit);
  res.json(rows);
});

// GET /api/suburbs/:name — single suburb detail
router.get('/:name', (req, res) => {
  const db   = getDb();
  const name = req.params.name;
  const row  = db.prepare(`SELECT * FROM suburb_stats WHERE LOWER(suburb) = LOWER(?)`).get(name);
  if (!row) return res.status(404).json({ error: 'Suburb not found' });
  res.json(row);
});

// GET /api/suburbs/:name/trend — price trend over time
router.get('/:name/trend', (req, res) => {
  const db   = getDb();
  const name = req.params.name;
  const rows = db.prepare(`
    SELECT quarter, ROUND(median_price / 1000, 0) as median_k, sales_count
    FROM suburbs
    WHERE LOWER(suburb) = LOWER(?) AND property_type = 'house'
    ORDER BY quarter ASC
  `).all(name);
  res.json(rows);
});

// GET /api/suburbs/:name/listings — properties for sale in suburb
router.get('/:name/listings', (req, res) => {
  const db   = getDb();
  const name = req.params.name;

  const listings = db.prepare(`
    SELECT l.id, l.address, l.property_type as type, l.beds, l.price, l.description as desc
    FROM listings l
    WHERE LOWER(l.suburb) = LOWER(?)
    ORDER BY l.price DESC
  `).all(name);

  // Attach sale history to each listing
  const historyStmt = db.prepare(`
    SELECT sale_date as date, price FROM sale_history
    WHERE listing_id = ? ORDER BY sale_date DESC
  `);

  const result = listings.map(l => ({
    ...l,
    history: historyStmt.all(l.id),
  }));

  res.json(result);
});

module.exports = router;
