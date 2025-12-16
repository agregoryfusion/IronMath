// backend_Factoring.js - Supabase integration + leaderboard for Factor Sprint
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
const lbMonthlyBtn = document.getElementById("lbMonthlyBtn");
const lbAllTimeBtn = document.getElementById("lbAllTimeBtn");

const TABLES = {
  leaderboard: "factoring_leaderboard",
  sessions: "factoring_sessions",
  questions: "factoring_questions"
};

let cachedAllTimeLeaderboard = null;
let cachedMonthlyLeaderboard = null;
let cachedAllTimeFetchTime = 0;
let cachedMonthlyFetchTime = 0;
let lastLoadedTimeFilter = "monthly";
const LEADERBOARD_CACHE_DURATION = 60000;

function safeUserId(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
}

function normalizeLeaderboardRow(r) {
  if (!r) return null;
  return {
    playerName: r.player_name,
    questionsAnswered: r.questions_answered ?? 0,
    stageReached: r.stage_reached ?? null,
    totalTime: r.total_time_seconds ?? 0,
    penaltyTime: r.penalty_time_seconds ?? 0,
    dateAdded: r.date_added ? new Date(r.date_added).getTime() : null,
    isTeacher: r.is_teacher ?? false,
    isStudent: r.is_student ?? false
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
    tr.appendChild(t(row.questionsAnswered ?? 0));
    tr.appendChild(t((row.totalTime ?? 0).toFixed(2)));
    tr.appendChild(t(((row.totalTime ?? 0) / Math.max(1, row.questionsAnswered ?? 1)).toFixed(2)));
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

function cacheStillValid(bucket) {
  const now = Date.now();
  if (bucket === "alltime") return cachedAllTimeLeaderboard && (now - cachedAllTimeFetchTime) < LEADERBOARD_CACHE_DURATION;
  return cachedMonthlyLeaderboard && (now - cachedMonthlyFetchTime) < LEADERBOARD_CACHE_DURATION;
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

function getTopByRole(role = "student") {
  const list = lastLoadedTimeFilter === "alltime" ? cachedAllTimeLeaderboard : cachedMonthlyLeaderboard;
  if (!list || list.length === 0) return null;
  if (role === "teacher") {
    const t = list.find(r => r.isTeacher);
    if (t) return t;
  }
  const s = list.find(r => r.isStudent);
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
  if (!Array.isArray(rows) || rows.length === 0) return;
  const { error } = await supabase.from(TABLES.questions).insert(rows);
  if (error) throw error;
}

function updateCachedLeaderboardWithNewScore(newEntry) {
  if (!newEntry?.playerName) return;
  const key = (newEntry.playerName || "").trim().toLowerCase();

  const updateCache = (cache) => {
    if (!cache) return null;
    const idx = cache.findIndex(d => (d.playerName || "").trim().toLowerCase() === key);
    if (idx !== -1) {
      const old = cache[idx];
      const isBetter =
        newEntry.questionsAnswered > (old.questionsAnswered ?? 0) ||
        (newEntry.questionsAnswered === old.questionsAnswered && newEntry.totalTime < (old.totalTime ?? Infinity));
      if (isBetter) cache[idx] = newEntry;
    } else {
      cache.push(newEntry);
    }
    cache.sort((a, b) => {
      if (b.questionsAnswered === a.questionsAnswered) return a.totalTime - b.totalTime;
      return b.questionsAnswered - a.questionsAnswered;
    });
    return cache;
  };

  cachedAllTimeLeaderboard = updateCache(cachedAllTimeLeaderboard);
  cachedMonthlyLeaderboard = updateCache(cachedMonthlyLeaderboard);

  const active = lastLoadedTimeFilter === "alltime" ? cachedAllTimeLeaderboard : cachedMonthlyLeaderboard;
  if (active) {
    const scope = (document.querySelector(".lb-scope-active")?.dataset?.scope) || "all";
    const filtered = applyLeaderboardFilter(active, scope);
    renderLeaderboard(filtered);
  }
}

if (viewAllBtn) {
  viewAllBtn.addEventListener("click", () => {
    viewAllBtn.classList.add("lb-scope-active");
    viewStudentsBtn?.classList.remove("lb-scope-active");
    viewTeachersBtn?.classList.remove("lb-scope-active");
    loadLeaderboard("all", lastLoadedTimeFilter, true);
  });
}
if (viewStudentsBtn) {
  viewStudentsBtn.addEventListener("click", () => {
    viewStudentsBtn.classList.add("lb-scope-active");
    viewAllBtn?.classList.remove("lb-scope-active");
    viewTeachersBtn?.classList.remove("lb-scope-active");
    loadLeaderboard("students", lastLoadedTimeFilter, true);
  });
}
if (viewTeachersBtn) {
  viewTeachersBtn.addEventListener("click", () => {
    viewTeachersBtn.classList.add("lb-scope-active");
    viewAllBtn?.classList.remove("lb-scope-active");
    viewStudentsBtn?.classList.remove("lb-scope-active");
    loadLeaderboard("teachers", lastLoadedTimeFilter, true);
  });
}
if (lbMonthlyBtn) {
  lbMonthlyBtn.addEventListener("click", () => {
    lbMonthlyBtn.classList.add("active");
    lbAllTimeBtn?.classList.remove("active");
    loadLeaderboard(document.querySelector(".lb-scope-active")?.dataset?.scope || "all", "monthly", true);
  });
}
if (lbAllTimeBtn) {
  lbAllTimeBtn.addEventListener("click", () => {
    lbAllTimeBtn.classList.add("active");
    lbMonthlyBtn?.classList.remove("active");
    loadLeaderboard(document.querySelector(".lb-scope-active")?.dataset?.scope || "all", "all", true);
  });
}

FM.backendFactoring = {
  loadLeaderboard,
  insertLeaderboardRow,
  insertSessionRow,
  insertQuestionRows,
  updateCachedLeaderboardWithNewScore,
  getEmperorTopStudent,
  getTopByRole,
  safeUserId
};
