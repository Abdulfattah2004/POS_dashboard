// Read-only REST diagnostic. Never logs credentials or transaction records.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).flatMap(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  return match ? [[match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, '')]] : [];
}));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Public Supabase configuration missing');
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
});
const result = await db.from('businesses').select('id,name').ilike('name', 'Daily Supermarket');
if (result.error) {
  console.log(JSON.stringify({ verified: false, stage: 'businesses', code: result.error.code, message: result.error.message }));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ businesses: result.data, note: 'Anonymous empty results cannot establish absence under RLS.' }));
}
const observedBusinessId = '1593a757-910c-4e45-8dd2-26436bae0347';
const branches = await db.from('branches').select('id,name,business_id').eq('business_id', observedBusinessId).order('id');
console.log(JSON.stringify({ businessId: observedBusinessId, branches: branches.data, error: branches.error?.code ?? null }));
if (branches.error) process.exitCode = 1;
try {
  const response = await fetch('https://dailys-pos.vercel.app', { signal: AbortSignal.timeout(15000) });
  const html = await response.text();
  const script = html.match(/<script[^>]+src="([^"]+\.js)"/);
  const js = script ? await (await fetch(new URL(script[1], response.url), { signal: AbortSignal.timeout(15000) })).text() : '';
  console.log(JSON.stringify({ siteStatus: response.status, script: script?.[1],
    containsFaultyValidation: js.includes('Dashboard requires one uniquely identified branch'),
    containsPinnedPalmaId: js.includes('93cbc500-8177-42a8-a74c-4a57c2113956'),
    note: 'Public bundle inspection only; no authenticated customer data verified.' }));
} catch {
  console.log(JSON.stringify({ siteVerified: false, reason: 'Public website request failed' }));
}
