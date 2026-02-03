// Comparisoning.js - UI + gameplay loop for Comparison-ing
import "./utils.js";
import "./backend_Comparisoning.js";

const FM = (window.FastMath = window.FastMath || {});
const backend = FM.backendComparisoning || {};

const loadingScreen = document.getElementById("loading-screen");
const comparisonScreen = document.getElementById("comparison-screen");
const leaderboardSection = document.getElementById("leaderboard-section");
const unauthorizedScreen = document.getElementById("unauthorized-screen");
const versionBadge = document.getElementById("version");
const statusText = document.getElementById("statusText");
const reloadLeaderboardBtn = document.getElementById("reloadLeaderboardBtn");
const leaderboardBody = document.querySelector("#leaderboardTable tbody");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const votersSection = document.getElementById("voters-section");
const votersBody = document.querySelector("#votersTable tbody");
const votersStatus = document.getElementById("votersStatus");
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const GAME_ID = 1;

const leftName = document.getElementById("leftName");
const rightName = document.getElementById("rightName");
const leftVoteBtn = document.getElementById("leftVoteBtn");
const rightVoteBtn = document.getElementById("rightVoteBtn");

const state = {
  items: [],
  currentPair: null,
  lastPairIds: [],
  hasLoadedLeaderboard: false,
  hasLoadedVoters: false,
  activeTab: "game",
  user: {
    userId: null,
    playerName: "Player",
    isTeacher: false,
    isStudent: false
  }
};

if (comparisonScreen) comparisonScreen.style.display = "none";
showLoading();

function setStatus(msg, isError = false) {
  if (!statusText) return;
  statusText.textContent = msg;
  statusText.classList.toggle("error-text", !!isError);
}

function showLoading() {
  if (loadingScreen) loadingScreen.style.display = "flex";
  if (comparisonScreen) comparisonScreen.style.display = "none";
  if (leaderboardSection) leaderboardSection.style.display = "none";
  if (votersSection) votersSection.style.display = "none";
}

function showGame() {
  if (loadingScreen) loadingScreen.style.display = "none";
  if (comparisonScreen) comparisonScreen.style.display = "block";
  if (leaderboardSection) leaderboardSection.style.display = "none";
  if (votersSection) votersSection.style.display = "none";
}

function showLeaderboardSection() {
  if (loadingScreen) loadingScreen.style.display = "none";
  if (comparisonScreen) comparisonScreen.style.display = "none";
  if (leaderboardSection) leaderboardSection.style.display = "block";
  if (votersSection) votersSection.style.display = "none";
}

function showVotersSection() {
  if (loadingScreen) loadingScreen.style.display = "none";
  if (comparisonScreen) comparisonScreen.style.display = "none";
  if (leaderboardSection) leaderboardSection.style.display = "none";
  if (votersSection) votersSection.style.display = "block";
}

function setVersionBadge() {
  if (versionBadge && FM.GAME_VERSION) {
    versionBadge.textContent = "v" + FM.GAME_VERSION;
  }
}

function renderPair(pair) {
  if (!pair || pair.length < 2) {
    setStatus("Not enough items to compare yet.", true);
    return;
  }
  const [a, b] = pair;
  if (leftName) leftName.textContent = a.name;
  if (rightName) rightName.textContent = b.name;
  if (leftVoteBtn) leftVoteBtn.textContent = `${a.name} is better`;
  if (rightVoteBtn) rightVoteBtn.textContent = `${b.name} is better`;
  setStatus("Tap the one you prefer.");
}

function disableVoteButtons(disabled) {
  [leftVoteBtn, rightVoteBtn].forEach((btn) => {
    if (btn) btn.disabled = disabled;
  });
}

function applyRatingUpdate(itemId, newRating) {
  const target = state.items.find((i) => i.id === itemId);
  if (target && Number.isFinite(newRating)) {
    target.rating = Number(newRating);
  }
}

function choosePair() {
  if (!backend.pickPair) return;
  const pair = backend.pickPair(state.items, state.lastPairIds);
  state.currentPair = pair;
  state.lastPairIds = Array.isArray(pair) ? pair.map((p) => p.id) : [];
  renderPair(pair);
}

async function refreshItemsAndPair() {
  try {
    showLoading();
    state.items = await backend.loadItems(GAME_ID);
    choosePair();
    showGame();
  } catch (err) {
    console.error(err);
    setStatus("Could not load items. Please try again.", true);
  }
}

async function handleVote(side = "left") {
  const pair = state.currentPair;
  if (!pair || pair.length < 2) return;
  const winner = side === "left" ? pair[0] : pair[1];
  const loser = side === "left" ? pair[1] : pair[0];
  const winnerBefore = winner.rating;

  disableVoteButtons(true);
  setStatus("Saving vote…");
  try {
    const res = await backend.submitVote({
      winnerId: winner.id,
      loserId: loser.id,
      userId: state.user.userId,
      playerName: state.user.playerName,
      gameId: GAME_ID
    });
    applyRatingUpdate(winner.id, res.winnerRating);
    applyRatingUpdate(loser.id, res.loserRating);
    const delta = Math.abs(Math.round((res.winnerRating ?? winnerBefore) - winnerBefore));
    setStatus(`${winner.name} inched ahead by ${delta} pts`);
    choosePair();
  } catch (err) {
    console.error(err);
    setStatus("Vote failed. Please try again.", true);
  } finally {
    disableVoteButtons(false);
  }
}

async function renderLeaderboard() {
  if (!leaderboardBody) return;
  leaderboardBody.innerHTML = "";
  if (leaderboardStatus) leaderboardStatus.textContent = "Loading…";
  try {
    const rows = await backend.fetchLeaderboard(GAME_ID);
    if (!rows || rows.length === 0) {
      if (leaderboardStatus) leaderboardStatus.textContent = "No votes yet.";
      return;
    }
    if (leaderboardStatus) leaderboardStatus.textContent = "";
    const formatRatio = (w, l) => {
      if (!Number.isFinite(w) || !Number.isFinite(l)) return "—";
      if (l === 0) return w > 0 ? "∞" : "—";
      return (w / l).toFixed(2);
    };
    const formatMMR = (r) => (Number.isFinite(r) ? Number(r).toFixed(1) : "—");

    rows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      const t = (v) => {
        const td = document.createElement("td");
        td.textContent = v;
        return td;
      };
      tr.appendChild(t(idx + 1));
      tr.appendChild(t(row.name));
      tr.appendChild(t(row.wins));
      tr.appendChild(t(row.losses));
      tr.appendChild(t(formatRatio(row.wins, row.losses)));
      tr.appendChild(t(row.matches));
      tr.appendChild(t(formatMMR(row.rating)));
      leaderboardBody.appendChild(tr);
    });
    state.hasLoadedLeaderboard = true;
  } catch (err) {
    console.error(err);
    if (leaderboardStatus) leaderboardStatus.textContent = "Could not load leaderboard.";
  }
}

async function renderVoters() {
  if (!votersBody) return;
  votersBody.innerHTML = "";
  if (votersStatus) votersStatus.textContent = "Loading…";
  try {
    const rows = await backend.fetchVoterCounts(GAME_ID);
    if (!rows || rows.length === 0) {
      if (votersStatus) votersStatus.textContent = "No votes yet.";
      return;
    }
    if (votersStatus) votersStatus.textContent = "";
    rows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      const t = (v) => {
        const td = document.createElement("td");
        td.textContent = v;
        return td;
      };
      tr.appendChild(t(idx + 1));
      tr.appendChild(t(row.name || "Unknown"));
      tr.appendChild(t(row.count));
      votersBody.appendChild(tr);
    });
    state.hasLoadedVoters = true;
  } catch (err) {
    console.error(err);
    if (votersStatus) votersStatus.textContent = "Could not load voters.";
  }
}

function activateTab(tab) {
  state.activeTab = tab;
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("active", isActive);
  });
  if (tab === "leaderboard") {
    showLeaderboardSection();
    if (!state.hasLoadedLeaderboard) {
      renderLeaderboard();
    }
  } else if (tab === "voters") {
    showVotersSection();
    if (!state.hasLoadedVoters) {
      renderVoters();
    }
  } else {
    showGame();
  }
}

function wireEvents() {
  if (leftVoteBtn) leftVoteBtn.addEventListener("click", () => handleVote("left"));
  if (rightVoteBtn) rightVoteBtn.addEventListener("click", () => handleVote("right"));
  if (reloadLeaderboardBtn) reloadLeaderboardBtn.addEventListener("click", () => renderLeaderboard());
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
}

function showUnauthorized(message) {
  if (!unauthorizedScreen) return;
  unauthorizedScreen.style.display = "block";
  unauthorizedScreen.innerHTML = `
    <h3>Access Restricted</h3>
    <p>${message || "Please sign in with your @fusionacademy account to play."}</p>
  `;
  if (loadingScreen) loadingScreen.style.display = "none";
  if (comparisonScreen) comparisonScreen.style.display = "none";
  if (leaderboardSection) leaderboardSection.style.display = "none";
}

async function bootstrap(userCtx) {
  state.user = { ...state.user, ...(userCtx || {}) };
  setVersionBadge();
  wireEvents();
  await refreshItemsAndPair();
  activateTab("game");
}

FM.comparisonGame = {
  bootstrap,
  showUnauthorized
};
