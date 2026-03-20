const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');

const suburbRoutes  = require('./routes/suburbs');
const auctionRoutes = require('./routes/auctions');
const propertyRoutes= require('./routes/properties');
const { initDb }    = require('./db/database');
const { syncData }  = require('./jobs/syncData');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Init DB on startup ──
initDb();

// ── Routes ──
app.use('/api/suburbs',    suburbRoutes);
app.use('/api/auctions',   auctionRoutes);
app.use('/api/properties', propertyRoutes);

// Overview endpoint
app.get('/api/overview', (req, res) => {
  const db = require('./db/database').getDb();
  const metro   = db.prepare(`SELECT ROUND(AVG(median_price)/1000,0)*1000 as metro_median FROM suburbs WHERE quarter = (SELECT MAX(quarter) FROM suburbs)`).get();
  const prev    = db.prepare(`SELECT ROUND(AVG(median_price)/1000,0)*1000 as prev_median  FROM suburbs WHERE quarter = (SELECT MAX(quarter) FROM suburbs WHERE quarter < (SELECT MAX(quarter) FROM suburbs))`).get();
  const best    = db.prepare(`SELECT suburb, growth_pct FROM suburb_stats ORDER BY growth_pct DESC LIMIT 1`).get();
  const yield_  = db.prepare(`SELECT ROUND(AVG(gross_yield),1) as avg_yield FROM suburb_stats`).get();
  const growth  = metro.metro_median && prev.prev_median ? (((metro.metro_median - prev.prev_median) / prev.prev_median) * 100).toFixed(1) : 0;

  res.json({
    metro_median:    metro.metro_median || 980000,
    metro_growth:    growth,
    clearance_rate:  71,
    best_suburb:     best?.suburb || 'Footscray',
    best_growth:     best?.growth_pct || 14.7,
    avg_yield:       yield_?.avg_yield || 3.9,
  });
});

// Metro trend endpoint
app.get('/api/trend', (req, res) => {
  const db = require('./db/database').getDb();
  const rows = db.prepare(`
    SELECT quarter, ROUND(AVG(median_price)/1000, 0) as median_k
    FROM suburbs
    GROUP BY quarter
    ORDER BY quarter ASC
    LIMIT 12
  `).all();
  res.json(rows.length ? rows : fallbackTrend());
});

function fallbackTrend() {
  return [
    {quarter:"Q1 2023",median_k:870},{quarter:"Q2 2023",median_k:895},
    {quarter:"Q3 2023",median_k:910},{quarter:"Q4 2023",median_k:928},
    {quarter:"Q1 2024",median_k:945},{quarter:"Q2 2024",median_k:958},
    {quarter:"Q3 2024",median_k:971},{quarter:"Q4 2024",median_k:980},
  ];
}

// ── Weekly data sync (every Sunday 3am) ──
cron.schedule('0 3 * * 0', () => {
  console.log('[cron] Running weekly data sync...');
  syncData();
});

app.listen(PORT, () => {
  console.log(`✅ PropIQ server running on http://localhost:${PORT}`);
  // Sync data on first start if DB is empty
  const db = require('./db/database').getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM suburbs').get();
  if (count.c === 0) {
    console.log('[startup] Database empty — running initial data sync...');
    syncData();
  }
});
