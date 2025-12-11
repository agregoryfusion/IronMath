// gam_worldCapitals.js - gameplay for World Capitals grouped by continent
const FM = (window.FastMath = window.FastMath || {});
const backend = FM.backendWorldCapitals || {};

const questionEl = document.getElementById("question");
const answerInput = document.getElementById("answer");
const feedbackEl = document.getElementById("feedback");
const progressEl = document.getElementById("progress");
const actionBtn = document.getElementById("actionBtn");
const giveUpBtn = document.getElementById("giveUpBtn");
const continentLabel = document.getElementById("continentLabel");

const loadingScreen = document.getElementById("loading-screen");
const emperorScreen = document.getElementById("emperor-screen");
const gameContainer = document.getElementById("game-container");
const endScreen = document.getElementById("end-screen");

const endQuestions = document.getElementById("end-questions");
const endTime = document.getElementById("end-time");
const sessionIdEl = document.getElementById("session-id");
const savedStatus = document.getElementById("saved-status");
const restartBtn = document.getElementById("restartBtn");

const lbMonthlyBtn = document.getElementById("lbMonthlyBtn");
const lbAllTimeBtn = document.getElementById("lbAllTimeBtn");
const viewAllBtn = document.getElementById("viewAllBtn");
const viewStudentsBtn = document.getElementById("viewStudentsBtn");
const viewTeachersBtn = document.getElementById("viewTeachersBtn");

let dataset = [];
let continentOrder = [];
let currentContinentIdx = 0;
let currentCountryIdx = 0;
let totalQuestions = 0;
let questionsAsked = 0; // tracks how many questions were actually asked/logged
let startTime = null;
let questionStartTime = null;
let correctCount = 0;
let sessionId = null;
let questionLog = [];
let scopeFilter = "students";
let timeFilter = "monthly";
let leaderboardOnlyMode = false;
let gameActive = false;
let currentQuestion = null;
let askedCount = 0;

function sanitizeAnswer(input) {
  const cleaned = (input || "").replace(/[^a-zA-Z\s.'-]/g, "");
  return cleaned.trim().replace(/\s+/g, " ");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function loadCsv() {
  if (dataset.length > 0) return dataset;
  const res = await fetch("countries_capitals_continents.csv");
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rows = lines.slice(1); // skip header
  const byContinent = {};
  rows.forEach((line) => {
    const parts = line.split(",");
    if (parts.length < 3) return;
    const country = parts[0].trim();
    const capital = parts[1].trim();
    const cont = parts[2].trim();
    if (!country || !capital || !cont) return;
    if (!byContinent[cont]) byContinent[cont] = [];
    byContinent[cont].push({ country, capital, continent: cont });
  });
  dataset = Object.entries(byContinent).map(([name, list]) => ({ name, countries: list }));
  return dataset;
}

function setFeedback(text, success = false) {
  if (!feedbackEl) return;
  feedbackEl.textContent = text;
  feedbackEl.classList.remove("success", "error");
  if (text) {
    feedbackEl.classList.add(success ? "success" : "error");
  }
}

function updateProgress() {
  if (!progressEl) return;
  const total = Math.max(totalQuestions, 1);
  progressEl.textContent = `${askedCount} / ${total} countries`;
}

function updateActionLabel() {
  if (!actionBtn || !answerInput) return;
  const hasText = answerInput.value.trim().length > 0;
  actionBtn.textContent = hasText ? "Submit" : "Skip";
}

function buildOrder() {
  const conts = dataset.map((c) => ({
    name: c.name,
    countries: shuffle([...c.countries])
  }));
  continentOrder = shuffle(conts);
  totalQuestions = continentOrder.reduce((sum, c) => sum + c.countries.length, 0);
  currentContinentIdx = 0;
  currentCountryIdx = 0;
}

function nextAvailableQuestion() {
  while (currentContinentIdx < continentOrder.length) {
    const cont = continentOrder[currentContinentIdx];
    if (currentCountryIdx < cont.countries.length) {
      return cont.countries[currentCountryIdx];
    }
    currentContinentIdx += 1;
    currentCountryIdx = 0;
  }
  return null;
}

function showQuestion() {
  currentQuestion = nextAvailableQuestion();
  if (!currentQuestion) {
    finishGame();
    return;
  }
  questionsAsked = askedCount;
  questionEl.textContent = currentQuestion.country;
  if (continentLabel) continentLabel.textContent = currentQuestion.continent;
  answerInput.value = "";
  answerInput.focus();
  setFeedback("", true);
  questionStartTime = performance.now();
  updateProgress();
  updateActionLabel();
}

function remainingQuestions() {
  let rem = 0;
  if (currentContinentIdx >= continentOrder.length) return rem;
  const cont = continentOrder[currentContinentIdx];
  rem += (cont.countries.length - currentCountryIdx - 1);
  for (let i = currentContinentIdx + 1; i < continentOrder.length; i++) {
    rem += continentOrder[i].countries.length;
  }
  return rem;
}

function startGame() {
  loadCsv()
    .then(() => {
      buildOrder();
      questionsAsked = 0;
      currentQuestion = null;
      startTime = performance.now();
      questionStartTime = performance.now();
      correctCount = 0;
      questionLog = [];
      sessionId = null;
      timeFilter = "monthly";
      scopeFilter = "students";
      leaderboardOnlyMode = false;
      gameActive = true;
      askedCount = 0;
      endScreen?.classList.remove("leaderboard-only");

      if (loadingScreen) loadingScreen.style.display = "none";
      if (emperorScreen) emperorScreen.style.display = "none";
      if (endScreen) endScreen.style.display = "none";
      if (gameContainer) gameContainer.style.display = "block";

      showQuestion();
    })
    .catch((err) => {
      console.error("Failed to load countries CSV", err);
      setFeedback("Could not load countries list.", false);
    });
}

async function saveResults(totalTimeSec) {
  const auth = FM.auth || {};
  const userId = backend.safeUserId ? backend.safeUserId(window.currentUserId) : null;
  const sessionPayload = {
    player_name: auth.playerName || "Player",
    user_id: userId,
    countries_correct: correctCount,
    total_time_seconds: totalTimeSec,
    is_teacher: auth.isTeacher,
    is_student: auth.isStudent,
    version_number: FM.GAME_VERSION
  };

  try {
    const sessionRow = await backend.insertSessionRow(sessionPayload);
    sessionId = sessionRow?.session_id || null;
    sessionIdEl.textContent = sessionId ? `Session ID: ${sessionId}` : "";

    const rows = questionLog.map((q, idx) => ({
      session_id: sessionId,
      question_number: idx + 1,
      country_name: q.country,
      continent: q.continent,
      expected_capital: q.capital,
      player_answer: q.answer,
      is_correct: q.correct,
      time_taken: q.timeTaken,
      skipped: q.skipped,
      player_name: auth.playerName || "Player",
      version_number: FM.GAME_VERSION
    }));

    if (rows.length) {
      await backend.insertQuestionRows(rows);
    }

    await backend.insertLeaderboardRow({
      player_name: auth.playerName || "Player",
      countries_correct: correctCount,
      total_time_seconds: totalTimeSec,
      is_teacher: auth.isTeacher,
      is_student: auth.isStudent,
      version_number: FM.GAME_VERSION,
      user_id: userId
    });

    savedStatus.textContent = "Session saved!";
    savedStatus.classList.add("success");
  } catch (err) {
    console.error("Save failed", err);
    savedStatus.textContent = "Could not save to leaderboard.";
    savedStatus.classList.add("error");
  }
}

function finishGame(options = {}) {
  if (!gameActive) return;
  gameActive = false;
  const totalTimeSec = (performance.now() - startTime) / 1000;
  if (gameContainer) gameContainer.style.display = "none";
  if (endScreen) endScreen.style.display = "block";
  if (restartBtn) restartBtn.textContent = "Play Again";
  const answeredCount = questionLog.length;
  const plannedTotal = totalQuestions || answeredCount;
  const displayTotal = options.skippedContinent ? answeredCount : plannedTotal;
  const stoppedLabel = options.skippedContinent ? " (some continents skipped)" : "";
  if (endQuestions) endQuestions.textContent = `Countries correct: ${correctCount} / ${displayTotal}${stoppedLabel}`;
  if (endTime) endTime.textContent = `Total time: ${totalTimeSec.toFixed(2)} s`;
  savedStatus.textContent = "Saving...";
  savedStatus.classList.remove("success", "error");
  sessionIdEl.textContent = "";

  saveResults(totalTimeSec);
  backend.loadLeaderboard(scopeFilter, timeFilter, true);
}

function recordAnswer(answer, skipped = false) {
  if (!gameActive) return;
  if (!currentQuestion) return;
  const elapsed = (performance.now() - questionStartTime) / 1000;
  const sanitizedAnswer = sanitizeAnswer(answer);
  const normalizedCapital = sanitizeAnswer(currentQuestion.capital);
  const isSkip = skipped || !sanitizedAnswer;
  const correct = !isSkip && sanitizedAnswer.toLowerCase() === normalizedCapital.toLowerCase();

  if (correct) correctCount += 1;

  questionLog.push({
    country: currentQuestion.country,
    capital: currentQuestion.capital,
    continent: currentQuestion.continent,
    answer: isSkip ? "SKIP" : sanitizedAnswer,
    correct,
    skipped: isSkip,
    timeTaken: elapsed
  });

  askedCount += 1;

  setFeedback(correct ? "Correct!" : isSkip ? "Skipped." : `Incorrect. Capital is ${currentQuestion.capital}.`, correct);

  currentCountryIdx += 1;
  if (currentCountryIdx >= continentOrder[currentContinentIdx].countries.length) {
    currentContinentIdx += 1;
    currentCountryIdx = 0;
  }
}

function handleSubmit() {
  const trimmed = (answerInput?.value || "").trim();
  if (!answerInput) return;
  recordAnswer(trimmed, false);
  showQuestion();
}

function handleSkip() {
  recordAnswer("SKIP", true);
  showQuestion();
}

function skipContinent() {
  if (!gameActive || !currentQuestion) return;
  const cont = continentOrder[currentContinentIdx];
  const remainingAfterCurrent = Math.max(0, cont.countries.length - currentCountryIdx - 1);
  recordAnswer("SKIP", true);
  totalQuestions = Math.max(askedCount, totalQuestions - remainingAfterCurrent);
  currentContinentIdx += 1;
  currentCountryIdx = 0;
  if (!nextAvailableQuestion()) return finishGame({ skippedContinent: true });
  showQuestion();
}

function showLeaderboardOnly() {
  gameActive = false;
  if (loadingScreen) loadingScreen.style.display = "none";
  if (emperorScreen) emperorScreen.style.display = "none";
  if (gameContainer) gameContainer.style.display = "none";
  if (endScreen) {
    endScreen.classList.add("leaderboard-only");
    endScreen.style.display = "block";
  }

  leaderboardOnlyMode = true;
  if (restartBtn) restartBtn.textContent = "Play";
  scopeFilter = "all";
  viewAllBtn?.classList.add("active");
  viewStudentsBtn?.classList.remove("active");
  viewTeachersBtn?.classList.remove("active");

  backend.loadLeaderboard(scopeFilter, timeFilter, true);
}

function handleAction() {
  const value = (answerInput?.value || "").trim();
  if (!value) {
    handleSkip();
  } else {
    handleSubmit();
  }
}

function bindEvents() {
  if (actionBtn) actionBtn.addEventListener("click", handleAction);
  if (answerInput) {
    answerInput.addEventListener("input", updateActionLabel);
    answerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAction();
      }
    });
  }
  if (restartBtn) restartBtn.addEventListener("click", () => {
    if (leaderboardOnlyMode) {
      leaderboardOnlyMode = false;
      startGame();
    } else if (FM.ui && typeof FM.ui.showEmperor === "function") {
      FM.ui.showEmperor();
    }
  });

  if (lbMonthlyBtn) lbMonthlyBtn.addEventListener("click", () => {
    lbMonthlyBtn.classList.add("active");
    lbAllTimeBtn?.classList.remove("active");
    timeFilter = "monthly";
    backend.loadLeaderboard(scopeFilter, timeFilter, true);
  });
  if (lbAllTimeBtn) lbAllTimeBtn.addEventListener("click", () => {
    lbAllTimeBtn.classList.add("active");
    lbMonthlyBtn?.classList.remove("active");
    timeFilter = "alltime";
    backend.loadLeaderboard(scopeFilter, timeFilter, true);
  });

  if (viewAllBtn) viewAllBtn.addEventListener("click", () => {
    viewAllBtn.classList.add("active");
    viewStudentsBtn?.classList.remove("active");
    viewTeachersBtn?.classList.remove("active");
    scopeFilter = "all";
    backend.loadLeaderboard(scopeFilter, timeFilter, true);
  });
  if (viewStudentsBtn) viewStudentsBtn.addEventListener("click", () => {
    viewStudentsBtn.classList.add("active");
    viewAllBtn?.classList.remove("active");
    viewTeachersBtn?.classList.remove("active");
    scopeFilter = "students";
    backend.loadLeaderboard(scopeFilter, timeFilter, true);
  });
  if (viewTeachersBtn) viewTeachersBtn.addEventListener("click", () => {
    viewTeachersBtn.classList.add("active");
    viewStudentsBtn?.classList.remove("active");
    viewAllBtn?.classList.remove("active");
    scopeFilter = "teachers";
    backend.loadLeaderboard(scopeFilter, timeFilter, true);
  });

  if (giveUpBtn) giveUpBtn.addEventListener("click", skipContinent);
}

bindEvents();

FM.worldCapitalsGame = {
  startGame,
  showLeaderboardOnly
};
