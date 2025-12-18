// gam_numberLanguages2.js - gameplay for Germanic Number Languages recognition game
const FM = (window.FastMath = window.FastMath || {});
const backend2 = FM.backendNumberLanguages2 || {};
const DATA2 = FM.numberLanguageDataGermanic || {};

const LANGUAGES = DATA2.LANGUAGES || ["Dutch", "German", "Swedish", "Norwegian"];
const WORDS = DATA2.WORDS || {};
const COLLISIONS = DATA2.COLLISIONS || {};
const NUMBER_ORDER = DATA2.NUMBERS || Array.from({ length: 100 }, (_, i) => i + 1);

const questionEl = document.getElementById("question");
const numberLabel = document.getElementById("numberLabel");
const optionGrid = document.getElementById("optionGrid");
const feedbackEl = document.getElementById("feedback");
const progressEl = document.getElementById("progress");
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

let startTime = null;
let questionStartTime = null;
let questionIndex = 0;
let correctCount = 0;
let sessionId = null;
let questionLog = [];
let scopeFilter = "all";
let timeFilter = "monthly";
let leaderboardOnlyMode = false;
let gameActive = false;
let currentQuestion = null;
let totalQuestions = NUMBER_ORDER.length;
let answersVisible = false;
let acceptingAnswers = false;
const REVEAL_DELAY_MS = 1000;

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
  if (text) {
    feedbackEl.classList.add(success ? "success" : "error");
  }
}

function updateProgress() {
  if (!progressEl) return;
  progressEl.textContent = `${Math.min(questionIndex + 1, totalQuestions)} / ${totalQuestions} numbers`;
}

function getWord(language, number) {
  const list = WORDS[language] || [];
  return list[number] || "";
}

function getCollisionGroup(number, language) {
  const collisions = COLLISIONS[number] || {};
  return collisions[language] || [language];
}

function pickLanguage() {
  const idx = Math.floor(Math.random() * LANGUAGES.length);
  return LANGUAGES[idx];
}

function buildOptions(number, correctLanguage) {
  const collisionGroup = new Set(getCollisionGroup(number, correctLanguage));
  const ordered = [];
  LANGUAGES.forEach((lang) => {
    if (lang === correctLanguage) ordered.push(lang);
  });
  LANGUAGES.forEach((lang) => {
    if (lang !== correctLanguage && !collisionGroup.has(lang) && ordered.length < 4) {
      ordered.push(lang);
    }
  });
  return ordered.slice(0, 4);
}

function renderOptions(options) {
  if (!optionGrid) return;
  optionGrid.innerHTML = "";
  options.forEach((lang) => {
    const btn = document.createElement("button");
    btn.textContent = lang;
    btn.className = "option-btn";
    btn.dataset.lang = lang;
    btn.addEventListener("click", () => handleGuess(lang));
    optionGrid.appendChild(btn);
  });
  acceptingAnswers = true;
}

function showQuestion() {
  if (questionIndex >= totalQuestions) {
    finishGame();
    return;
  }
  const number = NUMBER_ORDER[questionIndex];
  const language = pickLanguage();
  const word = getWord(language, number);
  const options = buildOptions(number, language);
  currentQuestion = { number, language, word, options };

  if (questionEl) questionEl.textContent = word;
  if (numberLabel) numberLabel.textContent = `Number ${number}`;
  setFeedback("", true);
  renderOptions(options);
  questionStartTime = performance.now();
  updateProgress();
  questionIndex += 1;
}

function renderAnswersTable() {
  if (!answersContainer || !answersTableBody) return;
  answersTableBody.innerHTML = "";
  questionLog.forEach((q) => {
    const tr = document.createElement("tr");
    tr.classList.add(q.correct ? "answer-correct" : "answer-wrong");
    [q.number, q.word, q.language, q.guess || ""].forEach((val) => {
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

async function saveResults(totalTimeSec) {
  const auth = FM.auth || {};
  const userId = backend2.safeUserId ? backend2.safeUserId(window.currentUserId) : null;
  const sessionPayload = {
    player_name: auth.playerName || "Player",
    user_id: userId,
    numbers_correct: correctCount,
    total_time_seconds: totalTimeSec,
    is_teacher: auth.isTeacher,
    is_student: auth.isStudent,
    version_number: FM.GAME_VERSION
  };

  try {
    const sessionRow = await backend2.insertSessionRow(sessionPayload);
    sessionId = sessionRow?.session_id || null;
    sessionIdEl.textContent = sessionId ? `Session ID: ${sessionId}` : "";

    const rows = questionLog.map((q, idx) => ({
      session_id: sessionId,
      question_number: idx + 1,
      number_value: q.number,
      displayed_word: q.word,
      correct_language: q.language,
      guessed_language: q.guess,
      is_correct: q.correct,
      time_taken: q.timeTaken,
      player_name: auth.playerName || "Player",
      version_number: FM.GAME_VERSION
    }));

    if (rows.length) {
      await backend2.insertQuestionRows(rows);
    }

    await backend2.insertLeaderboardRow({
      player_name: auth.playerName || "Player",
      numbers_correct: correctCount,
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
  const displayTotal = options.gaveUp ? answeredCount : totalQuestions;
  const stoppedLabel = options.gaveUp ? " (stopped early)" : "";
  if (endQuestions) endQuestions.textContent = `Numbers correct: ${correctCount} / ${displayTotal}${stoppedLabel}`;
  if (endTime) endTime.textContent = `Total time: ${totalTimeSec.toFixed(2)} s`;
  savedStatus.textContent = "Saving...";
  savedStatus.classList.remove("success", "error");
  sessionIdEl.textContent = "";
  answersVisible = false;
  if (answersContainer) answersContainer.style.display = "none";
  if (showAnswersBtn) {
    showAnswersBtn.textContent = "Show Answers";
    showAnswersBtn.classList.remove("active");
    showAnswersBtn.style.display = "inline-block";
  }

  saveResults(totalTimeSec);
  backend2.loadLeaderboard(scopeFilter, timeFilter, true);
}

function highlightSelections(selectedLanguage) {
  if (!optionGrid) return;
  optionGrid.querySelectorAll("button").forEach((btn) => {
    const lang = btn.dataset.lang;
    btn.disabled = true;
    if (lang === currentQuestion.language) {
      btn.classList.add("option-correct");
    } else if (lang === selectedLanguage) {
      btn.classList.add("option-wrong");
    } else {
      btn.classList.add("option-muted");
    }
  });
}

function handleGuess(selectedLanguage) {
  if (!gameActive || !currentQuestion || !acceptingAnswers) return;
  acceptingAnswers = false;
  const elapsed = (performance.now() - questionStartTime) / 1000;
  const correct = selectedLanguage === currentQuestion.language;
  if (correct) correctCount += 1;

  questionLog.push({
    number: currentQuestion.number,
    word: currentQuestion.word,
    language: currentQuestion.language,
    guess: selectedLanguage,
    correct,
    timeTaken: elapsed
  });

  highlightSelections(selectedLanguage);
  setFeedback(correct ? "Correct!" : `It's ${currentQuestion.language}.`, correct);

  if (questionIndex >= totalQuestions) {
    setTimeout(() => finishGame(), REVEAL_DELAY_MS);
  } else {
    setTimeout(() => showQuestion(), REVEAL_DELAY_MS);
  }
}

function handleGiveUp() {
  finishGame({ gaveUp: true });
}

function showLeaderboardOnly() {
  leaderboardOnlyMode = true;
  gameActive = false;
  if (loadingScreen) loadingScreen.style.display = "none";
  if (emperorScreen) emperorScreen.style.display = "none";
  if (gameContainer) gameContainer.style.display = "none";
  if (endScreen) {
    endScreen.classList.add("leaderboard-only");
    endScreen.style.display = "block";
  }
  if (answersContainer) answersContainer.style.display = "none";
  answersVisible = false;
  if (showAnswersBtn) {
    showAnswersBtn.textContent = "Show Answers";
    showAnswersBtn.classList.remove("active");
    showAnswersBtn.style.display = "none";
  }
  if (restartBtn) restartBtn.textContent = "Play";
  backend2.loadLeaderboard(scopeFilter, timeFilter, true);
}

function startGame() {
  totalQuestions = NUMBER_ORDER.length;
  questionIndex = 0;
  currentQuestion = null;
  startTime = performance.now();
  questionStartTime = performance.now();
  correctCount = 0;
  questionLog = [];
  sessionId = null;
  timeFilter = "monthly";
  scopeFilter = "all";
  leaderboardOnlyMode = false;
  gameActive = true;
  answersVisible = false;

  if (loadingScreen) loadingScreen.style.display = "none";
  if (emperorScreen) emperorScreen.style.display = "none";
  if (endScreen) {
    endScreen.style.display = "none";
    endScreen.classList.remove("leaderboard-only");
  }
  if (gameContainer) gameContainer.style.display = "block";
  if (answersContainer) answersContainer.style.display = "none";
  if (showAnswersBtn) {
    showAnswersBtn.textContent = "Show Answers";
    showAnswersBtn.classList.remove("active");
    showAnswersBtn.style.display = "inline-block";
  }

  showQuestion();
}

function bindEvents() {
  if (restartBtn) restartBtn.addEventListener("click", () => {
    if (leaderboardOnlyMode) {
      leaderboardOnlyMode = false;
      startGame();
    } else {
      startGame();
    }
  });

  if (lbMonthlyBtn) lbMonthlyBtn.addEventListener("click", () => {
    lbMonthlyBtn.classList.add("active");
    lbAllTimeBtn?.classList.remove("active");
    timeFilter = "monthly";
    backend2.loadLeaderboard(scopeFilter, timeFilter, true);
  });
  if (lbAllTimeBtn) lbAllTimeBtn.addEventListener("click", () => {
    lbAllTimeBtn.classList.add("active");
    lbMonthlyBtn?.classList.remove("active");
    timeFilter = "alltime";
    backend2.loadLeaderboard(scopeFilter, timeFilter, true);
  });

  if (viewAllBtn) viewAllBtn.addEventListener("click", () => {
    viewAllBtn.classList.add("active");
    viewStudentsBtn?.classList.remove("active");
    viewTeachersBtn?.classList.remove("active");
    scopeFilter = "all";
    backend2.loadLeaderboard(scopeFilter, timeFilter, true);
  });
  if (viewStudentsBtn) viewStudentsBtn.addEventListener("click", () => {
    viewStudentsBtn.classList.add("active");
    viewAllBtn?.classList.remove("active");
    viewTeachersBtn?.classList.remove("active");
    scopeFilter = "students";
    backend2.loadLeaderboard(scopeFilter, timeFilter, true);
  });
  if (viewTeachersBtn) viewTeachersBtn.addEventListener("click", () => {
    viewTeachersBtn.classList.add("active");
    viewStudentsBtn?.classList.remove("active");
    viewAllBtn?.classList.remove("active");
    scopeFilter = "teachers";
    backend2.loadLeaderboard(scopeFilter, timeFilter, true);
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

FM.numberLanguagesGame2 = {
  startGame,
  showLeaderboardOnly
};
