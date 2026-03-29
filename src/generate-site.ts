import { getDb, getActiveDeals, getRouteStats } from './db.js';
import { DESTINATION_MAP } from './constants.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Deal } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '..', 'docs');

export function generateSite() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  const db = getDb();
  const allDeals = getActiveDeals() as Deal[];
  const routeStats = getRouteStats() as any[];

  const recordLows = allDeals.filter(d => d.deal_type === 'record_low');
  const vacationDeals = allDeals.filter(d => d.deal_type === 'vacation_deal');
  const significantDrops = allDeals.filter(d => d.deal_type === 'significant_drop');

  // Combine vacation deals and significant drops for the "crazy deals" section
  const crazyDeals = [...vacationDeals, ...significantDrops]
    .sort((a, b) => b.score - a.score)
    .filter((d, i, arr) => arr.findIndex(x => x.route_id === d.route_id) === i); // dedupe by route

  const totalRoutes = (db.prepare('SELECT COUNT(*) as c FROM tracked_routes WHERE is_active = 1').get() as any).c;
  const totalObs = (db.prepare('SELECT COUNT(*) as c FROM price_observations').get() as any).c;
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = buildHtml({
    recordLows,
    crazyDeals,
    routeStats,
    totalRoutes,
    totalObs,
    lastUpdated: now,
  });

  fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), html, 'utf-8');
  console.log(`Site generated: docs/index.html (${recordLows.length} record lows, ${crazyDeals.length} vacation deals)`);
}

interface SiteData {
  recordLows: Deal[];
  crazyDeals: Deal[];
  routeStats: any[];
  totalRoutes: number;
  totalObs: number;
  lastUpdated: string;
}

function buildHtml(data: SiteData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Houston Flight Deals</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            fire: { 50: '#fff7ed', 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 700: '#c2410c' },
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .deal-card { transition: transform 0.2s, box-shadow 0.2s; }
    .deal-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.12); }
    .savings-bar { background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%); }
    .record-pulse { animation: pulse-red 2s infinite; }
    @keyframes pulse-red {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">

  <!-- Header -->
  <header class="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
    <div class="max-w-6xl mx-auto px-4 py-10 sm:py-14">
      <div class="flex items-center gap-3 mb-2">
        <span class="text-4xl">&#9992;</span>
        <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Houston Flight Deals</h1>
      </div>
      <p class="text-blue-100 text-lg mt-1">Record-low prices & crazy vacation deals from IAH & HOU</p>
      <div class="mt-5 flex flex-wrap gap-4 text-sm text-blue-200">
        <span class="bg-blue-500/30 px-3 py-1 rounded-full">Tracking ${data.totalRoutes} routes</span>
        <span class="bg-blue-500/30 px-3 py-1 rounded-full">${data.totalObs.toLocaleString()} price checks</span>
        <span class="bg-blue-500/30 px-3 py-1 rounded-full">Updated ${data.lastUpdated} CT</span>
      </div>
    </div>
  </header>

  <!-- Navigation -->
  <nav class="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
    <div class="max-w-6xl mx-auto px-4 flex gap-6 text-sm font-medium">
      <a href="#record-lows" class="py-3 border-b-2 border-red-500 text-red-600">Record Lows</a>
      <a href="#vacation-deals" class="py-3 border-b-2 border-transparent hover:border-emerald-500 text-gray-600 hover:text-emerald-600">Vacation Deals</a>
      <a href="#all-routes" class="py-3 border-b-2 border-transparent hover:border-blue-500 text-gray-600 hover:text-blue-600">All Routes</a>
    </div>
  </nav>

  <main class="max-w-6xl mx-auto px-4 py-8">

    <!-- Record Lows Section -->
    <section id="record-lows" class="mb-14">
      <div class="flex items-center gap-2 mb-6">
        <span class="text-2xl">&#128293;</span>
        <h2 class="text-2xl font-bold text-gray-800">Record-Low Prices</h2>
        <span class="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">${data.recordLows.length} active</span>
      </div>
      ${data.recordLows.length === 0
        ? emptyState('No record lows detected yet. Prices are being tracked and compared — check back after a few days of data collection.')
        : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">${data.recordLows.map(d => dealCard(d, 'record')).join('')}</div>`
      }
    </section>

    <!-- Crazy Vacation Deals Section -->
    <section id="vacation-deals" class="mb-14">
      <div class="flex items-center gap-2 mb-6">
        <span class="text-2xl">&#127796;</span>
        <h2 class="text-2xl font-bold text-gray-800">Crazy Vacation Deals</h2>
        <span class="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">${data.crazyDeals.length} active</span>
      </div>
      ${data.crazyDeals.length === 0
        ? emptyState('No crazy deals yet. We flag vacation flights that drop 30%+ below their 90-day average — keep watching!')
        : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">${data.crazyDeals.map(d => dealCard(d, 'vacation')).join('')}</div>`
      }
    </section>

    <!-- All Routes Table -->
    <section id="all-routes">
      <div class="flex items-center gap-2 mb-6">
        <span class="text-2xl">&#128203;</span>
        <h2 class="text-2xl font-bold text-gray-800">All Tracked Routes</h2>
      </div>
      <div class="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 text-left text-gray-500 uppercase text-xs tracking-wider">
              <th class="px-4 py-3">Route</th>
              <th class="px-4 py-3">Latest Price</th>
              <th class="px-4 py-3">All-Time Low</th>
              <th class="px-4 py-3">30d Avg</th>
              <th class="px-4 py-3">90d Avg</th>
              <th class="px-4 py-3">Checks</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${data.routeStats.length === 0
              ? `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No price data yet. Run the fetcher to start collecting prices.</td></tr>`
              : data.routeStats.map(routeRow).join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-gray-200 mt-16 py-8 text-center text-sm text-gray-400">
    <p>Prices updated every ~4 hours via Amadeus API. Fares shown were available at time of check and may have changed.</p>
    <p class="mt-1">Last updated: ${data.lastUpdated} Central Time</p>
  </footer>

</body>
</html>`;
}

function dealCard(deal: Deal, style: 'record' | 'vacation'): string {
  const dest = DESTINATION_MAP.get(deal.destination || '');
  const cityName = deal.destination_city || dest?.city || deal.destination || '???';
  const country = deal.destination_country || dest?.country || '';
  const origin = deal.origin || 'IAH';
  const isRecord = style === 'record';

  const priceStr = `$${Math.round(deal.current_price)}`;
  const avgStr = deal.average_price ? `$${Math.round(deal.average_price)}` : '';
  const savingsStr = deal.savings_percent > 0 ? `${Math.round(deal.savings_percent)}% off` : '';

  const stopsText = deal.stops === 0 ? 'Nonstop' : deal.stops === 1 ? '1 stop' : `${deal.stops} stops`;
  const durationText = deal.trip_duration_days ? `${deal.trip_duration_days} days` : '';

  const depStr = deal.departure_date ? formatDate(deal.departure_date) : '';
  const retStr = deal.return_date ? formatDate(deal.return_date) : '';
  const dateStr = depStr && retStr ? `${depStr} - ${retStr}` : depStr || '';

  const borderColor = isRecord ? 'border-red-200 hover:border-red-300' : 'border-emerald-200 hover:border-emerald-300';
  const badgeBg = isRecord ? 'bg-red-500' : 'bg-emerald-500';
  const badgeText = isRecord ? 'RECORD LOW' : 'GREAT DEAL';

  return `
    <div class="deal-card bg-white rounded-xl border ${borderColor} shadow-sm overflow-hidden">
      <div class="p-5">
        <div class="flex justify-between items-start mb-3">
          <div>
            <div class="text-xs text-gray-400 font-medium">${origin}</div>
            <h3 class="text-lg font-bold text-gray-800">${cityName}</h3>
            <div class="text-xs text-gray-500">${country}</div>
          </div>
          <span class="${badgeBg} text-white text-[10px] font-bold px-2 py-1 rounded-full tracking-wide ${isRecord ? 'record-pulse' : ''}">${badgeText}</span>
        </div>

        <div class="flex items-baseline gap-2 mb-3">
          <span class="text-3xl font-extrabold ${isRecord ? 'text-red-600' : 'text-emerald-600'}">${priceStr}</span>
          ${avgStr ? `<span class="text-sm text-gray-400 line-through">${avgStr}</span>` : ''}
          ${savingsStr ? `<span class="text-xs font-semibold ${isRecord ? 'text-red-500' : 'text-emerald-500'}">${savingsStr}</span>` : ''}
        </div>

        <div class="space-y-1 text-xs text-gray-500">
          ${deal.airline ? `<div class="flex items-center gap-1"><span>&#9992;</span> ${deal.airline}</div>` : ''}
          ${dateStr ? `<div class="flex items-center gap-1"><span>&#128197;</span> ${dateStr}${durationText ? ` (${durationText})` : ''}</div>` : ''}
          <div class="flex items-center gap-1"><span>&#128260;</span> Round-trip &middot; ${stopsText}</div>
        </div>

        ${deal.savings_percent > 0 ? `
        <div class="mt-3">
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div class="savings-bar h-full rounded-full" style="width: ${Math.min(100, deal.savings_percent)}%"></div>
          </div>
        </div>` : ''}
      </div>
    </div>`;
}

function routeRow(route: any): string {
  const cityName = route.destination_city || route.destination;
  const origin = route.origin;
  const latestPrice = route.latest_price != null ? `$${Math.round(route.latest_price)}` : '-';
  const allTimeLow = route.all_time_low != null ? `$${Math.round(route.all_time_low)}` : '-';
  const avg30 = route.avg_price_30d != null ? `$${Math.round(route.avg_price_30d)}` : '-';
  const avg90 = route.avg_price_90d != null ? `$${Math.round(route.avg_price_90d)}` : '-';
  const checks = route.observation_count || 0;

  const isLow = route.latest_price != null && route.all_time_low != null &&
    route.latest_price <= route.all_time_low;

  return `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3">
        <span class="font-medium text-gray-800">${origin} &rarr; ${cityName}</span>
        <span class="text-gray-400 text-xs ml-1">${route.destination}</span>
        ${route.is_vacation ? '<span class="ml-1 text-xs">&#127796;</span>' : ''}
      </td>
      <td class="px-4 py-3 font-semibold ${isLow ? 'text-red-600' : 'text-gray-800'}">${latestPrice} ${isLow ? '<span class="text-[10px] text-red-500 font-bold">LOW</span>' : ''}</td>
      <td class="px-4 py-3 text-gray-600">${allTimeLow}</td>
      <td class="px-4 py-3 text-gray-600">${avg30}</td>
      <td class="px-4 py-3 text-gray-600">${avg90}</td>
      <td class="px-4 py-3 text-gray-400">${checks}</td>
    </tr>`;
}

function emptyState(message: string): string {
  return `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
      <div class="text-4xl mb-3">&#128269;</div>
      <p class="text-gray-500">${message}</p>
    </div>`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Allow running directly
if (process.argv[1]?.includes('generate-site')) {
  generateSite();
}
