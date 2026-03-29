import cron from 'node-cron';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('Houston Flight Deals - Scheduler Started');
console.log('Running on the 1st of each month at 8am CT. Press Ctrl+C to stop.\n');

// Run immediately on start
runJob();

// 1st of every month at 8am (CT is handled by system timezone)
cron.schedule('0 8 1 * *', () => {
  runJob();
});

function runJob() {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  console.log(`[${now}] Starting full price sweep...`);

  try {
    execSync('npx tsx src/main.ts --push', {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 10 * 60 * 1000, // 10 minute timeout (29 destinations)
    });
  } catch (error: any) {
    console.error(`[${now}] Job failed:`, error.message);
  }

  console.log(`Next run: 1st of next month at 8am CT\n`);
}
