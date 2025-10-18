-- Questify Collab - Initial schema migration
-- Run this in your Supabase SQL editor (or any PostgreSQL client connected to your project)

-- USERS TABLE
-- Mirrors the auth.users table (by PK), stores profile + reputation
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text,
  reputation_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- POSTS TABLE
-- Community posts (Reddit-style threads) by topic
create table if not exists public.posts (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ANSWERS TABLE
-- Answers to posts; can be marked as a helpful solution
create table if not exists public.answers (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  is_helpful_solution boolean not null default false,
  created_at timestamptz not null default now()
);

-- INDEXES
create index if not exists idx_posts_topic on public.posts(topic);
create index if not exists idx_posts_user_id on public.posts(user_id);
create index if not exists idx_answers_post_id on public.answers(post_id);
create index if not exists idx_answers_user_id on public.answers(user_id);

-- OPTIONAL: simple updated_at maintenance trigger for public.users
-- (You can uncomment if you want automatic updated_at maintenance)
-- create or replace function public.set_updated_at()
-- returns trigger as $$
-- begin
--   new.updated_at = now();
--   return new;
-- end;
-- $$ language plpgsql;

-- drop trigger if exists trg_users_updated_at on public.users;
-- create trigger trg_users_updated_at
-- before update on public.users
-- for each row
-- execute procedure public.set_updated_at();

-- NOTES:
-- - This migration assumes Supabase auth is enabled (auth.users exists).
-- - Service role key is required for server-side inserts/updates bypassing RLS.
-- - RLS policies are not added here; you may add them later if client-side access is needed.

------------------------------------------------------------------------
-- ADDITIONS FOR PERSONALIZED FEED, FRIENDSHIPS, AND MESSAGING
------------------------------------------------------------------------

-- Tracks user's interest score per topic (used for feed personalization)
create table if not exists public.user_topic_interests (
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  score integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);
create index if not exists idx_user_topic_interests_user on public.user_topic_interests(user_id);
create index if not exists idx_user_topic_interests_topic on public.user_topic_interests(topic);

-- Friendships (requester/addressee, with status)
create table if not exists public.friendships (
  id bigserial primary key,
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('pending','accepted','rejected')) default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);
create index if not exists idx_friendships_requester on public.friendships(requester_id);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id);
create index if not exists idx_friendships_status on public.friendships(status);

-- Direct messages between users (allowed only if friendship is accepted)
create table if not exists public.messages (
  id bigserial primary key,
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_recipient on public.messages(recipient_id);
create index if not exists idx_messages_pair_time on public.messages(sender_id, recipient_id, created_at);

-- Optional helper view for faster "thread" queries (not required)
-- create or replace view public.message_pairs as
-- select
--   least(sender_id, recipient_id) as u1,
--   greatest(sender_id, recipient_id) as u2,
--   max(created_at) as last_message_at,
--   count(*) as message_count
-- from public.messages
-- group by 1,2;
 
-- NOTE: Add RLS as needed for client-side access. Server uses service role.

--------------------------------------------------------------------------
-- TAGS SUPPORT FOR POSTS
-- Adds an array of text tags with a GIN index for fast filtering
--------------------------------------------------------------------------
alter table if exists public.posts
  add column if not exists tags text[] default '{}'::text[];

create index if not exists idx_posts_tags_gin
  on public.posts using gin (tags);

-- normalize any NULLs left from older rows
update public.posts set tags = '{}'::text[] where tags is null;