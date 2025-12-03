// backend_AddingUp.js - Supabase + leaderboard + caching for Adding Up game
const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};

const SUPABASE_URL = "https://jfjlznxvofhjjlommdrd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bSFpnR01TewY44SI8mLuLA_aX3bF3Lk";

const supabase = FM.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
  leaderboard: "addingup_leaderboard",
  sessions: "addingup_sessions",
  questions: "addingup_questions"
};

function normalizeLeaderboardRow(r) {
  if (!r) return null;
  return {
    playerName: r.player_name,
    questionsAnswered: r.questions_answered ?? 0,
    totalTime: r.total_time_seconds ?? 0,
    penaltyTime: r.penalty_time_seconds ?? 0,
    dateAdded: r.date_added ? new Date(r.date_added).getTime() : null,
    isTeacher: r.is_teacher ?? false,
    isStudent: r.is_student ?? false,
    finalTotal: r.final_total ?? null
  };
}

function renderLeaderboard(rows) {
  if (!lbBody) return;
  lbBody.innerHTML = "";
  if (!rows || rows.length === 0) {
    if (lbStatus) lbStatus.textContent = "No scores yet.";
    return;
  }
  if (lbStatus) lbStatus.textContent = "";

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    const t = (n) => {
      const td = document.createElement("td");
      td.textContent = n;
      return td;
    };
    tr.appendChild(t(idx + 1));
    tr.appendChild(t(row.playerName || "?"));
    tr.appendChild(t(row.questionsAnswered ?? 0));
    tr.appendChild(t((row.totalTime ?? 0).toFixed(2)));
    tr.appendChild(t(((row.totalTime ?? 0) / Math.max(1, row.questionsAnswered ?? 1)).toFixed(2)));
    tr.appendChild(t(row.finalTotal ?? "—"));
    const d = row.dateAdded ? new Date(row.dateAdded) : null;
    tr.appendChild(t(d ? d.toLocaleDateString() : "—"));
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
  const tf = (typeof timeFilter === "string" && timeFilter.trim().toLowerCase().startsWith("all")) ? "alltime" : "monthly";
  lastLoadedTimeFilter = tf;

  const cache = tf === "alltime" ? cachedAllTimeLeaderboard : cachedMonthlyLeaderboard;
  if (!forceRefresh && cacheStillValid(tf)) {
    const filtered = applyLeaderboardFilter(cache, scopeFilter);
    renderLeaderboard(filtered);
    return cache;
  }

  if (lbStatus) lbStatus.textContent = "Loading leaderboard...";

  let query = supabase
    .from(TABLES.leaderboard)
    .select("*")
    .order("questions_answered", { ascending: false })
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

  // keep best entry per player
  const grouped = {};
  for (const row of normalized) {
    const key = (row.playerName || "").trim().toLowerCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  const best = Object.values(grouped).map(list =>
    list.sort((a, b) => {
      if (b.questionsAnswered === a.questionsAnswered) return a.totalTime - b.totalTime;
      return b.questionsAnswered - a.questionsAnswered;
    })[0]
  );

  best.sort((a, b) => {
    if (b.questionsAnswered === a.questionsAnswered) return a.totalTime - b.totalTime;
    return b.questionsAnswered - a.questionsAnswered;
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

// Optional: fetch cached questions for analytics pages
let cachedQuestions = null;
let cachedQuestionsFetchTime = 0;
async function fetchAndCacheQuestions(force = false) {
  const now = Date.now();
  if (!force && cachedQuestions && (now - cachedQuestionsFetchTime) < LEADERBOARD_CACHE_DURATION) {
    return cachedQuestions;
  }
  const { data, error } = await supabase
    .from(TABLES.questions)
    .select("*")
    .order("date_added", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("Question fetch failed:", error);
    return cachedQuestions;
  }
  cachedQuestions = (data || []).map(r => ({
    playerName: r.player_name,
    startingTotal: r.starting_total,
    addend: r.addend,
    expectedTotal: r.expected_total,
    timeTaken: r.time_taken,
    mistakes: r.mistakes,
    success: r.success,
    dateMs: r.date_added ? new Date(r.date_added).getTime() : null,
    version: r.version_number
  }));
  cachedQuestionsFetchTime = now;
  return cachedQuestions;
}

FM.backendAddingUp = {
  supabase,
  loadLeaderboard,
  getEmperorTopStudent,
  insertLeaderboardRow,
  insertSessionRow,
  insertQuestionRows,
  fetchAndCacheQuestions
};
