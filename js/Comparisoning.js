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
const submitItemBtn = document.getElementById("submitItemBtn");
const submitLockoutMsg = document.getElementById("submitLockoutMsg");
const submissionOverlay = document.getElementById("submissionOverlay");
const submissionInput = document.getElementById("submissionInput");
const submissionError = document.getElementById("submissionError");
const submissionSuccess = document.getElementById("submissionSuccess");
const submissionCancelBtn = document.getElementById("submissionCancelBtn");
const submissionConfirmBtn = document.getElementById("submissionConfirmBtn");

const SIMILARITY_THRESHOLD = 0.25;
const MAX_SUBMISSION_LENGTH = 60;
const VOTE_COOLDOWN_MS = 2000;

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
  },
  submission: {
    canSubmit: false,
    hasChecked: false,
    weekStart: null,
    weekEnd: null,
    voteCount: 0,
    submissionCount: 0,
    maxAllowed: 1,
    votesToNext: 0,
    items: [],
    isOpen: false
  }
};
let lastVoteAt = 0;

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

function clearSubmissionFeedback() {
  if (submissionError) submissionError.textContent = "";
  if (submissionSuccess) submissionSuccess.textContent = "";
}

function setSubmissionError(msg) {
  if (submissionError) submissionError.textContent = msg || "";
  if (submissionSuccess) submissionSuccess.textContent = "";
}

function setSubmissionSuccess(msg) {
  if (submissionSuccess) submissionSuccess.textContent = msg || "";
  if (submissionError) submissionError.textContent = "";
}

function getWeekBounds(dateObj = new Date()) {
  const base = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const day = base.getDay(); // 0 = Sunday
  const start = new Date(base);
  start.setDate(base.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function normalizeSubmissionText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function damerauLevenshtein(a, b) {
  const s = a || "";
  const t = b || "";
  const sLen = s.length;
  const tLen = t.length;
  if (sLen === 0) return tLen;
  if (tLen === 0) return sLen;

  const dp = Array.from({ length: sLen + 1 }, () => new Array(tLen + 1).fill(0));
  for (let i = 0; i <= sLen; i += 1) dp[i][0] = i;
  for (let j = 0; j <= tLen; j += 1) dp[0][j] = j;

  for (let i = 1; i <= sLen; i += 1) {
    for (let j = 1; j <= tLen; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let best = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        best = Math.min(best, dp[i - 2][j - 2] + cost);
      }
      dp[i][j] = best;
    }
  }
  return dp[sLen][tLen];
}

function findSimilarItem(candidate, items = []) {
  const normalized = normalizeSubmissionText(candidate);
  if (!normalized) return null;
  let bestScore = Infinity;
  let bestItem = null;

  items.forEach((item) => {
    const nameNorm = item.normalizedName || normalizeSubmissionText(item.name);
    if (!nameNorm) return;
    const dist = damerauLevenshtein(normalized, nameNorm);
    const score = dist / Math.max(normalized.length, nameNorm.length, 1);
    if (score < bestScore) {
      bestScore = score;
      bestItem = item;
    }
  });

  if (bestItem && bestScore <= SIMILARITY_THRESHOLD) {
    return { item: bestItem, score: bestScore };
  }
  return null;
}

function setSubmissionControlsDisabled(disabled) {
  if (submissionInput) submissionInput.disabled = disabled;
  if (submissionConfirmBtn) submissionConfirmBtn.disabled = disabled;
  if (submissionCancelBtn) submissionCancelBtn.disabled = disabled;
}

function toggleSubmissionOverlay(show) {
  state.submission.isOpen = !!show;
  if (submissionOverlay) submissionOverlay.style.display = show ? "flex" : "none";
  if (show) {
    clearSubmissionFeedback();
    if (submissionInput) {
      submissionInput.value = "";
      submissionInput.focus();
    }
  }
}

function prepareSubmissionItems(rows = []) {
  return rows.map((row) => ({
    ...row,
    normalizedName: normalizeSubmissionText(row.name)
  }));
}

function recomputeSubmissionAllowance() {
  const voteCount = Number(state.submission.voteCount || 0);
  const submissionCount = Number(state.submission.submissionCount || 0);
  const maxAllowed = Math.floor(voteCount / 100) + 1;
  state.submission.maxAllowed = maxAllowed;
  state.submission.canSubmit = submissionCount < maxAllowed;
  state.submission.votesToNext = Math.max(0, maxAllowed * 100 - voteCount);
  if (submitItemBtn) {
    submitItemBtn.style.display = state.submission.canSubmit ? "inline-flex" : "none";
  }
}

async function ensureSubmissionItemsLoaded() {
  if (state.submission.items && state.submission.items.length) return;
  if (!backend.fetchSubmissionItems) return;
  const rows = await backend.fetchSubmissionItems(GAME_ID);
  state.submission.items = prepareSubmissionItems(rows || []);
}

function updateSubmissionLockout() {
  if (!submitLockoutMsg) return;
  if (state.submission.canSubmit) {
    submitLockoutMsg.textContent = "";
    submitLockoutMsg.style.display = "none";
    return;
  }
  const remaining = state.submission.votesToNext;
  if (Number.isFinite(remaining) && remaining > 0) {
    const needed = Math.max(1, Math.ceil(remaining));
    submitLockoutMsg.textContent = `You can earn another submission by voting ${needed} more times.`;
    submitLockoutMsg.style.display = "block";
    return;
  }
  submitLockoutMsg.textContent = "You can earn another submission by voting more.";
  submitLockoutMsg.style.display = "block";
}

async function refreshSubmissionEligibility() {
  if (!submitItemBtn || !backend.fetchWeeklyVoteCount || !backend.fetchWeeklySubmissionCount) return;
  const { start, end } = getWeekBounds();
  state.submission.weekStart = start;
  state.submission.weekEnd = end;
  try {
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const [voteCount, submissionCount] = await Promise.all([
      backend.fetchWeeklyVoteCount({
        playerName: state.user.playerName,
        gameId: GAME_ID,
        startIso,
        endIso
      }),
      backend.fetchWeeklySubmissionCount({
        playerName: state.user.playerName,
        gameId: GAME_ID,
        startIso,
        endIso
      })
    ]);

    state.submission.voteCount = voteCount || 0;
    state.submission.submissionCount = submissionCount || 0;
    recomputeSubmissionAllowance();
  } catch (err) {
    console.error(err);
    submitItemBtn.style.display = "none";
  } finally {
    updateSubmissionLockout();
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

function isSubmittedByPlayer(item, playerName) {
  if (!item || !playerName) return false;
  const submitted = String(item.submittedBy || "").trim().toLowerCase();
  const player = String(playerName || "").trim().toLowerCase();
  if (!submitted || !player) return false;
  return submitted === player;
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
    const rows = await backend.loadItems(GAME_ID);
    state.items = (rows || []).filter((item) => !isSubmittedByPlayer(item, state.user.playerName));
    choosePair();
    showGame();
  } catch (err) {
    console.error(err);
    setStatus("Could not load items. Please try again.", true);
  }
}

async function openSubmissionOverlay() {
  if (!state.submission.canSubmit) return;
  toggleSubmissionOverlay(true);
  try {
    await ensureSubmissionItemsLoaded();
  } catch (err) {
    console.error(err);
    setSubmissionError("Could not load existing items. Please try again.");
  }
}

async function handleSubmissionConfirm() {
  clearSubmissionFeedback();
  if (!state.submission.canSubmit) {
    setSubmissionError("You already submitted an item this week.");
    return;
  }

  const rawValue = submissionInput ? submissionInput.value : "";
  const name = String(rawValue || "").trim();

  if (!name) {
    setSubmissionError("Please enter an item name.");
    return;
  }
  if (name.length > MAX_SUBMISSION_LENGTH) {
    setSubmissionError(`Please keep it under ${MAX_SUBMISSION_LENGTH} characters.`);
    return;
  }

  setSubmissionControlsDisabled(true);
  try {
    await ensureSubmissionItemsLoaded();
    const similar = findSimilarItem(name, state.submission.items);
    if (similar) {
      setSubmissionError(`That is too similar to an existing item: ${similar.item.name}. If you think this is a mistake, come talk to Alex.`);
      return;
    }

    const newItem = await backend.submitComparisonItem({
      name,
      submittedBy: state.user.playerName,
      gameId: GAME_ID
    });

    state.submission.items.unshift({
      ...newItem,
      normalizedName: normalizeSubmissionText(newItem.name)
    });

    setSubmissionSuccess("Submitted! Your item will appear once approved.");
    state.submission.submissionCount = (state.submission.submissionCount || 0) + 1;
    recomputeSubmissionAllowance();
    updateSubmissionLockout();

    setTimeout(() => toggleSubmissionOverlay(false), 900);
  } catch (err) {
    console.error(err);
    const isDuplicate = err && err.code === "23505";
    const isLimit = err && String(err.message || "").toLowerCase().includes("submission limit");
    if (isLimit) {
      setSubmissionError("You have no submissions left this week. Vote more to earn another submission.");
    } else {
      setSubmissionError(isDuplicate ? "That item already exists." : "Could not submit item. Please try again.");
    }
  } finally {
    setSubmissionControlsDisabled(false);
  }
}

async function handleVote(side = "left") {
  const now = Date.now();
  if (now - lastVoteAt < VOTE_COOLDOWN_MS) {
    setStatus("Slow down and atleast read each option", true);
    return;
  }
  lastVoteAt = now;
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
    state.submission.voteCount = Number(state.submission.voteCount || 0) + 1;
    recomputeSubmissionAllowance();
    updateSubmissionLockout();
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
  if (state.submission.isOpen) toggleSubmissionOverlay(false);
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

  if (submitItemBtn) submitItemBtn.addEventListener("click", openSubmissionOverlay);
  if (submissionCancelBtn) submissionCancelBtn.addEventListener("click", () => toggleSubmissionOverlay(false));
  if (submissionConfirmBtn) submissionConfirmBtn.addEventListener("click", handleSubmissionConfirm);
  if (submissionOverlay) {
    submissionOverlay.addEventListener("click", (e) => {
      if (e.target === submissionOverlay) toggleSubmissionOverlay(false);
    });
  }
  if (submissionInput) {
    submissionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmissionConfirm();
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.submission.isOpen) {
      toggleSubmissionOverlay(false);
    }
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
  await refreshSubmissionEligibility();
  activateTab("game");
}

FM.comparisonGame = {
  bootstrap,
  showUnauthorized
};
