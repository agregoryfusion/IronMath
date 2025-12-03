// AddingUp.js - incremental addition game logic
const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};
const backend = FM.backendAddingUp || {};

const gameContainer = document.getElementById("game-container");
const endScreen = document.getElementById("end-screen");
const emperorScreen = document.getElementById("emperor-screen");
const questionEl = document.getElementById("question");
const answerEl = document.getElementById("answer");
const stageInfo = document.getElementById("stage-info");
const timerFill = document.getElementById("timerFill");
const restartBtn = document.getElementById("restartBtn");
const lbWrap = document.getElementById("leaderboardContainer");

const TIMER_SECONDS = 10;
const PENALTY_MULT = 2;
const START_MEAN = 5;
const START_STD = 2;

let sessionId = U.buildSessionID ? U.buildSessionID("Player") : "Session";
let questionCount = 0;
let correctCount = 0;
let totalTimeTrue = 0;
let penaltySeconds = 0;
let mistakesThisQuestion = 0;
let current = null;
let timeLeft = TIMER_SECONDS;
let rafId = 0;
let qStartTs = 0;
let runStartTs = 0;
let leaderboardOnlyMode = false;
let currentTotal = 0;

let runData = { sessionID: "", results: [] };
const tower = createTowerAnimator();

function createTowerAnimator() {
  const container = document.getElementById("towerCanvas");
  const blocksLayer = document.getElementById("towerBlocks");
  const FLOOR_HEIGHT = 22;
  const cfg = {
    block: 30,
    gap: 4,
    padPct: 0.04,
    dropOvershoot: 60
  };

  let cols = 0;
  let padPx = 0;
  let heights = [];
  const blocks = [];

  function measure() {
    if (!container) return false;
    const width = container.clientWidth || 0;
    padPx = Math.max(cfg.block, Math.round(width * cfg.padPct));
    const usable = Math.max(cfg.block, width - padPx * 2);
    const nextCols = Math.max(5, Math.floor((usable + cfg.gap) / (cfg.block + cfg.gap)));
    const changed = nextCols !== cols;
    cols = nextCols;
    heights = new Array(cols).fill(0);
    return changed;
  }

  function pickCol() {
    let idx = 0;
    let min = heights[0] ?? 0;
    for (let i = 1; i < heights.length; i++) {
      if (heights[i] < min) {
        min = heights[i];
        idx = i;
      }
    }
    return idx;
  }

  function relayoutExisting() {
    heights = new Array(cols).fill(0);
    blocks.forEach((el) => {
      const col = pickCol();
      const left = padPx + col * (cfg.block + cfg.gap);
      const bottom = FLOOR_HEIGHT + heights[col] * (cfg.block + cfg.gap);
      el.style.left = `${left}px`;
      el.style.bottom = `${bottom}px`;
      heights[col] += 1;
    });
    updateViewOffset();
  }

  function reset() {
    if (blocksLayer) blocksLayer.innerHTML = "";
    blocks.length = 0;
    measure();
    updateViewOffset();
  }

  function addBlocks(count) {
    if (!container || !blocksLayer || !Number.isFinite(count) || count <= 0) return;
    if (!cols) measure();

    for (let i = 0; i < count; i++) {
      const col = pickCol();
      const left = padPx + col * (cfg.block + cfg.gap);
      const targetBottom = FLOOR_HEIGHT + heights[col] * (cfg.block + cfg.gap);
      const startBottom = (container.clientHeight || 200) + cfg.dropOvershoot + Math.random() * 50;

      const block = document.createElement("div");
      block.className = "tower-block";
      block.style.left = `${left}px`;
      block.style.width = `${cfg.block}px`;
      block.style.height = `${cfg.block}px`;
      block.style.bottom = `${startBottom}px`;

      const colorIdx = (heights[col] + i) % 5;
      const palette = [
        ["#7cc3ff", "#4ea2ff", "#1b3550"],
        ["#7ff0c9", "#4ac59c", "#1f4a3c"],
        ["#ffd27a", "#ffb347", "#5a3a1b"],
        ["#ff9bb6", "#ff6f94", "#5a1f3a"],
        ["#c7abff", "#a680ff", "#3d2c63"]
      ];
      const [c1, c2, border] = palette[colorIdx] || palette[0];
      block.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
      block.style.borderColor = border;

      blocksLayer.appendChild(block);
      // Animate on the next frame so the transition runs
      requestAnimationFrame(() => {
        block.style.bottom = `${targetBottom}px`;
      });

      heights[col] += 1;
      blocks.push(block);
    }
    updateViewOffset();
  }

  window.addEventListener("resize", () => {
    if (!container) return;
    const changed = measure();
    if (changed && blocks.length > 0) relayoutExisting();
  });

  measure();

  return {
    reset,
    addBlocks
  };
}

function gaussianAddend() {
  const growthFactor = Math.floor(correctCount / 3);
  const mean = START_MEAN + growthFactor;
  const std = START_STD + Math.min(10, correctCount * 0.2);
  const min = 1;
  const max = Math.max(9, Math.round(mean + std * 3));
  const sample = U.sampleTrunc ? U.sampleTrunc(min, max, mean, std) : mean;
  return Math.max(min, Math.round(sample));
}

function buildQuestion() {
  if (questionCount === 0) {
    const a = gaussianAddend();
    const b = gaussianAddend();
    currentTotal = a + b;
    return { base: a, addend: b, expected: a + b };
  }
  const addend = gaussianAddend();
  return { base: currentTotal, addend, expected: currentTotal + addend };
}

function shake(el, mult = 1) {
  const urgency = 1 - (timeLeft / TIMER_SECONDS);
  const dur = 0.3 + 0.2 * urgency;
  const base = 8;
  const mag = base * (1 + 2 * urgency) * (1 + 0.3 * (mult - 1));
  const t0 = performance.now();
  (function step() {
    const dt = performance.now() - t0;
    if (dt < dur * 1000) {
      const k = 1 - dt / (dur * 1000);
      const vertBias = 0.5 + 1.5 * urgency;
      const dx = (Math.random() * 2 - 1) * mag * k;
      const dy = (Math.random() * 2 - 1) * mag * k * vertBias;
      el.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(step);
    } else {
      el.style.transform = "translate(0,0)";
    }
  })();
}

function resetRunState() {
  const auth = FM.auth || { playerName: "Player" };
  sessionId = U.buildSessionID ? U.buildSessionID(auth.playerName || "Player") : "Session";
  runData = { sessionID: sessionId, results: [] };
  questionCount = 0;
  correctCount = 0;
  totalTimeTrue = 0;
  penaltySeconds = 0;
  mistakesThisQuestion = 0;
  timeLeft = TIMER_SECONDS;
  cancelAnimationFrame(rafId);
  leaderboardOnlyMode = false;
  currentTotal = 0;
  tower.reset();
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

function nextQuestion() {
  const q = buildQuestion();
  current = q;
  mistakesThisQuestion = 0;
  questionEl.textContent = `${q.base} + ${q.addend}`;
  answerEl.value = "";
  answerEl.focus();
  if (stageInfo) stageInfo.textContent = "";

  let penaltySecondsThisRound = 0;
  timeLeft = TIMER_SECONDS;
  qStartTs = performance.now();
  timerFill.style.width = "100%";
  cancelAnimationFrame(rafId);

  const tick = () => {
    const elapsed = (performance.now() - qStartTs) / 1000;
    const remaining = TIMER_SECONDS - elapsed - penaltySecondsThisRound;
    timeLeft = Math.max(0, remaining);
    const pct = Math.max(0, Math.min(1, timeLeft / TIMER_SECONDS));
    timerFill.style.width = pct * 100 + "%";
    if (timeLeft <= 0) {
      const trueT = (performance.now() - qStartTs) / 1000;
      totalTimeTrue += trueT;
      runData.results.push({
        questionNumber: runData.results.length + 1,
        base: current.base,
        addend: current.addend,
        expected: current.expected,
        timeTaken: (performance.now() - qStartTs) / 1000,
        mistakes: mistakesThisQuestion,
        success: false
      });
      return gameOver();
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  answerEl.oninput = (e) => {
    if (!current) return;
    const val = e.target.value.trim();
    if (val === "") return;
    const correctStr = String(current.expected);

    if (val === correctStr) {
      const trueT = (performance.now() - qStartTs) / 1000;
      totalTimeTrue += trueT;
      correctCount++;
      questionCount++;
      currentTotal = current.expected;
      tower.addBlocks(current.addend || 0);
      runData.results.push({
        questionNumber: runData.results.length + 1,
        base: current.base,
        addend: current.addend,
        expected: current.expected,
        timeTaken: (performance.now() - qStartTs) / 1000,
        mistakes: mistakesThisQuestion,
        success: true
      });
      current = null;
      return nextQuestion();
    }

    if (!correctStr.startsWith(val)) {
      const avgModifiedSoFar = (totalTimeTrue + penaltySeconds) / Math.max(correctCount, 1) || 2.0;
      const penalty = avgModifiedSoFar * Math.pow(PENALTY_MULT, mistakesThisQuestion);
      mistakesThisQuestion++;
      penaltySeconds += penalty;
      penaltySecondsThisRound += penalty;
      const remaining = TIMER_SECONDS - ((performance.now() - qStartTs) / 1000) - penaltySecondsThisRound;
      timeLeft = Math.max(0, remaining);
      const pct = Math.max(0, Math.min(1, timeLeft / TIMER_SECONDS));
      timerFill.style.width = pct * 100 + "%";
      e.target.value = val.slice(0, -1);
      shake(questionEl, mistakesThisQuestion);
      if (remaining <= 0) {
        runData.results.push({
          questionNumber: runData.results.length + 1,
          base: current.base,
          addend: current.addend,
          expected: current.expected,
          timeTaken: (performance.now() - qStartTs) / 1000,
          mistakes: mistakesThisQuestion,
          success: false
        });
        return gameOver();
      }
    }
  };
}

function showLeaderboardOnly() {
  leaderboardOnlyMode = true;
  if (gameContainer) gameContainer.style.display = "none";
  if (endScreen) {
    endScreen.style.display = "block";
    endScreen.classList.add("leaderboard-only");
  }
  if (lbWrap) {
    lbWrap.style.display = "block";
    lbWrap.classList.add("show");
  }
  backend.loadLeaderboard("all", true);
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
  backend.loadLeaderboard("all", true);

  const totalTrue = totalTimeTrue;
  const totalWithPen = totalTimeTrue + penaltySeconds;
  const avgTrue = totalTrue / Math.max(correctCount, 1);
  const avgPen = totalWithPen / Math.max(correctCount, 1);

  document.getElementById("end-questions").textContent = `Questions answered: ${correctCount}`;
  document.getElementById("end-penalty").textContent = `Total penalty time: ${penaltySeconds.toFixed(2)} s`;
  document.getElementById("end-total").innerHTML = `Total time: ${totalTrue.toFixed(2)} s (<span id="end-with-penalty">${totalWithPen.toFixed(2)}</span> s with penalties)`;
  document.getElementById("end-avg").innerHTML = `Avg time/question: ${avgTrue.toFixed(2)} s (<span id="end-avg-with-penalty">${avgPen.toFixed(2)}</span> s with penalties)`;

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
    // Only send user_id to Supabase if it looks like a valid UUID; otherwise use null to avoid 22P02 errors.
    const userId = backend.safeUserId ? backend.safeUserId(window.currentUserId) : null;
    const toFinite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);

    const insertPayload = {
      user_id: userId,
      player_name: playerName,
      questions_answered: toFinite(correctCount, 0),
      true_time_seconds: toFinite(totalTrue, 0),
      penalty_time_seconds: toFinite(penaltySeconds, 0),
      total_time_seconds: toFinite(totalWithPen, 0),
      final_total: Number.isFinite(currentTotal) ? currentTotal : null,
      created_at: createdIso,
      version_number: FM.GAME_VERSION,
      is_teacher: !!auth.isTeacher,
      is_student: !!auth.isStudent
    };

    const s = document.getElementById("saved-status");
    if (s) {
      s.textContent = "Saving session...";
      s.style.color = "";
    }

    const sessionRow = await backend.insertSessionRow(insertPayload);
    const sessionNumericId = sessionRow?.session_id ?? sessionRow?.id ?? null;

    const questionsPayload = runData.results.map((q, idx) => ({
      session_id: sessionNumericId,
      question_number: q.questionNumber ?? idx + 1,
      starting_total: toFinite(q.base, 0),
      addend: toFinite(q.addend, 0),
      expected_total: toFinite(q.expected, 0),
      time_taken: toFinite(q.timeTaken, 0),
      mistakes: toFinite(q.mistakes, 0),
      success: !!q.success,
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
          user_id: userId,
          player_name: playerName,
          questions_answered: toFinite(correctCount, 0),
          total_time_seconds: toFinite(totalWithPen, 0),
          penalty_time_seconds: toFinite(penaltySeconds, 0),
          date_added: createdIso,
          is_teacher: !!auth.isTeacher,
          is_student: !!auth.isStudent,
          version_number: FM.GAME_VERSION,
          final_total: Number.isFinite(currentTotal) ? currentTotal : null
        });
      } catch (lbe) {
        console.warn("Leaderboard insert failed:", lbe);
      }
    }

    if (s) {
      s.textContent = "Saved!";
      s.style.color = "#0b8457";
    }
  } catch (err) {
    console.error("Session upload failed:", err);
    const s = document.getElementById("saved-status");
    if (s) {
      s.textContent = "Save failed";
      s.style.color = "#c0392b";
    }
  }
}

if (restartBtn) {
  restartBtn.addEventListener("click", () => {
    if (leaderboardOnlyMode) {
      leaderboardOnlyMode = false;
      if (FM.ui && typeof FM.ui.showEmperor === "function") FM.ui.showEmperor();
    } else {
      startGame();
    }
  });
}

FM.addingUpGame = {
  startGame,
  showLeaderboardOnly
};
  function updateViewOffset() {
    if (!container || !blocksLayer) return;
    const viewport = container.clientHeight || 220;
    const maxHeightBlocks = Math.max(...heights, 0);
    const currentHeight = maxHeightBlocks * (cfg.block + cfg.gap) + FLOOR_HEIGHT;
    const padTop = 14;
    const overflow = Math.max(0, currentHeight - (viewport - padTop));
    blocksLayer.style.transform = `translateY(${overflow}px)`;
    const floor = document.getElementById("towerFloor");
    if (floor) floor.style.transform = `translateY(${overflow}px)`;
  }
