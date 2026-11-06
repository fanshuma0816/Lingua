-- Read-only checks after the migration. Does not issue credits or modify records.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') as anon_can_read,
 has_table_privilege('authenticated',c.oid,'UPDATE') as browser_can_update
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
 'generation_subjects','generation_grants','generation_requests',
 'generated_lessons','generation_usage','generation_rate_limits'
) order by c.relname;
-- Expected: 6 rows, rls_enabled=true, both permission columns=false.

select has_function_privilege('anon','public.lingua_generation(text,text,text,uuid,jsonb)','EXECUTE') as anon_can_execute,
 has_function_privilege('authenticated','public.lingua_generation(text,text,text,uuid,jsonb)','EXECUTE') as browser_can_execute,
 has_function_privilege('service_role','public.lingua_generation(text,text,text,uuid,jsonb)','EXECUTE') as server_can_execute;
-- Expected: false, false, true.

select s.environment,count(*) as grant_records,sum(g.amount) as granted_total
from public.generation_grants g join public.generation_subjects s on s.id=g.subject_id
group by s.environment;
-- Immediately after migration with the feature off: no rows.
