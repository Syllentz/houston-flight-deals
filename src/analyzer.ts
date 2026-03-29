import { getDb } from './db.js';
import { SIGNIFICANT_DROP_PERCENT, VACATION_DEAL_PERCENT } from './constants.js';
import type { PriceStats, TrackedRoute } from './types.js';

export function detectDeals() {
  const db = getDb();

  // Deactivate expired deals (departure date passed)
  db.prepare(`
    UPDATE deals SET is_active = 0
    WHERE is_active = 1 AND departure_date < date('now')
  `).run();

  // Get all routes with stats
  const routes = db.prepare(`
    SELECT r.*, ps.all_time_low, ps.all_time_low_date,
           ps.avg_price_30d, ps.avg_price_90d, ps.observation_count
    FROM tracked_routes r
    JOIN price_stats ps ON r.id = ps.route_id
    WHERE r.is_active = 1 AND ps.observation_count >= 1
  `).all() as (TrackedRoute & PriceStats)[];

  let dealsFound = 0;

  for (const route of routes) {
    // Get the latest observation for this route
    const latest = db.prepare(`
      SELECT * FROM price_observations
      WHERE route_id = ?
      ORDER BY observed_at DESC
      LIMIT 1
    `).get(route.id) as any;

    if (!latest) continue;

    // Get previous all-time low BEFORE this latest observation
    const prevLow = db.prepare(`
      SELECT MIN(price) as low FROM price_observations
      WHERE route_id = ? AND id != ?
    `).get(route.id, latest.id) as any;

    const currentPrice = latest.price;
    const previousLow = prevLow?.low || null;
    const avg30 = route.avg_price_30d;
    const avg90 = route.avg_price_90d;

    // Record Low: current price is the lowest we've ever seen
    if (previousLow !== null && currentPrice <= previousLow && route.observation_count >= 3) {
      const savings = avg30 ? Math.round((1 - currentPrice / avg30) * 100) : 0;
      upsertDeal(db, {
        routeId: route.id,
        observationId: latest.id,
        dealType: 'record_low',
        currentPrice,
        previousLow,
        averagePrice: avg30,
        savingsPercent: Math.max(0, savings),
        departureDate: latest.departure_date,
        returnDate: latest.return_date,
        airline: latest.airline,
        stops: latest.stops,
        tripDurationDays: latest.trip_duration_days,
      });
      dealsFound++;
    }

    // Significant Drop: >20% below 30-day average
    if (avg30 && currentPrice < avg30 * (1 - SIGNIFICANT_DROP_PERCENT / 100)) {
      const savings = Math.round((1 - currentPrice / avg30) * 100);
      upsertDeal(db, {
        routeId: route.id,
        observationId: latest.id,
        dealType: 'significant_drop',
        currentPrice,
        previousLow,
        averagePrice: avg30,
        savingsPercent: savings,
        departureDate: latest.departure_date,
        returnDate: latest.return_date,
        airline: latest.airline,
        stops: latest.stops,
        tripDurationDays: latest.trip_duration_days,
      });
      dealsFound++;
    }

    // Vacation Deal: vacation destination >30% below 90-day average
    if (route.is_vacation && avg90 && currentPrice < avg90 * (1 - VACATION_DEAL_PERCENT / 100)) {
      const savings = Math.round((1 - currentPrice / avg90) * 100);
      upsertDeal(db, {
        routeId: route.id,
        observationId: latest.id,
        dealType: 'vacation_deal',
        currentPrice,
        previousLow,
        averagePrice: avg90,
        savingsPercent: savings,
        departureDate: latest.departure_date,
        returnDate: latest.return_date,
        airline: latest.airline,
        stops: latest.stops,
        tripDurationDays: latest.trip_duration_days,
      });
      dealsFound++;
    }
  }

  console.log(`Deal detection complete: ${dealsFound} deals found/updated`);
  return dealsFound;
}

interface DealInput {
  routeId: number;
  observationId: number;
  dealType: string;
  currentPrice: number;
  previousLow: number | null;
  averagePrice: number | null;
  savingsPercent: number;
  departureDate: string | null;
  returnDate: string | null;
  airline: string | null;
  stops: number | null;
  tripDurationDays: number | null;
}

function upsertDeal(db: any, deal: DealInput) {
  // Calculate a score (0-100) for ranking deals
  const savingsScore = Math.min(deal.savingsPercent, 60); // cap at 60%
  const typeBonus = deal.dealType === 'record_low' ? 20 : deal.dealType === 'vacation_deal' ? 15 : 10;
  const score = Math.min(100, savingsScore + typeBonus);

  // Deactivate previous deals of same type for same route
  db.prepare(`
    UPDATE deals SET is_active = 0
    WHERE route_id = ? AND deal_type = ? AND is_active = 1
  `).run(deal.routeId, deal.dealType);

  // Insert new deal
  db.prepare(`
    INSERT INTO deals
      (route_id, observation_id, deal_type, current_price, previous_low,
       average_price, savings_percent, score, is_active,
       departure_date, return_date, airline, stops, trip_duration_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `).run(
    deal.routeId, deal.observationId, deal.dealType, deal.currentPrice,
    deal.previousLow, deal.averagePrice, deal.savingsPercent, score,
    deal.departureDate, deal.returnDate, deal.airline, deal.stops,
    deal.tripDurationDays
  );
}
