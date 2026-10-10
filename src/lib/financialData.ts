import {readCatalog} from './catalog';
import { supabase } from './supabase';
import { readScopedSnapshot } from './financial';
export async function fetchFinancialSnapshot(businessId:string,selectedBranch:string) {
 const {data:branches,error:branchError}=await readCatalog<{id:string}>('branches',businessId);
 if(branchError)throw branchError;
 return readScopedSnapshot(async args=>{
   const result=await supabase.rpc('pos_dashboard_snapshot',args);
   if(result.error?.code==='PGRST202') throw new Error('Financial reporting is unavailable until the approved database migration installs pos_dashboard_snapshot. No substitute totals are shown.');
   return result;
 },businessId,(branches??[]).map(b=>String(b.id)),selectedBranch);
}
