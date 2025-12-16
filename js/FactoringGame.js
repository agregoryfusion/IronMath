// FactoringGame.js - procedural factoring game logic
const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};
const backend = FM.backendFactoring || {};

const gameContainer = document.getElementById("game-container");
const endScreen = document.getElementById("end-screen");
const emperorScreen = document.getElementById("emperor-screen");
const factorNumberEl = document.getElementById("factorNumber");
const factorButtonsEl = document.getElementById("factorButtons");
const submitBtn = document.getElementById("submitAnswer");
const statusEl = document.getElementById("factorStatus");
const stageInfo = document.getElementById("stage-info");
const questionCountEl = document.getElementById("question-count");
const timerFill = document.getElementById("timerFill");
const restartBtn = document.getElementById("restartBtn");
const lbWrap = document.getElementById("leaderboardContainer");

const CONFIG = {
  startStage: 8,
  timerSeconds: 15,
  wrongPenaltySeconds: 3,
  startingMinFactor: 2,
  startingMaxFactor: 5,
  factorIncrementEvery: 1, // how many stage bumps before adding another factor button
  maxNumberAddend: -4, // used in (stage + addend)^exponent for max number
  maxNumberExponent: 2.0,
  minNumberFloor: 10
};

let sessionId = U.buildSessionID ? U.buildSessionID("Player") : "Session";
let stage = CONFIG.startStage;
let questionCount = 0;
let correctCount = 0;
let totalTimeTrue = 0;
let penaltySeconds = 0;
let penaltySecondsThisQuestion = 0;
let current = null;
let selected = new Set();
let timeLeft = CONFIG.timerSeconds;
let rafId = 0;
let qStartTs = 0;
let runStartTs = 0;
let mistakesThisQuestion = 0;
let leaderboardOnlyMode = false;

let runData = { sessionID: "", results: [] };

function shake(el, mult = 1) {
  if (!el) return;
  const dur = 300;
  const mag = 6 * mult;
  const t0 = performance.now();
  (function step() {
    const dt = performance.now() - t0;
    if (dt < dur) {
      const k = 1 - dt / dur;
      const dx = (Math.random() * 2 - 1) * mag * k;
      const dy = (Math.random() * 2 - 1) * mag * k;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(step);
    } else {
      el.style.transform = "translate(0,0)";
    }
  })();
}

function computeStageFromCorrect(correct) {
  const base = CONFIG.startStage * CONFIG.startStage;
  const root = Math.floor(Math.sqrt(base + correct));
  return Math.max(CONFIG.startStage, root);
}

function computeAvailableFactors(currentStage) {
  const extraButtons = Math.max(0, Math.floor((currentStage - CONFIG.startStage) / CONFIG.factorIncrementEvery));
  const maxFactor = CONFIG.startingMaxFactor + extraButtons;
  const factors = [];
  for (let f = CONFIG.startingMinFactor; f <= maxFactor; f++) {
    factors.push(f);
  }
  return factors;
}

function computeNumberBounds(currentStage) {
  const base = Math.max(1, currentStage + CONFIG.maxNumberAddend);
  const maxNumber = Math.max(CONFIG.startingMaxFactor, Math.pow(base, CONFIG.maxNumberExponent));
  const minNumber = Math.max(CONFIG.minNumberFloor, currentStage + CONFIG.startingMaxFactor);
  return { minNumber: Math.floor(minNumber), maxNumber: Math.floor(maxNumber) };
}

function generateNumberForFactors(factors, currentStage) {
  const { minNumber, maxNumber } = computeNumberBounds(currentStage);
  const factor = factors[Math.floor(Math.random() * factors.length)];
  const cofactorMin = Math.max(2, Math.ceil(minNumber / factor));
  const cofactorMax = Math.max(cofactorMin, Math.floor(maxNumber / factor));
  const cofactor = cofactorMin + Math.floor(Math.random() * (cofactorMax - cofactorMin + 1));
  const value = factor * cofactor;
  return value;
}

function renderFactorButtons(factors) {
  if (!factorButtonsEl) return;
  factorButtonsEl.innerHTML = "";
  factors.forEach((f) => {
    const btn = document.createElement("button");
    btn.textContent = f;
    btn.className = "factor-btn";
    if (selected.has(f)) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      if (selected.has(f)) selected.delete(f);
      else selected.add(f);
      btn.classList.toggle("selected");
    });
    factorButtonsEl.appendChild(btn);
  });
}

function updateHud() {
  if (stageInfo) stageInfo.textContent = `Stage ${stage}`;
  if (questionCountEl) questionCountEl.textContent = `Question ${questionCount + 1}`;
}

function startTimer() {
  timeLeft = CONFIG.timerSeconds;
  qStartTs = performance.now();
  cancelAnimationFrame(rafId);
  const tick = () => {
    const elapsed = (performance.now() - qStartTs) / 1000;
    const remaining = CONFIG.timerSeconds - elapsed - penaltySecondsThisQuestion;
    timeLeft = Math.max(0, remaining);
    const pct = Math.max(0, Math.min(1, timeLeft / CONFIG.timerSeconds));
    if (timerFill) timerFill.style.width = `${pct * 100}%`;
    if (timeLeft <= 0) {
      recordResult(false, { timeTaken: (performance.now() - qStartTs) / 1000 });
      return gameOver();
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function nextQuestion() {
  const factors = computeAvailableFactors(stage);
  const value = generateNumberForFactors(factors, stage);
  const correctFactors = factors.filter((f) => value % f === 0);
  current = { value, factors, correctFactors, stage };
  selected = new Set();
  mistakesThisQuestion = 0;
  penaltySecondsThisQuestion = 0;
  if (factorNumberEl) factorNumberEl.textContent = value;
  renderFactorButtons(factors);
  if (statusEl) statusEl.textContent = "";
  updateHud();
  startTimer();
}

function recordResult(success, extra = {}) {
  const nowTime = (performance.now() - qStartTs) / 1000;
  const timeTaken = extra.timeTaken ?? nowTime;
  totalTimeTrue += timeTaken;
  runData.results.push({
    questionNumber: runData.results.length + 1,
    stage,
    number: current?.value ?? null,
    availableFactors: current?.factors || [],
    correctFactors: current?.correctFactors || [],
    selectedFactors: Array.from(selected),
    timeTaken,
    mistakes: mistakesThisQuestion,
    success
  });
}

function evaluateAnswer() {
  if (!current) return;
  const correctSet = new Set(current.correctFactors);
  let isCorrect = true;
  if (selected.size !== correctSet.size) {
    isCorrect = false;
  } else {
    for (const f of selected) {
      if (!correctSet.has(f)) { isCorrect = false; break; }
    }
  }

  if (isCorrect) {
    const timeTaken = (performance.now() - qStartTs) / 1000;
    recordResult(true, { timeTaken });
    correctCount++;
    questionCount++;
    stage = computeStageFromCorrect(correctCount);
    current = null;
    penaltySecondsThisQuestion = 0;
    if (statusEl) statusEl.textContent = "";
    nextQuestion();
  } else {
    mistakesThisQuestion++;
    penaltySeconds += CONFIG.wrongPenaltySeconds;
    penaltySecondsThisQuestion += CONFIG.wrongPenaltySeconds;
    if (statusEl) statusEl.textContent = "Try again — time reduced!";
    shake(factorNumberEl, mistakesThisQuestion);
  }
}

function resetRunState() {
  const auth = FM.auth || { playerName: "Player" };
  sessionId = U.buildSessionID ? U.buildSessionID(auth.playerName || "Player") : "Session";
  runData = { sessionID: sessionId, results: [] };
  stage = CONFIG.startStage;
  questionCount = 0;
  correctCount = 0;
  totalTimeTrue = 0;
  penaltySeconds = 0;
  penaltySecondsThisQuestion = 0;
  selected = new Set();
  timeLeft = CONFIG.timerSeconds;
  cancelAnimationFrame(rafId);
  leaderboardOnlyMode = false;
}

function startGame() {
  if (!gameContainer) return;
  resetRunState();
  runStartTs = performance.now();
  gameContainer.style.display = "block";
  if (endScreen) {
    endScreen.style.display = "none";
    endScreen.classList.remove("leaderboard-only");
  }
  if (lbWrap) {
    lbWrap.classList.remove("show");
    lbWrap.style.display = "none";
  }
  nextQuestion();
}

function gameOver() {
  cancelAnimationFrame(rafId);
  current = null;
  if (gameContainer) gameContainer.style.display = "none";
  if (endScreen) {
    endScreen.style.display = "block";
    endScreen.classList.remove("leaderboard-only");
  }
  if (lbWrap) {
    lbWrap.style.display = "block";
    lbWrap.classList.add("show");
  }
  backend.loadLeaderboard("all", "monthly", true);

  const totalTrue = totalTimeTrue;
  const totalWithPen = totalTimeTrue + penaltySeconds;
  const avgTrue = totalTrue / Math.max(correctCount, 1);
  const avgPen = totalWithPen / Math.max(correctCount, 1);

  document.getElementById("end-questions").textContent =
    `Questions answered: ${correctCount}`;
  document.getElementById("end-penalty").textContent =
    `Total penalty time: ${penaltySeconds.toFixed(2)} s`;
  document.getElementById("end-total").innerHTML =
    `Total time: ${totalTrue.toFixed(2)} s (<span id="end-with-penalty">${totalWithPen.toFixed(2)}</span> s with penalties)`;
  document.getElementById("end-avg").innerHTML =
    `Avg time/question: ${avgTrue.toFixed(2)} s (<span id="end-avg-with-penalty">${avgPen.toFixed(2)}</span> s with penalties)`;

  uploadSession(totalTrue);

  if (restartBtn) restartBtn.textContent = "Play Again";
}

async function uploadSession(totalTrue) {
  try {
    const now = new Date();
    const createdIso = now.toISOString();
    const totalWithPen = totalTrue + penaltySeconds;

    const auth = FM.auth || { playerName: "Player", isTeacher: false, isStudent: false };
    const playerName = auth.playerName || "Player";

    const sessionPayload = {
      user_id: window.currentUserId || null,
      player_name: playerName,
      questions_answered: correctCount,
      stage_reached: stage,
      total_time_seconds: totalTrue,
      penalty_time_seconds: penaltySeconds,
      created_at: createdIso,
      version_number: FM.GAME_VERSION
    };

    let sessionNumericId = null;
    try {
      const inserted = await backend.insertSessionRow(sessionPayload);
      sessionNumericId = inserted?.session_id || inserted?.id || null;
    } catch (se) {
      console.warn("Session insert failed:", se);
    }

    const questionsPayload = runData.results.map((q, idx) => ({
      session_id: sessionNumericId,
      question_number: q.questionNumber ?? (idx + 1),
      prompt_number: q.number,
      available_factors: (q.availableFactors || []).join(","),
      correct_factors: (q.correctFactors || []).join(","),
      selected_factors: (q.selectedFactors || []).join(","),
      time_taken: q.timeTaken,
      mistakes: q.mistakes,
      success: q.success,
      stage: q.stage,
      date_added: createdIso,
      player_name: playerName,
      version_number: FM.GAME_VERSION
    }));

    if (questionsPayload.length > 0) {
      try {
        await backend.insertQuestionRows(questionsPayload);
      } catch (qe) {
        console.error("Questions insert failed:", qe);
      }
    }

    if (correctCount > 0) {
      try {
        await backend.insertLeaderboardRow({
          user_id: backend.safeUserId(window.currentUserId) || null,
          player_name: playerName,
          stage_reached: stage,
          questions_answered: correctCount,
          total_time_seconds: totalWithPen,
          penalty_time_seconds: penaltySeconds,
          date_added: createdIso,
          is_teacher: !!auth.isTeacher,
          is_student: !!auth.isStudent,
          version_number: FM.GAME_VERSION
        });
      } catch (lbe) {
        console.warn("Leaderboard insert failed:", lbe);
      }
    }

    const cacheEntry = {
      playerName,
      stageReached: stage,
      questionsAnswered: correctCount,
      totalTime: totalWithPen,
      penaltyTime: penaltySeconds,
      dateAdded: now.getTime(),
      isTeacher: !!auth.isTeacher,
      isStudent: !!auth.isStudent
    };
    backend.updateCachedLeaderboardWithNewScore(cacheEntry);
    const s = document.getElementById("saved-status");
    if (s) {
      s.textContent = "Saved!";
      s.style.color = "#7fdca2";
    }
  } catch (e) {
    console.error("Upload failed", e);
    const s = document.getElementById("saved-status");
    if (s) {
      s.textContent = "Upload failed";
      s.style.color = "#ff8a8a";
    }
  }
}

if (submitBtn) submitBtn.addEventListener("click", evaluateAnswer);
if (restartBtn) {
  restartBtn.addEventListener("click", () => {
    if (endScreen) endScreen.style.display = "none";
    startGame();
  });
}

function showLeaderboardOnly() {
  cancelAnimationFrame(rafId);
  current = null;
  if (gameContainer) gameContainer.style.display = "none";
  if (emperorScreen) emperorScreen.style.display = "none";

  if (endScreen) {
    endScreen.classList.add("leaderboard-only");
    endScreen.style.display = "block";
  }

  if (lbWrap) {
    lbWrap.style.display = "block";
    lbWrap.classList.add("show");
  }

  const s = document.getElementById("saved-status");
  if (s) {
    s.textContent = "";
    s.style.color = "";
  }

  backend.loadLeaderboard("all", "monthly", true);
  leaderboardOnlyMode = true;
  if (restartBtn) restartBtn.textContent = "Play";
}

FM.factorGame = {
  startGame,
  showLeaderboardOnly
};
