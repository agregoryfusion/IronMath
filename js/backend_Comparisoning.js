// backend_Comparisoning.js - Supabase helpers for Comparison-ing
import "./utils.js";
import "./backend_main.js";

const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};

const SUPABASE_URL = "https://jfjlznxvofhjjlommdrd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bSFpnR01TewY44SI8mLuLA_aX3bF3Lk";
const supabase = FM.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
FM.supabaseClient = supabase;

const TABLES = {
  items: "comparison_items",
  votes: "comparison_votes"
};

const MATCH_GAP_CAP = 250;   // avoid matching items too far apart
const RECENT_BLOCK = 1;      // avoid immediate rematch of the same two items

function normalizeItem(r) {
  if (!r) return null;
  return {
    id: r.item_id,
    name: r.name,
    category: r.category || "General",
    rating: Number(r.rating ?? 1000),
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
    matches: Number(r.matches ?? 0),
    lastPlayed: r.last_played ? new Date(r.last_played) : null,
    updatedAt: r.updated_at ? new Date(r.updated_at) : null
  };
}

async function loadItems(gameId = 1, limit = 200) {
  const { data, error } = await supabase
    .from(TABLES.items)
    .select("item_id,name,category,rating,wins,losses,matches,last_played,updated_at,game_id")
    .eq("game_id", gameId)
    .order("rating", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("loadItems error", error);
    throw error;
  }
  return (data || []).map(normalizeItem);
}

async function fetchLeaderboard(gameId = 1, limit = 25) {
  const { data, error } = await supabase
    .from(TABLES.items)
    .select("item_id,name,category,rating,wins,losses,matches,last_played")
    .eq("game_id", gameId)
    .order("rating", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchLeaderboard error", error);
    throw error;
  }
  return (data || []).map(normalizeItem);
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Choose two items that are close in rating and not the exact last pair.
function pickPair(items, lastPair = []) {
  if (!Array.isArray(items) || items.length < 2) return null;
  const lastSet = new Set(lastPair);

  // prefer mid-ranked items to keep things moving; bias slightly toward underplayed items
  const sorted = [...items].sort((a, b) => (b.matches - a.matches));
  const anchor = randomPick(sorted.slice(0, Math.max(6, Math.min(20, sorted.length))));

  const close = items.filter((it) => {
    if (it.id === anchor.id) return false;
    if (lastSet.has(it.id) && lastSet.has(anchor.id)) return false;
    return Math.abs(it.rating - anchor.rating) <= MATCH_GAP_CAP;
  });

  const second = close.length > 0 ? randomPick(close) : randomPick(items.filter((i) => i.id !== anchor.id));
  return [anchor, second];
}

async function submitVote({ winnerId, loserId, userId = null, playerName = null, gameId = 1 }) {
  const { data, error } = await supabase.rpc("comparison_submit_vote", {
    p_winner_id: winnerId,
    p_loser_id: loserId,
    p_user_id: userId,
    p_voter_name: playerName,
    p_game_id: gameId
  });

  if (error) {
    console.error("submitVote error", error);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    winnerRating: row?.winner_rating ?? null,
    loserRating: row?.loser_rating ?? null
  };
}

FM.backendComparisoning = {
  loadItems,
  fetchLeaderboard,
  pickPair,
  submitVote,
  MATCH_GAP_CAP
};
