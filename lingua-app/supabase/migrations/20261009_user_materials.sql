create table if not exists public.user_materials (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null, source_type text not null check (source_type in ('pdf','txt','markdown','pasted')),
  source_hash text, language text not null default 'Dutch', learner_level text not null, learning_goal text, target_minutes integer,
  cleaned_text text not null check (char_length(cleaned_text) between 1 and 200000),
  original_char_count integer, cleaned_char_count integer not null check (cleaned_char_count between 1 and 200000),
  source_file_size integer check (source_file_size is null or source_file_size <= 10485760),
  source_page_count integer check (source_page_count is null or source_page_count <= 100),
  planning_version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.material_segments (
  id uuid primary key default gen_random_uuid(), material_id uuid not null references public.user_materials(id) on delete cascade,
  segment_index integer not null, title text, text text not null, start_offset integer not null,
  end_offset integer not null check (end_offset > start_offset), source_page_start integer, source_page_end integer,
  word_count integer not null default 0, estimated_minutes_min integer, estimated_minutes_max integer,
  material_level text, difficulty_label text, learning_objectives jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(material_id,segment_index)
);

alter table public.lesson_sessions
  add column if not exists material_id uuid references public.user_materials(id) on delete set null,
  add column if not exists material_segment_id uuid references public.material_segments(id) on delete set null,
  add column if not exists segment_index integer,
  add column if not exists segment_count integer;

create index if not exists user_materials_user_updated_idx on public.user_materials(user_id,updated_at desc);
create index if not exists material_segments_material_index_idx on public.material_segments(material_id,segment_index);
create index if not exists material_segments_material_status_idx on public.material_segments(material_id,status);
create index if not exists lesson_sessions_material_idx on public.lesson_sessions(material_id,material_segment_id);

alter table public.user_materials enable row level security;
alter table public.material_segments enable row level security;
drop policy if exists "Users manage their own materials" on public.user_materials;
create policy "Users manage their own materials" on public.user_materials for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users read their own material segments" on public.material_segments;
create policy "Users read their own material segments" on public.material_segments for select to authenticated
  using (exists(select 1 from public.user_materials m where m.id=public.material_segments.material_id and m.user_id=(select auth.uid())));
drop policy if exists "Users insert their own material segments" on public.material_segments;
create policy "Users insert their own material segments" on public.material_segments for insert to authenticated
  with check (exists(select 1 from public.user_materials m where m.id=public.material_segments.material_id and m.user_id=(select auth.uid())));
drop policy if exists "Users update their own material segments" on public.material_segments;
create policy "Users update their own material segments" on public.material_segments for update to authenticated
  using (exists(select 1 from public.user_materials m where m.id=public.material_segments.material_id and m.user_id=(select auth.uid())))
  with check (exists(select 1 from public.user_materials m where m.id=public.material_segments.material_id and m.user_id=(select auth.uid())));
drop policy if exists "Users delete their own material segments" on public.material_segments;
create policy "Users delete their own material segments" on public.material_segments for delete to authenticated
  using (exists(select 1 from public.user_materials m where m.id=public.material_segments.material_id and m.user_id=(select auth.uid())));
