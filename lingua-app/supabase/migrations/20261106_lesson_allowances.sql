-- Apply to an isolated Supabase staging database first. No existing rows are deleted.
begin;
create table if not exists public.learning_allowances_v1 (
  owner_key text primary key,
  allowance integer not null check (allowance between 1 and 3),
  granted_at timestamptz not null default now()
);
create table if not exists public.learning_courses_v1 (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null references public.learning_allowances_v1(owner_key),
  request_key uuid not null,
  input_hash text not null,
  source_text text not null,
  status text not null check (status in ('generating','ready','confirmed','failed')),
  chargeable boolean not null default true,
  lesson jsonb,
  resume jsonb not null default '{}'::jsonb,
  lease_until timestamptz not null default now() + interval '2 minutes',
  created_at timestamptz not null default now(),
  saved_at timestamptz,
  completed_at timestamptz,
  unique(owner_key, request_key)
);
create table if not exists public.learning_usage_v1 (
  course_id uuid primary key references public.learning_courses_v1(id),
  owner_key text not null references public.learning_allowances_v1(owner_key),
  used_at timestamptz not null default now()
);
create index if not exists learning_courses_owner_v1 on public.learning_courses_v1(owner_key, created_at desc);
alter table public.learning_allowances_v1 enable row level security;
alter table public.learning_courses_v1 enable row level security;
alter table public.learning_usage_v1 enable row level security;
revoke all on public.learning_allowances_v1, public.learning_courses_v1, public.learning_usage_v1 from public, anon, authenticated;
grant all on public.learning_allowances_v1, public.learning_courses_v1, public.learning_usage_v1 to service_role;

-- Serialize all quota mutations for an owner. No client may execute these functions.
create or replace function public.learning_allowance_v1(p_owner text, p_limit integer) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare used integer; reserved integer; quota integer; pending uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner, 0));
  insert into learning_allowances_v1(owner_key,allowance) values(p_owner,p_limit) on conflict do nothing;
  update learning_courses_v1 set status='failed' where owner_key=p_owner and status='generating' and lease_until<now();
  select allowance into quota from learning_allowances_v1 where owner_key=p_owner;
  select count(*) into used from learning_usage_v1 where owner_key=p_owner;
  select count(*) into reserved from learning_courses_v1 where owner_key=p_owner and chargeable and status in ('generating','ready');
  select id into pending from learning_courses_v1 where owner_key=p_owner and status in ('generating','ready') order by created_at limit 1;
  return jsonb_build_object('total',quota,'used',used,'reserved',reserved,'remaining',greatest(0,quota-used-reserved),'pendingLessonId',pending);
end $$;

create or replace function public.learning_reserve_v1(p_owner text,p_limit integer,p_request uuid,p_hash text,p_source text,p_pro boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare state jsonb; course learning_courses_v1;
begin
  state:=learning_allowance_v1(p_owner,p_limit);
  select * into course from learning_courses_v1 where owner_key=p_owner and request_key=p_request;
  if found and course.input_hash<>p_hash then return '{"error":"request_conflict","status":409}'; end if;
  if course.status in ('ready','confirmed') then return jsonb_build_object('course',to_jsonb(course),'reused',true); end if;
  if course.status='generating' then return '{"error":"generation_in_progress","status":409}'; end if;
  -- A delivered-but-unconfirmed course must be recovered, never bypassed with another request ID.
  select * into course from learning_courses_v1 where owner_key=p_owner and status in ('ready','generating') order by created_at limit 1;
  if found then
    if course.status='ready' then return jsonb_build_object('course',to_jsonb(course),'reused',true); end if;
    return '{"error":"generation_in_progress","status":409}';
  end if;
  if not p_pro and (state->>'remaining')::integer<=0 then
    return jsonb_build_object('error',case when left(p_owner,2)='g:' then 'registration_required' else 'allowance_exhausted' end,'status',403);
  end if;
  insert into learning_courses_v1(owner_key,request_key,input_hash,source_text,status,chargeable)
    values(p_owner,p_request,p_hash,p_source,'generating',not p_pro)
    on conflict(owner_key,request_key) do update set status='generating',lease_until=now()+interval '2 minutes',chargeable=not p_pro
    returning * into course;
  return jsonb_build_object('course',to_jsonb(course),'reused',false);
end $$;

create or replace function public.learning_finish_v1(p_owner text,p_id uuid,p_lesson jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare course learning_courses_v1;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner,0));
  update learning_courses_v1 set status='ready',lesson=p_lesson where id=p_id and owner_key=p_owner and status='generating' and lease_until>=now() returning * into course;
  if not found then return '{"error":"generation_expired","status":409}'; end if;
  return to_jsonb(course);
end $$;
create or replace function public.learning_fail_v1(p_owner text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner,0));
  update learning_courses_v1 set status='failed' where id=p_id and owner_key=p_owner and status='generating';
  return '{"ok":true}';
end $$;
create or replace function public.learning_confirm_v1(p_owner text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare course learning_courses_v1;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner,0));
  select * into course from learning_courses_v1 where id=p_id and owner_key=p_owner for update;
  if not found then return '{"error":"course_not_found","status":404}'; end if;
  if course.status not in ('ready','confirmed') then return '{"error":"course_not_ready","status":409}'; end if;
  if course.chargeable then insert into learning_usage_v1(course_id,owner_key) values(p_id,p_owner) on conflict do nothing; end if;
  update learning_courses_v1 set status='confirmed',saved_at=case when left(p_owner,2)='u:' then coalesce(saved_at,now()) else saved_at end where id=p_id returning * into course;
  return to_jsonb(course);
end $$;
create or replace function public.learning_read_v1(p_owner text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare course learning_courses_v1;
begin
  select * into course from learning_courses_v1 where id=p_id and owner_key=p_owner and status in ('ready','confirmed');
  if not found then return '{"error":"course_not_found","status":404}'; end if;
  return to_jsonb(course);
end $$;
create or replace function public.learning_save_v1(p_owner text,p_id uuid,p_resume jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare course learning_courses_v1;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner,0));
  update learning_courses_v1 set resume=p_resume,saved_at=now(),
    completed_at=case when p_resume->>'completed'='true' then coalesce(completed_at,now()) else completed_at end
    where id=p_id and owner_key=p_owner and status='confirmed' returning * into course;
  if not found then return '{"error":"course_not_found","status":404}'; end if;
  return to_jsonb(course);
end $$;
create or replace function public.learning_claim_v1(p_guest text,p_owner text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare item learning_courses_v1; lock_key text;
begin
  if left(p_guest,2)<>'g:' or left(p_owner,2)<>'u:' then return '{"error":"invalid_claim","status":403}'; end if;
  for lock_key in select unnest(array[p_guest,p_owner]) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(lock_key,0));
  end loop;
  insert into learning_allowances_v1(owner_key,allowance) values(p_owner,3) on conflict do nothing;
  for item in select * from learning_courses_v1 where owner_key=p_guest and status in ('ready','confirmed') for update loop
    -- Preserve the guest debit; the account still has three additional generations.
    if item.chargeable then insert into learning_usage_v1(course_id,owner_key) values(item.id,p_guest) on conflict do nothing; end if;
    update learning_courses_v1 set owner_key=p_owner,status='confirmed',saved_at=coalesce(saved_at,now()) where id=item.id;
  end loop;
  return '{"ok":true}';
end $$;

-- Keep existing lesson snapshots; allow drafts and serialize legacy upserts by owner+course.
do $$ begin
  if to_regclass('public.lesson_sessions') is not null then
    alter table public.lesson_sessions alter column completed_at drop not null;
    alter table public.lesson_sessions add column if not exists input_text text;
    alter table public.lesson_sessions add column if not exists lesson_snapshot jsonb;
    alter table public.lesson_sessions add column if not exists interaction_snapshot jsonb;
    alter table public.lesson_sessions add column if not exists saved_options jsonb;
  end if;
end $$;
create or replace function public.learning_legacy_save_v1(p_user uuid,p_local text,p_row jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare existing_id uuid; result jsonb; patched jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_local,0));
  if p_row ? '_legacy_id' then
    select id into existing_id from lesson_sessions where user_id=p_user and id=(p_row->>'_legacy_id')::uuid;
    if not found then return '{"error":"course_not_found","status":404}'; end if;
  else
    select id into existing_id from lesson_sessions where user_id=p_user and local_lesson_id=p_local order by completed_at desc nulls last limit 1;
  end if;
  patched:=p_row||jsonb_build_object('user_id',p_user,'local_lesson_id',p_local);
  if existing_id is not null then
    update lesson_sessions set local_lesson_id=p_local,input_text=patched->>'input_text',lesson_snapshot=patched->'lesson_snapshot',
      interaction_snapshot=patched->'interaction_snapshot',saved_options=patched->'saved_options',stats=patched->'stats',
      completed_steps=patched->'completed_steps',
      completed_at=coalesce(completed_at,(patched->>'completed_at')::timestamptz)
      where id=existing_id and user_id=p_user returning to_jsonb(lesson_sessions.*) into result;
  else
    insert into lesson_sessions(user_id,local_lesson_id,lang,level,goal,material_title,material_source,material_hash,material_summary,
      stats,completed_steps,completed_at,input_text,lesson_snapshot,interaction_snapshot,saved_options)
    values(p_user,p_local,patched->>'lang',patched->>'level',patched->>'goal',patched->>'material_title',patched->>'material_source',
      patched->>'material_hash',patched->'material_summary',patched->'stats',patched->'completed_steps',
      (patched->>'completed_at')::timestamptz,patched->>'input_text',patched->'lesson_snapshot',patched->'interaction_snapshot',patched->'saved_options')
      returning to_jsonb(lesson_sessions.*) into result;
  end if;
  return result;
end $$;

-- PostgreSQL grants PUBLIC execute by default; revoke that for every new RPC explicitly.
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in
    ('learning_allowance_v1','learning_reserve_v1','learning_finish_v1','learning_fail_v1','learning_confirm_v1','learning_read_v1','learning_save_v1','learning_claim_v1','learning_legacy_save_v1') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
