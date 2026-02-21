#!/usr/bin/env node
/**
 * Harvest → Yield Migration Script
 *
 * Reads a single Harvest invoice report CSV (the "All invoices" export) and
 * imports clients + invoices + line items into PocketBase.
 *
 * Expected CSV columns (Harvest invoice report format):
 *   Issue Date, Last Payment Date, ID, PO Number, Client, Subject,
 *   Invoice Amount, Paid Amount, Balance, Subtotal, Discount,
 *   Tax, Tax2, Currency, Currency Symbol, Document Type, Client Address
 *
 * Usage:
 *   PB_URL=http://localhost:8090 \
 *   PB_ADMIN_EMAIL=admin@example.com \
 *   PB_ADMIN_PASSWORD=secret \
 *   node migrate.js [path/to/invoices.csv]
 *
 * The CSV path defaults to the first .csv found in the current directory
 * that contains "harvest" in its name, or ./invoices.csv as a last resort.
 */

import { createReadStream, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';
import Papa from 'papaparse';
import PocketBase from 'pocketbase';

// ─── Config ───────────────────────────────────────────────────────────────────
const PB_URL    = process.env.PB_URL            || 'http://localhost:8090';
const ADMIN_EMAIL    = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

// Resolve CSV path: explicit arg → harvest*.csv in cwd → ./invoices.csv
function findCsv() {
  const explicit = process.argv[2];
  if (explicit) return resolve(explicit);
  const found = readdirSync('.').find(f => f.toLowerCase().includes('harvest') && f.endsWith('.csv'));
  if (found) return resolve(found);
  return resolve('./invoices.csv');
}
const csvPath = findCsv();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseCsv(filePath) {
  return new Promise((res, rej) => {
    if (!existsSync(filePath)) { rej(new Error(`File not found: ${filePath}`)); return; }
    Papa.parse(createReadStream(filePath, 'utf8'), {
      header: true,
      skipEmptyLines: true,
      complete: r => res(r.data),
      error: rej
    });
  });
}

/** Parse numbers that Harvest formats with commas: "1,800.0" → 1800 */
function parseNum(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(/,/g, '')) || 0;
}

/** Extract ISO currency code from "Canadian Dollar - CAD" → "CAD" */
function parseCurrency(val) {
  if (!val) return 'USD';
  const m = String(val).match(/[-–]\s*([A-Z]{3})\s*$/);
  return m ? m[1] : String(val).trim().slice(0, 10);
}

/** Derive status from balance + issue date
 *  - balance = 0         → paid
 *  - issue date in future → draft (not sent yet)
 *  - otherwise           → sent (sent but unpaid)
 */
function deriveStatus(balance, issueDate) {
  if (parseNum(balance) === 0) return 'paid';
  if (issueDate && new Date(issueDate) > new Date()) return 'draft';
  return 'sent';
}

/** ISO date string or empty */
function toIso(d) {
  if (!d) return '';
  try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
}

/** Return issue_date + offsetDays as ISO date, or '' */
function addDays(isoDate, offsetDays) {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().split('T')[0];
  } catch { return ''; }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required.');
    process.exit(1);
  }

  const pb = new PocketBase(PB_URL);

  console.log(`Connecting to PocketBase at ${PB_URL}…`);
  await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Authenticated ✓\n');

  console.log(`Parsing ${csvPath}…`);
  const rows = await parseCsv(csvPath);
  console.log(`Parsed ${rows.length} invoice rows\n`);

  // ── 1. Deduplicate & upsert clients ────────────────────────────────────────
  /** client name → PocketBase record id */
  const clientIdMap = new Map();

  const uniqueClients = new Map(); // name → first row seen
  for (const row of rows) {
    const name = (row['Client'] || '').trim();
    if (name && !uniqueClients.has(name)) uniqueClients.set(name, row);
  }
  console.log(`Found ${uniqueClients.size} unique clients`);

  let clientsCreated = 0, clientsSkipped = 0;
  for (const [name, row] of uniqueClients) {
    // Idempotent: find by name
    try {
      const existing = await pb.collection('clients').getFirstListItem(`name = "${name.replace(/"/g, '\\"')}"`);
      clientIdMap.set(name, existing.id);
      clientsSkipped++;
      continue;
    } catch { /* not found → create */ }

    try {
      const record = await pb.collection('clients').create({
        name,
        address:  (row['Client Address'] || '').trim(),
        currency: parseCurrency(row['Currency']),
      });
      clientIdMap.set(name, record.id);
      clientsCreated++;
      console.log(`  [client +] ${name}`);
    } catch (e) {
      console.error(`  [client ✗] "${name}": ${e.message}`);
    }
  }
  console.log(`\nClients: ${clientsCreated} created, ${clientsSkipped} already existed\n`);

  // ── 2. Create invoices + line items ────────────────────────────────────────
  let invCreated = 0, invSkipped = 0, invFailed = 0;

  for (const row of rows) {
    const harvestId  = (row['ID'] || '').trim();
    const clientName = (row['Client'] || '').trim();
    const subject    = (row['Subject'] || '').trim();
    const issueDate  = toIso(row['Issue Date']);
    const subtotal   = parseNum(row['Subtotal']);
    const tax        = parseNum(row['Tax']);
    const balance    = row['Balance'];
    const paidAmount = parseNum(row['Paid Amount']);
    const status     = deriveStatus(balance, row['Issue Date']);
    const number     = harvestId; // use Harvest's own ID as the invoice number

    if (!harvestId || !clientName) { invSkipped++; continue; }

    const pbClientId = clientIdMap.get(clientName);
    if (!pbClientId) {
      console.warn(`  [invoice -] #${number}: no client record for "${clientName}"`);
      invSkipped++; continue;
    }

    // Idempotent: skip if number already exists
    try {
      await pb.collection('invoices').getFirstListItem(`number = "${number}"`);
      invSkipped++;
      continue;
    } catch { /* not found → create */ }

    // Tax percent: Tax$ / Subtotal$ × 100, rounded to 2 dp
    const taxPercent = subtotal > 0 ? Math.round((tax / subtotal) * 10000) / 100 : 0;

    try {
      const invoice = await pb.collection('invoices').create({
        client:      pbClientId,
        number,
        issue_date:  issueDate,
        due_date:    addDays(issueDate, 30),
        status,
        tax_percent: taxPercent,
        paid_amount: paidAmount,
        notes:       (row['PO Number'] || '').trim(),
      });

      // Create a single line item representing the whole invoice
      if (subtotal > 0) {
        await pb.collection('invoice_items').create({
          invoice:     invoice.id,
          description: subject || 'Services',
          quantity:    1,
          unit_price:  subtotal,
        });
      }

      invCreated++;
      console.log(`  [invoice +] #${number} ${clientName} – ${status}`);
    } catch (e) {
      console.error(`  [invoice ✗] #${number}: ${e.message}`);
      invFailed++;
    }
  }

  console.log(`\nInvoices: ${invCreated} created, ${invSkipped} skipped, ${invFailed} failed`);
  console.log('\nMigration complete ✓');
}

run().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
