import type { Destination } from './types.js';

export const HOUSTON_AIRPORTS = ['IAH', 'HOU'] as const;

export const DESTINATIONS: Destination[] = [
  // Caribbean
  { code: 'CUN', city: 'Cancun', country: 'Mexico', region: 'Caribbean' },
  { code: 'PUJ', city: 'Punta Cana', country: 'Dominican Republic', region: 'Caribbean' },
  { code: 'SJU', city: 'San Juan', country: 'Puerto Rico', region: 'Caribbean' },
  { code: 'MBJ', city: 'Montego Bay', country: 'Jamaica', region: 'Caribbean' },
  { code: 'AUA', city: 'Oranjestad', country: 'Aruba', region: 'Caribbean' },
  { code: 'NAS', city: 'Nassau', country: 'Bahamas', region: 'Caribbean' },
  // Mexico
  { code: 'MEX', city: 'Mexico City', country: 'Mexico', region: 'Mexico' },
  { code: 'SJD', city: 'Los Cabos', country: 'Mexico', region: 'Mexico' },
  { code: 'GDL', city: 'Guadalajara', country: 'Mexico', region: 'Mexico' },
  // Central America
  { code: 'BZE', city: 'Belize City', country: 'Belize', region: 'Central America' },
  { code: 'SJO', city: 'San Jose', country: 'Costa Rica', region: 'Central America' },
  { code: 'LIR', city: 'Liberia', country: 'Costa Rica', region: 'Central America' },
  // South America
  { code: 'BOG', city: 'Bogota', country: 'Colombia', region: 'South America' },
  { code: 'LIM', city: 'Lima', country: 'Peru', region: 'South America' },
  { code: 'GRU', city: 'Sao Paulo', country: 'Brazil', region: 'South America' },
  // US Domestic
  { code: 'LAX', city: 'Los Angeles', country: 'US', region: 'US Domestic' },
  { code: 'JFK', city: 'New York', country: 'US', region: 'US Domestic' },
  { code: 'MIA', city: 'Miami', country: 'US', region: 'US Domestic' },
  { code: 'SFO', city: 'San Francisco', country: 'US', region: 'US Domestic' },
  { code: 'DEN', city: 'Denver', country: 'US', region: 'US Domestic' },
  { code: 'ORD', city: 'Chicago', country: 'US', region: 'US Domestic' },
  { code: 'SEA', city: 'Seattle', country: 'US', region: 'US Domestic' },
  { code: 'HNL', city: 'Honolulu', country: 'US', region: 'Hawaii' },
  // Europe
  { code: 'LHR', city: 'London', country: 'UK', region: 'Europe' },
  { code: 'CDG', city: 'Paris', country: 'France', region: 'Europe' },
  { code: 'MAD', city: 'Madrid', country: 'Spain', region: 'Europe' },
  { code: 'FCO', city: 'Rome', country: 'Italy', region: 'Europe' },
  { code: 'BCN', city: 'Barcelona', country: 'Spain', region: 'Europe' },
  { code: 'AMS', city: 'Amsterdam', country: 'Netherlands', region: 'Europe' },
];

export const VACATION_CODES = new Set([
  'CUN', 'PUJ', 'SJU', 'MBJ', 'AUA', 'NAS',
  'SJD', 'BZE', 'SJO', 'LIR',
  'MIA', 'HNL',
  'BCN', 'FCO', 'LHR', 'CDG', 'MAD',
  'BOG', 'LIM',
]);

export const DESTINATION_MAP = new Map(
  DESTINATIONS.map(d => [d.code, d])
);

// How many routes to check per run (to stay within API limits)
export const ROUTES_PER_RUN = 8;

// Deal detection thresholds
export const SIGNIFICANT_DROP_PERCENT = 20;
export const VACATION_DEAL_PERCENT = 30;
