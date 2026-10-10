-- Read-only. Run in the Supabase SQL editor for project ncbyahoyhrbmunqkisuq.
begin isolation level repeatable read read only;

-- Return every branch, including hidden branches, for diagnosis only.
select b.id as business_id, b.name as business_name, b.owner_id,
       br.id as branch_id, br.name as stored_branch_name,
       length(br.name) as name_length
from public.businesses b
left join public.branches br on br.business_id = b.id
where lower(trim(b.name)) = 'daily supermarket'
   or b.id = '1593a757-910c-4e45-8dd2-26436bae0347'::uuid
order by b.id, br.name, br.id;

-- Detect requested names located in other businesses; never authorize by name.
select id, name, business_id from public.branches
where lower(trim(name)) in ('palma', 'manar', 'haykaliye')
order by business_id, name, id;

-- This is the deployed RPC definition, not a migration.
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'pos_dashboard_snapshot';

-- Inspect the RPC using the business owner's existing authenticated RLS context.
-- No roles, policies, records, or persistent settings are changed.
select set_config('request.jwt.claim.sub', owner_id::text, true),
       set_config('request.jwt.claims', json_build_object(
         'sub', owner_id::text, 'role', 'authenticated')::text, true)
from public.businesses
where id = '1593a757-910c-4e45-8dd2-26436bae0347'::uuid;
set local role authenticated;

-- Only existing IDs with the expected business/name enter the read-only RPC.
-- Returns counts and scope keys rather than customer transaction details.
with requested(id, name) as (values
  ('93cbc500-8177-42a8-a74c-4a57c2113956'::uuid, 'palma'),
  ('12de0c1c-57fe-4367-9016-818f0ee3a88d'::uuid, 'manar'),
  ('c0dbbe76-61ac-4c8f-b970-472a6751e810'::uuid, 'haykaliye')
), existing as (
  select br.id, br.name, br.business_id
  from public.branches br join requested r
    on r.id = br.id and lower(trim(br.name)) = r.name
  where br.business_id = '1593a757-910c-4e45-8dd2-26436bae0347'::uuid
), snapshots as (
  select e.*, public.pos_dashboard_snapshot(e.business_id, array[e.id])::jsonb as data
  from existing e
)
select id as branch_id, name as stored_branch_name, business_id,
       jsonb_typeof(data) as snapshot_type,
       jsonb_array_length(data->'products') as product_count,
       jsonb_array_length(data->'sales') as sale_count,
       jsonb_array_length(data->'refunds') as refund_count,
       (select jsonb_agg(k) from jsonb_object_keys(data) k) as snapshot_keys,
       (select jsonb_agg(distinct jsonb_build_object(
          'business_id', entry->>'business_id', 'branch_id', entry->>'branch_id'))
        from (
          select value as entry from jsonb_array_elements(data->'products')
          union all select value from jsonb_array_elements(data->'sales')
          union all select value from jsonb_array_elements(data->'refunds')
          union all select value from jsonb_array_elements(data->'historical'->'sales')
          union all select value from jsonb_array_elements(data->'historical'->'sale_items')
          union all select value from jsonb_array_elements(data->'historical'->'refunds')
          union all select value from jsonb_array_elements(data->'historical'->'refund_items')
        ) scoped_rows) as returned_scopes
from snapshots order by name;

rollback;
