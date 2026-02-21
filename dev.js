#!/usr/bin/env node
/**
 * Dev launcher — runs for `npm run dev`.
 *
 * 1. Reads .env (if present) for PB credentials.
 * 2. Downloads the PocketBase binary into ./pb/ if it isn't there yet.
 * 3. Starts PocketBase (data stored in ./pb/pb_data/).
 * 4. Waits for PocketBase to be healthy.
 * 5. Runs pb_setup.js to apply the schema (idempotent — safe to re-run).
 * 6. Starts `vite dev`.
 *
 * PocketBase credentials for dev default to the values in .env.example.
 * Override them in a .env file (they are never required in production —
 * that's handled by Docker / entrypoint.sh).
 */

import { existsSync, mkdirSync, createWriteStream, readFileSync } from 'fs';
import { spawn, execSync } from 'child_process';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env ────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

// ── Config ───────────────────────────────────────────────────────────────────
const PB_VERSION = '0.36.4';
const PB_BIN     = join(__dirname, 'pocketbase');
const PB_DATA    = join(__dirname, 'pb_data');
const PB_URL     = process.env.PB_URL || 'http://localhost:8090';

// Dev-only defaults — safe placeholder credentials for localhost
const PB_ADMIN_EMAIL    = process.env.PB_ADMIN_EMAIL    || 'admin@example.com';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'change-this-password';

// ── Helpers ──────────────────────────────────────────────────────────────────
function log(msg)  { console.log(`\x1b[36m[dev]\x1b[0m ${msg}`); }
function warn(msg) { console.log(`\x1b[33m[dev]\x1b[0m ${msg}`); }

function getArch() {
  const raw = execSync('uname -m').toString().trim();
  if (raw === 'x86_64')  return 'linux_amd64';
  if (raw === 'aarch64') return 'linux_arm64';
  throw new Error(`Unsupported arch: ${raw}`);
}

async function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      resolve(res);
    }).on('error', reject);
  });
}

async function downloadPocketBase() {
  const arch    = getArch();
  const zipName = `pocketbase_${PB_VERSION}_${arch}.zip`;
  const zipUrl  = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${zipName}`;
  const zipDest = join(__dirname, zipName);

  log(`Downloading PocketBase v${PB_VERSION} (${arch})…`);

  const res = await httpsGet(zipUrl);
  await pipeline(res, createWriteStream(zipDest));

  log('Extracting…');
  execSync(`unzip -o "${zipDest}" pocketbase -d "${__dirname}"`, { stdio: 'inherit' });
  execSync(`chmod +x "${PB_BIN}"`);

  // Clean up zip
  try { execSync(`rm "${zipDest}"`); } catch {}
  log('PocketBase ready ✓');
}

async function waitForHealth(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${PB_URL}/api/health`);
      if (res.ok) return;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`PocketBase did not become healthy within ${timeoutMs / 1000}s`);
}

function spawnAttached(cmd, args, env = {}) {
  return spawn(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  // 1. Download PocketBase if needed
  if (!existsSync(PB_BIN)) {
    await downloadPocketBase();
  }

  mkdirSync(PB_DATA, { recursive: true });

  // 2. Create / upsert the superuser before starting PocketBase
  //    (direct SQLite write — PB must NOT be running yet)
  log(`Creating superuser ${PB_ADMIN_EMAIL}…`);
  try {
    execSync(`"${PB_BIN}" superuser upsert "${PB_ADMIN_EMAIL}" "${PB_ADMIN_PASSWORD}" --dir="${PB_DATA}"`, {
      stdio: 'pipe'
    });
    log('Superuser ready ✓');
  } catch (e) {
    warn(`superuser upsert: ${e.stderr?.toString().trim() || e.message} — continuing`);
  }

  // 3. Start PocketBase
  log(`Starting PocketBase (data: ${PB_DATA})…`);
  const pb = spawn(PB_BIN, ['serve', `--http=127.0.0.1:8090`, `--dir=${PB_DATA}`], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Print PB output with a prefix so it's distinguishable
  pb.stdout.on('data', d => process.stdout.write(`\x1b[2m[pb] ${d}\x1b[0m`));
  pb.stderr.on('data', d => process.stderr.write(`\x1b[2m[pb] ${d}\x1b[0m`));
  pb.on('exit', (code) => {
    if (code !== null) warn(`PocketBase exited with code ${code}`);
  });

  // Kill PocketBase when this process exits
  process.on('exit',    () => pb.kill());
  process.on('SIGINT',  () => { pb.kill(); process.exit(0); });
  process.on('SIGTERM', () => { pb.kill(); process.exit(0); });

  // 4. Wait for PocketBase to be healthy
  log('Waiting for PocketBase to be ready…');
  await waitForHealth();
  log('PocketBase is healthy ✓');

  // 5. Apply schema (idempotent)
  log('Applying schema via pb_setup.js…');
  await new Promise((resolve) => {
    const setup = spawnAttached('node', [join(__dirname, 'pb_setup.js')], {
      PB_URL,
      PB_ADMIN_EMAIL,
      PB_ADMIN_PASSWORD,
    });
    setup.on('exit', (code) => {
      if (code !== 0) warn('pb_setup.js exited with errors — schema may already be applied, continuing.');
      resolve();
    });
  });

  // 6. Start Vite
  log('Starting Vite dev server…');
  const vite = spawnAttached('./node_modules/.bin/vite', ['dev'], {
    PB_URL,
  });
  vite.on('exit', (code) => process.exit(code ?? 0));
})().catch((e) => {
  console.error(`\x1b[31m[dev] Fatal: ${e.message}\x1b[0m`);
  process.exit(1);
});
