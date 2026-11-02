const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 1. Ensure persistent /data directory exists
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.warn('[STARTUP] Notice: could not create dataDir:', err);
  }
}

// 2. Set default persistent DATABASE_URL if not provided
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'file:./dev.db' || process.env.DATABASE_URL === 'file:./prisma/dev.db') {
  process.env.DATABASE_URL = 'file:../data/rakna.db';
}

console.log('[STARTUP] Using Database URL:', process.env.DATABASE_URL);

// 3. Ensure schema is in sync with database file
try {
  execSync('node ./node_modules/prisma/build/index.js db push --skip-generate', {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  console.error('[STARTUP] Prisma db push error:', err);
}

// 4. Start the compiled backend server
require('../dist/server.js');

