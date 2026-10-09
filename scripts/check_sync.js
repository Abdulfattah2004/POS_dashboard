import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY (or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) in your environment.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log('Querying branches for "Main Branch"...');
  const { data: branches, error: branchesError } = await supabase
    .from('branches')
    .select('id, name, business_id, created_at')
    .ilike('name', 'Main Branch');

  if (branchesError) {
    console.error('Error fetching branches:', branchesError);
    process.exit(1);
  }

  console.log(`Found ${branches.length} branch(es) with name like 'Main Branch'`);
  branches.forEach((b) => console.log(' -', b));

  console.log('\nFetching latest 10 sales...');
  // Try ordering by common timestamp columns; some schemas use `created_at`, others use `date`.
  let recentSales = null;
  let salesError = null;

  ({ data: recentSales, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10));

  if (salesError) {
    // Fallback to ordering by `date` if `created_at` doesn't exist
    ({ data: recentSales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .order('date', { ascending: false })
      .limit(10));
  }

  if (salesError) {
    // Final fallback: grab any 10 sales without ordering
    ({ data: recentSales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .limit(10));
  }

  if (salesError) {
    console.error('Error fetching sales:', salesError);
    process.exit(1);
  }

  console.log(`Found ${recentSales.length} recent sales`);
  recentSales.forEach((s) => console.log(' -', s.id, 'branch_id:', s.branch_id, 'total:', s.total, 'date/created_at:', s.created_at || s.date));

  if (recentSales.length > 0) {
    const sale = recentSales[0];
    console.log(`\nFetching sale_items for latest sale ${sale.id}...`);
    const { data: items, error: itemsError } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', sale.id);

    if (itemsError) {
      console.error('Error fetching sale_items:', itemsError);
    } else {
      console.log(`Found ${items.length} sale_items for sale ${sale.id}`);
      items.forEach((it) => console.log(' -', it.id, it.product_name, 'qty:', it.quantity));
    }
  }

  console.log('\nChecking for sales with branch_id that does not exist in branches table...');
  const { data: allBranches } = await supabase.from('branches').select('id');
  const branchIds = new Set((allBranches || []).map((b) => b.id));

  const { data: allSales } = await supabase.from('sales').select('id, branch_id, created_at').order('created_at', { ascending: false }).limit(200);
  const missingBranchSales = (allSales || []).filter((s) => s.branch_id && !branchIds.has(s.branch_id));

  console.log(`Found ${missingBranchSales.length} sale(s) referencing missing branch IDs`);
  missingBranchSales.slice(0, 20).forEach((s) => console.log(' -', s.id, 'branch_id:', s.branch_id, 'created_at:', s.created_at));

  // Check if any sale uses a branch id matching a Main Branch found earlier
  if (branches.length > 0) {
    const mainBranchIds = new Set(branches.map((b) => b.id));
    const salesUsingMain = (allSales || []).filter((s) => mainBranchIds.has(s.branch_id));
    console.log(`\nFound ${salesUsingMain.length} sale(s) that use a Main Branch id`);
    salesUsingMain.slice(0, 20).forEach((s) => console.log(' -', s.id, 'branch_id:', s.branch_id, 'created_at:', s.created_at));
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
