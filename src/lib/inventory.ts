import { supabase } from './supabase';
import { readScopedSnapshot } from './financial';
// A single read-only snapshot avoids offset paging drift during concurrent
// sales, receipts and product deactivation, and bypasses the REST row cap.
export async function fetchInventoryProducts<T>(businessId:string,branchIds:string[],selectedBranchId='all'):Promise<{data:T[];error:unknown|null}> {
 try {
  const snapshot=await readScopedSnapshot(args=>supabase.rpc('pos_dashboard_snapshot',args),businessId,branchIds,selectedBranchId);
  return {data:snapshot.products as unknown as T[],error:null};
 } catch(error){return {data:[],error};}
}
