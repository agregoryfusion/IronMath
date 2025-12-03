-- Supabase DDL for Adding Up game

create table if not exists public.addingup_leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  questions_answered integer not null default 0,
  total_time_seconds numeric not null default 0,
  penalty_time_seconds numeric not null default 0,
  final_total integer,
  date_added timestamptz not null default now(),
  is_teacher boolean default false,
  is_student boolean default false,
  version_number text,
  user_id uuid
);

create table if not exists public.addingup_sessions (
  session_id bigint generated always as identity primary key,
  user_id uuid,
  player_name text not null,
  questions_answered integer not null default 0,
  true_time_seconds numeric not null default 0,
  penalty_time_seconds numeric not null default 0,
  total_time_seconds numeric not null default 0,
  final_total integer,
  created_at timestamptz not null default now(),
  version_number text,
  is_teacher boolean default false,
  is_student boolean default false
);

create table if not exists public.addingup_questions (
  question_id bigint generated always as identity primary key,
  session_id bigint references public.addingup_sessions(session_id) on delete cascade,
  question_number integer not null,
  starting_total integer not null,
  addend integer not null,
  expected_total integer not null,
  time_taken numeric,
  mistakes integer default 0,
  success boolean default false,
  date_added timestamptz not null default now(),
  player_name text,
  version_number text
);

create index if not exists addingup_leaderboard_date_idx on public.addingup_leaderboard(date_added);
create index if not exists addingup_leaderboard_player_idx on public.addingup_leaderboard(player_name);
create index if not exists addingup_sessions_player_idx on public.addingup_sessions(player_name);
create index if not exists addingup_questions_session_idx on public.addingup_questions(session_id);
