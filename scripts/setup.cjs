/**
 * Ensure frontend/.env and backend-ts/.env exist (copy from .env.example).
 * Run from repo root: node scripts/setup.cjs
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function ensureEnv(subdir) {
  const envPath = path.join(root, subdir, '.env');
  const examplePath = path.join(root, subdir, '.env.example');
  if (fs.existsSync(envPath)) {
    console.log(`[setup] ${subdir}/.env already exists — skipped`);
    return;
  }
  if (!fs.existsSync(examplePath)) {
    console.warn(`[setup] ${subdir}/.env.example missing — skipped`);
    return;
  }
  fs.copyFileSync(examplePath, envPath);
  console.log(`[setup] created ${subdir}/.env from .env.example`);
}

ensureEnv('frontend');
ensureEnv('backend-ts');
console.log('[setup] done');
