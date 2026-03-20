const axios  = require('axios');
const XLSX   = require('xlsx');
const { getDb } = require('../db/database');

// ── Real URLs from data.vic.gov.au (verified March 2026) ──
const SOURCES = {
  vpsr_quarterly:  'https://www.land.vic.gov.au/__data/assets/excel_doc/0023/762143/median-house-q2-2025.xls',
  vpsr_timeseries: 'https://www.land.vic.gov.au/__data/assets/excel_doc/0029/709751/Houses-by-suburb-2013-2023.xlsx',
  rental_suburb:   'https://www.dffh.vic.gov.au/moving-annual-rent-suburb-september-quarter-2025-excel',
};

async function syncData() {
  console.log('[sync] Starting data sync from Victorian Government sources...');
  const db = getDb();
  try {
    await syncVPSR(db);
    await syncRental(db);
    await computeSuburbStats(db);
    await seedListings(db);
    await seedAuctions(db);
    console.log('[sync] ✅ Live data sync complete');
  } catch (err) {
    console.error('[sync] ❌ Live sync failed:', err.message);
    console.log('[sync] Using fallback data...');
    seedFallbackData(db);
    await seedListings(db);
    await seedAuctions(db);
  }
}

async function downloadExcel(url) {
  console.log(`[sync] Downloading: ${url}`);
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PropIQ/1.0)' },
  });
  return XLSX.read(response.data, { type: 'buffer' });
}

async function syncVPSR(db) {
  console.log('[sync] Fetching VPSR quarterly...');
  const workbook  = await downloadExcel(SOURCES.vpsr_quarterly);
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const rows      = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find header row containing 'suburb'
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    if (rows[i].some(c => String(c).toLowerCase().includes('suburb'))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('VPSR: suburb header not found');

  const headers   = rows[headerIdx].map(h => String(h).toLowerCase().trim());
  const suburbIdx = headers.findIndex(h => h.includes('suburb'));
  const medianIdx = headers.findIndex(h => h.includes('median') || h.includes('price'));
  const salesIdx  = headers.findIndex(h => h.includes('sales') || h.includes('number') || h.includes('#') || h.includes('no.'));

  console.log(`[sync] VPSR headers: ${headers.slice(0,8).join(' | ')}`);

  const insert = db.prepare(`INSERT OR REPLACE INTO suburbs (suburb,quarter,property_type,median_price,sales_count) VALUES (?,?,?,?,?)`);
  let count = 0;

  db.transaction(() => {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row    = rows[i];
      const suburb = String(row[suburbIdx] || '').trim();
      if (!suburb || suburb.toLowerCase().includes('total') || suburb.toLowerCase().includes('victoria')) continue;
      const price  = parsePrice(medianIdx >= 0 ? row[medianIdx] : null);
      if (!price || price < 100000 || price > 20000000) continue;
      const sales  = salesIdx >= 0 ? parseInt(row[salesIdx]) || 0 : 0;
      insert.run(suburb, 'Q2 2025', 'house', price, sales);
      count++;
    }
  })();

  console.log(`[sync] ✅ VPSR: ${count} suburbs saved`);
  await syncTimeSeries(db);
}

async function syncTimeSeries(db) {
  console.log('[sync] Fetching time series...');
  let workbook;
  try { workbook = await downloadExcel(SOURCES.vpsr_timeseries); }
  catch (e) { console.log('[sync] Time series unavailable:', e.message); return; }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let headerIdx = -1, yearCols = [];
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row  = rows[i];
    const years = row.map((c,idx) => ({ year: String(c), idx })).filter(x => /^20\d{2}$/.test(x.year));
    if (years.length >= 3 && row.some(c => String(c).toLowerCase().includes('suburb'))) {
      headerIdx = i; yearCols = years; break;
    }
  }
  if (headerIdx === -1) { console.log('[sync] Time series header not found'); return; }

  const headers   = rows[headerIdx].map(h => String(h).toLowerCase());
  const suburbIdx = headers.findIndex(h => h.includes('suburb'));

  const insert = db.prepare(`INSERT OR REPLACE INTO suburbs (suburb,quarter,property_type,median_price,sales_count) VALUES (?,?,?,?,?)`);
  let count = 0;

  db.transaction(() => {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row    = rows[i];
      const suburb = String(row[suburbIdx] || '').trim();
      if (!suburb || suburb.toLowerCase().includes('total')) continue;
      for (const { year, idx } of yearCols) {
        const price = parsePrice(row[idx]);
        if (price && price > 100000) { insert.run(suburb, `Q4 ${year}`, 'house', price, 0); count++; }
      }
    }
  })();

  console.log(`[sync] ✅ Time series: ${count} records saved`);
}

async function syncRental(db) {
  console.log('[sync] Fetching rental data...');
  let workbook;
  try { workbook = await downloadExcel(SOURCES.rental_suburb); }
  catch (e) { console.log('[sync] Rental data unavailable:', e.message); return; }

  const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('house')) || workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const rows      = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if (rows[i].some(c => String(c).toLowerCase().includes('suburb'))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) { console.log('[sync] Rental header not found'); return; }

  const headers   = rows[headerIdx].map(h => String(h).toLowerCase().trim());
  const suburbIdx = headers.findIndex(h => h.includes('suburb'));

  const insert = db.prepare(`INSERT OR REPLACE INTO rental (suburb,quarter,property_type,median_rent) VALUES (?,?,?,?)`);
  let count = 0;

  db.transaction(() => {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row    = rows[i];
      const suburb = String(row[suburbIdx] || '').trim();
      if (!suburb) continue;
      // Find last non-empty numeric rent value in the row
      let rent = 0;
      for (let j = row.length - 1; j > suburbIdx; j--) {
        const val = parsePrice(row[j]);
        if (val && val > 50 && val < 5000) { rent = val; break; }
      }
      if (!rent) continue;
      insert.run(suburb, 'Q3 2025', 'house', rent);
      count++;
    }
  })();

  console.log(`[sync] ✅ Rental: ${count} suburb records saved`);
}

async function computeSuburbStats(db) {
  console.log('[sync] Computing suburb statistics...');
  const latestQ = db.prepare(`SELECT MAX(quarter) as q FROM suburbs`).get()?.q;
  const prevQ   = db.prepare(`SELECT MAX(quarter) as q FROM suburbs WHERE quarter < ?`).get(latestQ)?.q;
  if (!latestQ) return;

  console.log(`[sync] Quarters: latest=${latestQ} prev=${prevQ}`);

  const latest  = db.prepare(`SELECT suburb, median_price, sales_count FROM suburbs WHERE quarter=? AND property_type='house' AND median_price>0`).all(latestQ);
  const prev    = prevQ ? db.prepare(`SELECT suburb, median_price FROM suburbs WHERE quarter=? AND property_type='house'`).all(prevQ) : [];
  const prevMap = Object.fromEntries(prev.map(r => [r.suburb.toLowerCase(), r.median_price]));
  const rentals = db.prepare(`SELECT suburb, median_rent FROM rental WHERE property_type='house'`).all();
  const rentMap = Object.fromEntries(rentals.map(r => [r.suburb.toLowerCase(), r.median_rent]));

  const upsert = db.prepare(`INSERT OR REPLACE INTO suburb_stats (suburb,median_price,sales_count,growth_pct,gross_yield,median_rent,score) VALUES (?,?,?,?,?,?,?)`);

  db.transaction(() => {
    for (const r of latest) {
      const key       = r.suburb.toLowerCase();
      const prevPrice = prevMap[key];
      const growth    = prevPrice ? parseFloat((((r.median_price - prevPrice) / prevPrice) * 100).toFixed(1)) : 0;
      const rent      = rentMap[key] || estimateRent(r.median_price);
      const yield_    = parseFloat(((rent * 52 / r.median_price) * 100).toFixed(1));
      const score     = computeScore(growth, yield_, r.sales_count);
      upsert.run(r.suburb, r.median_price, r.sales_count, growth, yield_, rent, score);
    }
  })();

  console.log(`[sync] ✅ Stats computed for ${latest.length} suburbs`);
}

function parsePrice(val) {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val).replace(/[$,\s]/g, '');
  if (['-','N/A','na','n/a',''].includes(str.toLowerCase())) return 0;
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.round(n);
}

function estimateRent(price) {
  if (price > 1400000) return 2700;
  if (price > 1100000) return 2550;
  if (price > 900000)  return 2400;
  if (price > 700000)  return 2200;
  return 2000;
}

function computeScore(growth, yield_, volume) {
  return Math.round(
    Math.min(Math.max(growth, 0) * 3, 40) +
    Math.min(yield_ * 5, 30) +
    Math.min((volume || 0) / 10, 30)
  );
}

async function seedListings(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM listings').get();
  if (count.c > 0) return;
  const data = [
    { suburb:'Footscray',   address:'14 Barkly St',    type:'House',     beds:3, price:820000,  desc:'Renovated weatherboard, open plan, north garden.',           history:[{date:'Mar 2019',price:590000},{date:'Sep 2015',price:420000}] },
    { suburb:'Footscray',   address:'7/22 Irving St',  type:'Apartment', beds:2, price:560000,  desc:'Modern apartment, city views, secure parking.',              history:[{date:'Jun 2021',price:495000}] },
    { suburb:'Footscray',   address:'88 Napier St',    type:'House',     beds:4, price:1050000, desc:'Spacious family home, period features, double garage.',       history:[{date:'Oct 2020',price:810000},{date:'Jul 2013',price:510000}] },
    { suburb:'Fitzroy',     address:'42 Smith St',     type:'House',     beds:3, price:1480000, desc:'Victorian terrace, original features, courtyard.',            history:[{date:'Feb 2018',price:1050000},{date:'May 2012',price:680000}] },
    { suburb:'Fitzroy',     address:'5 Greeves St',    type:'House',     beds:4, price:2100000, desc:'Architect renovated Edwardian, north-rear double storey.',    history:[{date:'Mar 2016',price:1340000},{date:'Jan 2009',price:720000}] },
    { suburb:'Brunswick',   address:'77 Albert St',    type:'House',     beds:3, price:1150000, desc:'Charming cottage, polished floors, landscaped garden.',       history:[{date:'Sep 2019',price:890000},{date:'Jun 2014',price:620000}] },
    { suburb:'Brunswick',   address:'31 Dawson St',    type:'House',     beds:4, price:1320000, desc:'Extended family home, open plan, entertaining deck.',         history:[{date:'Apr 2017',price:980000},{date:'Dec 2010',price:590000}] },
    { suburb:'Preston',     address:'19 Murray Rd',    type:'House',     beds:3, price:895000,  desc:'Post-war brick, recently updated, large 620m² block.',        history:[{date:'Jan 2020',price:730000},{date:'Aug 2015',price:490000}] },
    { suburb:'Preston',     address:'103 Gilbert Rd',  type:'House',     beds:4, price:1020000, desc:'Light-filled family home, close to Preston Market.',          history:[{date:'Jun 2018',price:780000}] },
    { suburb:'Collingwood', address:'22 Oxford St',    type:'House',     beds:3, price:1350000, desc:'Converted warehouse, polished concrete, rooftop terrace.',    history:[{date:'Nov 2017',price:980000},{date:'Apr 2011',price:560000}] },
    { suburb:'Richmond',    address:'9 Church St',     type:'Apartment', beds:2, price:890000,  desc:'High-floor apartment, MCG views, concierge building.',        history:[{date:'May 2020',price:820000}] },
    { suburb:'Northcote',   address:'55 High St',      type:'House',     beds:3, price:1290000, desc:'Californian bungalow, original features, large backyard.',    history:[{date:'Mar 2018',price:980000},{date:'Jul 2012',price:620000}] },
    { suburb:'Yarraville',  address:'12 Anderson St',  type:'House',     beds:3, price:1040000, desc:'Federation cottage, renovated kitchen, sun-drenched garden.', history:[{date:'Sep 2019',price:860000}] },
    { suburb:'Coburg',      address:'88 Bell St',      type:'House',     beds:4, price:980000,  desc:'Period home on 650m², close to Coburg Lake Reserve.',         history:[{date:'Feb 2020',price:780000},{date:'May 2015',price:520000}] },
  ];
  const iL = db.prepare(`INSERT INTO listings (suburb,address,property_type,beds,price,description) VALUES (?,?,?,?,?,?)`);
  const iH = db.prepare(`INSERT INTO sale_history (listing_id,sale_date,price) VALUES (?,?,?)`);
  db.transaction(() => { for (const l of data) { const { lastInsertRowid:lid } = iL.run(l.suburb,l.address,l.type,l.beds,l.price,l.desc); l.history.forEach(h=>iH.run(lid,h.date,h.price)); } })();
  console.log('[sync] ✅ Listings seeded');
}

async function seedAuctions(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM auctions').get();
  if (count.c > 0) return;
  const data = [
    {address:'12 Hope St',      suburb:'Brunswick', result:'Sold',      price:1240000, above:4.2,  date:'2025-03-15'},
    {address:'7 Paisley St',    suburb:'Footscray', result:'Sold',      price:830000,  above:7.1,  date:'2025-03-15'},
    {address:'34 St Georges Rd',suburb:'Northcote', result:'Passed In', price:1180000, above:-1.2, date:'2025-03-08'},
    {address:'88 Victoria St',  suburb:'Fitzroy',   result:'Sold',      price:1560000, above:9.4,  date:'2025-03-08'},
    {address:'22 Lygon St',     suburb:'Coburg',    result:'Sold',      price:975000,  above:3.8,  date:'2025-03-01'},
    {address:'5 High St',       suburb:'Preston',   result:'Sold',      price:920000,  above:5.2,  date:'2025-03-01'},
  ];
  const ins = db.prepare(`INSERT INTO auctions (address,suburb,result,price,above_reserve_pct,auction_date) VALUES (?,?,?,?,?,?)`);
  db.transaction(() => data.forEach(a => ins.run(a.address,a.suburb,a.result,a.price,a.above,a.date)))();
  console.log('[sync] ✅ Auctions seeded');
}

function seedFallbackData(db) {
  console.log('[sync] Seeding fallback data...');
  const suburbs = [
    {suburb:'Footscray',    median:790000,  growth:14.7, yield:4.8, volume:267, rent:2180, score:93},
    {suburb:'Preston',      median:880000,  growth:13.2, yield:4.4, volume:231, rent:2340, score:90},
    {suburb:'Fitzroy',      median:1420000, growth:12.4, yield:3.1, volume:142, rent:2650, score:91},
    {suburb:'Coburg',       median:920000,  growth:11.1, yield:4.1, volume:213, rent:2420, score:87},
    {suburb:'Thornbury',    median:1050000, growth:10.5, yield:3.9, volume:187, rent:2500, score:86},
    {suburb:'Brunswick',    median:1180000, growth:9.8,  yield:3.6, volume:198, rent:2590, score:88},
    {suburb:'Yarraville',   median:1010000, growth:9.1,  yield:3.7, volume:162, rent:2460, score:84},
    {suburb:'Richmond',     median:1350000, growth:8.2,  yield:3.4, volume:176, rent:2720, score:85},
    {suburb:'Northcote',    median:1270000, growth:7.6,  yield:3.2, volume:155, rent:2560, score:82},
    {suburb:'Heidelberg',   median:960000,  growth:6.9,  yield:4.2, volume:144, rent:2380, score:78},
    {suburb:'Collingwood',  median:1190000, growth:8.9,  yield:3.5, volume:131, rent:2610, score:83},
    {suburb:'Prahran',      median:1310000, growth:7.2,  yield:3.3, volume:119, rent:2680, score:80},
    {suburb:'St Kilda',     median:1050000, growth:6.5,  yield:3.8, volume:168, rent:2540, score:79},
    {suburb:'Williamstown', median:1160000, growth:9.4,  yield:3.5, volume:143, rent:2490, score:85},
    {suburb:'Essendon',     median:1230000, growth:8.1,  yield:3.2, volume:189, rent:2540, score:81},
  ];
  const uS = db.prepare(`INSERT OR REPLACE INTO suburb_stats (suburb,median_price,sales_count,growth_pct,gross_yield,median_rent,score) VALUES (?,?,?,?,?,?,?)`);
  const uQ = db.prepare(`INSERT OR REPLACE INTO suburbs (suburb,quarter,property_type,median_price,sales_count) VALUES (?,?,?,?,?)`);
  const qs = ['Q4 2021','Q4 2022','Q1 2023','Q2 2023','Q3 2023','Q4 2023','Q1 2024','Q2 2024','Q3 2024','Q4 2024','Q1 2025','Q2 2025'];
  db.transaction(() => {
    for (const s of suburbs) {
      uS.run(s.suburb, s.median, s.volume, s.growth, s.yield, s.rent, s.score);
      qs.forEach((q,i) => uQ.run(s.suburb, q, 'house', Math.round(s.median*(0.80+i*0.018)/1000)*1000, Math.round(s.volume*(0.85+i*0.012))));
    }
  })();
  console.log('[sync] ✅ Fallback data seeded');
}

module.exports = { syncData };
