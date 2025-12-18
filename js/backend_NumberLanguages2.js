// backend_NumberLanguages2.js - Supabase helpers for Germanic Number Languages game
const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};

const SUPABASE_URL = "https://jfjlznxvofhjjlommdrd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bSFpnR01TewY44SI8mLuLA_aX3bF3Lk";

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
  leaderboard: "secondnumberlanguage_leaderboard",
  sessions: "secondnumberlanguage_sessions",
  questions: "secondnumberlanguage_questions"
};

function safeUserId(raw) {
  if (raw === null || raw === undefined) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (uuidRegex.test(trimmed)) return trimmed;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function normalizeLeaderboardRow(r) {
  if (!r) return null;
  return {
    playerName: r.player_name,
    numbersCorrect: r.numbers_correct ?? 0,
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

  const selfKey = FM.auth && FM.auth.playerName ? (FM.auth.playerName || "").trim().toLowerCase() : "";

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
    tr.appendChild(t(row.numbersCorrect ?? 0));
    tr.appendChild(t((row.totalTime ?? 0).toFixed(2)));
    const d = row.dateAdded ? new Date(row.dateAdded) : null;
    tr.appendChild(t(d ? d.toLocaleDateString() : "?"));
    lbBody.appendChild(tr);
  });
}

function applyLeaderboardFilter(rows, scope) {
  if (!rows) return [];
  if (scope === "teachers") return rows.filter((r) => r.isTeacher);
  if (scope === "students") return rows.filter((r) => r.isStudent);
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
    .order("numbers_correct", { ascending: false })
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
    .filter((r) => !!r.player_name)
    .map(normalizeLeaderboardRow);

  const grouped = {};
  for (const row of normalized) {
    const key = (row.playerName || "").trim().toLowerCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  const best = Object.values(grouped).map((list) =>
    list.sort((a, b) => {
      if (b.numbersCorrect === a.numbersCorrect) return a.totalTime - b.totalTime;
      return b.numbersCorrect - a.numbersCorrect;
    })[0]
  );

  best.sort((a, b) => {
    if (b.numbersCorrect === a.numbersCorrect) return a.totalTime - b.totalTime;
    return b.numbersCorrect - a.numbersCorrect;
  });

  storeLeaderboardInCache(best, tf);
  const filtered = applyLeaderboardFilter(best, scopeFilter);
  renderLeaderboard(filtered);
  return best;
}

function getEmperorTopStudent() {
  const list = lastLoadedTimeFilter === "alltime" ? cachedAllTimeLeaderboard : cachedMonthlyLeaderboard;
  if (!list || list.length === 0) return null;
  return list.find((r) => r.isStudent) || list[0];
}

function getTopByRole(role = "student") {
  const list = lastLoadedTimeFilter === "alltime" ? cachedAllTimeLeaderboard : cachedMonthlyLeaderboard;
  if (!list || list.length === 0) return null;
  if (role === "teacher") {
    const t = list.find((r) => r.isTeacher);
    if (t) return t;
  }
  const s = list.find((r) => r.isStudent);
  if (s) return s;
  return list[0] || null;
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

FM.backendNumberLanguages2 = {
  supabase,
  loadLeaderboard,
  getEmperorTopStudent,
  getTopByRole,
  safeUserId,
  insertLeaderboardRow,
  insertSessionRow,
  insertQuestionRows
};
