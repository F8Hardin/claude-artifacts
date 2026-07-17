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
declare
  base_username text;
  final_username text;
begin
  -- Username comes from user-controlled signup metadata. It must be unique so
  -- one account cannot claim another author's handle (impersonation). If the
  -- requested handle is already taken, fall back to an id-derived suffix, which
  -- is effectively collision-free.
  base_username := coalesce(
    nullif(NEW.raw_user_meta_data->>'username', ''),
    nullif(NEW.raw_user_meta_data->>'user_name', ''),
    'user-' || substr(replace(NEW.id::text, '-', ''), 1, 6)
  );
  if exists (
    select 1 from public.profiles where lower(username) = lower(base_username)
  ) then
    final_username := base_username || '-' || substr(replace(NEW.id::text, '-', ''), 1, 6);
  else
    final_username := base_username;
  end if;

  insert into public.profiles (id, username, github_username, avatar_url)
  values (
    NEW.id,
    final_username,
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

-- Trigger functions fire regardless of caller privileges, so they never need
-- to be directly callable as PostgREST RPCs. Revoke the default PUBLIC EXECUTE.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Enforce unique usernames (case-insensitive) so a handle cannot be claimed by
-- more than one account. First rename any pre-existing duplicates by appending
-- an id-derived suffix, then add the constraint. Safe to re-run.
update public.profiles p
  set username = p.username || '-' || substr(replace(p.id::text, '-', ''), 1, 6)
  from (
    select id,
           row_number() over (
             partition by lower(username) order by created_at, id
           ) as rn
    from public.profiles
    where username is not null
  ) d
  where p.id = d.id and d.rn > 1;

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;

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

-- ─── Moderation ──────────────────────────────────────────────────────────────
-- Uploaded artifacts are executable documents from untrusted agents. They stay
-- private until a hosted classifier clears them. Effective visibility is gated
-- by is_public; the trigger below guarantees is_public can only be true once
-- moderation_status = 'approved', regardless of which write path sets it (the
-- upload action, the edit form's public toggle, or the MCP update tool).

alter table public.artifacts
  add column if not exists moderation_status text not null default 'pending';

create or replace function public.enforce_moderation_gate()
returns trigger set search_path = '' language plpgsql as $$
begin
  -- Only trusted server-side code (the service_role, used by the upload action
  -- and the MCP function after running the classifier) may assign a moderation
  -- verdict. Writes from any other caller — a logged-in user's session, or a
  -- raw PostgREST call with the public anon key — cannot self-approve: their
  -- moderation_status is pinned. On INSERT it is forced to 'pending'; on UPDATE
  -- it is held at the stored value. current_user reflects the PostgREST role
  -- (service_role / authenticated / anon) after its per-request SET ROLE, and
  -- 'postgres'/'supabase_admin' cover migrations run as the DB owner.
  if current_user not in ('service_role', 'supabase_admin', 'postgres') then
    if TG_OP = 'INSERT' then
      NEW.moderation_status := 'pending';
    else
      NEW.moderation_status := OLD.moderation_status;
    end if;
  end if;

  -- An artifact may only be public once it has been approved. Any other status
  -- (pending / rejected) is silently forced back to private. Applies to every
  -- caller, service_role included.
  if NEW.is_public and NEW.moderation_status is distinct from 'approved' then
    NEW.is_public := false;
  end if;
  return NEW;
end;
$$;

drop trigger if exists artifacts_moderation_gate on public.artifacts;
create trigger artifacts_moderation_gate
  before insert or update on public.artifacts
  for each row execute procedure public.enforce_moderation_gate();

revoke execute on function public.enforce_moderation_gate() from public, anon, authenticated;

-- Grandfather already-published artifacts so they stay visible. This is safe to
-- re-run: once the trigger is in place no row can be both public and
-- un-approved, so after the first pass this UPDATE matches nothing.
update public.artifacts
  set moderation_status = 'approved'
  where is_public = true and moderation_status <> 'approved';

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
returns trigger set search_path = '' language plpgsql security definer as $$
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

-- Trigger-only function: remove the default PUBLIC EXECUTE so it is not
-- exposed as a callable PostgREST RPC.
revoke execute on function public.update_artifact_like_count() from public, anon, authenticated;

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

-- ─── Rate limiting ────────────────────────────────────────────────────────────
-- Atomic fixed-window counter shared by the web server actions and the MCP edge
-- function (both call it with the service-role key). Keys are built from a
-- trusted identity (authenticated user id, or client IP for anonymous calls),
-- so callers cannot spend each other's budget.

create table if not exists public.rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

-- Only the service role touches this table; enable RLS with no policies so the
-- anon/authenticated PostgREST API can never read or write it.
alter table public.rate_limits enable row level security;

-- Returns true if the request is within the limit. A single upsert keeps the
-- increment atomic under concurrency; the window resets once it has elapsed.
create or replace function public.rate_limit_hit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
  set search_path = ''
  language plpgsql
  security definer
as $$
declare
  v_now   timestamptz := now();
  v_count int;
begin
  insert into public.rate_limits as rl (key, count, window_start)
    values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          when rl.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now
          else rl.window_start
        end
  returning rl.count into v_count;
  return v_count <= p_max;
end;
$$;

-- Callable only with the service-role key (which bypasses RLS). Revoke the
-- default PUBLIC EXECUTE so anon/authenticated users can't spend other users'
-- budgets by passing a forged key.
revoke execute on function public.rate_limit_hit(text, int, int)
  from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

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

-- Registered OAuth clients (server-side only via service key)
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

-- These tables must never be reachable through the public anon/authenticated
-- API. They hold OAuth client secrets and live authorization codes (which can
-- be exchanged for access tokens). Enable RLS with NO policies so PostgREST
-- denies all anon/authenticated access; the server reaches them only through
-- the service-role key, which bypasses RLS.
alter table public.oauth_clients enable row level security;
alter table public.oauth_authorization_codes enable row level security;

-- Register the claude.ai connector client (idempotent)
insert into public.oauth_clients (id, secret_hash, name, redirect_uri_prefix)
values (
  'claude_artifacts_connector',
  '9f75a7bc45cbfb5d3d3639385591cee606094b4380a5b61142b0833cefd83463',
  'claude.ai Connector',
  'https://claude.ai'
)
on conflict (id) do nothing;
