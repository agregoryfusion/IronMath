// gam_stateCapitals.js - gameplay for the State Capitals sprint
const FM = (window.FastMath = window.FastMath || {});
const backend = FM.backendStateCapitals || {};

const questionEl = document.getElementById("question");
const answerInput = document.getElementById("answer");
const feedbackEl = document.getElementById("feedback");
const progressEl = document.getElementById("progress");
const actionBtn = document.getElementById("actionBtn");

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

const STATES = [
  { state: "Alabama", capital: "Montgomery" },
  { state: "Alaska", capital: "Juneau" },
  { state: "Arizona", capital: "Phoenix" },
  { state: "Arkansas", capital: "Little Rock" },
  { state: "California", capital: "Sacramento" },
  { state: "Colorado", capital: "Denver" },
  { state: "Connecticut", capital: "Hartford" },
  { state: "Delaware", capital: "Dover" },
  { state: "Florida", capital: "Tallahassee" },
  { state: "Georgia", capital: "Atlanta" },
  { state: "Hawaii", capital: "Honolulu" },
  { state: "Idaho", capital: "Boise" },
  { state: "Illinois", capital: "Springfield" },
  { state: "Indiana", capital: "Indianapolis" },
  { state: "Iowa", capital: "Des Moines" },
  { state: "Kansas", capital: "Topeka" },
  { state: "Kentucky", capital: "Frankfort" },
  { state: "Louisiana", capital: "Baton Rouge" },
  { state: "Maine", capital: "Augusta" },
  { state: "Maryland", capital: "Annapolis" },
  { state: "Massachusetts", capital: "Boston" },
  { state: "Michigan", capital: "Lansing" },
  { state: "Minnesota", capital: "Saint Paul" },
  { state: "Mississippi", capital: "Jackson" },
  { state: "Missouri", capital: "Jefferson City" },
  { state: "Montana", capital: "Helena" },
  { state: "Nebraska", capital: "Lincoln" },
  { state: "Nevada", capital: "Carson City" },
  { state: "New Hampshire", capital: "Concord" },
  { state: "New Jersey", capital: "Trenton" },
  { state: "New Mexico", capital: "Santa Fe" },
  { state: "New York", capital: "Albany" },
  { state: "North Carolina", capital: "Raleigh" },
  { state: "North Dakota", capital: "Bismarck" },
  { state: "Ohio", capital: "Columbus" },
  { state: "Oklahoma", capital: "Oklahoma City" },
  { state: "Oregon", capital: "Salem" },
  { state: "Pennsylvania", capital: "Harrisburg" },
  { state: "Rhode Island", capital: "Providence" },
  { state: "South Carolina", capital: "Columbia" },
  { state: "South Dakota", capital: "Pierre" },
  { state: "Tennessee", capital: "Nashville" },
  { state: "Texas", capital: "Austin" },
  { state: "Utah", capital: "Salt Lake City" },
  { state: "Vermont", capital: "Montpelier" },
  { state: "Virginia", capital: "Richmond" },
  { state: "Washington", capital: "Olympia" },
  { state: "West Virginia", capital: "Charleston" },
  { state: "Wisconsin", capital: "Madison" },
  { state: "Wyoming", capital: "Cheyenne" }
];

let pool = [];
let currentIndex = 0;
let startTime = null;
let questionStartTime = null;
let correctCount = 0;
let sessionId = null;
let questionLog = [];
let scopeFilter = "students";
let timeFilter = "monthly";

function sanitizeAnswer(input) {
  const cleaned = (input || "").replace(/[^a-zA-Z\\s\\-'.]/g, "");
  return cleaned.trim().replace(/\\s+/g, " ");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function setFeedback(text, success = false) {
  if (!feedbackEl) return;
  feedbackEl.textContent = text;
  feedbackEl.classList.remove("success", "error");
  feedbackEl.classList.add(success ? "success" : "error");
}

function updateProgress() {
  if (!progressEl) return;
  progressEl.textContent = `${currentIndex + 1} / ${pool.length} states`;
}

function showQuestion() {
  const entry = pool[currentIndex];
  if (!entry) return;
  questionEl.textContent = entry.state;
  answerInput.value = "";
  answerInput.focus();
  setFeedback("", true);
  questionStartTime = performance.now();
  updateProgress();
  updateActionLabel();
}

function startGame() {
  pool = shuffle([...STATES]);
  currentIndex = 0;
  startTime = performance.now();
  questionStartTime = performance.now();
  correctCount = 0;
  questionLog = [];
  sessionId = null;
  timeFilter = "monthly";
  scopeFilter = "students";

  if (loadingScreen) loadingScreen.style.display = "none";
  if (emperorScreen) emperorScreen.style.display = "none";
  if (endScreen) endScreen.style.display = "none";
  if (gameContainer) gameContainer.style.display = "block";

  showQuestion();
}

async function saveResults(totalTimeSec) {
  const auth = FM.auth || {};
  const userId = backend.safeUserId ? backend.safeUserId(window.currentUserId) : null;
  const sessionPayload = {
    player_name: auth.playerName || "Player",
    user_id: userId,
    states_correct: correctCount,
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
      state_name: q.state,
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
      states_correct: correctCount,
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

function finishGame() {
  const totalTimeSec = (performance.now() - startTime) / 1000;
  if (gameContainer) gameContainer.style.display = "none";
  if (endScreen) endScreen.style.display = "block";
  if (endQuestions) endQuestions.textContent = `States correct: ${correctCount} / ${pool.length}`;
  if (endTime) endTime.textContent = `Total time: ${totalTimeSec.toFixed(2)} s`;
  savedStatus.textContent = "Saving...";
  savedStatus.classList.remove("success", "error");
  sessionIdEl.textContent = "";

  saveResults(totalTimeSec);
  backend.loadLeaderboard(scopeFilter, timeFilter, true);
}

function recordAnswer(answer, skipped = false) {
  const entry = pool[currentIndex];
  if (!entry) return;
  const elapsed = (performance.now() - questionStartTime) / 1000;
  const sanitizedAnswer = sanitizeAnswer(answer);
  const normalizedCapital = sanitizeAnswer(entry.capital);
  const isSkip = skipped || !sanitizedAnswer;
  const correct = !isSkip && sanitizedAnswer.toLowerCase() === normalizedCapital.toLowerCase();

  if (correct) correctCount += 1;

  questionLog.push({
    state: entry.state,
    capital: entry.capital,
    answer: isSkip ? "SKIP" : sanitizedAnswer,
    correct,
    skipped: isSkip,
    timeTaken: elapsed
  });

  setFeedback(correct ? "Correct!" : `Incorrect. Capital is ${entry.capital}.`, correct);

  currentIndex += 1;
  if (currentIndex >= pool.length) {
    finishGame();
  } else {
    showQuestion();
  }
}

function handleSubmit() {
  const trimmed = (answerInput?.value || "").trim();
  if (!answerInput) return;
  recordAnswer(trimmed, false);
}

function handleSkip() {
  recordAnswer("SKIP", true);
}

function showLeaderboardOnly() {
  if (loadingScreen) loadingScreen.style.display = "none";
  if (emperorScreen) emperorScreen.style.display = "none";
  if (gameContainer) gameContainer.style.display = "none";
  if (endScreen) endScreen.style.display = "block";
  backend.loadLeaderboard(scopeFilter, timeFilter, true);
}

function updateActionLabel() {
  if (!actionBtn || !answerInput) return;
  const hasText = answerInput.value.trim().length > 0;
  actionBtn.textContent = hasText ? "Submit" : "Skip";
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
    if (FM.ui && typeof FM.ui.showEmperor === "function") {
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
}

bindEvents();

FM.stateCapitalsGame = {
  startGame,
  showLeaderboardOnly
};
