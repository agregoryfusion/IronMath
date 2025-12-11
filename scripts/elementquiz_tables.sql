-- Periodic Sprint game tables

create table if not exists elementquiz_sessions (
  session_id            bigint generated always as identity primary key,
  user_id               bigint references users(user_id) on delete set null,
  player_name           text not null,
  symbols_correct       int default 0,
  atomic_numbers_correct int default 0,
  total_points          int default 0,
  total_time_seconds    numeric,
  created_at            timestamptz default now(),
  version_number        text,
  is_teacher            boolean default false,
  is_student            boolean default false
);

create table if not exists elementquiz_questions (
  id                    bigint generated always as identity primary key,
  session_id            bigint references elementquiz_sessions(session_id) on delete cascade,
  question_number       int,
  element_name          text,
  correct_symbol        text,
  correct_atomic_number int,
  user_symbol           text,
  user_atomic_number    int,
  correct_symbol_flag   boolean,
  correct_number_flag   boolean,
  time_taken            numeric,
  skipped               boolean default false,
  date_added            timestamptz default now(),
  player_name           text,
  version_number        text
);

create table if not exists elementquiz_leaderboard (
  id                    bigint generated always as identity primary key,
  user_id               bigint references users(user_id) on delete set null,
  player_name           text not null,
  symbols_correct       int default 0,
  atomic_numbers_correct int default 0,
  total_points          int default 0,
  total_time_seconds    numeric,
  version_number        text,
  is_teacher            boolean default false,
  is_student            boolean default false,
  date_added            timestamptz default now()
);

create index if not exists idx_eq_sessions_player on elementquiz_sessions(player_name);
create index if not exists idx_eq_leaderboard_player on elementquiz_leaderboard(player_name);
create index if not exists idx_eq_leaderboard_date on elementquiz_leaderboard(date_added);
create index if not exists idx_eq_questions_session on elementquiz_questions(session_id);
