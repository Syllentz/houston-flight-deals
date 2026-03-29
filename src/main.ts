import 'dotenv/config';
import { getDb, seedRoutes, closeDb } from './db.js';
import { runPriceCheck } from './fetcher.js';
import { detectDeals } from './analyzer.js';
import { generateSite } from './generate-site.js';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const shouldPush = process.argv.includes('--push');

async function main() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Houston Flight Deals - ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`);
  console.log('='.repeat(50));

  try {
    // 1. Initialize DB and seed routes if needed
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM tracked_routes').get() as any).c;
    if (count === 0) {
      console.log('\nFirst run - seeding routes...');
      seedRoutes();
    }

    // 2. Run targeted price checks via Google Flights
    console.log('\n--- Price Check ---');
    await runPriceCheck();

    // 3. Analyze for deals
    console.log('\n--- Deal Detection ---');
    detectDeals();

    // 4. Generate static site
    console.log('\n--- Site Generation ---');
    generateSite();

    // 5. Push to GitHub if requested
    if (shouldPush) {
      console.log('\n--- Git Push ---');
      pushToGithub();
    } else {
      console.log('\nSkipping git push (use --push to enable)');
    }

    console.log('\nDone!\n');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    closeDb();
  }
}

function pushToGithub() {
  try {
    const opts = { cwd: ROOT, stdio: 'pipe' as const };

    // Check if git repo exists
    try {
      execSync('git rev-parse --git-dir', opts);
    } catch {
      console.log('  Initializing git repo...');
      execSync('git init', opts);
    }

    // Check for changes in docs/
    const status = execSync('git status --porcelain docs/', opts).toString().trim();
    if (!status) {
      console.log('  No changes to push');
      return;
    }

    execSync('git add docs/', opts);
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    execSync(`git commit -m "Update flight deals - ${timestamp}"`, opts);

    // Try to push (will fail if no remote configured, which is fine)
    try {
      execSync('git push', opts);
      console.log('  Pushed to GitHub');
    } catch {
      console.log('  Committed locally. Set up a remote with: git remote add origin <your-repo-url>');
    }
  } catch (error: any) {
    console.error('  Git error:', error.message);
  }
}

main();
