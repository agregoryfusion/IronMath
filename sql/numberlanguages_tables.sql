-- Schema for Number Languages game

-- Leaderboard table
create table if not exists numberlanguages_leaderboard (
  leaderboard_id bigint generated always as identity primary key,
  -- Align with existing users.user_id (bigint) to avoid type mismatch
  user_id bigint references users(user_id) on delete set null,
  player_name text not null,
  numbers_correct integer not null default 0,
  total_time_seconds numeric,
  date_added timestamptz default now(),
  is_teacher boolean default false,
  is_student boolean default false,
  version_number text
);

-- Sessions table
create table if not exists numberlanguages_sessions (
  session_id bigint generated always as identity primary key,
  -- Align with existing users.user_id (bigint) to avoid type mismatch
  user_id bigint references users(user_id) on delete set null,
  player_name text not null,
  numbers_correct integer not null default 0,
  total_time_seconds numeric,
  created_at timestamptz default now(),
  is_teacher boolean default false,
  is_student boolean default false,
  version_number text
);

-- Questions table
create table if not exists numberlanguages_questions (
  question_id bigint generated always as identity primary key,
  session_id bigint references numberlanguages_sessions(session_id) on delete cascade,
  question_number integer,
  number_value integer,
  displayed_word text,
  correct_language text,
  guessed_language text,
  is_correct boolean,
  time_taken numeric,
  date_added timestamptz default now(),
  player_name text,
  version_number text
);

create index if not exists numberlanguages_leaderboard_date_idx on numberlanguages_leaderboard(date_added desc);
create index if not exists numberlanguages_sessions_user_idx on numberlanguages_sessions(user_id);
create index if not exists numberlanguages_questions_session_idx on numberlanguages_questions(session_id);
