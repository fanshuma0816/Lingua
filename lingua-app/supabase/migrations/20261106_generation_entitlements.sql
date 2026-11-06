-- Phase 1. Additive only: does not alter existing tables or issue production grants.
begin;
create table if not exists public.generation_subjects (
  id uuid primary key default gen_random_uuid(),
  environment text not null check(environment in ('test','production')),
  identity_key text not null,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(environment,identity_key)
);
create table if not exists public.generation_grants (
  subject_id uuid primary key references public.generation_subjects(id) on delete cascade,
  amount integer not null check(amount in (1,3)), created_at timestamptz not null default now()
);
create table if not exists public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.generation_subjects(id) on delete cascade,
  request_key uuid not null, payload_hash text not null,
  status text not null check(status in ('processing','ready','confirmed','failed','expired')),
  expires_at timestamptz not null default now()+interval '15 minutes',
  created_at timestamptz not null default now(), unique(subject_id,request_key)
);
create table if not exists public.generated_lessons (
  id uuid primary key default gen_random_uuid(),
  environment text not null check(environment in ('test','production')),
  subject_id uuid not null references public.generation_subjects(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  request_id uuid unique references public.generation_requests(id) on delete cascade,
  legacy_record_id uuid, material_segment_id uuid,
  analysis_cache jsonb not null default '{}'::jsonb, resources jsonb not null default '[]'::jsonb, snapshot jsonb not null, progress jsonb not null default '{}'::jsonb,
  delivered_at timestamptz, saved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(environment,legacy_record_id)
);
create table if not exists public.generation_usage (
  request_id uuid primary key references public.generation_requests(id) on delete cascade,
  subject_id uuid not null references public.generation_subjects(id) on delete cascade,
  lesson_id uuid unique references public.generated_lessons(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.generation_rate_limits (
  environment text not null, rate_key text not null, window_start timestamptz not null,
  count integer not null, primary key(environment,rate_key,window_start)
);
create index if not exists generation_requests_pending_idx on public.generation_requests(subject_id,expires_at)
  where status in ('processing','ready');
create index if not exists generated_lessons_owner_idx on public.generated_lessons(environment,owner_user_id,created_at desc);
create index if not exists generated_lessons_segment_idx on public.generated_lessons(environment,owner_user_id,material_segment_id);

alter table public.generation_subjects enable row level security;
alter table public.generation_grants enable row level security;
alter table public.generation_requests enable row level security;
alter table public.generated_lessons enable row level security;
alter table public.generation_usage enable row level security;
alter table public.generation_rate_limits enable row level security;
revoke all on public.generation_subjects, public.generation_grants, public.generation_requests,
 public.generated_lessons, public.generation_usage, public.generation_rate_limits from public, anon, authenticated;
grant select,insert,update,delete on public.generation_subjects, public.generation_grants, public.generation_requests,
 public.generated_lessons, public.generation_usage, public.generation_rate_limits to service_role;

-- Only service_role can execute. Identity/environment are validated by the app server.
create or replace function public.lingua_generation(
 p_action text, p_environment text, p_subject text, p_user_id uuid, p_args jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 s public.generation_subjects; r public.generation_requests; l public.generated_lessons;
 granted integer; used integer; held integer; guest_id uuid; rate_count integer;
 items jsonb; off integer;
begin
 if p_environment not in ('test','production') or p_subject is null then raise exception 'invalid identity'; end if;
 if (p_user_id is not null and p_subject <> 'user:'||p_user_id::text)
   or (p_user_id is null and p_subject !~ '^guest:[0-9a-f-]{36}$') then raise exception 'invalid identity'; end if;
 insert into generation_subjects(environment,identity_key,user_id) values(p_environment,p_subject,p_user_id)
   on conflict(environment,identity_key) do nothing;
 select * into s from generation_subjects where environment=p_environment and identity_key=p_subject for update;
 -- All quota transitions for one subject serialize on this row.
 insert into generation_grants(subject_id,amount) values(s.id,case when p_user_id is null then 1 else 3 end)
   on conflict(subject_id) do nothing;
 update generation_requests set status='expired' where subject_id=s.id and status in ('processing','ready') and expires_at<=now();
 select amount into granted from generation_grants where subject_id=s.id;
 select count(*) into used from generation_usage where subject_id=s.id;
 select count(*) into held from generation_requests where subject_id=s.id and status in ('processing','ready');

 if p_action='balance' then
   return jsonb_build_object('enabled',true,'environment',p_environment,'signedIn',p_user_id is not null,
    'granted',granted,'used',used,'reserved',held,'remaining',greatest(0,granted-used),
    'available',greatest(0,granted-used-held),'canGenerate',granted>used+held,'pro',false);
 elsif p_action='rate' then
   insert into generation_rate_limits(environment,rate_key,window_start,count)
    values(p_environment,p_args->>'key',date_trunc('minute',now()),1)
    on conflict(environment,rate_key,window_start) do update set count=generation_rate_limits.count+1
    returning count into rate_count;
   if rate_count>coalesce((p_args->>'limit')::integer,12) then return jsonb_build_object('error','rate_limited'); end if;
   return '{"ok":true}'::jsonb;
 elsif p_action in ('reserve','request','store','release') then
   select * into r from generation_requests where subject_id=s.id and request_key=(p_args->>'requestId')::uuid for update;
   if p_action='reserve' then
     if r.id is not null then
       if r.payload_hash<>p_args->>'hash' then return jsonb_build_object('error','request_conflict'); end if;
     else
       if granted<=used+held then return jsonb_build_object('error',case when p_user_id is null then 'sign_in_required' else 'quota_exhausted' end); end if;
       insert into generation_requests(subject_id,request_key,payload_hash,status) values(s.id,(p_args->>'requestId')::uuid,p_args->>'hash','processing') returning * into r;
       return jsonb_build_object('status','processing','acquired',true);
     end if;
   end if;
   if r.id is null then return jsonb_build_object('error','request_not_found'); end if;
   if p_action='release' then
     update generation_requests set status='failed' where id=r.id and status='processing';
     return '{"ok":true}'::jsonb;
   end if;
   if r.status in ('expired','failed') then return jsonb_build_object('error',case when r.status='expired' then 'request_expired' else 'request_failed' end); end if;
   if p_action='store' and r.status='processing' then
     insert into generated_lessons(environment,subject_id,owner_user_id,request_id,snapshot,material_segment_id)
      values(p_environment,s.id,p_user_id,r.id,p_args->'snapshot',nullif(p_args->'snapshot'->'material'->>'accountSegmentId','')::uuid)
      returning * into l;
     update generated_lessons set snapshot=snapshot||jsonb_build_object('lessonId',l.id,'localLessonId',l.id,'environment',p_environment,'ownerId',p_user_id) where id=l.id returning * into l;
     update generation_requests set status='ready' where id=r.id;
     return jsonb_build_object('status','ready','lesson',l.snapshot);
   end if;
   select * into l from generated_lessons where request_id=r.id;
   return jsonb_build_object('status',r.status,'lesson',l.snapshot);
 elsif p_action='claim' then
   if p_user_id is null then return jsonb_build_object('error','sign_in_required'); end if;
   select id into guest_id from generation_subjects where environment=p_environment and identity_key=p_args->>'guest';
   update generated_lessons set owner_user_id=p_user_id,
     snapshot=snapshot||jsonb_build_object('ownerId',p_user_id),updated_at=now()
    where subject_id=guest_id and owner_user_id is null and delivered_at is not null;
   return '{"ok":true}'::jsonb;
 elsif p_action='legacy' then
   if p_user_id is null then return jsonb_build_object('error','sign_in_required'); end if;
   insert into generated_lessons(environment,subject_id,owner_user_id,legacy_record_id,snapshot,progress,delivered_at,saved_at)
    values(p_environment,s.id,p_user_id,(p_args->>'recordId')::uuid,p_args->'snapshot',coalesce(p_args->'progress','{}'),now(),now())
    on conflict(environment,legacy_record_id) do nothing;
   select * into l from generated_lessons where environment=p_environment and legacy_record_id=(p_args->>'recordId')::uuid and owner_user_id=p_user_id;
   update generated_lessons set snapshot=snapshot||jsonb_build_object('lessonId',l.id,'localLessonId',l.id,'environment',p_environment,'ownerId',p_user_id) where id=l.id returning * into l;
   return jsonb_build_object('lesson',l.snapshot,'progress',l.progress,'delivered',true);
 elsif p_action='history' then
   off:=greatest(0,coalesce((p_args->>'offset')::integer,0));
   select coalesce(jsonb_agg(x.item order by x.at desc,x.sort_id),'[]') into items from (
     select * from (
       select jsonb_build_object('id',g.id,'generated',true,'lang',g.snapshot->>'lang','level',g.snapshot->>'level',
        'material_title',g.snapshot->'material'->>'title','lesson_snapshot',g.snapshot,
        'input_text',g.snapshot->>'text','interaction_snapshot',g.progress->'interaction',
        'completed_at',g.created_at,'stats',jsonb_build_object('sentenceCount',jsonb_array_length(coalesce(g.snapshot->'sents','[]')))) as item,
        g.created_at as at,g.id as sort_id
       from generated_lessons g where g.environment=p_environment and g.delivered_at is not null
        and ((p_user_id is not null and g.owner_user_id=p_user_id) or (p_user_id is null and g.subject_id=s.id and g.owner_user_id is null))
       union all
       select to_jsonb(h)||jsonb_build_object('generated',false),h.created_at,h.id
       from lesson_sessions h where h.user_id=p_user_id and not exists(
         select 1 from generated_lessons g where g.environment=p_environment and g.legacy_record_id=h.id
       )
     ) all_lessons order by at desc,sort_id limit 21 offset off
   ) x;
   return jsonb_build_object('lessons',items);
 elsif p_action='list' then
   off:=greatest(0,coalesce((p_args->>'offset')::integer,0));
   select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc,x.id),'[]') into items from (
    select id,snapshot,progress,created_at,saved_at,legacy_record_id from generated_lessons
     where environment=p_environment and delivered_at is not null
     and ((p_user_id is not null and owner_user_id=p_user_id) or (p_user_id is null and subject_id=s.id and owner_user_id is null))
     order by created_at desc,id limit 21 offset off
   ) x;
   return jsonb_build_object('lessons',items);
 elsif p_action='segment' then
   select * into l from generated_lessons where environment=p_environment and owner_user_id=p_user_id
    and material_segment_id=(p_args->>'segmentId')::uuid and delivered_at is not null order by created_at desc limit 1;
   return jsonb_build_object('lessonId',l.id);
 elsif p_action in ('read','confirm','progress','save','resource','analysis_get','analysis_put') then
   -- Confirm takes the original subject lock too (guest claim does not move quota).
   select subject_id into guest_id from generated_lessons where id=(p_args->>'lessonId')::uuid and environment=p_environment;
   if guest_id is not null and guest_id<>s.id then
     -- Claim only transfers delivered lessons; another subject never confirms a reservation.
     if p_action='confirm' then
       select * into l from generated_lessons where id=(p_args->>'lessonId')::uuid and environment=p_environment and owner_user_id=p_user_id and delivered_at is not null;
       if l.id is not null then return jsonb_build_object('delivered',true); end if;
     end if;
   end if;
   select * into l from generated_lessons where id=(p_args->>'lessonId')::uuid and environment=p_environment
    and ((p_user_id is not null and owner_user_id=p_user_id) or (p_user_id is null and subject_id=s.id and owner_user_id is null)) for update;
   if l.id is null then return jsonb_build_object('error','lesson_not_found'); end if;
   if p_action='confirm' then
     if l.delivered_at is not null then return jsonb_build_object('delivered',true); end if;
     select * into r from generation_requests where id=l.request_id and subject_id=s.id for update;
     if r.status<>'ready' or r.expires_at<=now() then return jsonb_build_object('error','request_expired'); end if;
     insert into generation_usage(request_id,subject_id,lesson_id) values(r.id,s.id,l.id) on conflict do nothing;
     update generation_requests set status='confirmed' where id=r.id;
     update generated_lessons set delivered_at=now(),updated_at=now() where id=l.id;
     return jsonb_build_object('delivered',true);
   end if;
   if l.delivered_at is null then
     select * into r from generation_requests where id=l.request_id;
     if r.status<>'ready' or r.expires_at<=now() then return jsonb_build_object('error','request_expired'); end if;
     if p_action<>'read' then return jsonb_build_object('error','lesson_not_delivered'); end if;
   end if;
   if p_action='analysis_get' then
     return jsonb_build_object('result',l.analysis_cache->(p_args->>'key'));
   end if;
   if p_action='analysis_put' then
     if not (l.analysis_cache ? (p_args->>'key')) then
       update generated_lessons set analysis_cache=analysis_cache||jsonb_build_object(p_args->>'key',p_args->'result') where id=l.id returning * into l;
     end if;
     return jsonb_build_object('result',l.analysis_cache->(p_args->>'key'));
   end if;
   if p_action='resource' then
     update generated_lessons set resources=(select coalesce(jsonb_agg(v),'[]') from (
       select distinct v from jsonb_array_elements(l.resources||coalesce(p_args->'resources','[]')) as a(v) limit 2000
     ) q) where id=l.id;
     return '{"ok":true}'::jsonb;
   end if;
   if p_action in ('progress','save') then
     update generated_lessons set progress=progress||coalesce(p_args->'progress','{}'),
       saved_at=case when p_action='save' then now() else saved_at end,updated_at=now() where id=l.id;
     return jsonb_build_object('ok',true,'lessonSessionId',l.id);
   end if;
   return jsonb_build_object('lesson',l.snapshot,'progress',l.progress,'resources',l.resources,'delivered',l.delivered_at is not null);
 end if;
 raise exception 'unknown generation action';
end $$;
revoke all on function public.lingua_generation(text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.lingua_generation(text,text,text,uuid,jsonb) to service_role;

-- Call through a scheduled server task; every quota operation also expires its own holds.
create or replace function public.lingua_expire_generation_requests() returns integer
 language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 -- SKIP LOCKED avoids racing an in-flight confirmation or blocking active users.
 with expired as (
   select r.id from generation_requests r join generation_subjects s on s.id=r.subject_id
   where r.status in ('processing','ready') and r.expires_at<=now()
   for update of s,r skip locked
 ) update generation_requests r set status='expired' from expired e where r.id=e.id;
 get diagnostics n=row_count;
 delete from generation_rate_limits where window_start<now()-interval '2 days';
 return n;
end $$;
revoke all on function public.lingua_expire_generation_requests() from public,anon,authenticated;
grant execute on function public.lingua_expire_generation_requests() to service_role;
commit;
