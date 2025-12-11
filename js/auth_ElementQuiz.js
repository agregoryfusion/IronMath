// auth_ElementQuiz.js - entry point for Periodic Sprint game
import "./utils.js";
import "./backend_main.js";
import "./data_elements.js";
import "./backend_ElementQuiz.js";
import "./gam_elementQuiz.js";

const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils;
const backendMain = FM.backendMain || {};
const backend = FM.backendElementQuiz || {};

const loadingScreen = document.getElementById("loading-screen");
const emperorScreen = document.getElementById("emperor-screen");
const emperorName = document.getElementById("emperorName");
const emperorScore = document.getElementById("emperorScore");
const playBtn = document.getElementById("playBtn");
const leaderboardBtn = document.getElementById("viewLeaderboardBtn");

const gameContainer = document.getElementById("game-container");
const endScreen = document.getElementById("end-screen");
let unauthorizedScreen = null;

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUaOrUckCuTrc9MHB9jCF4TUsx-hWFC7g",
  authDomain: "ironmath-1263b.firebaseapp.com",
  projectId: "ironmath-1263b",
  storageBucket: "ironmath-1263b.firebasestorage.app",
  messagingSenderId: "729878130193",
  appId: "1:729878130193:web:f4d447b552e4f955f80bb0",
  measurementId: "G-0VCM7C1HPC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);

FM.auth = {
  playerName: "Player",
  email: "",
  isTeacher: false,
  isStudent: false
};

function showUnauthorized(authInstance, message) {
  if (unauthorizedScreen) unauthorizedScreen.remove();
  unauthorizedScreen = document.createElement("div");
  unauthorizedScreen.className = "panel";
  unauthorizedScreen.style.maxWidth = "600px";
  unauthorizedScreen.style.margin = "60px auto";
  unauthorizedScreen.innerHTML = `
    <h3>Access Restricted</h3>
    <p>${message || "Please sign in with your @fusionacademy account to play."}</p>
    <button id="retrySignInBtn" class="primary-btn">Sign in again</button>
  `;
  document.body.appendChild(unauthorizedScreen);
  if (loadingScreen) loadingScreen.style.display = "none";
  if (emperorScreen) emperorScreen.style.display = "none";
  if (gameContainer) gameContainer.style.display = "none";
  if (endScreen) endScreen.style.display = "none";
  const retryBtn = unauthorizedScreen.querySelector("#retrySignInBtn");
  if (retryBtn) {
    retryBtn.addEventListener("click", async () => {
      try { await signOut(authInstance); } catch (e) { console.error(e); }
      if (unauthorizedScreen) unauthorizedScreen.remove();
      window.location.href = "index.html";
    });
  }
}

function showLoading() {
  if (loadingScreen) loadingScreen.style.display = "flex";
  if (emperorScreen) emperorScreen.style.display = "none";
  if (gameContainer) gameContainer.style.display = "none";
  if (endScreen) endScreen.style.display = "none";
}

async function handleSignedIn(user) {
  const email = user.email?.toLowerCase() || "";
  let isTeacher = false;
  let isStudent = false;

  if (email.endsWith("@fusionacademy.com")) {
    isTeacher = true;
    isStudent = false;
  } else if (email.endsWith("@fusionacademy.me")) {
    isStudent = true;
    isTeacher = false;
  }

  const playerName = user.displayName || (U && U.parseEmailToName ? U.parseEmailToName(user.email) : "Player");

  const allowed = email.endsWith("@fusionacademy.com") || email.endsWith("@fusionacademy.me");
  if (!allowed) {
    return showUnauthorized(auth, "Please sign in with your @fusionacademy account to play.");
  }

  FM.auth.playerName = playerName;
  FM.auth.email = email;
  FM.auth.isTeacher = isTeacher;
  FM.auth.isStudent = isStudent;

  showLoading();

  try {
    const [userId] = await Promise.all([
      backendMain.recordUserLogin(email, playerName),
      backend.loadLeaderboard("students", "monthly", true)
    ]);
    window.currentUserId = userId;
  } catch (err) {
    console.error("Initial load failed:", err);
  }

  showEmperor();
}

function showEmperor() {
  const auth = FM.auth || {};
  const role = auth.isTeacher ? "teacher" : "student";
  const top = backend.getTopByRole ? backend.getTopByRole(role) : backend.getEmperorTopStudent();
  const fallback = (!top && backend.getTopByRole) ? backend.getTopByRole("student") : top;
  const target = fallback || top;
  if (target) {
    const total = (target.symbolsCorrect ?? 0) + (target.numbersCorrect ?? 0);
    emperorName.textContent = target.playerName;
    emperorScore.textContent = `${total} / 236`;
  } else {
    emperorName.textContent = "...";
    emperorScore.textContent = "...";
  }

  if (loadingScreen) loadingScreen.style.display = "none";
  if (emperorScreen) emperorScreen.style.display = "block";
  if (gameContainer) gameContainer.style.display = "none";
}

FM.ui = { showEmperor };

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await handleSignedIn(user);
  } else {
    if (emperorScreen) emperorScreen.style.display = "none";
    if (gameContainer) gameContainer.style.display = "none";
    if (endScreen) endScreen.style.display = "none";
    window.location.href = "index.html";
  }
});

if (playBtn) {
  playBtn.addEventListener("click", () => {
    if (emperorScreen) emperorScreen.style.display = "none";
    if (FM.elementQuizGame && typeof FM.elementQuizGame.startGame === "function") {
      FM.elementQuizGame.startGame();
    }
  });
}

if (leaderboardBtn) {
  leaderboardBtn.addEventListener("click", () => {
    if (loadingScreen) loadingScreen.style.display = "none";
    if (emperorScreen) emperorScreen.style.display = "none";
    if (FM.elementQuizGame && typeof FM.elementQuizGame.showLeaderboardOnly === "function") {
      FM.elementQuizGame.showLeaderboardOnly();
    }
  });
}
