// backend_StateCapitals.js - Supabase helpers for State Capitals game
const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};

const SUPABASE_URL = "https://jfjlznxvofhjjlommdrd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bSFpnR01TewY44SI8mLuLA_aX3bF3Lk";

// Safely create the client so a missing CDN script doesn't break the page
const supabaseLib = window.supabase;
const supabase = FM.supabaseClient || (supabaseLib ? supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null);
FM.supabaseClient = supabase;

const lbWrap = document.getElementById("leaderboardContainer");
const lbStatus = document.getElementById("leaderboardStatus");
const lbBody = document.querySelector("#leaderboardContainer tbody");
const viewAllBtn = document.getElementById("viewAllBtn");
const viewStudentsBtn = document.getElementById("viewStudentsBtn");
const viewTeachersBtn = document.getElementById("viewTeachersBtn");

let cachedAllTimeLeaderboard = null;
let cachedMonthlyLeaderboard = null;
let cachedAllTimeFetchTime = 0;
let cachedMonthlyFetchTime = 0;
let lastLoadedTimeFilter = "monthly";
const LEADERBOARD_CACHE_DURATION = 60000;

const TABLES = {
  leaderboard: "statecapitals_leaderboard",
  sessions: "statecapitals_sessions",
  questions: "statecapitals_questions"
};

function safeUserId(raw) {
  if (!raw) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
}

function normalizeLeaderboardRow(r) {
  if (!r) return null;
  return {
    playerName: r.player_name,
    statesCorrect: r.states_correct ?? 0,
    totalTime: r.total_time_seconds ?? 0,
    dateAdded: r.date_added ? new Date(r.date_added).getTime() : null,
    isTeacher: r.is_teacher ?? false,
    isStudent: r.is_student ?? false
  };
}

function renderLeaderboard(rows) {
  if (!lbBody) return;
  lbBody.innerHTML = "";
  if (lbWrap) {
    lbWrap.style.display = "block";
    lbWrap.classList.add("show");
  }
  if (!rows || rows.length === 0) {
    if (lbStatus) lbStatus.textContent = "No scores yet.";
    return;
  }
  if (lbStatus) lbStatus.textContent = "";

  const selfKey = (FM.auth && FM.auth.playerName) ? (FM.auth.playerName || "").trim().toLowerCase() : "";

  rows.forEach((row, idx) => {
    const rowKey = (row.playerName || "").trim().toLowerCase();
    const tr = document.createElement("tr");
    const t = (n) => {
      const td = document.createElement("td");
      td.textContent = n;
      return td;
    };
    if (selfKey && rowKey && rowKey === selfKey) {
      tr.classList.add("lb-row-self");
    }
    tr.appendChild(t(idx + 1));
    tr.appendChild(t(row.playerName || "?"));
    tr.appendChild(t(row.statesCorrect ?? 0));
    tr.appendChild(t((row.totalTime ?? 0).toFixed(2)));
    const d = row.dateAdded ? new Date(row.dateAdded) : null;
    tr.appendChild(t(d ? d.toLocaleDateString() : "?"));
    lbBody.appendChild(tr);
  });
}

function applyLeaderboardFilter(rows, scope) {
  if (!rows) return [];
  if (scope === "teachers") return rows.filter(r => r.isTeacher);
  if (scope === "students") return rows.filter(r => r.isStudent);
  return rows;
}

function storeLeaderboardInCache(list, bucket) {
  if (bucket === "alltime") {
    cachedAllTimeLeaderboard = list;
    cachedAllTimeFetchTime = Date.now();
  } else {
    cachedMonthlyLeaderboard = list;
    cachedMonthlyFetchTime = Date.now();
  }
}

function cacheStillValid(bucket) {
  const now = Date.now();
  if (bucket === "alltime") return cachedAllTimeLeaderboard && (now - cachedAllTimeFetchTime) < LEADERBOARD_CACHE_DURATION;
  return cachedMonthlyLeaderboard && (now - cachedMonthlyFetchTime) < LEADERBOARD_CACHE_DURATION;
}

async function loadLeaderboard(scopeFilter = "all", timeFilter = "monthly", forceRefresh = false) {
  if (!supabase) {
    console.error("Supabase client not available.");
    if (lbStatus) lbStatus.textContent = "Leaderboard unavailable.";
    return [];
  }
  const tf = (typeof timeFilter === "string" && timeFilter.trim().toLowerCase().startsWith("all")) ? "alltime" : "monthly";
  lastLoadedTimeFilter = tf;

  const cache = tf === "alltime" ? cachedAllTimeLeaderboard : cachedMonthlyLeaderboard;
  if (!forceRefresh && cacheStillValid(tf)) {
    const filtered = applyLeaderboardFilter(cache, scopeFilter);
    renderLeaderboard(filtered);
    return cache;
  }

  if (lbWrap) {
    lbWrap.style.display = "block";
    lbWrap.classList.add("show");
  }
  if (lbStatus) lbStatus.textContent = "Loading leaderboard...";

  let query = supabase
    .from(TABLES.leaderboard)
    .select("*")
    .order("states_correct", { ascending: false })
    .order("total_time_seconds", { ascending: true })
    .limit(500);

  if (tf === "monthly") {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte("date_added", startOfMonth);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Leaderboard fetch failed:", error);
    if (lbStatus) lbStatus.textContent = "Unable to load leaderboard.";
    return null;
  }

  const normalized = (data || [])
    .filter(r => !!r.player_name)
    .map(normalizeLeaderboardRow);

  const grouped = {};
  for (const row of normalized) {
    const key = (row.playerName || "").trim().toLowerCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  const best = Object.values(grouped).map(list =>
    list.sort((a, b) => {
      if (b.statesCorrect === a.statesCorrect) return a.totalTime - b.totalTime;
      return b.statesCorrect - a.statesCorrect;
    })[0]
  );

  best.sort((a, b) => {
    if (b.statesCorrect === a.statesCorrect) return a.totalTime - b.totalTime;
    return b.statesCorrect - a.statesCorrect;
  });

  storeLeaderboardInCache(best, tf);
  const filtered = applyLeaderboardFilter(best, scopeFilter);
  renderLeaderboard(filtered);
  return best;
}

function getEmperorTopStudent() {
  const list = lastLoadedTimeFilter === "alltime" ? cachedAllTimeLeaderboard : cachedMonthlyLeaderboard;
  if (!list || list.length === 0) return null;
  return list.find(r => r.isStudent) || list[0];
}

async function insertLeaderboardRow(payload) {
  return await supabase.from(TABLES.leaderboard).insert(payload).select().maybeSingle();
}

async function insertSessionRow(payload) {
  const { data, error } = await supabase.from(TABLES.sessions).insert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
}

async function insertQuestionRows(rows) {
  const { error } = await supabase.from(TABLES.questions).insert(rows);
  if (error) throw error;
  return true;
}

FM.backendStateCapitals = {
  supabase,
  loadLeaderboard,
  getEmperorTopStudent,
  safeUserId,
  insertLeaderboardRow,
  insertSessionRow,
  insertQuestionRows
};
