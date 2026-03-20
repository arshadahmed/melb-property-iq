const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');

// GET /api/properties/sample — sample property for the Property tab
router.get('/sample', (req, res) => {
  const db = getDb();
  const listing = db.prepare(`SELECT * FROM listings LIMIT 1 OFFSET 2`).get();
  if (!listing) return res.json({ address: '42 Nicholson St, Fitzroy', sales: [] });

  const history = db.prepare(`
    SELECT sale_date as date, price FROM sale_history
    WHERE listing_id = ? ORDER BY sale_date ASC
  `).all(listing.id);

  res.json({
    address: `${listing.address}, ${listing.suburb || 'Melbourne'} VIC`,
    sales: history,
  });
});

module.exports = router;
