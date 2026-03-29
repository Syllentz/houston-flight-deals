export interface Destination {
  code: string;
  city: string;
  country: string;
  region: string;
}

export interface TrackedRoute {
  id: number;
  origin: string;
  destination: string;
  destination_city: string;
  destination_country: string;
  destination_region: string;
  is_vacation: number;
  is_active: number;
}

export interface PriceObservation {
  id: number;
  route_id: number;
  price: number;
  airline: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_duration_days: number | null;
  stops: number;
  source: string;
  observed_at: string;
}

export interface PriceStats {
  route_id: number;
  all_time_low: number | null;
  all_time_low_date: string | null;
  avg_price_30d: number | null;
  avg_price_90d: number | null;
  observation_count: number;
  last_updated: string;
}

export interface Deal {
  id: number;
  route_id: number;
  observation_id: number | null;
  deal_type: 'record_low' | 'vacation_deal' | 'significant_drop';
  current_price: number;
  previous_low: number | null;
  average_price: number | null;
  savings_percent: number;
  score: number;
  is_active: number;
  detected_at: string;
  departure_date: string | null;
  return_date: string | null;
  airline: string | null;
  stops: number | null;
  trip_duration_days: number | null;
  // Joined fields for display
  origin?: string;
  destination?: string;
  destination_city?: string;
  destination_country?: string;
  destination_region?: string;
}

export interface ParsedFlight {
  price: number;
  airline: string;
  departureDate: string;
  returnDate: string;
  stops: number;
  tripDurationDays: number;
}
