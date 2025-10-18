-- Questify Collab - Community quality and personalization schema
-- Migration 002: votes, flags, community notes, lesson completions, dispute marker
-- Run this in your Supabase SQL editor (connected to the target project)

-- =========================
-- Votes (posts and answers)
-- =========================
create table if not exists public.post_votes (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists idx_post_votes_post on public.post_votes(post_id);
create index if not exists idx_post_votes_user on public.post_votes(user_id);

create table if not exists public.answer_votes (
  id bigserial primary key,
  answer_id bigint not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (answer_id, user_id)
);

create index if not exists idx_answer_votes_answer on public.answer_votes(answer_id);
create index if not exists idx_answer_votes_user on public.answer_votes(user_id);

-- Optional helper to maintain updated_at
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_post_votes_updated on public.post_votes;
create trigger trg_post_votes_updated
before update on public.post_votes
for each row
execute procedure public.touch_updated_at();

drop trigger if exists trg_answer_votes_updated on public.answer_votes;
create trigger trg_answer_votes_updated
before update on public.answer_votes
for each row
execute procedure public.touch_updated_at();

-- =========================
-- Flags (accuracy concerns)
-- =========================
create table if not exists public.post_flags (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists idx_post_flags_post on public.post_flags(post_id);
create index if not exists idx_post_flags_user on public.post_flags(user_id);

create table if not exists public.answer_flags (
  id bigserial primary key,
  answer_id bigint not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (answer_id, user_id)
);

create index if not exists idx_answer_flags_answer on public.answer_flags(answer_id);
create index if not exists idx_answer_flags_user on public.answer_flags(user_id);

-- =========================
-- Community notes
-- =========================
create table if not exists public.community_notes (
  id bigserial primary key,
  entity_type text not null check (entity_type in ('post','answer')),
  entity_id bigint not null,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_notes_entity on public.community_notes(entity_type, entity_id);
create index if not exists idx_community_notes_user on public.community_notes(user_id);

-- =========================
-- Lesson completions (for personalization)
-- =========================
create table if not exists public.user_lesson_completions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  course_title text,
  module_title text,
  keywords text[] not null default '{}'::text[],
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_completions_user_time
  on public.user_lesson_completions(user_id, completed_at desc);

-- =========================
-- Dispute penalty marker
-- =========================
alter table if exists public.posts
  add column if not exists disputed_penalized boolean not null default false;

-- Helpful derived indexes for feed filters
create index if not exists idx_posts_created_at on public.posts(created_at);
create index if not exists idx_answers_post_id_is_solution on public.answers(post_id, is_helpful_solution);