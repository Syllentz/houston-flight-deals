import 'dotenv/config';
import type { ParsedFlight } from './types.js';

const BASE_URL = 'https://serpapi.com/search.json';

function getApiKey(): string {
  const key = process.env.SERPAPI_KEY;
  if (!key || key === 'paste_your_key_here') {
    throw new Error('Missing SERPAPI_KEY in .env — get one at https://serpapi.com/users/sign_up');
  }
  return key;
}

export interface FlightSearchResult {
  flights: ParsedFlight[];
  priceInsights: {
    lowestPrice: number | null;
    priceLevel: string | null;
    typicalRange: [number, number] | null;
  } | null;
}

export async function searchRoundTrips(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
): Promise<FlightSearchResult> {
  try {
    const params = new URLSearchParams({
      engine: 'google_flights',
      api_key: getApiKey(),
      departure_id: origin,
      arrival_id: destination,
      outbound_date: departureDate,
      return_date: returnDate,
      type: '1', // round trip
      currency: 'USD',
      hl: 'en',
      gl: 'us',
      adults: '1',
      sort_by: '2', // sort by price
    });

    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) {
      console.error(`  API ${res.status}: ${origin}->${destination}`);
      return { flights: [], priceInsights: null };
    }

    const data = await res.json();

    // Parse price insights
    let priceInsights: FlightSearchResult['priceInsights'] = null;
    if (data.price_insights) {
      priceInsights = {
        lowestPrice: data.price_insights.lowest_price ?? null,
        priceLevel: data.price_insights.price_level ?? null,
        typicalRange: data.price_insights.typical_price_range ?? null,
      };
    }

    // Parse flight results
    const allFlights = [...(data.best_flights || []), ...(data.other_flights || [])];
    const flights: ParsedFlight[] = allFlights
      .map((trip: any) => parseTrip(trip, departureDate, returnDate))
      .filter(Boolean) as ParsedFlight[];

    return { flights, priceInsights };
  } catch (error: any) {
    console.error(`  Error ${origin}->${destination}: ${error.message}`);
    return { flights: [], priceInsights: null };
  }
}

function parseTrip(trip: any, departureDate: string, returnDate: string): ParsedFlight | null {
  try {
    const price = trip.price;
    if (!price || price <= 0) return null;

    const segments = trip.flights || [];
    const firstSeg = segments[0];
    const airline = firstSeg?.airline || 'Unknown';
    const stops = Math.max(0, segments.length - 1);

    let tripDurationDays = 0;
    if (departureDate && returnDate) {
      tripDurationDays = Math.ceil(
        (new Date(returnDate).getTime() - new Date(departureDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
    }

    return {
      price,
      airline,
      departureDate,
      returnDate,
      stops,
      tripDurationDays,
    };
  } catch {
    return null;
  }
}

/** Check remaining API credits */
export async function checkAccountStatus(): Promise<{ remaining: number | null }> {
  try {
    const res = await fetch(`https://serpapi.com/account.json?api_key=${getApiKey()}`);
    if (!res.ok) return { remaining: null };
    const data = await res.json();
    return { remaining: data.total_searches_left ?? null };
  } catch {
    return { remaining: null };
  }
}
