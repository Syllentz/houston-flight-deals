import { searchRoundTrips, checkAccountStatus } from './flights-client.js';
import {
  getDb, seedRoutes, getActiveRoutes, insertObservation, updatePriceStats,
} from './db.js';
import { DESTINATION_MAP } from './constants.js';
import type { TrackedRoute } from './types.js';

/** Generate search dates: a short trip and a longer trip */
function getSearchDates(): Array<{ departure: string; return: string; label: string }> {
  const now = new Date();

  // Weekend trip ~3-4 weeks out
  const d1 = new Date(now);
  d1.setDate(d1.getDate() + 21 + Math.floor(Math.random() * 7));
  while (d1.getDay() !== 5) d1.setDate(d1.getDate() + 1);
  const r1 = new Date(d1);
  r1.setDate(r1.getDate() + 3);

  // Week trip ~6-8 weeks out
  const d2 = new Date(now);
  d2.setDate(d2.getDate() + 42 + Math.floor(Math.random() * 14));
  while (d2.getDay() !== 6) d2.setDate(d2.getDate() + 1);
  const r2 = new Date(d2);
  r2.setDate(r2.getDate() + 7);

  return [
    { departure: fmt(d1), return: fmt(r1), label: 'weekend' },
    { departure: fmt(d2), return: fmt(r2), label: 'week' },
  ];
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function runPriceCheck() {
  const db = getDb();

  // Ensure routes are seeded
  const count = (db.prepare('SELECT COUNT(*) as c FROM tracked_routes').get() as any).c;
  if (count === 0) seedRoutes();

  // Check remaining API quota
  const account = await checkAccountStatus();
  if (account.remaining !== null) {
    console.log(`API searches remaining: ${account.remaining}`);
    if (account.remaining < 30) {
      console.log('Low on API quota — skipping this run to save searches');
      return { totalObservations: 0, routesChecked: 0 };
    }
  }

  const allRoutes = getActiveRoutes() as TrackedRoute[];

  // Get ALL unique destinations — full sweep every run
  const destinations = [...new Set(allRoutes.map(r => r.destination))];

  // Pick one date range per run (alternates between weekend and week trips)
  const searchDates = getSearchDates();
  const dateRange = searchDates[Math.random() > 0.5 ? 0 : 1];

  console.log(`Full sweep: ${destinations.length} destinations (${dateRange.label} trip: ${dateRange.departure} - ${dateRange.return})`);

  let totalObservations = 0;
  const checkedRouteIds = new Set<number>();

  for (const destCode of destinations) {
    const dest = DESTINATION_MAP.get(destCode);
    const cityName = dest?.city || destCode;

    // Search from IAH
    const route = allRoutes.find(r => r.origin === 'IAH' && r.destination === destCode);
    if (!route) continue;

    console.log(`  IAH -> ${cityName} (${destCode})`);
    const result = await searchRoundTrips('IAH', destCode, dateRange.departure, dateRange.return);

    // Log price insights if available
    if (result.priceInsights) {
      const pi = result.priceInsights;
      const rangeStr = pi.typicalRange ? `$${pi.typicalRange[0]}-$${pi.typicalRange[1]}` : 'N/A';
      console.log(`    Price insight: ${pi.priceLevel || '?'} | Typical: ${rangeStr} | Lowest: $${pi.lowestPrice || '?'}`);
    }

    // Store the best flights
    for (const flight of result.flights.slice(0, 5)) {
      insertObservation(
        route.id,
        flight.price,
        flight.airline,
        flight.departureDate,
        flight.returnDate,
        flight.tripDurationDays,
        flight.stops,
        'google_flights'
      );
      totalObservations++;
    }
    checkedRouteIds.add(route.id);

    // Also credit HOU route with same prices (saves an API call)
    const houRoute = allRoutes.find(r => r.origin === 'HOU' && r.destination === destCode);
    if (houRoute && result.flights.length > 0) {
      for (const flight of result.flights.slice(0, 3)) {
        insertObservation(
          houRoute.id,
          flight.price,
          flight.airline,
          flight.departureDate,
          flight.returnDate,
          flight.tripDurationDays,
          flight.stops,
          'google_flights_proxy'
        );
        totalObservations++;
      }
      checkedRouteIds.add(houRoute.id);
    }

    // Small delay between API calls
    await sleep(1000);
  }

  // Update stats for all checked routes
  for (const routeId of checkedRouteIds) {
    updatePriceStats(routeId);
  }

  console.log(`Stored ${totalObservations} price observations for ${checkedRouteIds.size} routes`);
  return { totalObservations, routesChecked: checkedRouteIds.size };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
