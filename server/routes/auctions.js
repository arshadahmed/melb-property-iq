const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');

// GET /api/auctions/recent
router.get('/recent', (req, res) => {
  const db    = getDb();
  const limit = parseInt(req.query.limit) || 10;
  const rows  = db.prepare(`
    SELECT address || ', ' || suburb as address, result, price, above_reserve_pct, auction_date
    FROM auctions ORDER BY auction_date DESC LIMIT ?
  `).all(limit);
  res.json(rows);
});

module.exports = router;
