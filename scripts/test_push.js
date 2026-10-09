import 'dotenv/config';
throw new Error('Production diagnostic inserts are retired. Use the isolated POS/database/Dashboard acceptance tests.');
import { createClient } from '@supabase/supabase-js';

// Diagnostic test script: attempts to insert a single small test sale
// Usage: set SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY in your environment or .env, then run:
// node scripts/test_push.js

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or key. Set SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY in environment or .env');
  process.exit(1);
}

const supabase = createClient(url, key);

// Default branch id discovered earlier; override by setting TEST_BRANCH_ID in env if needed.
const DEFAULT_MAIN_BRANCH_ID = process.env.TEST_BRANCH_ID || '64bb012f-4070-4ef8-87b7-a3f836e522a9';
const DEFAULT_BUSINESS_ID = process.env.TEST_BUSINESS_ID || '1593a757-910c-4e45-8dd2-26436bae0347';

(async () => {
  try {
    const uniqueClientId = `diag-${Date.now()}`;
    const testSale = {
      id: uniqueClientId,
      branch_id: DEFAULT_MAIN_BRANCH_ID,
      business_id: DEFAULT_BUSINESS_ID,
      total: 0.01,
      subtotal: 0.01,
       exchange_rate: 1,
      currency: 'USD',
      cashier_name: 'diag-test',
      date: new Date().toISOString(),
      // remove optional columns that may not exist in every schema
    };

    console.log('Attempting to insert test sale (id:', uniqueClientId, ')');
    const { data, error } = await supabase.from('sales').insert([testSale]).select();

    if (error) {
      console.error('Insert error:', error);
      process.exit(1);
    }

    console.log('Insert response:', data);
    console.log('\nYou can remove the test row later using SQL if desired:');
    console.log("DELETE FROM sales WHERE id = '" + uniqueClientId + "';");
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
