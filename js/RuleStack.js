// RuleStack.js - password-style numeric criteria game logic
const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};
const backend = FM.backendRuleStack || {};

// DOM references
const gameContainer = document.getElementById("game-container");
const endScreen = document.getElementById("end-screen");
const emperorScreen = document.getElementById("emperor-screen");
const questionEl = document.getElementById("question");
const answerEl = document.getElementById("answer");
const ruleListEl = document.getElementById("ruleList");
const stageInfo = document.getElementById("stage-info");
const timerFill = document.getElementById("timerFill");
const restartBtn = document.getElementById("restartBtn");
const lbWrap = document.getElementById("leaderboardContainer");
const lbStatus = document.getElementById("leaderboardStatus");
const feedbackEl = document.getElementById("feedback");
const ruleMetaEl = document.getElementById("ruleMeta");
const difficultyMetaEl = document.getElementById("difficultyMeta");

// Tunable knobs (exposed for quick tuning)
const TIMER_SECONDS = 12;
const PENALTY_MULT = 1.6;
const CRITERIA_INTERVAL_MEAN = 40;
const CRITERIA_INTERVAL_SD = 10;
const MIN_INTERVAL = 6;
const MAX_RULE_SLOTS = 8;
const DIFFICULTY_RAMP_EVERY = 8;
const DIFFICULTY_MAX = 9;

// State
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
let previousAnswer = null;
let usedAnswers = new Set();
let activeRuleSlots = 1;
let nextRuleUnlock = 0;
let peakRulesUsed = 1;
let peakDifficulty = 1;

let runData = { sessionID: "", results: [] };

// Utility helpers
const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const gcd = (a, b) => {
  let x = Math.abs(Math.round(a || 0));
  let y = Math.abs(Math.round(b || 0));
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
};
const lcm = (a, b) => {
  if (!a || !b) return 0;
  return Math.abs(a * b) / gcd(a, b || 1);
};
const digitSum = (n) => Math.abs(Math.round(n || 0)).toString().split("").reduce((s, d) => s + Number(d || 0), 0);
const isPerfectSquare = (n) => {
  if (n < 0) return false;
  const r = Math.floor(Math.sqrt(n));
  return r * r === n;
};
const isPerfectCube = (n) => {
  const r = Math.round(Math.cbrt(n));
  return r * r * r === n;
};
const isPrime = (n) => {
  const x = Math.abs(Math.round(n));
  if (x < 2) return false;
  if (x % 2 === 0) return x === 2;
  const limit = Math.floor(Math.sqrt(x));
  for (let i = 3; i <= limit; i += 2) {
    if (x % i === 0) return false;
  }
  return true;
};
const sampleInterval = () => {
  if (U.sampleTrunc) {
    return Math.max(
      MIN_INTERVAL,
      Math.round(U.sampleTrunc(MIN_INTERVAL, CRITERIA_INTERVAL_MEAN * 3, CRITERIA_INTERVAL_MEAN, CRITERIA_INTERVAL_SD))
    );
  }
  return Math.max(MIN_INTERVAL, Math.round(CRITERIA_INTERVAL_MEAN + (Math.random() - 0.5) * CRITERIA_INTERVAL_SD * 2));
};

// Rule library: build returns { label, check, tags?, excludes? }
const RULE_LIBRARY = [
  {
    id: "positive",
    difficulty: 1,
    tags: ["sign-positive"],
    excludes: ["sign-negative"],
    build: () => ({ label: "Number must be positive", check: (n) => n > 0 })
  },
  {
    id: "negative",
    difficulty: 1,
    tags: ["sign-negative"],
    excludes: ["sign-positive"],
    build: () => ({ label: "Number must be negative", check: (n) => n < 0 })
  },
  {
    id: "nonzero",
    difficulty: 1,
    tags: ["nonzero"],
    build: () => ({ label: "Number cannot be 0", check: (n) => n !== 0 })
  },
  {
    id: "even",
    difficulty: 1,
    tags: ["parity-even"],
    excludes: ["parity-odd"],
    build: () => ({ label: "Number must be even", check: (n) => n % 2 === 0 })
  },
  {
    id: "odd",
    difficulty: 1,
    tags: ["parity-odd"],
    excludes: ["parity-even"],
    build: () => ({ label: "Number must be odd", check: (n) => Math.abs(n) % 2 === 1 })
  },
  {
    id: "range",
    difficulty: 2,
    build: () => {
      const centers = [10, 20, 30, 40, 50, 75, 100, 125, 150];
      const span = randChoice([12, 16, 20, 24, 32, 40, 50]);
      const c = randChoice(centers);
      const low = c - span;
      const high = c + span;
      return {
        label: `Between ${low} and ${high} (inclusive)`,
        check: (n) => n >= low && n <= high,
        tags: ["range"],
        excludes: []
      };
    }
  },
  {
    id: "multiple-of",
    difficulty: 2,
    build: () => {
      const factors = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const f = randChoice(factors);
      return {
        label: `A multiple of ${f}`,
        check: (n) => n % f === 0,
        tags: [`multiple-${f}`],
        excludes: []
      };
    }
  },
  {
    id: "not-multiple-of",
    difficulty: 2,
    build: () => {
      const factors = [3, 4, 5, 6, 7, 8, 9, 10];
      const f = randChoice(factors);
      return {
        label: `Not divisible by ${f}`,
        check: (n) => n % f !== 0,
        tags: [`not-multiple-${f}`],
        excludes: [`multiple-${f}`]
      };
    }
  },
  {
    id: "perfect-square",
    difficulty: 3,
    tags: ["square"],
    excludes: ["prime"],
    build: () => ({ label: "A perfect square", check: (n) => isPerfectSquare(n) })
  },
  {
    id: "perfect-cube",
    difficulty: 3,
    tags: ["cube"],
    build: () => ({ label: "A perfect cube", check: (n) => isPerfectCube(n) })
  },
  {
    id: "digit-sum",
    difficulty: 3,
    build: () => {
      const targets = [3, 4, 5, 6, 7, 8, 9];
      const t = randChoice(targets);
      return {
        label: `Digit sum divisible by ${t}`,
        check: (n) => digitSum(n) % t === 0,
        tags: ["digit-sum"],
        excludes: []
      };
    }
  },
  {
    id: "contains-digit",
    difficulty: 2,
    build: () => {
      const d = randChoice([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      return {
        label: `Contains the digit ${d}`,
        check: (n) => Math.abs(Math.round(n || 0)).toString().includes(String(d)),
        tags: [`has-digit-${d}`],
        excludes: []
      };
    }
  },
  {
    id: "ends-with-digit",
    difficulty: 2,
    build: () => {
      const d = randChoice([1, 3, 4, 6, 7, 8, 9]);
      return {
        label: `Ends with ${d}`,
        check: (n) => Math.abs(Math.round(n || 0)).toString().endsWith(String(d)),
        tags: [`ends-${d}`],
        excludes: []
      };
    }
  },
  {
    id: "prime",
    difficulty: 4,
    tags: ["prime"],
    excludes: ["square", "cube"],
    build: () => ({ label: "A prime number (|n| ≤ 200000)", check: (n) => Math.abs(n) <= 200000 && isPrime(n) })
  },
  {
    id: "coprime-with-prev",
    difficulty: 3,
    tags: ["coprime-prev"],
    excludes: ["shares-factor-prev", "multiple-prev"],
    build: (ctx) => {
      if (ctx.previousAnswer === null) return null;
      const target = Math.abs(Math.round(ctx.previousAnswer || 0));
      if (target === 0 || target === 1) return null;
      return {
        label: `Coprime with previous answer (${target})`,
        check: (n) => gcd(n, target) === 1
      };
    }
  },
  {
    id: "shares-factor-prev",
    difficulty: 3,
    tags: ["shares-factor-prev"],
    excludes: ["coprime-prev"],
    build: (ctx) => {
      if (ctx.previousAnswer === null) return null;
      const target = Math.abs(Math.round(ctx.previousAnswer || 0));
      if (target === 0 || target === 1) return null;
      return {
        label: `Shares a factor with previous answer (${target})`,
        check: (n) => gcd(n, target) > 1
      };
    }
  },
  {
    id: "multiple-of-prev",
    difficulty: 5,
    tags: ["multiple-prev"],
    excludes: ["coprime-prev"],
    build: (ctx) => {
      if (ctx.previousAnswer === null || ctx.previousAnswer === 0) return null;
      return {
        label: `A multiple of previous answer (${ctx.previousAnswer})`,
        check: (n) => n % ctx.previousAnswer === 0
      };
    }
  },
  {
    id: "factor-of-prev",
    difficulty: 4,
    build: (ctx) => {
      if (ctx.previousAnswer === null || ctx.previousAnswer === 0) return null;
      return {
        label: `A factor of previous answer (${ctx.previousAnswer})`,
        check: (n) => ctx.previousAnswer % n === 0,
        tags: ["factor-prev"],
        excludes: []
      };
    }
  },
  {
    id: "lcm-threshold",
    difficulty: 5,
    build: (ctx) => {
      const base = randChoice([6, 8, 10, 12, 14, 15, 16, 18, 20, 24, 30]);
      const cap = base * randChoice([4, 5, 6, 8]);
      return {
        label: `LCM with ${base} must be ≤ ${cap}`,
        check: (n) => lcm(n, base) <= cap,
        tags: ["lcm"],
        excludes: []
      };
    }
  },
  {
    id: "magnitude-band",
    difficulty: 2,
    build: () => {
      const bands = [
        [1, 25],
        [10, 60],
        [50, 120],
        [100, 200],
        [150, 320],
        [250, 520]
      ];
      const [low, high] = randChoice(bands);
      return {
        label: `Absolute value between ${low} and ${high}`,
        check: (n) => {
          const v = Math.abs(n);
          return v >= low && v <= high;
        },
        tags: ["magnitude"],
        excludes: []
      };
    }
  }
];

function isCompatible(candidate, selected) {
  const candTags = new Set(candidate.tags || []);
  const candEx = new Set(candidate.excludes || []);
  for (const s of selected) {
    const tags = new Set(s.tags || []);
    const ex = new Set(s.excludes || []);
    for (const t of candTags) {
      if (ex.has(t)) return false;
    }
    for (const t of tags) {
      if (candEx.has(t)) return false;
    }
  }
  return true;
}

function chooseRules(ruleCount, difficulty, ctx) {
  const pool = RULE_LIBRARY.filter((r) => r.difficulty <= difficulty);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const chosen = [];
  for (const def of shuffled) {
    if (chosen.length >= ruleCount) break;
    if (chosen.some((c) => c.id === def.id)) continue;
    const built = def.build(ctx || {}) || null;
    if (!built || typeof built.check !== "function") continue;
    const candidate = {
      id: def.id,
      difficulty: def.difficulty,
      tags: def.tags || [],
      excludes: def.excludes || [],
      ...built
    };
    candidate.tags = [...new Set([...(def.tags || []), ...(built.tags || [])])];
    candidate.excludes = [...new Set([...(def.excludes || []), ...(built.excludes || [])])];
    if (!isCompatible(candidate, chosen)) continue;
    chosen.push(candidate);
  }
  if (chosen.length === 0) {
    return [
      {
        id: "fallback-any",
        label: "Any integer works",
        difficulty: 1,
        tags: [],
        excludes: [],
        check: () => true
      }
    ];
  }
  return chosen;
}

function shake(el, mult = 1) {
  if (!el) return;
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

function setFeedback(msg, tone = "") {
  if (!feedbackEl) return;
  feedbackEl.textContent = msg;
  feedbackEl.className = `muted small ${tone}`;
}

function computeDifficulty(idx) {
  return Math.min(DIFFICULTY_MAX, 1 + Math.floor((idx - 1) / DIFFICULTY_RAMP_EVERY));
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
  previousAnswer = null;
  usedAnswers = new Set();
  activeRuleSlots = 1;
  nextRuleUnlock = sampleInterval();
  peakRulesUsed = 1;
  peakDifficulty = 1;
}

function renderRules(rules) {
  if (!ruleListEl) return;
  ruleListEl.innerHTML = "";
  rules.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r.label;
    ruleListEl.appendChild(li);
  });
  if (ruleMetaEl) ruleMetaEl.textContent = `Rules active: ${rules.length}`;
  if (difficultyMetaEl && current) {
    difficultyMetaEl.textContent = `Difficulty: ${current.difficultyLevel}`;
  }
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

function computeRuleCount(difficulty) {
  const baseline = 1 + Math.floor((difficulty - 1) / 2);
  return Math.min(MAX_RULE_SLOTS, Math.min(activeRuleSlots, baseline));
}

function updateUnlocks() {
  if (questionCount >= nextRuleUnlock) {
    activeRuleSlots = Math.min(MAX_RULE_SLOTS, activeRuleSlots + 1);
    nextRuleUnlock += sampleInterval();
  }
}

function nextQuestion() {
  const qIdx = correctCount + 1;
  const difficulty = computeDifficulty(qIdx);
  const ruleCount = computeRuleCount(difficulty);
  const rules = chooseRules(ruleCount, difficulty, { previousAnswer });

  current = {
    rules,
    ruleCount: rules.length,
    difficultyLevel: difficulty
  };

  peakRulesUsed = Math.max(peakRulesUsed, rules.length);
  peakDifficulty = Math.max(peakDifficulty, difficulty);

  mistakesThisQuestion = 0;
  renderRules(rules);
  if (stageInfo) stageInfo.textContent = `Question ${qIdx} • Difficulty ${difficulty}`;
  setFeedback("No repeats. Enter when ready.", "");
  answerEl.value = "";
  answerEl.focus();

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
        ruleCount: current.ruleCount,
        rules: current.rules.map((r) => r.label),
        ruleIds: current.rules.map((r) => r.id),
        difficulty: current.difficultyLevel,
        timeTaken: trueT,
        mistakes: mistakesThisQuestion,
        success: false,
        answer: null,
        penaltyApplied: penaltySecondsThisRound
      });
      return gameOver();
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  const handleSubmit = () => {
    if (!current) return;
    const raw = (answerEl.value || "").trim();
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) {
      setFeedback("Enter a valid number.", "warn");
      shake(questionEl, 1);
      return;
    }
    if (usedAnswers.has(value)) {
      applyPenalty("No repeats this run.");
      return;
    }

    const ctx = { previousAnswer, rules: current.rules };
    for (const rule of current.rules) {
      try {
        if (!rule.check(value, ctx)) {
          applyPenalty(`Fails rule: ${rule.label}`);
          return;
        }
      } catch (e) {
        applyPenalty("Rule check failed.");
        return;
      }
    }

    const trueT = (performance.now() - qStartTs) / 1000;
    totalTimeTrue += trueT;
    correctCount++;
    questionCount++;
    usedAnswers.add(value);
    previousAnswer = value;

    runData.results.push({
      questionNumber: runData.results.length + 1,
      ruleCount: current.ruleCount,
      rules: current.rules.map((r) => r.label),
      ruleIds: current.rules.map((r) => r.id),
      difficulty: current.difficultyLevel,
      timeTaken: trueT,
      mistakes: mistakesThisQuestion,
      success: true,
      answer: value,
      penaltyApplied: penaltySecondsThisRound
    });

    updateUnlocks();
    current = null;
    return nextQuestion();
  };

  function applyPenalty(reason) {
    const avgModifiedSoFar = (totalTimeTrue + penaltySeconds) / Math.max(correctCount, 1) || 2.0;
    const penalty = avgModifiedSoFar * Math.pow(PENALTY_MULT, mistakesThisQuestion);
    mistakesThisQuestion++;
    penaltySeconds += penalty;
    penaltySecondsThisRound += penalty;
    const remaining = TIMER_SECONDS - ((performance.now() - qStartTs) / 1000) - penaltySecondsThisRound;
    timeLeft = Math.max(0, remaining);
    const pct = Math.max(0, Math.min(1, timeLeft / TIMER_SECONDS));
    timerFill.style.width = pct * 100 + "%";
    setFeedback(reason, "warn");
    shake(questionEl, mistakesThisQuestion);
    if (remaining <= 0) {
      runData.results.push({
        questionNumber: runData.results.length + 1,
        ruleCount: current.ruleCount,
        rules: current.rules.map((r) => r.label),
        ruleIds: current.rules.map((r) => r.id),
        difficulty: current.difficultyLevel,
        timeTaken: (performance.now() - qStartTs) / 1000,
        mistakes: mistakesThisQuestion,
        success: false,
        answer: null,
        penaltyApplied: penaltySecondsThisRound
      });
      return gameOver();
    }
  }

  answerEl.onkeydown = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
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
  if (restartBtn) restartBtn.textContent = "Play";
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
  document.getElementById("end-rules").textContent = `Max rules faced: ${peakRulesUsed}`;
  document.getElementById("end-difficulty").textContent = `Peak difficulty: ${peakDifficulty}`;
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
    const userId = backend.safeUserId ? backend.safeUserId(window.currentUserId) : null;
    const toFinite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);

    const insertPayload = {
      user_id: userId,
      player_name: playerName,
      questions_answered: toFinite(correctCount, 0),
      true_time_seconds: toFinite(totalTrue, 0),
      penalty_time_seconds: toFinite(penaltySeconds, 0),
      total_time_seconds: toFinite(totalWithPen, 0),
      max_rules_used: peakRulesUsed,
      hardest_rule_difficulty: peakDifficulty,
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
      answer_value: q.answer,
      rule_count: q.ruleCount,
      rule_labels: q.rules,
      rule_ids: q.ruleIds,
      difficulty: q.difficulty,
      time_taken: toFinite(q.timeTaken, 0),
      mistakes: toFinite(q.mistakes, 0),
      success: !!q.success,
      penalty_time: toFinite(q.penaltyApplied, 0),
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
          max_rules_used: peakRulesUsed,
          hardest_rule_difficulty: peakDifficulty,
          final_time_seconds: toFinite(totalWithPen, 0)
        });
        if (backend.loadLeaderboard) {
          backend.loadLeaderboard("all", "monthly", true);
        }
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
      startGame();
    } else {
      startGame();
    }
  });
}

FM.ruleStackGame = {
  startGame,
  showLeaderboardOnly
};
