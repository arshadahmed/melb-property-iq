const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'property.db');
let db;

function getDb() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS suburbs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      suburb       TEXT NOT NULL,
      quarter      TEXT NOT NULL,
      property_type TEXT DEFAULT 'house',
      median_price INTEGER,
      sales_count  INTEGER,
      created_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(suburb, quarter, property_type)
    );

    CREATE TABLE IF NOT EXISTS suburb_stats (
      suburb       TEXT PRIMARY KEY,
      median_price INTEGER,
      sales_count  INTEGER,
      growth_pct   REAL,
      gross_yield  REAL,
      median_rent  INTEGER,
      score        INTEGER,
      updated_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auctions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      address      TEXT,
      suburb       TEXT,
      result       TEXT,
      price        INTEGER,
      above_reserve_pct REAL,
      auction_date TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rental (
      suburb       TEXT,
      quarter      TEXT,
      property_type TEXT,
      median_rent  INTEGER,
      PRIMARY KEY (suburb, quarter, property_type)
    );

    CREATE TABLE IF NOT EXISTS listings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      suburb       TEXT,
      address      TEXT,
      property_type TEXT,
      beds         INTEGER,
      price        INTEGER,
      description  TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sale_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id   INTEGER,
      sale_date    TEXT,
      price        INTEGER,
      FOREIGN KEY (listing_id) REFERENCES listings(id)
    );
  `);

  console.log('✅ Database initialised');
}

module.exports = { getDb, initDb };
