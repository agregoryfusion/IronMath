import "./utils.js";
import "./backend_main.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  OAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};
const backendMain = FM.backendMain || {};

const loginScreen = document.getElementById("login-screen");
const loginBtn = document.getElementById("loginBtn");
const loginStatus = document.getElementById("loginStatus");
const homeScreen = document.getElementById("home-screen");
const userNameEl = document.getElementById("userName");
const userNameCard = document.getElementById("userNameCard");
const userEmailEl = document.getElementById("userEmail");
const signOutBtn = document.getElementById("signOutBtn");
const placeholderCard = document.querySelector(".app-card.placeholder");
const filterButtons = Array.from(document.querySelectorAll(".filter-pill"));
const appCards = Array.from(document.querySelectorAll(".app-card[data-field]"));
let activeField = null;

const uniqueDaysValue = document.getElementById("uniqueDaysValue");
const uniqueDaysRange = document.getElementById("uniqueDaysRange");
const uniqueDaysStatus = document.getElementById("uniqueDaysStatus");
const openLoginLeaderboardBtn = document.getElementById("openLoginLeaderboardBtn");

const loginLeaderboardSection = document.getElementById("login-leaderboard");
const loginLeaderboardStatus = document.getElementById("loginLeaderboardStatus");
const loginLeaderboardTable = document.getElementById("loginLeaderboardTable");
const loginLbMonthlyBtn = document.getElementById("loginLbMonthlyBtn");
const loginLbAllTimeBtn = document.getElementById("loginLbAllTimeBtn");
const loginLbEveryoneBtn = document.getElementById("loginLbEveryoneBtn");
const loginLbStudentsBtn = document.getElementById("loginLbStudentsBtn");
const loginLbTeachersBtn = document.getElementById("loginLbTeachersBtn");
const loginLbBackBtn = document.getElementById("loginLbBackBtn");
let loginLbScope = "all";
let loginLbTimeFilter = "monthly";

// Konami code easter egg to replace the "Coming Soon?" text with an image
const KONAMI_SEQUENCE = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let konamiIndex = 0;
function revealKonamiImage() {
  if (!placeholderCard || placeholderCard.dataset.konamiShown === "1") return;
  placeholderCard.dataset.konamiShown = "1";
  const existingText = placeholderCard.querySelector(".muted");
  if (existingText) existingText.remove();
  const img = document.createElement("img");
  img.src = "https://images.squarespace-cdn.com/content/v1/56608ba6e4b0527b5cbad513/1679335688247-43ISQGVR7SLDS1HMUXAG/mothra.png?format=750w";
  img.alt = "Hidden preview unlocked";
  img.className = "konami-img";
  placeholderCard.appendChild(img);
}
window.addEventListener("keydown", (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const expected = KONAMI_SEQUENCE[konamiIndex];
  if (key === expected || (expected === "b" && key === "b") || (expected === "a" && key === "a")) {
    konamiIndex += 1;
    if (konamiIndex === KONAMI_SEQUENCE.length) {
      revealKonamiImage();
      konamiIndex = 0;
    }
  } else {
    konamiIndex = key === KONAMI_SEQUENCE[0] ? 1 : 0;
  }
});

const firebaseConfig = {
  apiKey: "AIzaSyBUaOrUckCuTrc9MHB9jCF4TUsx-hWFC7g",
  authDomain: "ironmath-1263b.firebaseapp.com",
  projectId: "ironmath-1263b",
  storageBucket: "ironmath-1263b.firebasestorage.app",
  messagingSenderId: "729878130193",
  appId: "1:729878130193:web:f4d447b552e4f955f80bb0",
  measurementId: "G-0VCM7C1HPC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new OAuthProvider("microsoft.com");
await setPersistence(auth, browserLocalPersistence);

function setUserName(displayName) {
  if (userNameEl) userNameEl.textContent = "Welcome " + (displayName || "Player");
  if (userNameCard) userNameCard.textContent = displayName || "Player";
}

function showHome() {
  if (loginScreen) loginScreen.style.display = "none";
  if (homeScreen) {
    homeScreen.style.display = "flex";
    homeScreen.style.opacity = "1";
  }
  if (loginLeaderboardSection) {
    loginLeaderboardSection.style.display = "none";
  }
  if (loginStatus) loginStatus.textContent = "";
}

function showLogin(message = "") {
  if (homeScreen) {
    homeScreen.style.display = "none";
    homeScreen.style.opacity = "0";
  }
  if (loginLeaderboardSection) {
    loginLeaderboardSection.style.display = "none";
  }
  if (loginScreen) loginScreen.style.display = "flex";
  if (loginStatus) loginStatus.textContent = message;
}

function applyFilter(field) {
  appCards.forEach((card) => {
    const cardField = (card.dataset.field || "").toLowerCase();
    if (!field || cardField === field.toLowerCase()) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
}

function bindFilters() {
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.field || "";
      const isAlreadyActive = activeField && activeField.toLowerCase() === field.toLowerCase();
      activeField = isAlreadyActive ? null : field;

      filterButtons.forEach((b) => b.classList.toggle("active", b === btn && !isAlreadyActive));
      applyFilter(activeField);
    });
  });
}

function formatDate(value) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (!d || isNaN(d)) return "-";
  return d.toLocaleDateString();
}

function updateUniqueDaysDisplay(stats) {
  if (!uniqueDaysValue) return;
  const { uniqueDays = 0, firstLogin } = stats || {};
  uniqueDaysValue.textContent = `${uniqueDays || 1} Days`;
  if (uniqueDaysRange) {
    const first = firstLogin ? formatDate(firstLogin) : "-";
    uniqueDaysRange.textContent = `First: ${first}`;
  }
  if (uniqueDaysStatus) uniqueDaysStatus.textContent = "";
}

async function loadUniqueDayStats(userId) {
  if (!uniqueDaysValue) return;
  if (uniqueDaysStatus) uniqueDaysStatus.textContent = "Loading login history...";
  try {
    const stats = await backendMain.fetchUserUniqueLoginStats(userId);
    updateUniqueDaysDisplay(stats);
  } catch (err) {
    console.error("Unique login days fetch failed:", err);
    if (uniqueDaysStatus) uniqueDaysStatus.textContent = "Could not load login history.";
  }
}

function renderLoginLeaderboard(rows) {
  if (!loginLeaderboardTable) return;
  const tbody = loginLeaderboardTable.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    if (loginLeaderboardStatus) loginLeaderboardStatus.textContent = "No logins recorded yet.";
    return;
  }
  if (loginLeaderboardStatus) loginLeaderboardStatus.textContent = "";

  const selfName = (FM.auth?.playerName || "").trim().toLowerCase();

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    const add = (text) => {
      const td = document.createElement("td");
      td.textContent = text;
      return td;
    };
    const rowName = (row.playerName || "").trim().toLowerCase();
    if (selfName && rowName === selfName) tr.classList.add("lb-row-self");

    tr.appendChild(add(idx + 1));
    tr.appendChild(add(row.playerName || "?"));
    tr.appendChild(add(row.uniqueDays ?? 0));
    tr.appendChild(add(formatDate(row.firstLogin)));
    tr.appendChild(add(formatDate(row.lastLogin)));
    tbody.appendChild(tr);
  });
}

async function refreshLoginLeaderboard(forceRefresh = false) {
  if (loginLeaderboardStatus) loginLeaderboardStatus.textContent = "Loading leaderboard...";
  try {
    const rows = await backendMain.loadLoginLeaderboard(loginLbScope, loginLbTimeFilter, forceRefresh);
    renderLoginLeaderboard(rows || []);
  } catch (err) {
    console.error("Login leaderboard fetch failed:", err);
    if (loginLeaderboardStatus) loginLeaderboardStatus.textContent = "Unable to load leaderboard.";
  }
}

function setLeaderboardScope(scope) {
  loginLbScope = scope;
  if (loginLbEveryoneBtn) loginLbEveryoneBtn.classList.toggle("active", scope === "all");
  if (loginLbStudentsBtn) loginLbStudentsBtn.classList.toggle("active", scope === "students");
  if (loginLbTeachersBtn) loginLbTeachersBtn.classList.toggle("active", scope === "teachers");
}

function setLeaderboardTimeFilter(tf) {
  loginLbTimeFilter = tf;
  if (loginLbMonthlyBtn) loginLbMonthlyBtn.classList.toggle("active", tf === "monthly");
  if (loginLbAllTimeBtn) loginLbAllTimeBtn.classList.toggle("active", tf === "alltime");
}

function showLoginLeaderboard() {
  if (homeScreen) {
    homeScreen.style.display = "none";
    homeScreen.style.opacity = "0";
  }
  if (loginLeaderboardSection) {
    loginLeaderboardSection.style.display = "block";
  }
  refreshLoginLeaderboard();
}

function hideLoginLeaderboard() {
  if (loginLeaderboardSection) loginLeaderboardSection.style.display = "none";
  if (homeScreen) {
    homeScreen.style.display = "flex";
    homeScreen.style.opacity = "1";
  }
}

function bindLeaderboardControls() {
  if (openLoginLeaderboardBtn) {
    openLoginLeaderboardBtn.addEventListener("click", () => {
      showLoginLeaderboard();
    });
  }
  if (loginLbBackBtn) {
    loginLbBackBtn.addEventListener("click", () => {
      hideLoginLeaderboard();
    });
  }
  if (loginLbMonthlyBtn) {
    loginLbMonthlyBtn.addEventListener("click", () => {
      setLeaderboardTimeFilter("monthly");
      refreshLoginLeaderboard();
    });
  }
  if (loginLbAllTimeBtn) {
    loginLbAllTimeBtn.addEventListener("click", () => {
      setLeaderboardTimeFilter("alltime");
      refreshLoginLeaderboard();
    });
  }
  if (loginLbEveryoneBtn) {
    loginLbEveryoneBtn.addEventListener("click", () => {
      setLeaderboardScope("all");
      refreshLoginLeaderboard();
    });
  }
  if (loginLbStudentsBtn) {
    loginLbStudentsBtn.addEventListener("click", () => {
      setLeaderboardScope("students");
      refreshLoginLeaderboard();
    });
  }
  if (loginLbTeachersBtn) {
    loginLbTeachersBtn.addEventListener("click", () => {
      setLeaderboardScope("teachers");
      refreshLoginLeaderboard();
    });
  }
}

async function handleSignedIn(user) {
  const email = user?.email?.toLowerCase() || "";
  const displayName = user?.displayName || (U.parseEmailToName ? U.parseEmailToName(user?.email) : "Player");
  const { isTeacher, isStudent } = backendMain.classifyEmail ? backendMain.classifyEmail(email) : { isTeacher: false, isStudent: false };

  FM.auth = {
    playerName: displayName,
    email,
    isTeacher,
    isStudent
  };

  setUserName(displayName);
  if (userEmailEl) userEmailEl.textContent = user?.email || "";
  showHome();

  try {
    const userId = await backendMain.recordUserLogin(email, displayName);
    window.currentUserId = userId;
    await loadUniqueDayStats(userId);
  } catch (err) {
    console.error("Login record or stats load failed:", err);
    if (uniqueDaysStatus) uniqueDaysStatus.textContent = "Could not record login.";
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    handleSignedIn(user);
  } else {
    showLogin();
  }
});

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    try {
      if (loginStatus) loginStatus.textContent = "Signing in...";
      const result = await signInWithPopup(auth, provider);
      await handleSignedIn(result.user);
    } catch (e) {
      console.error("Sign-in error:", e);
      showLogin("Sign-in failed: " + (e?.message || e));
    }
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showLogin();
    } catch (e) {
      console.error("Sign-out error:", e);
      if (loginStatus) loginStatus.textContent = "Sign-out failed: " + (e?.message || e);
    }
  });
}

// set up category filters and leaderboard controls immediately
bindFilters();
bindLeaderboardControls();
