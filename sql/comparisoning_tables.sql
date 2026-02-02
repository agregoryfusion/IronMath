-- Schema for Comparison-ing (pairwise Elo ranking game)

-- Items that can be compared (multiple games share the same tables)
create table if not exists comparison_items (
  game_id integer not null default 1,
  item_id bigint generated always as identity primary key,
  name text not null unique,
  category text default 'General',
  event_year integer, -- optional: for timeline weighting
  rating numeric not null default 1000,          -- Elo-style rating
  rating_deviation numeric not null default 350, -- reserved for possible TrueSkill-style math
  wins integer not null default 0,
  losses integer not null default 0,
  matches integer not null default 0,
  last_played timestamptz,
  last_decay_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Each recorded vote (winner vs loser)
create table if not exists comparison_votes (
  game_id integer not null default 1,
  vote_id bigint generated always as identity primary key,
  user_id bigint references users(user_id) on delete set null,
  voter_name text,
  winner_item_id bigint references comparison_items(item_id) on delete cascade,
  loser_item_id bigint references comparison_items(item_id) on delete cascade,
  winner_rating_before numeric,
  loser_rating_before numeric,
  winner_rating_after numeric,
  loser_rating_after numeric,
  rating_delta numeric,
  created_at timestamptz default now()
);

create index if not exists comparison_votes_created_idx on comparison_votes(created_at desc);
create index if not exists comparison_items_rating_idx on comparison_items(rating desc);
create index if not exists comparison_items_game_idx on comparison_items(game_id, rating desc);
create index if not exists comparison_votes_game_idx on comparison_votes(game_id, created_at desc);

-- Atomic rating update for a single vote. Returns the new ratings for both items.
create or replace function comparison_submit_vote(
  p_winner_id bigint,
  p_loser_id bigint,
  p_user_id bigint default null,
  p_voter_name text default null,
  p_game_id integer default 1
) returns table (winner_rating numeric, loser_rating numeric) language plpgsql as $$
declare
  v_now timestamptz := now();
  v_k_base numeric := 24;         -- base K factor
  v_max_gap numeric := 400;       -- if ratings far apart, dampen K
  v_decay_per_day numeric := 2;   -- gentle decay after 14 idle days
  v_max_delta numeric := 25;      -- cap any single-rating move
  w record;
  l record;
  w_expected numeric;
  l_expected numeric;
  rating_gap numeric;
  w_new numeric;
  l_new numeric;
  w_delta numeric;
  l_delta numeric;
  w_before numeric;
  l_before numeric;
  idle_days_w numeric;
  idle_days_l numeric;
  k_match_factor numeric := 1;    -- shrink K as items accumulate votes
  k_year_factor numeric := 1;     -- shrink K when events far apart in time
begin
  if p_winner_id is null or p_loser_id is null or p_winner_id = p_loser_id then
    raise exception 'Winner and loser must be different item ids';
  end if;

  select * into w from comparison_items where item_id = p_winner_id and game_id = p_game_id for update;
  select * into l from comparison_items where item_id = p_loser_id and game_id = p_game_id for update;

  if w is null or l is null then
    raise exception 'One or both items do not exist in this game';
  end if;

  w_before := w.rating;
  l_before := l.rating;

  -- Apply light decay after 14 days of inactivity
  idle_days_w := greatest(0, extract(epoch from (v_now - coalesce(w.last_played, w.created_at))) / 86400 - 14);
  idle_days_l := greatest(0, extract(epoch from (v_now - coalesce(l.last_played, l.created_at))) / 86400 - 14);
  if idle_days_w > 0 then
    w.rating := greatest(700, w.rating - idle_days_w * v_decay_per_day);
  end if;
  if idle_days_l > 0 then
    l.rating := greatest(700, l.rating - idle_days_l * v_decay_per_day);
  end if;

  w_expected := 1.0 / (1 + power(10, (l.rating - w.rating) / 400));
  l_expected := 1 - w_expected;

  rating_gap := abs(w.rating - l.rating);
  if rating_gap > v_max_gap then
    v_k_base := v_k_base * (v_max_gap / rating_gap);
  end if;

  -- More matches -> smaller moves (anchor ~20 votes)
  k_match_factor := 1 / (1 + ((coalesce(w.matches,0) + coalesce(l.matches,0))::numeric / 2) / 20);

  -- If we know event years, big temporal gaps should move ratings less
  if w.event_year is not null and l.event_year is not null then
    k_year_factor := 1 / (1 + (abs(w.event_year - l.event_year)::numeric / 50));
  end if;

  w_delta := v_k_base * k_match_factor * k_year_factor * (1 - w_expected);
  l_delta := v_k_base * k_match_factor * k_year_factor * (0 - l_expected);

  -- Cap per-vote movement
  w_delta := greatest(-v_max_delta, least(v_max_delta, w_delta));
  l_delta := greatest(-v_max_delta, least(v_max_delta, l_delta));

  w_new := w.rating + w_delta;
  l_new := l.rating + l_delta;

  update comparison_items
    set rating = w_new,
        wins = wins + 1,
        matches = matches + 1,
        last_played = v_now,
        last_decay_at = v_now,
        updated_at = v_now
    where item_id = p_winner_id and game_id = p_game_id
    returning rating into w_new;

  update comparison_items
    set rating = l_new,
        losses = losses + 1,
        matches = matches + 1,
        last_played = v_now,
        last_decay_at = v_now,
        updated_at = v_now
    where item_id = p_loser_id and game_id = p_game_id
    returning rating into l_new;

  insert into comparison_votes (
    game_id,
    user_id, voter_name,
    winner_item_id, loser_item_id,
    winner_rating_before, loser_rating_before,
    winner_rating_after, loser_rating_after,
    rating_delta
  ) values (
    p_game_id,
    p_user_id, p_voter_name,
    p_winner_id, p_loser_id,
    w_before, l_before,
    w_new, l_new,
    w_new - w_before
  );

  return query select w_new, l_new;
end;
$$;

-- Seed data: 16 desserts (Game 1). Safe to re-run.
insert into comparison_items (game_id, name, category, event_year)
values
(1, 'Chocolate Cake', 'Dessert', null),
(1, 'Cheesecake', 'Dessert', null),
(1, 'Apple Pie', 'Dessert', null),
(1, 'Brownies', 'Dessert', null),
(1, 'Ice Cream', 'Dessert', null),
(1, 'Tiramisu', 'Dessert', null),
(1, 'Creme Brulee', 'Dessert', null),
(1, 'Donuts', 'Dessert', null),
(1, 'Cupcakes', 'Dessert', null),
(1, 'Gelato', 'Dessert', null),
(1, 'Macarons', 'Dessert', null),
(1, 'Pecan Pie', 'Dessert', null),
(1, 'Key Lime Pie', 'Dessert', null),
(1, 'Banana Split', 'Dessert', null),
(1, 'Cinnamon Roll', 'Dessert', null),
(1, 'Bread Pudding', 'Dessert', null)
on conflict (name) do nothing;

-- Additional desserts for Game 1
insert into comparison_items (game_id, name, category, event_year)
values
(1, 'Ice Cream', 'Dessert', null),
(1, 'Milkshake', 'Dessert', null),
(1, 'Chocolate Chip Cookie', 'Dessert', null),
(1, 'Sugar Cookie', 'Dessert', null),
(1, 'Oatmeal-Rasin Cookie', 'Dessert', null),
(1, 'Brownies', 'Dessert', null),
(1, 'Blondies', 'Dessert', null),
(1, 'Birthday Cake', 'Dessert', null),
(1, 'Cupcakes', 'Dessert', null),
(1, 'Cheesecake', 'Dessert', null),
(1, 'Apple Pie', 'Dessert', null),
(1, 'Pumpkin Pie', 'Dessert', null),
(1, 'Pecan Pie', 'Dessert', null),
(1, 'Molten Chocolate Lava Cake', 'Dessert', null),
(1, 'Chocolate Cake', 'Dessert', null),
(1, 'Fudge', 'Dessert', null),
(1, 'Yellow Cake', 'Dessert', null),
(1, 'Donuts', 'Dessert', null),
(1, 'Cinnamon Rolls', 'Dessert', null),
(1, 'Fruit Cobbler', 'Dessert', null),
(1, 'Pudding', 'Dessert', null),
(1, 'Popsicles', 'Dessert', null),
(1, 'Ice Cream Sandwiches', 'Dessert', null),
(1, 'S''mores', 'Dessert', null),
(1, 'Funnel Cake', 'Dessert', null)
on conflict (name) do nothing;

-- Seed data: 16 historical events (Game 2)
insert into comparison_items (game_id, name, category, event_year)
values
(2, 'Fall of Rome (476 CE)', 'History', 476),
(2, 'Magna Carta Signed (1215)', 'History', 1215),
(2, 'Columbus Reaches Americas (1492)', 'History', 1492),
(2, 'Protestant Reformation Begins (1517)', 'History', 1517),
(2, 'American Declaration of Independence (1776)', 'History', 1776),
(2, 'French Revolution Begins (1789)', 'History', 1789),
(2, 'US Civil War Ends (1865)', 'History', 1865),
(2, 'Wright Brothers First Flight (1903)', 'History', 1903),
(2, 'Start of World War I (1914)', 'History', 1914),
(2, 'Start of World War II (1939)', 'History', 1939),
(2, 'Moon Landing (1969)', 'History', 1969),
(2, 'Fall of Berlin Wall (1989)', 'History', 1989),
(2, 'Internet Becomes Public (1991)', 'History', 1991),
(2, '9/11 Attacks (2001)', 'History', 2001),
(2, 'Global Financial Crisis (2008)', 'History', 2008),
(2, 'James Webb Telescope Launch (2021)', 'History', 2021)
on conflict (name) do nothing;
