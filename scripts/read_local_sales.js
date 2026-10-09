import path from 'path';
import fs from 'fs';

// Uses better-sqlite3 for synchronous reads. Install with:
// npm install better-sqlite3

let dbPath = process.env.LOCAL_POS_DB;
if (!dbPath) {
  const appdata = process.env.APPDATA || process.env.LOCALAPPDATA;
  if (!appdata) {
    console.error('Cannot determine APPDATA. Set LOCAL_POS_DB env var to the local DB path.');
    process.exit(1);
  }
  dbPath = path.join(appdata, 'com.pos.dailys', 'pos_v2.db');
}

if (!fs.existsSync(dbPath)) {
  console.error('Local DB not found at', dbPath);
  process.exit(1);
}

let Database;
try {
  Database = (await import('better-sqlite3')).default;
} catch (err) {
  console.error('Please install better-sqlite3 first: npm install better-sqlite3');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

function getColumns(table) {
  try {
    const stmt = db.prepare(`PRAGMA table_info(${table})`);
    return stmt.all().map((r) => r.name);
  } catch (err) {
    return [];
  }
}

const salesCols = getColumns('sales');
if (salesCols.length === 0) {
  console.error('No sales table found in DB at', dbPath);
  process.exit(1);
}

const want = ['id','branch_id','business_id','total','subtotal','currency','exchange_rate','cashier_name','date','synced_at','synced','is_synced'];
const avail = want.filter((c) => salesCols.includes(c));
const selectCols = avail.length > 0 ? avail.join(', ') : 'id, branch_id, business_id, total, date';

const q = `SELECT ${selectCols} FROM sales ORDER BY date DESC LIMIT 50`;
let rows = [];
try {
  rows = db.prepare(q).all();
} catch (err) {
  // fallback: try without ORDER BY
  try {
    rows = db.prepare(`SELECT ${selectCols} FROM sales LIMIT 50`).all();
  } catch (err2) {
    console.error('Failed to query sales table:', err2.message || err2);
    process.exit(1);
  }
}

console.log('Local DB path:', dbPath);
console.log('Sales table columns:', salesCols.join(', '));
console.log('Selected columns:', selectCols);
console.log('Recent sales (up to 50):');
console.log(JSON.stringify(rows, null, 2));

process.exit(0);
