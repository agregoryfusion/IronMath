-- World Capitals game tables

create table if not exists worldcapitals_sessions (
  session_id            bigint generated always as identity primary key,
  user_id               bigint references users(user_id) on delete set null,
  player_name           text not null,
  countries_correct     int default 0,
  total_time_seconds    numeric,
  created_at            timestamptz default now(),
  version_number        text,
  is_teacher            boolean default false,
  is_student            boolean default false
);

create table if not exists worldcapitals_questions (
  id               bigint generated always as identity primary key,
  session_id       bigint references worldcapitals_sessions(session_id) on delete cascade,
  question_number  int,
  country_name     text,
  continent        text,
  expected_capital text,
  player_answer    text,
  is_correct       boolean,
  time_taken       numeric,
  skipped          boolean default false,
  date_added       timestamptz default now(),
  player_name      text,
  version_number   text
);

create table if not exists worldcapitals_leaderboard (
  id                   bigint generated always as identity primary key,
  user_id              bigint references users(user_id) on delete set null,
  player_name          text not null,
  countries_correct    int default 0,
  total_time_seconds   numeric,
  version_number       text,
  is_teacher           boolean default false,
  is_student           boolean default false,
  date_added           timestamptz default now()
);

create index if not exists idx_wc_sessions_player on worldcapitals_sessions(player_name);
create index if not exists idx_wc_leaderboard_player on worldcapitals_leaderboard(player_name);
create index if not exists idx_wc_leaderboard_date on worldcapitals_leaderboard(date_added);
create index if not exists idx_wc_questions_session on worldcapitals_questions(session_id);
