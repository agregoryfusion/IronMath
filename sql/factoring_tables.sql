-- Schema for Factor Sprint game

-- Leaderboard table
create table if not exists factoring_leaderboard (
  leaderboard_id bigint generated always as identity primary key,
  user_id uuid references users(user_id),
  player_name text not null,
  stage_reached integer not null,
  questions_answered integer not null default 0,
  total_time_seconds numeric,
  penalty_time_seconds numeric,
  date_added timestamptz default now(),
  is_teacher boolean default false,
  is_student boolean default false,
  version_number text
);

-- Sessions table
create table if not exists factoring_sessions (
  session_id bigint generated always as identity primary key,
  user_id uuid references users(user_id),
  player_name text not null,
  questions_answered integer not null default 0,
  stage_reached integer not null,
  total_time_seconds numeric,
  penalty_time_seconds numeric,
  created_at timestamptz default now(),
  version_number text
);

-- Questions table
create table if not exists factoring_questions (
  question_id bigint generated always as identity primary key,
  session_id bigint references factoring_sessions(session_id) on delete cascade,
  question_number integer,
  prompt_number integer,
  available_factors text,
  correct_factors text,
  selected_factors text,
  time_taken numeric,
  mistakes integer,
  success boolean,
  stage integer,
  date_added timestamptz default now(),
  player_name text,
  version_number text
);

create index if not exists factoring_leaderboard_date_idx on factoring_leaderboard(date_added desc);
create index if not exists factoring_sessions_user_idx on factoring_sessions(user_id);
create index if not exists factoring_questions_session_idx on factoring_questions(session_id);
