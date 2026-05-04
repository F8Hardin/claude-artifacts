-- ============================================================
-- Claude Artifacts — Initial Schema
-- Run this once in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Profiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  github_username text,
  avatar_url      text,
  created_at      timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update using ((select auth.uid()) = id);

-- Auto-create profile row when a new user signs up
create function public.handle_new_user()
returns trigger set search_path = '' language plpgsql security definer as $$
begin
  insert into public.profiles (id, github_username, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'user_name',  -- populated by GitHub OAuth
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Artifacts ───────────────────────────────────────────────────────────────

create table public.artifacts (
  id           uuid default gen_random_uuid() primary key,
  slug         text unique not null,
  title        text not null,
  description  text not null default '',
  owner_id     uuid references auth.users(id) on delete cascade not null,
  storage_path text not null,
  tags         text[] not null default '{}',
  is_public    boolean not null default true,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

alter table public.artifacts enable row level security;

create policy "Public artifacts readable by all"
  on public.artifacts for select using (is_public = true);

create policy "Private artifacts readable by owner"
  on public.artifacts for select
  using (is_public = false and (select auth.uid()) = owner_id);

create policy "Owners can insert artifacts"
  on public.artifacts for insert with check ((select auth.uid()) = owner_id);

create policy "Owners can update artifacts"
  on public.artifacts for update using ((select auth.uid()) = owner_id);

create policy "Owners can delete artifacts"
  on public.artifacts for delete using ((select auth.uid()) = owner_id);

-- ─── Storage ─────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public) values ('artifacts', 'artifacts', true);

create policy "Artifacts publicly readable"
  on storage.objects for select using (bucket_id = 'artifacts');

create policy "Authenticated users can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'artifacts');

create policy "Owners can delete artifact files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'artifacts' and owner_id = (select auth.uid())::text);
