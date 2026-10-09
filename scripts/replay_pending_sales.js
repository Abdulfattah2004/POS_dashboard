import 'dotenv/config';
throw new Error('Legacy direct-write queue replay is retired. Preserve pending operations and use the reviewed reconciliation runbook; automatic replay is prohibited.');
import fs from 'fs';
import path from 'path';

let Database;
try {
  Database = (await import('better-sqlite3')).default;
} catch (err) {
  console.error('Please install better-sqlite3 first: npm install better-sqlite3');
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY (service role) in environment or .env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const appdata = process.env.APPDATA || process.env.LOCALAPPDATA;
const dbPath = process.env.LOCAL_POS_DB || path.join(appdata, 'com.pos.dailys', 'pos_v2.db');

if (!fs.existsSync(dbPath)) {
  console.error('Local DB not found at', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

function getSetting(key) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  } catch (err) {
    return null;
  }
}

const business_id = process.env.TEST_BUSINESS_ID || getSetting('business_id');
const branch_id = process.env.TEST_BRANCH_ID || getSetting('branch_id');

if (!business_id || !branch_id) {
  console.error('Could not determine business_id or branch_id. Set TEST_BUSINESS_ID/TEST_BRANCH_ID or ensure settings table contains them.');
  process.exit(1);
}

console.log('Using business_id=', business_id);
console.log('Using branch_id=', branch_id);

// Read unsynced sales
const pendingSales = db.prepare('SELECT * FROM sales WHERE synced = 0 ORDER BY date ASC').all();
console.log(`Found ${pendingSales.length} unsynced sale(s)`);

for (const sale of pendingSales) {
  const saleId = sale.id;
  console.log('\nProcessing sale', saleId);

  // Map local columns (camelCase) to cloud snake_case
  const salePayload = {
    id: saleId,
    business_id,
    branch_id,
    subtotal: sale.subtotal ?? sale.subTotal ?? 0,
    total: sale.total ?? 0,
    currency: sale.currency || 'USD',
    exchange_rate: sale.exchangeRate ? Number(sale.exchangeRate) : Number(getSetting('exchange_rate') || 1),
    cashier_name: sale.cashierName || 'POS',
    date: sale.date || new Date().toISOString(),
    refunded: sale.refunded ? true : false,
  };

  try {
    // Upsert sale (on conflict id do nothing/update)
    const { data: saleData, error: saleError } = await supabase.from('sales').upsert([salePayload], { onConflict: 'id' }).select();
    if (saleError) {
      console.error('Supabase sale upsert error:', saleError);
      continue;
    }

    console.log('Sale upserted:', saleData && saleData[0] ? saleData[0].id : saleId);

    // Read local sale items
    const items = db.prepare('SELECT * FROM sale_items WHERE saleId = ?').all(saleId);
    if (items && items.length > 0) {
      const itemPayloads = items.map((it) => ({
        id: it.id,
        sale_id: saleId,
        product_id: it.productId || null,
        product_name: it.productName || it.product_name || null,
        quantity: Number(it.quantity || 0),
        sale_price: Number(it.salePrice || it.sale_price || 0),
        cost: Number(it.purchasePrice || it.purchase_price || 0),
        currency: it.currency || 'USD',
        branch_id,
        business_id,
        date: sale.date || new Date().toISOString(),
      }));

      const { data: itemsData, error: itemsError } = await supabase.from('sale_items').upsert(itemPayloads, { onConflict: 'id' }).select();
      if (itemsError) {
        console.error('Supabase sale_items upsert error:', itemsError);
        // continue; still mark? skip marking until items succeed
        continue;
      }
      console.log(`Upserted ${itemsData.length} sale_items`);
    } else {
      console.log('No sale_items for', saleId);
    }

    // Mark local sale and its items as synced
    try {
      db.prepare('UPDATE sales SET synced = 1 WHERE id = ?').run(saleId);
      db.prepare('UPDATE sale_items SET synced = 1 WHERE saleId = ?').run(saleId);
      console.log('Marked local sale and items as synced');
    } catch (markErr) {
      console.error('Failed to mark local rows as synced:', markErr.message || markErr);
    }
  } catch (err) {
    console.error('Unexpected error while processing sale', saleId, err.message || err);
    continue;
  }
}

console.log('\nReplay complete.');
process.exit(0);
