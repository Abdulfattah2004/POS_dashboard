import {supabase} from './supabase';
import {readAllPages} from './pagination';
export async function readCatalog<T extends {id:string}>(table:'businesses'|'branches',scopeId:string):Promise<{data:T[]|null;error:{message:string}|null}> {
 try{if(!scopeId)throw new Error('Catalog scope is required');const data=await readAllPages<T>(async after=>{let q=supabase.from(table).select('*').eq(table==='businesses'?'owner_id':'business_id',scopeId).order('id').limit(500);if(after)q=q.gt('id',after);const result=await q;return {data:result.data as T[]|null,error:result.error};});return {data,error:null};}
 catch(error){return {data:null,error:{message:error instanceof Error?error.message:'Catalog unavailable'}};}
}
