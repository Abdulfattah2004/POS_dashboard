import fs from 'fs';
import path from 'path';

let dbPath = process.env.LOCAL_POS_DB;
if (!dbPath) {
  const appdata = process.env.APPDATA || process.env.LOCALAPPDATA;
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

function listTables() {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return rows.map(r => r.name);
}

function getColumns(table) {
  try {
    const stmt = db.prepare(`PRAGMA table_info(${table})`);
    return stmt.all().map((r) => r.name);
  } catch (err) {
    return [];
  }
}

function sampleRows(table, cols, limit = 5) {
  try {
    const selectCols = cols.length > 0 ? cols.join(', ') : '*';
    const stmt = db.prepare(`SELECT ${selectCols} FROM ${table} LIMIT ${limit}`);
    return stmt.all();
  } catch (err) {
    return { error: err.message };
  }
}

const tables = listTables();
console.log('Local DB path:', dbPath);
console.log('Tables found:', tables.join(', '));

for (const t of tables) {
  const cols = getColumns(t);
  console.log(`\nTable: ${t}`);
  console.log(' Columns:', cols.join(', '));
  const sample = sampleRows(t, cols, 5);
  console.log(' Sample rows:', JSON.stringify(sample, null, 2));
}

process.exit(0);
