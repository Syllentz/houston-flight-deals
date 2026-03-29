import cron from 'node-cron';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('Houston Flight Deals - Scheduler Started');
console.log('Running every 4 hours. Press Ctrl+C to stop.\n');

// Run immediately on start
runJob();

// Then every 4 hours (at minute 0 of hours 0, 4, 8, 12, 16, 20)
cron.schedule('0 */4 * * *', () => {
  runJob();
});

function runJob() {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  console.log(`[${now}] Starting price check...`);

  try {
    execSync('npx tsx src/main.ts --push', {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 5 * 60 * 1000, // 5 minute timeout
    });
  } catch (error: any) {
    console.error(`[${now}] Job failed:`, error.message);
  }

  const next = getNextRun();
  console.log(`Next run: ${next}\n`);
}

function getNextRun(): string {
  const now = new Date();
  const nextHour = Math.ceil(now.getHours() / 4) * 4;
  const next = new Date(now);
  if (nextHour >= 24) {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  } else {
    next.setHours(nextHour, 0, 0, 0);
  }
  return next.toLocaleString('en-US', { timeZone: 'America/Chicago' });
}
