#!/usr/bin/env node
/**
 * PocketBase Schema Bootstrap Script
 *
 * Applies pb_schema.json to a running PocketBase instance.
 * Usage:
 *   PB_URL=http://localhost:8090 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret node pb_setup.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PB_URL = process.env.PB_URL || 'http://localhost:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars are required.');
  process.exit(1);
}

async function run() {
  // 1. Authenticate as superuser (PocketBase v0.23+ uses _superusers collection)
  console.log(`Connecting to PocketBase at ${PB_URL}…`);
  const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  if (!authRes.ok) {
    const text = await authRes.text();
    throw new Error(`Auth failed: ${authRes.status} ${text}`);
  }
  const { token } = await authRes.json();
  console.log('Authenticated as superuser ✓');

  // 2. Import schema
  const schema = JSON.parse(readFileSync(join(__dirname, 'pb_schema.json'), 'utf8'));
  const importRes = await fetch(`${PB_URL}/api/collections/import`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token
    },
    body: JSON.stringify({ collections: schema, deleteMissing: false })
  });
  if (!importRes.ok) {
    const text = await importRes.text();
    throw new Error(`Schema import failed: ${importRes.status} ${text}`);
  }
  console.log('Collections imported ✓');
  console.log('  → clients');
  console.log('  → invoices');
  console.log('  → invoice_items');
  console.log('  → invoice_logs');
  console.log('  → settings');
}

run().catch((e) => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});
