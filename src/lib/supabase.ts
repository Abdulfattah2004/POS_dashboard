import { createClient } from '@supabase/supabase-js';
import { isUnsafeClientKey } from './clientKey';
const url=import.meta.env.VITE_SUPABASE_URL?.trim();
const key=import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
if(!url||!key)throw new Error('Dashboard Supabase configuration is required.');
if(isUnsafeClientKey(key))throw new Error('Secret or privileged Supabase keys must never be used in a browser client.');
export const supabase=createClient(url,key,{global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)})}});
