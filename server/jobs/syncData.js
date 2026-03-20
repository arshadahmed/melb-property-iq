const axios  = require('axios');
const { parse } = require('csv-parse/sync');
const { getDb } = require('../db/database');

// ── data.vic.gov.au CKAN API resource IDs ──
// These point to the actual CSV files for the Victorian Property Sales Report
const DATA_SOURCES = {
  vpsr_quarterly: 'https://vgsi-property-sales-dot-data-api.appspot.com/api/v1/sales/medians/suburbs?state=VIC&propertyType=house&format=csv',
  // Fallback: direct CKAN download URLs
  ckan_quarterly:  'https://discover.data.vic.gov.au/api/3/action/datastore_search?resource_id=b6dd8c7f-5a74-4c86-a89c-06b94f83f2c1&limit=5000',
  ckan_rental:     'https://discover.data.vic.gov.au/api/3/action/datastore_search?resource_id=rental-report-moving-quarterly&limit=5000',
};

async function syncData() {
  console.log('[sync] Starting data sync from data.vic.gov.au...');
  const db = getDb();

  try {
    await syncVPSR(db);
    await computeSuburbStats(db);
    await seedListings(db);
    await seedAuctions(db);
    console.log('[sync] ✅ Data sync complete');
  } catch (err) {
    console.error('[sync] ❌ Sync failed:', err.message);
    console.log('[sync] Falling back to seeded data...');
    seedFallbackData(db);
  }
}

// ── Fetch VPSR data from data.vic.gov.au CKAN API ──
async function syncVPSR(db) {
  console.log('[sync] Fetching Victorian Property Sales Report...');

  // Try the CKAN API first
  const url = 'https://discover.data.vic.gov.au/api/3/action/datastore_search_sql?sql=' +
    encodeURIComponent(`SELECT * FROM "b6dd8c7f-5a74-4c86-a89c-06b94f83f2c1" LIMIT 5000`);

  let rows = [];
  try {
    const res = await axios.get(url, { timeout: 15000 });
    rows = res.data?.result?.records || [];
    console.log(`[sync] Got ${rows.length} records from CKAN API`);
  } catch (e) {
    console.log('[sync] CKAN API unavailable, using fallback data');
    rows = [];
  }

  if (rows.length === 0) {
    seedFallbackData(db);
    return;
  }

  const insert = db.prepare(`
    INSERT OR REPLACE INTO suburbs (suburb, quarter, property_type, median_price, sales_count)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.suburb || row.Suburb || '',
        row.quarter || row.Quarter || '',
        'house',
        parseInt(row.median_price || row.MedianPrice || 0),
        parseInt(row.sales_count  || row.SalesCount  || 0),
      );
    }
  });

  insertMany(rows);
  console.log(`[sync] Saved ${rows.length} suburb records`);
}

// ── Compute derived stats (growth, yield, score) ──
async function computeSuburbStats(db) {
  console.log('[sync] Computing suburb statistics...');

  const latestQ = db.prepare(`SELECT MAX(quarter) as q FROM suburbs`).get()?.q;
  const prevQ   = db.prepare(`SELECT MAX(quarter) as q FROM suburbs WHERE quarter < ?`).get(latestQ)?.q;

  if (!latestQ) return;

  const latest = db.prepare(`SELECT suburb, median_price, sales_count FROM suburbs WHERE quarter = ? AND property_type = 'house'`).all(latestQ);
  const prev   = prevQ ? db.prepare(`SELECT suburb, median_price FROM suburbs WHERE quarter = ? AND property_type = 'house'`).all(prevQ) : [];
  const prevMap = Object.fromEntries(prev.map(r => [r.suburb, r.median_price]));

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO suburb_stats (suburb, median_price, sales_count, growth_pct, gross_yield, median_rent, score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertMany = db.transaction((rows) => {
    for (const r of rows) {
      const prevPrice = prevMap[r.suburb];
      const growth    = prevPrice ? (((r.median_price - prevPrice) / prevPrice) * 100 * 4).toFixed(1) : 0; // annualise quarterly
      const rent      = estimateRent(r.suburb, r.median_price);
      const yield_    = r.median_price ? ((rent * 52 / r.median_price) * 100).toFixed(1) : 0;
      const score     = computeScore(parseFloat(growth), parseFloat(yield_), r.sales_count);

      upsert.run(r.suburb, r.median_price, r.sales_count, parseFloat(growth), parseFloat(yield_), rent, score);
    }
  });

  upsertMany(latest);
  console.log(`[sync] Computed stats for ${latest.length} suburbs`);
}

// ── Helpers ──
function estimateRent(suburb, medianPrice) {
  // Rough yield estimate by price band — replace with real rental data API
  if (medianPrice > 1400000) return 2700;
  if (medianPrice > 1100000) return 2550;
  if (medianPrice > 900000)  return 2400;
  if (medianPrice > 700000)  return 2200;
  return 2000;
}

function computeScore(growth, yield_, volume) {
  // Weighted investment score out of 100
  const gScore = Math.min(growth * 3, 40);   // growth up to 40pts
  const yScore = Math.min(yield_ * 5, 30);   // yield up to 30pts
  const vScore = Math.min(volume / 10, 30);  // volume up to 30pts
  return Math.round(gScore + yScore + vScore);
}

// ── Seed realistic listings (static for now — replace with Domain API) ──
async function seedListings(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM listings').get();
  if (count.c > 0) return; // already seeded

  const listingsData = [
    { suburb:'Footscray', address:'14 Barkly St', type:'House', beds:3, price:820000, desc:'Renovated weatherboard, open plan, north garden.',
      history:[{date:'Mar 2019',price:590000},{date:'Sep 2015',price:420000}] },
    { suburb:'Footscray', address:'7/22 Irving St', type:'Apartment', beds:2, price:560000, desc:'Modern apartment, city views, secure parking.',
      history:[{date:'Jun 2021',price:495000}] },
    { suburb:'Footscray', address:'88 Napier St', type:'House', beds:4, price:1050000, desc:'Spacious family home, period features, double garage.',
      history:[{date:'Oct 2020',price:810000},{date:'Jul 2013',price:510000}] },
    { suburb:'Fitzroy', address:'42 Smith St', type:'House', beds:3, price:1480000, desc:'Victorian terrace, original features, courtyard.',
      history:[{date:'Feb 2018',price:1050000},{date:'May 2012',price:680000}] },
    { suburb:'Fitzroy', address:'5 Greeves St', type:'House', beds:4, price:2100000, desc:'Architect renovated Edwardian, double storey.',
      history:[{date:'Mar 2016',price:1340000},{date:'Jan 2009',price:720000}] },
    { suburb:'Brunswick', address:'77 Albert St', type:'House', beds:3, price:1150000, desc:'Charming cottage, polished floors, landscaped garden.',
      history:[{date:'Sep 2019',price:890000},{date:'Jun 2014',price:620000}] },
    { suburb:'Preston', address:'19 Murray Rd', type:'House', beds:3, price:895000, desc:'Post-war brick, recently updated, large 620m² block.',
      history:[{date:'Jan 2020',price:730000},{date:'Aug 2015',price:490000}] },
    { suburb:'Preston', address:'103 Gilbert Rd', type:'House', beds:4, price:1020000, desc:'Light-filled family home, close to Preston Market.',
      history:[{date:'Jun 2018',price:780000}] },
    { suburb:'Collingwood', address:'22 Oxford St', type:'House', beds:3, price:1350000, desc:'Converted warehouse, polished concrete, rooftop terrace.',
      history:[{date:'Nov 2017',price:980000},{date:'Apr 2011',price:560000}] },
    { suburb:'Richmond', address:'9 Church St', type:'Apartment', beds:2, price:890000, desc:'High-floor apartment, MCG views, concierge.',
      history:[{date:'May 2020',price:820000}] },
  ];

  const insertListing = db.prepare(`INSERT INTO listings (suburb,address,property_type,beds,price,description) VALUES (?,?,?,?,?,?)`);
  const insertHistory = db.prepare(`INSERT INTO sale_history (listing_id,sale_date,price) VALUES (?,?,?)`);

  const insertAll = db.transaction(() => {
    for (const l of listingsData) {
      const result = insertListing.run(l.suburb, l.address, l.type, l.beds, l.price, l.desc);
      const lid = result.lastInsertRowid;
      for (const h of l.history) {
        insertHistory.run(lid, h.date, h.price);
      }
    }
  });
  insertAll();
  console.log('[sync] Seeded listings data');
}

// ── Seed sample auction results ──
async function seedAuctions(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM auctions').get();
  if (count.c > 0) return;

  const auctions = [
    { address:'12 Hope St', suburb:'Brunswick', result:'Sold', price:1240000, above:4.2, date:'2025-03-15' },
    { address:'7 Paisley St', suburb:'Footscray', result:'Sold', price:830000, above:7.1, date:'2025-03-15' },
    { address:'34 St Georges Rd', suburb:'Northcote', result:'Passed In', price:1180000, above:-1.2, date:'2025-03-08' },
    { address:'88 Victoria St', suburb:'Fitzroy', result:'Sold', price:1560000, above:9.4, date:'2025-03-08' },
    { address:'22 Lygon St', suburb:'Coburg', result:'Sold', price:975000, above:3.8, date:'2025-03-01' },
    { address:'5 High St', suburb:'Preston', result:'Sold', price:920000, above:5.2, date:'2025-03-01' },
  ];

  const insert = db.prepare(`INSERT INTO auctions (address,suburb,result,price,above_reserve_pct,auction_date) VALUES (?,?,?,?,?,?)`);
  const insertMany = db.transaction(() => auctions.forEach(a => insert.run(a.address, a.suburb, a.result, a.price, a.above, a.date)));
  insertMany();
  console.log('[sync] Seeded auction data');
}

// ── Fallback static data when API is unavailable ──
function seedFallbackData(db) {
  console.log('[sync] Seeding fallback static data...');
  const suburbs = [
    { suburb:'Footscray',   median:790000,  growth:14.7, yield:4.8, volume:267, rent:2180, score:93 },
    { suburb:'Preston',     median:880000,  growth:13.2, yield:4.4, volume:231, rent:2340, score:90 },
    { suburb:'Fitzroy',     median:1420000, growth:12.4, yield:3.1, volume:142, rent:2650, score:91 },
    { suburb:'Coburg',      median:920000,  growth:11.1, yield:4.1, volume:213, rent:2420, score:87 },
    { suburb:'Thornbury',   median:1050000, growth:10.5, yield:3.9, volume:187, rent:2500, score:86 },
    { suburb:'Brunswick',   median:1180000, growth:9.8,  yield:3.6, volume:198, rent:2590, score:88 },
    { suburb:'Yarraville',  median:1010000, growth:9.1,  yield:3.7, volume:162, rent:2460, score:84 },
    { suburb:'Richmond',    median:1350000, growth:8.2,  yield:3.4, volume:176, rent:2720, score:85 },
    { suburb:'Northcote',   median:1270000, growth:7.6,  yield:3.2, volume:155, rent:2560, score:82 },
    { suburb:'Heidelberg',  median:960000,  growth:6.9,  yield:4.2, volume:144, rent:2380, score:78 },
    { suburb:'Collingwood', median:1190000, growth:8.9,  yield:3.5, volume:131, rent:2610, score:83 },
    { suburb:'Prahran',     median:1310000, growth:7.2,  yield:3.3, volume:119, rent:2680, score:80 },
    { suburb:'St Kilda',    median:1050000, growth:6.5,  yield:3.8, volume:168, rent:2540, score:79 },
    { suburb:'Williamstown',median:1160000, growth:9.4,  yield:3.5, volume:143, rent:2490, score:85 },
    { suburb:'Essendon',    median:1230000, growth:8.1,  yield:3.2, volume:189, rent:2540, score:81 },
  ];

  const upsertStat = db.prepare(`
    INSERT OR REPLACE INTO suburb_stats (suburb,median_price,sales_count,growth_pct,gross_yield,median_rent,score)
    VALUES (?,?,?,?,?,?,?)
  `);

  const quarters = ['Q1 2023','Q2 2023','Q3 2023','Q4 2023','Q1 2024','Q2 2024','Q3 2024','Q4 2024'];
  const upsertQ  = db.prepare(`INSERT OR REPLACE INTO suburbs (suburb,quarter,property_type,median_price,sales_count) VALUES (?,?,?,?,?)`);

  const insertAll = db.transaction(() => {
    for (const s of suburbs) {
      upsertStat.run(s.suburb, s.median, s.volume, s.growth, s.yield, s.rent, s.score);
      quarters.forEach((q, i) => {
        const factor = 0.88 + i * 0.017;
        upsertQ.run(s.suburb, q, 'house', Math.round(s.median * factor / 1000) * 1000, Math.round(s.volume * (0.9 + i * 0.01)));
      });
    }
  });
  insertAll();
  console.log('[sync] ✅ Fallback data seeded');
}

module.exports = { syncData };
