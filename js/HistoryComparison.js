// HistoryComparison.js - timeline-focused comparison game (Game ID 2)
import "./utils.js";
import "./backend_Comparisoning.js";

const FM = (window.FastMath = window.FastMath || {});
const backend = FM.backendComparisoning || {};

const GAME_ID = 2;
const DEBUG_CAPS_FEATURE = true; // dev-only extras (show active pair + predictions)
const VOTE_COOLDOWN_MS = 2000;

const loadingScreen = document.getElementById("loading-screen");
const comparisonScreen = document.getElementById("comparison-screen");
const timelineSection = document.getElementById("timeline-section");
const timelineTrack = document.getElementById("timelineTrack");
const timelineMarkers = document.getElementById("timelineMarkers");
const timelineStatus = document.getElementById("timelineStatus");
const unauthorizedScreen = document.getElementById("unauthorized-screen");
const versionBadge = document.getElementById("version");

const leftName = document.getElementById("leftName");
const rightName = document.getElementById("rightName");
const leftVoteBtn = document.getElementById("leftVoteBtn");
const rightVoteBtn = document.getElementById("rightVoteBtn");

const state = {
  items: [],
  currentPair: null,
  lastPairIds: [],
  markerEls: [],
  activeIdx: -1,
  timelineRows: [],
  isCaps: false,
  predictionEl: null,
  user: { userId: null, playerName: "Player" }
};
let lastVoteAt = 0;

if (comparisonScreen) comparisonScreen.style.display = "none";
showLoading();

function setStatus(msg, isError = false) {
  if (!timelineStatus) return;
  timelineStatus.textContent = msg;
  timelineStatus.classList.toggle("error-text", !!isError);
}

function showLoading() {
  if (loadingScreen) loadingScreen.style.display = "flex";
  if (comparisonScreen) comparisonScreen.style.display = "none";
  if (timelineSection) timelineSection.style.display = "none";
}

function showGame() {
  if (loadingScreen) loadingScreen.style.display = "none";
  if (comparisonScreen) comparisonScreen.style.display = "block";
  if (timelineSection) timelineSection.style.display = "block";
}

function setVersionBadge() {
  if (versionBadge && FM.GAME_VERSION) versionBadge.textContent = "v" + FM.GAME_VERSION;
}

function renderPair(pair) {
  if (!pair || pair.length < 2) {
    setStatus("Not enough events to compare yet.", true);
    return;
  }
  const [a, b] = pair;
  if (leftName) leftName.textContent = a.name;
  if (rightName) rightName.textContent = b.name;
  if (leftVoteBtn) leftVoteBtn.textContent = `${a.name} was earlier`;
  if (rightVoteBtn) rightVoteBtn.textContent = `${b.name} was earlier`;
  setStatus("Pick which event happened first.");
}

function disableVoteButtons(disabled) {
  [leftVoteBtn, rightVoteBtn].forEach((btn) => { if (btn) btn.disabled = disabled; });
}

function applyRatingUpdate(itemId, newRating) {
  const target = state.items.find((i) => i.id === itemId);
  if (target && Number.isFinite(newRating)) target.rating = Number(newRating);
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
    await renderTimeline();
    showGame();
  } catch (err) {
    console.error(err);
    setStatus("Could not load events. Please try again.", true);
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
    setStatus(`${winner.name} moved ${delta} pts earlier on the timeline.`);
    choosePair();
    await renderTimeline();
  } catch (err) {
    console.error(err);
    setStatus("Vote failed. Please try again.", true);
  } finally {
    disableVoteButtons(false);
  }
}

async function renderTimeline() {
  if (!timelineMarkers) return;
  timelineMarkers.innerHTML = "";
  state.markerEls = [];
  state.activeIdx = -1;
  state.timelineRows = [];
  if (timelineStatus) timelineStatus.textContent = "Building timeline…";
  try {
    const rowsDesc = await backend.fetchLeaderboard(GAME_ID, 300);
    let rows = (rowsDesc || []).slice();
    const activeIds = Array.isArray(state.currentPair) ? state.currentPair.map(p => p?.id).filter(Boolean) : [];
    const includeActive = DEBUG_CAPS_FEATURE && state.isCaps;
    if (activeIds.length && !includeActive) {
      rows = rows.filter(r => !activeIds.includes(r.id));
    }
    rows = rows.sort((a,b)=>b.rating - a.rating);
    if (!rows || rows.length === 0) {
      if (timelineStatus) timelineStatus.textContent = "No votes yet.";
      return;
    }
    state.timelineRows = rows;

    const ratingVals = rows.map(r => Number(r.rating ?? 0));
    const minR = Math.min(...ratingVals);
    const maxR = Math.max(...ratingVals);
    const span = Math.max(1, maxR - minR);

    rows.forEach((row, idx) => {
      // Map linearly: min rating at far left, max rating at far right
      const pct = ((maxR - row.rating) / span) * 92 + 4;
      const marker = document.createElement("div");
      const pairClass = includeActive && activeIds.includes(row.id) ? " pair-marker" : "";
      marker.className = "timeline-marker " + (idx % 2 === 0 ? "above" : "below") + pairClass;
      marker.style.left = `${pct}%`;
      marker.setAttribute("tabindex", "0");
      marker.dataset.idx = String(idx);

      const stem = document.createElement("div");
      stem.className = "stem";
      const dot = document.createElement("div");
      dot.className = "dot";
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = row.name;

      marker.appendChild(stem);
      marker.appendChild(dot);
      marker.appendChild(label);
      timelineMarkers.appendChild(marker);
      state.markerEls.push(marker);
      marker.addEventListener("mouseenter", () => setActiveMarker(idx));
      marker.addEventListener("focus", () => setActiveMarker(idx));
    });
    if (timelineStatus) timelineStatus.textContent = "Left = earlier (lower Elo), Right = later (higher Elo)";
  } catch (err) {
    console.error(err);
    if (timelineStatus) timelineStatus.textContent = "Could not load timeline.";
  }
}

function setActiveMarker(idx) {
  if (!state.markerEls.length) return;
  state.markerEls.forEach(el => el.classList.remove("active-marker"));
  state.markerEls.forEach(el => el.blur && el.blur());
  if (idx < 0 || idx >= state.markerEls.length) {
    state.activeIdx = -1;
    return;
  }
  state.markerEls[idx].classList.add("active-marker");
  state.activeIdx = idx;
}

function cycleActiveMarker(delta) {
  if (!state.markerEls.length) return;
  const len = state.markerEls.length;
  let next = state.activeIdx;
  if (next === -1) next = 0;
  else next = (next + delta + len) % len;
  setActiveMarker(next);
}

function clearPrediction() {
  if (state.predictionEl && state.predictionEl.remove) state.predictionEl.remove();
  state.predictionEl = null;
}

function simulateWin(winner, loser) {
  if (!winner || !loser) return { winnerRating: winner?.rating, loserRating: loser?.rating };
  const v_k_base = 24;
  const v_max_gap = 400;
  const v_max_delta = 25;

  let wRating = winner.rating ?? 1000;
  let lRating = loser.rating ?? 1000;
  const wMatches = winner.matches ?? 0;
  const lMatches = loser.matches ?? 0;

  const w_expected = 1 / (1 + Math.pow(10, (lRating - wRating) / 400));
  const rating_gap = Math.abs(wRating - lRating);
  let kBase = v_k_base;
  if (rating_gap > v_max_gap) kBase = kBase * (v_max_gap / rating_gap);

  let k_match_factor = 1 / (1 + ((wMatches + lMatches) / 2) / 20);
  let k_year_factor = 1;
  if (winner.event_year != null && loser.event_year != null) {
    k_year_factor = 1 / (1 + (Math.abs(winner.event_year - loser.event_year) / 50));
  }

  let w_delta = kBase * k_match_factor * k_year_factor * (1 - w_expected);
  w_delta = Math.max(-v_max_delta, Math.min(v_max_delta, w_delta));

  const w_new = wRating + w_delta;
  return { winnerRating: w_new };
}

function showPrediction(winnerId, loserId) {
  clearPrediction();
  if (!DEBUG_CAPS_FEATURE || !state.isCaps) return;
  const rows = state.timelineRows;
  if (!rows || !rows.length) return;
  const winner = state.items.find(i => i.id === winnerId);
  const loser = state.items.find(i => i.id === loserId);
  if (!winner || !loser) return;
  const { winnerRating } = simulateWin(winner, loser);
  if (!Number.isFinite(winnerRating)) return;

  const ratings = rows.map(r => Number(r.id === winnerId ? winnerRating : r.rating ?? 1000));
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const span = Math.max(1, maxR - minR);
  const pct = ((maxR - winnerRating) / span) * 92 + 4;

  const marker = document.createElement("div");
  marker.className = "timeline-marker prediction above";
  marker.style.left = `${pct}%`;
  marker.setAttribute("tabindex", "-1");

  const stem = document.createElement("div");
  stem.className = "stem";
  const dot = document.createElement("div");
  dot.className = "dot";
  const label = document.createElement("div");
  label.className = "label";
  label.textContent = `${winner.name} (after vote)`;

  marker.appendChild(stem);
  marker.appendChild(dot);
  marker.appendChild(label);
  timelineMarkers.appendChild(marker);
  state.predictionEl = marker;
}

function wireEvents() {
  if (leftVoteBtn) leftVoteBtn.addEventListener("click", () => handleVote("left"));
  if (rightVoteBtn) rightVoteBtn.addEventListener("click", () => handleVote("right"));

  if (leftVoteBtn) {
    leftVoteBtn.addEventListener("mouseenter", () => {
      if (DEBUG_CAPS_FEATURE && state.isCaps && state.currentPair) {
        showPrediction(state.currentPair[0]?.id, state.currentPair[1]?.id);
      }
    });
    leftVoteBtn.addEventListener("mouseleave", clearPrediction);
  }
  if (rightVoteBtn) {
    rightVoteBtn.addEventListener("mouseenter", () => {
      if (DEBUG_CAPS_FEATURE && state.isCaps && state.currentPair) {
        showPrediction(state.currentPair[1]?.id, state.currentPair[0]?.id);
      }
    });
    rightVoteBtn.addEventListener("mouseleave", clearPrediction);
  }

  if (timelineMarkers) {
    timelineMarkers.addEventListener("mouseleave", () => setActiveMarker(-1));
    timelineMarkers.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1; // scroll up moves right (forward)
      setActiveMarker(state.activeIdx);
      cycleActiveMarker(delta);
    }, { passive: false });
  }
  if (timelineTrack) {
    timelineTrack.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1; // scroll up moves right (forward)
      setActiveMarker(state.activeIdx);
      cycleActiveMarker(delta);
    }, { passive: false });
  }

  if (DEBUG_CAPS_FEATURE) {
    const capsHandler = (e) => {
      const caps = e.getModifierState && e.getModifierState("CapsLock");
      if (caps !== state.isCaps) {
        state.isCaps = caps;
        clearPrediction();
        renderTimeline();
      }
    };
    window.addEventListener("keydown", capsHandler);
    window.addEventListener("keyup", capsHandler);
    window.addEventListener("blur", () => { state.isCaps = false; clearPrediction(); renderTimeline(); });
  }
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
  if (timelineSection) timelineSection.style.display = "none";
}

async function bootstrap(userCtx) {
  state.user = { ...state.user, ...(userCtx || {}) };
  setVersionBadge();
  wireEvents();
  await refreshItemsAndPair();
}

FM.historyComparisonGame = {
  bootstrap,
  showUnauthorized
};
