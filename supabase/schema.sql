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
  username        text,
  github_username text,
  avatar_url      text,
  created_at      timestamptz default now() not null
);

alter table public.profiles
  add column if not exists username text;

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
  insert into public.profiles (id, username, github_username, avatar_url)
  values (
    NEW.id,
    coalesce(
      nullif(NEW.raw_user_meta_data->>'username', ''),
      nullif(NEW.raw_user_meta_data->>'user_name', ''),
      'user-' || substr(replace(NEW.id::text, '-', ''), 1, 6)
    ),
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

-- ─── Comments ────────────────────────────────────────────────────────────────

create table if not exists public.comments (
  id          uuid default gen_random_uuid() primary key,
  artifact_id uuid references public.artifacts(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  body        text not null check (char_length(body) <= 1000),
  created_at  timestamptz default now() not null
);

alter table public.comments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'comments' and policyname = 'Comments on public artifacts readable by all'
  ) then
    create policy "Comments on public artifacts readable by all"
      on public.comments for select using (
        exists (
          select 1 from public.artifacts a
          where a.id = artifact_id and a.is_public = true
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'comments' and policyname = 'Comment owners can read own comments'
  ) then
    create policy "Comment owners can read own comments"
      on public.comments for select using ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'comments' and policyname = 'Authenticated users can comment'
  ) then
    create policy "Authenticated users can comment"
      on public.comments for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'comments' and policyname = 'Users can delete own comments'
  ) then
    create policy "Users can delete own comments"
      on public.comments for delete using ((select auth.uid()) = user_id);
  end if;
end $$;

-- ─── Likes ───────────────────────────────────────────────────────────────────

alter table public.artifacts
  add column if not exists like_count int not null default 0;

create table if not exists public.likes (
  id          uuid default gen_random_uuid() primary key,
  artifact_id uuid references public.artifacts(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now() not null,
  unique (artifact_id, user_id)
);

alter table public.likes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'likes' and policyname = 'Likes are publicly readable'
  ) then
    create policy "Likes are publicly readable"
      on public.likes for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'likes' and policyname = 'Authenticated users can like'
  ) then
    create policy "Authenticated users can like"
      on public.likes for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'likes' and policyname = 'Users can unlike'
  ) then
    create policy "Users can unlike"
      on public.likes for delete using ((select auth.uid()) = user_id);
  end if;
end $$;

create or replace function public.update_artifact_like_count()
returns trigger set search_path = '' language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.artifacts set like_count = like_count + 1 where id = NEW.artifact_id;
  elsif TG_OP = 'DELETE' then
    update public.artifacts set like_count = greatest(like_count - 1, 0) where id = OLD.artifact_id;
  end if;
  return null;
end;
$$;

create or replace trigger on_like_change
  after insert or delete on public.likes
  for each row execute procedure public.update_artifact_like_count();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists artifacts_owner_created
  on public.artifacts (owner_id, created_at desc);

create index if not exists artifacts_like_count
  on public.artifacts (like_count desc, created_at desc);

create index if not exists artifacts_public_created
  on public.artifacts (created_at desc)
  where is_public = true;

create index if not exists comments_artifact_id
  on public.comments (artifact_id);

-- ─── Storage ─────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('artifacts', 'artifacts', false)
  on conflict (id) do update set public = false;

-- Public artifact files are readable by anyone (joins to artifacts table)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'Public artifact files are readable'
  ) then
    create policy "Public artifact files are readable"
      on storage.objects for select
      using (
        bucket_id = 'artifacts' and
        exists (
          select 1 from public.artifacts a
          where a.storage_path = name and a.is_public = true
        )
      );
  end if;
end $$;

-- Private artifact files are readable only by their owner
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'Owners can read their artifact files'
  ) then
    create policy "Owners can read their artifact files"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'artifacts' and
        exists (
          select 1 from public.artifacts a
          where a.storage_path = name and a.owner_id = (select auth.uid())
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'Authenticated users can upload'
  ) then
    create policy "Authenticated users can upload"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'artifacts' and
        name like ((select auth.uid())::text || '/%')
      );
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

-- ─── Personal Access Tokens ───────────────────────────────────────────────────

create table if not exists public.personal_access_tokens (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  token_hash   text unique not null,
  token_prefix text not null,
  created_at   timestamptz default now() not null,
  last_used_at timestamptz,
  expires_at   timestamptz
);

alter table public.personal_access_tokens enable row level security;

create index if not exists pat_user_created
  on public.personal_access_tokens (user_id, created_at desc);

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'personal_access_tokens' and policyname = 'Users can view own tokens'
  ) then
    create policy "Users can view own tokens"
      on public.personal_access_tokens for select
      using ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'personal_access_tokens' and policyname = 'Users can insert own tokens'
  ) then
    create policy "Users can insert own tokens"
      on public.personal_access_tokens for insert
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'personal_access_tokens' and policyname = 'Users can delete own tokens'
  ) then
    create policy "Users can delete own tokens"
      on public.personal_access_tokens for delete
      using ((select auth.uid()) = user_id);
  end if;
end $$;

-- ─── OAuth (Authorization Code flow for claude.ai connector) ─────────────────

-- Registered OAuth clients (no RLS — server-side only via service key)
create table if not exists public.oauth_clients (
  id                  text primary key,
  secret_hash         text not null,
  name                text not null,
  redirect_uri_prefix text not null
);

-- Short-lived single-use authorization codes
create table if not exists public.oauth_authorization_codes (
  code            text primary key,
  client_id       text not null references public.oauth_clients(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  redirect_uri    text not null,
  expires_at      timestamptz not null,
  used            boolean not null default false,
  code_challenge  text
);

create index if not exists oauth_codes_expires
  on public.oauth_authorization_codes (expires_at);

-- Register the claude.ai connector client (idempotent)
insert into public.oauth_clients (id, secret_hash, name, redirect_uri_prefix)
values (
  'claude_artifacts_connector',
  '9f75a7bc45cbfb5d3d3639385591cee606094b4380a5b61142b0833cefd83463',
  'claude.ai Connector',
  'https://claude.ai'
)
on conflict (id) do nothing;
