import {readCatalog} from './catalog';
import { supabase } from './supabase';
import { readDashboardSnapshot } from './dashboardData';
import type { DashboardBranch } from './branchPolicy';
export async function fetchFinancialSnapshot(businessId:string,selectedBranch:string) {
 return readDashboardSnapshot(async id=>{
   const {data,error}=await readCatalog<DashboardBranch>('branches',id);
   if(error)throw new Error(error.message);
   return data??[];
 },async args=>{
   const result=await supabase.rpc('pos_dashboard_snapshot',args);
   if(result.error?.code==='PGRST202') throw new Error('Financial reporting is unavailable until the approved database migration installs pos_dashboard_snapshot. No substitute totals are shown.');
   return result;
 },businessId,selectedBranch);
}
