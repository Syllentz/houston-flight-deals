import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESTINATIONS, VACATION_CODES, HOUSTON_AIRPORTS } from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'flights.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      destination_city TEXT,
      destination_country TEXT,
      destination_region TEXT,
      is_vacation INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(origin, destination)
    );

    CREATE TABLE IF NOT EXISTS price_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL REFERENCES tracked_routes(id),
      price REAL NOT NULL,
      airline TEXT,
      departure_date TEXT,
      return_date TEXT,
      trip_duration_days INTEGER,
      stops INTEGER DEFAULT 0,
      source TEXT DEFAULT 'amadeus',
      observed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_obs_route_date
      ON price_observations(route_id, observed_at);
    CREATE INDEX IF NOT EXISTS idx_obs_route_price
      ON price_observations(route_id, price);

    CREATE TABLE IF NOT EXISTS price_stats (
      route_id INTEGER PRIMARY KEY REFERENCES tracked_routes(id),
      all_time_low REAL,
      all_time_low_date TEXT,
      avg_price_30d REAL,
      avg_price_90d REAL,
      observation_count INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL REFERENCES tracked_routes(id),
      observation_id INTEGER REFERENCES price_observations(id),
      deal_type TEXT NOT NULL,
      current_price REAL NOT NULL,
      previous_low REAL,
      average_price REAL,
      savings_percent REAL,
      score REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      detected_at TEXT DEFAULT (datetime('now')),
      departure_date TEXT,
      return_date TEXT,
      airline TEXT,
      stops INTEGER,
      trip_duration_days INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_deals_active
      ON deals(deal_type, is_active, score DESC);
  `);
}

export function seedRoutes() {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO tracked_routes
      (origin, destination, destination_city, destination_country, destination_region, is_vacation)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const origin of HOUSTON_AIRPORTS) {
      for (const dest of DESTINATIONS) {
        insert.run(
          origin,
          dest.code,
          dest.city,
          dest.country,
          dest.region,
          VACATION_CODES.has(dest.code) ? 1 : 0
        );
      }
    }
  });

  insertMany();
  console.log(`Seeded routes: ${HOUSTON_AIRPORTS.length} origins x ${DESTINATIONS.length} destinations`);
}

export function getActiveRoutes(limit?: number) {
  const db = getDb();
  const sql = limit
    ? `SELECT * FROM tracked_routes WHERE is_active = 1 ORDER BY RANDOM() LIMIT ?`
    : `SELECT * FROM tracked_routes WHERE is_active = 1`;
  return limit ? db.prepare(sql).all(limit) : db.prepare(sql).all();
}

export function insertObservation(
  routeId: number,
  price: number,
  airline: string | null,
  departureDate: string | null,
  returnDate: string | null,
  tripDurationDays: number | null,
  stops: number,
  source: string = 'amadeus'
): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO price_observations
      (route_id, price, airline, departure_date, return_date, trip_duration_days, stops, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(routeId, price, airline, departureDate, returnDate, tripDurationDays, stops, source);
  return Number(result.lastInsertRowid);
}

export function updatePriceStats(routeId: number) {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      MIN(price) as all_time_low,
      COUNT(*) as observation_count
    FROM price_observations
    WHERE route_id = ?
  `).get(routeId) as any;

  if (!stats || stats.observation_count === 0) return;

  const lowDate = db.prepare(`
    SELECT observed_at FROM price_observations
    WHERE route_id = ? AND price = ?
    ORDER BY observed_at DESC LIMIT 1
  `).get(routeId, stats.all_time_low) as any;

  const avg30 = db.prepare(`
    SELECT AVG(price) as avg FROM price_observations
    WHERE route_id = ? AND observed_at >= datetime('now', '-30 days')
  `).get(routeId) as any;

  const avg90 = db.prepare(`
    SELECT AVG(price) as avg FROM price_observations
    WHERE route_id = ? AND observed_at >= datetime('now', '-90 days')
  `).get(routeId) as any;

  const fullStats = {
    all_time_low: stats.all_time_low,
    all_time_low_date: lowDate?.observed_at || null,
    avg_price_30d: avg30?.avg || null,
    avg_price_90d: avg90?.avg || null,
    observation_count: stats.observation_count,
  } as any;

  db.prepare(`
    INSERT INTO price_stats (route_id, all_time_low, all_time_low_date, avg_price_30d, avg_price_90d, observation_count, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(route_id) DO UPDATE SET
      all_time_low = excluded.all_time_low,
      all_time_low_date = excluded.all_time_low_date,
      avg_price_30d = excluded.avg_price_30d,
      avg_price_90d = excluded.avg_price_90d,
      observation_count = excluded.observation_count,
      last_updated = excluded.last_updated
  `).run(
    routeId,
    fullStats.all_time_low,
    fullStats.all_time_low_date,
    fullStats.avg_price_30d,
    fullStats.avg_price_90d,
    fullStats.observation_count
  );
}

export function getActiveDeals() {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, r.origin, r.destination, r.destination_city,
           r.destination_country, r.destination_region
    FROM deals d
    JOIN tracked_routes r ON d.route_id = r.id
    WHERE d.is_active = 1
    ORDER BY d.score DESC
  `).all();
}

export function getRouteStats() {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, ps.all_time_low, ps.avg_price_30d, ps.avg_price_90d,
           ps.observation_count, ps.last_updated,
           (SELECT price FROM price_observations
            WHERE route_id = r.id ORDER BY observed_at DESC LIMIT 1) as latest_price,
           (SELECT airline FROM price_observations
            WHERE route_id = r.id ORDER BY observed_at DESC LIMIT 1) as latest_airline
    FROM tracked_routes r
    LEFT JOIN price_stats ps ON r.id = ps.route_id
    WHERE r.is_active = 1
    ORDER BY ps.all_time_low ASC NULLS LAST
  `).all();
}

export function closeDb() {
  if (db) {
    db.close();
  }
}
