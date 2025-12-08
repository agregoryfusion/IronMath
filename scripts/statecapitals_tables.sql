-- Supabase DDL for State Capitals game

create table if not exists public.statecapitals_leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  states_correct integer not null default 0,
  total_time_seconds numeric not null default 0,
  date_added timestamptz not null default now(),
  is_teacher boolean default false,
  is_student boolean default false,
  version_number text,
  user_id uuid
);

create table if not exists public.statecapitals_sessions (
  session_id bigint generated always as identity primary key,
  user_id uuid,
  player_name text not null,
  states_correct integer not null default 0,
  total_time_seconds numeric not null default 0,
  created_at timestamptz not null default now(),
  version_number text,
  is_teacher boolean default false,
  is_student boolean default false
);

create table if not exists public.statecapitals_questions (
  question_id bigint generated always as identity primary key,
  session_id bigint references public.statecapitals_sessions(session_id) on delete cascade,
  question_number integer not null,
  state_name text not null,
  expected_capital text not null,
  player_answer text,
  is_correct boolean default false,
  time_taken numeric,
  skipped boolean default false,
  date_added timestamptz not null default now(),
  player_name text,
  version_number text
);

create index if not exists statecapitals_leaderboard_date_idx on public.statecapitals_leaderboard(date_added);
create index if not exists statecapitals_leaderboard_player_idx on public.statecapitals_leaderboard(player_name);
create index if not exists statecapitals_sessions_player_idx on public.statecapitals_sessions(player_name);
create index if not exists statecapitals_questions_session_idx on public.statecapitals_questions(session_id);
