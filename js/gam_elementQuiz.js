// gam_elementQuiz.js - gameplay for Periodic Sprint (symbols + atomic numbers)
const FM = (window.FastMath = window.FastMath || {});
const backend = FM.backendElementQuiz || {};

const questionEl = document.getElementById("question");
const answerSymbol = document.getElementById("answerSymbol");
const answerNumber = document.getElementById("answerNumber");
const feedbackEl = document.getElementById("feedback");
const progressEl = document.getElementById("progress");
const actionBtn = document.getElementById("actionBtn");
const giveUpBtn = document.getElementById("giveUpBtn");

const loadingScreen = document.getElementById("loading-screen");
const emperorScreen = document.getElementById("emperor-screen");
const gameContainer = document.getElementById("game-container");
const endScreen = document.getElementById("end-screen");

const endQuestions = document.getElementById("end-questions");
const endTime = document.getElementById("end-time");
const sessionIdEl = document.getElementById("session-id");
const savedStatus = document.getElementById("saved-status");
const restartBtn = document.getElementById("restartBtn");
const showAnswersBtn = document.getElementById("showAnswersBtn");
const answersContainer = document.getElementById("answersContainer");
const answersTableBody = document.querySelector("#answersTable tbody");

const lbMonthlyBtn = document.getElementById("lbMonthlyBtn");
const lbAllTimeBtn = document.getElementById("lbAllTimeBtn");
const viewAllBtn = document.getElementById("viewAllBtn");
const viewStudentsBtn = document.getElementById("viewStudentsBtn");
const viewTeachersBtn = document.getElementById("viewTeachersBtn");

const ELEMENTS_DATA = (window.FastMath && window.FastMath.elementData) ? window.FastMath.elementData : [];
let elements = [];
let pool = [];
let startTime = null;
let questionStartTime = null;
let correctSymbols = 0;
let correctNumbers = 0;
let sessionId = null;
let questionLog = [];
let scopeFilter = "students";
let timeFilter = "monthly";
let leaderboardOnlyMode = false;
let gameActive = false;
let currentQuestion = null;
let totalQuestions = 0;
let questionsAsked = 0;
let answersVisible = false;

function sanitizeSymbol(input) {
  return (input || "").trim();
}

function sanitizeNumber(input) {
  const trimmed = (input || "").trim();
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function loadCsv() {
  if (elements.length > 0) return elements;
  elements = (ELEMENTS_DATA || []).filter((e) => e.element && e.symbol && Number.isFinite(e.atomicNumber));
  return elements;
}

function setFeedback(text, tone = "") {
  if (!feedbackEl) return;
  feedbackEl.textContent = text;
  feedbackEl.classList.remove("success", "error");
  if (tone === "success") feedbackEl.classList.add("success");
  if (tone === "error") feedbackEl.classList.add("error");
}

function updateProgress() {
  if (!progressEl) return;
  const total = totalQuestions || elements.length || 118;
  progressEl.textContent = `${questionsAsked} / ${total} elements`;
}

function updateActionLabel() {
  const hasText = (answerSymbol?.value || "").trim().length > 0 || (answerNumber?.value || "").trim().length > 0;
  if (actionBtn) actionBtn.textContent = hasText ? "Submit" : "Skip";
}

function showQuestion() {
  currentQuestion = pool.shift();
  if (!currentQuestion) {
    finishGame();
    return;
  }
  questionsAsked = totalQuestions - pool.length;
  questionEl.textContent = currentQuestion.element;
  answerSymbol.value = "";
  answerNumber.value = "";
  answerSymbol.focus();
  setFeedback("", "");
  questionStartTime = performance.now();
  updateProgress();
  updateActionLabel();
}

function startGame() {
  loadCsv()
    .then(() => {
      pool = shuffle([...elements]);
      totalQuestions = pool.length;
      questionsAsked = 0;
      currentQuestion = null;
      startTime = performance.now();
      questionStartTime = performance.now();
      correctSymbols = 0;
      correctNumbers = 0;
      questionLog = [];
      sessionId = null;
      timeFilter = "monthly";
      scopeFilter = "students";
      leaderboardOnlyMode = false;
      gameActive = true;
      answersVisible = false;
      endScreen?.classList.remove("leaderboard-only");

      if (loadingScreen) loadingScreen.style.display = "none";
      if (emperorScreen) emperorScreen.style.display = "none";
      if (endScreen) endScreen.style.display = "none";
      if (gameContainer) gameContainer.style.display = "block";
      if (answersContainer) answersContainer.style.display = "none";
      if (showAnswersBtn) {
        showAnswersBtn.textContent = "Show Answers";
        showAnswersBtn.classList.remove("active");
      }

      showQuestion();
    })
    .catch((err) => {
      console.error("Failed to load elements list", err);
      setFeedback("Could not load elements list.", "error");
    });
}

async function saveResults(totalTimeSec) {
  const auth = FM.auth || {};
  const userId = backend.safeUserId ? backend.safeUserId(window.currentUserId) : null;
  const sessionPayload = {
    player_name: auth.playerName || "Player",
    user_id: userId,
    symbols_correct: correctSymbols,
    atomic_numbers_correct: correctNumbers,
    total_points: correctSymbols + correctNumbers,
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
      element_name: q.element,
      correct_symbol: q.symbol,
      correct_atomic_number: q.atomicNumber,
      user_symbol: q.userSymbol,
      user_atomic_number: q.userAtomicNumber,
      correct_symbol_flag: q.correctSymbol,
      correct_number_flag: q.correctNumber,
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
      symbols_correct: correctSymbols,
      atomic_numbers_correct: correctNumbers,
      total_points: correctSymbols + correctNumbers,
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
  const plannedTotal = totalQuestions || elements.length;
  if (endQuestions) endQuestions.textContent = `Symbols: ${correctSymbols} / ${plannedTotal}, Atomic #: ${correctNumbers} / ${plannedTotal} (Total ${correctSymbols + correctNumbers} / ${plannedTotal * 2})`;
  if (endTime) endTime.textContent = `Total time: ${totalTimeSec.toFixed(2)} s`;
  savedStatus.textContent = "Saving...";
  savedStatus.classList.remove("success", "error");
  sessionIdEl.textContent = "";
  answersVisible = false;
  if (answersContainer) answersContainer.style.display = "none";
  if (showAnswersBtn) {
    showAnswersBtn.textContent = "Show Answers";
    showAnswersBtn.classList.remove("active");
  }

  // Default leaderboard view: Monthly + Everyone
  scopeFilter = "all";
  timeFilter = "monthly";
  viewAllBtn?.classList.add("active");
  viewStudentsBtn?.classList.remove("active");
  viewTeachersBtn?.classList.remove("active");
  lbMonthlyBtn?.classList.add("active");
  lbAllTimeBtn?.classList.remove("active");

  saveResults(totalTimeSec);
  backend.loadLeaderboard(scopeFilter, timeFilter, true);
}

function recordAnswer(symbolInput, numberInput, skipped = false) {
  if (!gameActive) return;
  if (!currentQuestion) return;
  const elapsed = (performance.now() - questionStartTime) / 1000;
  const userSymbol = sanitizeSymbol(symbolInput);
  const userNumber = sanitizeNumber(numberInput);

  const normalizedSymbol = currentQuestion.symbol;
  const normalizedNumber = currentQuestion.atomicNumber;

  const isSkip = skipped || (!userSymbol && userNumber === null);
  const symbolCorrect = !isSkip && userSymbol && userSymbol.toLowerCase() === normalizedSymbol.toLowerCase();
  const numberCorrect = !isSkip && userNumber !== null && userNumber === normalizedNumber;

  if (symbolCorrect) correctSymbols += 1;
  if (numberCorrect) correctNumbers += 1;

  questionLog.push({
    element: currentQuestion.element,
    symbol: currentQuestion.symbol,
    atomicNumber: currentQuestion.atomicNumber,
    userSymbol: userSymbol || "",
    userAtomicNumber: Number.isFinite(userNumber) ? userNumber : "",
    correctSymbol: symbolCorrect,
    correctNumber: numberCorrect,
    skipped: isSkip,
    timeTaken: elapsed
  });

  let feedback;
  if (isSkip) {
    feedback = "Skipped.";
  } else if (symbolCorrect && numberCorrect) {
    feedback = "Both correct!";
  } else if (symbolCorrect || numberCorrect) {
    feedback = "Half right.";
  } else {
    feedback = `Incorrect. Symbol ${currentQuestion.symbol}, Atomic # ${currentQuestion.atomicNumber}.`;
  }
  setFeedback(feedback, (symbolCorrect && numberCorrect) ? "success" : "error");

  if (pool.length === 0) {
    finishGame();
  } else {
    showQuestion();
  }
}

function handleSubmit() {
  const s = (answerSymbol?.value || "").trim();
  const n = (answerNumber?.value || "").trim();
  recordAnswer(s, n, false);
}

function handleSkip() {
  recordAnswer("", "", true);
}

function renderAnswersTable() {
  if (!answersContainer || !answersTableBody) return;
  answersTableBody.innerHTML = "";
  questionLog.forEach((q) => {
    const tr = document.createElement("tr");
    const bothCorrect = q.correctSymbol && q.correctNumber;
    const anyCorrect = q.correctSymbol || q.correctNumber;
    tr.classList.add(bothCorrect ? "answer-correct" : anyCorrect ? "answer-partial" : "answer-wrong");
    [q.element, q.symbol, q.atomicNumber, q.userSymbol || "", q.userAtomicNumber || ""].forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      tr.appendChild(td);
    });
    answersTableBody.appendChild(tr);
  });
  answersContainer.style.display = "block";
  answersVisible = true;
  if (showAnswersBtn) {
    showAnswersBtn.textContent = "Hide Answers";
    showAnswersBtn.classList.add("active");
  }
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
  const sym = (answerSymbol?.value || "").trim();
  const num = (answerNumber?.value || "").trim();
  if (!sym && !num) {
    handleSkip();
  } else {
    handleSubmit();
  }
}

function handleGiveUp() {
  if (!gameActive) return;
  finishGame({ gaveUp: true });
}

function bindEvents() {
  if (actionBtn) actionBtn.addEventListener("click", handleAction);
  if (answerSymbol) {
    answerSymbol.addEventListener("input", updateActionLabel);
    answerSymbol.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAction();
      }
    });
  }
  if (answerNumber) {
    answerNumber.addEventListener("input", updateActionLabel);
    answerNumber.addEventListener("keydown", (e) => {
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

  if (giveUpBtn) giveUpBtn.addEventListener("click", handleGiveUp);
  if (showAnswersBtn) {
    showAnswersBtn.addEventListener("click", () => {
      if (answersVisible) {
        answersVisible = false;
        if (answersContainer) answersContainer.style.display = "none";
        showAnswersBtn.textContent = "Show Answers";
        showAnswersBtn.classList.remove("active");
      } else {
        renderAnswersTable();
      }
    });
  }
}

bindEvents();

FM.elementQuizGame = {
  startGame,
  showLeaderboardOnly
};
