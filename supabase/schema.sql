-- ============================================================
-- Claude Artifacts — Initial Schema
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to re-run: uses IF NOT EXISTS guards throughout
-- ============================================================
--
-- What this creates:
--
-- TABLES
--   public.profiles     — One row per user. Stores their GitHub username and
--                         avatar URL. Auto-populated on signup via trigger.
--
--   public.artifacts    — One row per artifact. Stores title, description,
--                         tags, visibility (is_public), and a storage_path
--                         pointing to the HTML file in the storage bucket.
--                         Linked to the owner via owner_id → auth.users.
--
-- FUNCTION + TRIGGER
--   handle_new_user()   — Runs automatically after every new signup and
--                         inserts a matching row into public.profiles.
--
-- ROW LEVEL SECURITY (RLS)
--   profiles            — Anyone can read. Only the owner can insert/update.
--   artifacts           — Public artifacts readable by everyone (including
--                         unauthenticated users). Private artifacts readable
--                         only by their owner. Only the owner can insert,
--                         update, or delete their own artifacts.
--
-- STORAGE
--   artifacts bucket    — Public bucket for storing artifact HTML files.
--                         Anyone can read. Only authenticated users can
--                         upload. Only the uploader can delete their files.
--
-- ============================================================

-- ─── Profiles ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  github_username text,
  avatar_url      text,
  created_at      timestamptz default now() not null
);

alter table public.profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'Profiles are publicly readable'
  ) then
    create policy "Profiles are publicly readable"
      on public.profiles for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can insert own profile'
  ) then
    create policy "Users can insert own profile"
      on public.profiles for insert with check ((select auth.uid()) = id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles for update using ((select auth.uid()) = id);
  end if;
end $$;

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger set search_path = '' language plpgsql security definer as $$
begin
  insert into public.profiles (id, github_username, avatar_url)
  values (
    NEW.id,
    NEW.raw_user_meta_data->>'user_name',  -- populated by GitHub OAuth
    NEW.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Artifacts ───────────────────────────────────────────────────────────────

create table if not exists public.artifacts (
  id           uuid default gen_random_uuid() primary key,
  slug         text unique not null,
  title        text not null,
  description  text not null default '',
  owner_id     uuid references auth.users(id) on delete cascade not null,
  storage_path text not null,
  tags         text[] not null default '{}',
  is_public    boolean not null default true,
  author_name_visible boolean not null default true,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

alter table public.artifacts
  add column if not exists author_name_visible boolean not null default true;

alter table public.artifacts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'artifacts' and policyname = 'Public artifacts readable by all'
  ) then
    create policy "Public artifacts readable by all"
      on public.artifacts for select using (is_public = true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'artifacts' and policyname = 'Private artifacts readable by owner'
  ) then
    create policy "Private artifacts readable by owner"
      on public.artifacts for select
      using (is_public = false and (select auth.uid()) = owner_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'artifacts' and policyname = 'Owners can insert artifacts'
  ) then
    create policy "Owners can insert artifacts"
      on public.artifacts for insert with check ((select auth.uid()) = owner_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'artifacts' and policyname = 'Owners can update artifacts'
  ) then
    create policy "Owners can update artifacts"
      on public.artifacts for update using ((select auth.uid()) = owner_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'artifacts' and policyname = 'Owners can delete artifacts'
  ) then
    create policy "Owners can delete artifacts"
      on public.artifacts for delete using ((select auth.uid()) = owner_id);
  end if;
end $$;

-- ─── Storage ─────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('artifacts', 'artifacts', true)
  on conflict (id) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'Artifacts publicly readable'
  ) then
    create policy "Artifacts publicly readable"
      on storage.objects for select using (bucket_id = 'artifacts');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'Authenticated users can upload'
  ) then
    create policy "Authenticated users can upload"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'artifacts');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'Owners can delete artifact files'
  ) then
    create policy "Owners can delete artifact files"
      on storage.objects for delete to authenticated
      using (bucket_id = 'artifacts' and owner_id = (select auth.uid())::text);
  end if;
end $$;
