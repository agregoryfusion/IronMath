// backend_main.js - shared backend helpers (auth, user tracking, shared supabase client)
const FM = (window.FastMath = window.FastMath || {});

// Supabase config (shared)
const SUPABASE_URL = "https://jfjlznxvofhjjlommdrd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bSFpnR01TewY44SI8mLuLA_aX3bF3Lk";

// Reuse existing client if already created by another module
const supabase = FM.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
FM.supabaseClient = supabase;

function isWeekday(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj)) return false;
  const day = dateObj.getUTCDay();
  return day >= 1 && day <= 5; // Monday=1, Friday=5
}

function classifyEmail(email) {
  const lower = (email || "").toLowerCase();
  const isTeacher = lower.endsWith("@fusionacademy.com");
  const isStudent = lower.endsWith("@fusionacademy.me");
  return { isTeacher, isStudent };
}

async function recordUserLogin(email, name) {
  const nowIso = new Date().toISOString();

  const { data: existingUser, error: findErr } = await supabase
    .from("users")
    .select("*")
    .eq("name", name)
    .maybeSingle();

  if (findErr) {
    console.error("User lookup error:", findErr);
  }

  let userId = null;

  if (existingUser) {
    userId = existingUser.user_id;
    const updatedEmail = existingUser.email || email;

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        email: updatedEmail,
        last_login_at: nowIso
      })
      .eq("user_id", userId);

    if (updateErr) {
      console.error("User update failed:", updateErr);
    }
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("users")
      .insert({
        name,
        email,
        last_login_at: nowIso
      })
      .select()
      .single();

    if (insertErr) {
      console.error("User insert failed:", insertErr);
    } else {
      userId = inserted.user_id;
    }
  }

  if (userId !== null) {
    const { error: loginErr } = await supabase
      .from("logins")
      .insert({
        user_id: userId,
        name,
        login_at: nowIso
      });

    if (loginErr) {
      console.error("Login insert failed:", loginErr);
    }
  }

  return userId;
}

function aggregateLoginRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.user_id || row.name || row.email || Math.random().toString(36).slice(2);
    const entry = map.get(key) || {
      userId: row.user_id,
      playerName: row.name || "Player",
      email: row.users?.email || row.email || "",
      days: new Set(),
      firstLogin: null,
      lastLogin: null
    };

    const d = row.login_at ? new Date(row.login_at) : null;
    if (d && isWeekday(d)) {
      const isoDay = d.toISOString().slice(0, 10);
      entry.days.add(isoDay);
      if (!entry.firstLogin || d < entry.firstLogin) entry.firstLogin = d;
      if (!entry.lastLogin || d > entry.lastLogin) entry.lastLogin = d;
    }

    if (row.name && !entry.playerName) entry.playerName = row.name;
    if (row.users?.email) entry.email = row.users.email;

    map.set(key, entry);
  });

  return Array.from(map.values()).map((entry) => {
    const { isTeacher, isStudent } = classifyEmail(entry.email);
    return {
      userId: entry.userId,
      playerName: entry.playerName,
      uniqueDays: entry.days.size,
      firstLogin: entry.firstLogin,
      lastLogin: entry.lastLogin,
      isTeacher,
      isStudent
    };
  });
}

function filterLoginRows(rows, scope = "all") {
  if (scope === "students") return rows.filter((r) => r.isStudent);
  if (scope === "teachers") return rows.filter((r) => r.isTeacher);
  return rows;
}

function sortLoginRows(rows) {
  return [...rows].sort((a, b) => {
    if (b.uniqueDays === a.uniqueDays) {
      const aRecent = a.lastLogin ? a.lastLogin.getTime() : 0;
      const bRecent = b.lastLogin ? b.lastLogin.getTime() : 0;
      return bRecent - aRecent;
    }
    return b.uniqueDays - a.uniqueDays;
  });
}

const LOGIN_CACHE_MS = 60000;
const loginCache = {
  monthly: { rows: null, ts: 0 },
  alltime: { rows: null, ts: 0 }
};

async function fetchLoginAggregates(timeFilter = "monthly", forceRefresh = false) {
  const tf = (timeFilter || "").toLowerCase().startsWith("all") ? "alltime" : "monthly";
  if (!forceRefresh && loginCache[tf].rows && Date.now() - loginCache[tf].ts < LOGIN_CACHE_MS) {
    return loginCache[tf].rows;
  }
  let query = supabase
    .from("logins")
    .select("user_id,name,login_at,users(email)")
    .order("login_at", { ascending: false })
    .limit(5000);

  if (tf === "monthly") {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte("login_at", startOfMonth);
  }

  const { data, error } = await query;
  if (error) throw error;

  const aggregated = sortLoginRows(aggregateLoginRows(data || []));
  loginCache[tf] = { rows: aggregated, ts: Date.now() };
  return aggregated;
}

async function loadLoginLeaderboard(scope = "all", timeFilter = "monthly", forceRefresh = false) {
  const aggregated = await fetchLoginAggregates(timeFilter, forceRefresh);
  return filterLoginRows(aggregated, scope);
}

async function fetchUserUniqueLoginStats(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("logins")
    .select("login_at")
    .eq("user_id", userId)
    .order("login_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  const days = new Set();
  let first = null;
  let last = null;
  (data || []).forEach((row) => {
    const d = row.login_at ? new Date(row.login_at) : null;
    if (d && isWeekday(d)) {
      const isoDay = d.toISOString().slice(0, 10);
      days.add(isoDay);
      if (!first || d < first) first = d;
      if (!last || d > last) last = d;
    }
  });
  return {
    uniqueDays: days.size,
    firstLogin: first,
    lastLogin: last
  };
}

FM.backendMain = {
  supabase,
  recordUserLogin,
  classifyEmail,
  loadLoginLeaderboard,
  fetchUserUniqueLoginStats
};
