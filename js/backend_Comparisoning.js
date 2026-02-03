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
    updatedAt: r.updated_at ? new Date(r.updated_at) : null,
    approved: r.approved ?? null,
    submittedBy: r.submitted_by ?? null,
    createdAt: r.created_at ? new Date(r.created_at) : null
  };
}

async function loadItems(gameId = 1, limit = 200) {
  const { data, error } = await supabase
    .from(TABLES.items)
    .select("item_id,name,category,rating,wins,losses,matches,last_played,updated_at,game_id,approved,submitted_by,created_at")
    .eq("game_id", gameId)
    .eq("approved", true)
    .order("rating", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("loadItems error", error);
    throw error;
  }
  return (data || []).map(normalizeItem);
}

async function fetchLeaderboard(gameId = 1, limit = null) {
  let query = supabase
    .from(TABLES.items)
    .select("item_id,name,category,rating,wins,losses,matches,last_played,approved")
    .eq("game_id", gameId)
    .eq("approved", true)
    .order("rating", { ascending: false });

  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchLeaderboard error", error);
    throw error;
  }
  return (data || []).map(normalizeItem);
}

async function fetchWeeklyVoteCount({ userId = null, playerName = null, gameId = 1, startIso = null, endIso = null }) {
  let query = supabase
    .from(TABLES.votes)
    .select("vote_id", { count: "exact", head: true })
    .eq("game_id", gameId);

  if (startIso) query = query.gte("created_at", startIso);
  if (endIso) query = query.lte("created_at", endIso);

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (playerName) {
    query = query.eq("voter_name", playerName);
  }

  const { count, error } = await query;
  if (error) {
    console.error("fetchWeeklyVoteCount error", error);
    throw error;
  }
  return Number(count || 0);
}

async function fetchWeeklySubmissionCount({ playerName = null, gameId = 1, startIso = null, endIso = null }) {
  if (!playerName) return 0;
  let query = supabase
    .from(TABLES.items)
    .select("item_id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("submitted_by", playerName);

  if (startIso) query = query.gte("created_at", startIso);
  if (endIso) query = query.lte("created_at", endIso);

  const { count, error } = await query;
  if (error) {
    console.error("fetchWeeklySubmissionCount error", error);
    throw error;
  }
  return Number(count || 0);
}

async function fetchSubmissionItems(gameId = 1, limit = 2000) {
  const { data, error } = await supabase
    .from(TABLES.items)
    .select("item_id,name,category,approved,submitted_by,created_at,game_id")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchSubmissionItems error", error);
    throw error;
  }
  return (data || []).map(normalizeItem);
}

async function fetchUserSubmissionsInRange({ playerName, gameId = 1, startIso = null, endIso = null }) {
  if (!playerName) return [];
  let query = supabase
    .from(TABLES.items)
    .select("item_id,name,submitted_by,created_at,approved,game_id")
    .eq("game_id", gameId)
    .eq("submitted_by", playerName);

  if (startIso) query = query.gte("created_at", startIso);
  if (endIso) query = query.lte("created_at", endIso);

  const { data, error } = await query;
  if (error) {
    console.error("fetchUserSubmissionsInRange error", error);
    throw error;
  }
  return (data || []).map(normalizeItem);
}

async function submitComparisonItem({ name, category = null, submittedBy = null, gameId = 1 }) {
  const { data, error } = await supabase.rpc("comparison_submit_item", {
    p_name: name,
    p_category: category,
    p_submitted_by: submittedBy,
    p_game_id: gameId
  });

  if (error) {
    console.error("submitComparisonItem error", error);
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return normalizeItem(row);
}

async function fetchVoterCounts(gameId = 1) {
  // supabase-js v2 no longer supports .group(); fetch and aggregate client-side
  const { data, error } = await supabase
    .from(TABLES.votes)
    .select("voter_name")
    .eq("game_id", gameId)
    .not("voter_name", "is", null)
    .limit(10000);

  if (error) {
    console.error("fetchVoterCounts error", error);
    throw error;
  }

  const tally = {};
  (data || []).forEach((r) => {
    const name = r.voter_name || "Unknown";
    tally[name] = (tally[name] || 0) + 1;
  });

  return Object.entries(tally)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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
  fetchWeeklyVoteCount,
  fetchWeeklySubmissionCount,
  fetchSubmissionItems,
  fetchUserSubmissionsInRange,
  submitComparisonItem,
  fetchVoterCounts,
  pickPair,
  submitVote,
  MATCH_GAP_CAP
};
