import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

// 1. Ensure persistent /data directory exists
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.warn('[PRISMA] Could not create dataDir:', err);
  }
}

// 2. Setup persistent database path
const persistentDbPath = path.join(dataDir, 'rakna.db');
const fallbackDevDbPath = path.join(process.cwd(), 'prisma', 'dev.db');

// If persistent database does not exist yet, copy initial dev.db
if (!fs.existsSync(persistentDbPath) && fs.existsSync(fallbackDevDbPath)) {
  try {
    fs.copyFileSync(fallbackDevDbPath, persistentDbPath);
    console.log('[PRISMA] Successfully initialized persistent database from template dev.db');
  } catch (err) {
    console.warn('[PRISMA] Notice: Could not copy dev.db template:', err);
  }
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
