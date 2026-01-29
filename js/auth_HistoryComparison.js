// auth_HistoryComparison.js - entry for History timeline game (Game 2)
import "./utils.js";
import "./backend_main.js";
import "./backend_Comparisoning.js";
import "./HistoryComparison.js";

const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};
const backendMain = FM.backendMain || {};
const game = FM.historyComparisonGame || {};

const loadingScreen = document.getElementById("loading-screen");

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

function showLoading() {
  if (loadingScreen) loadingScreen.style.display = "flex";
}

function handleUnauthorized(message) {
  if (game && game.showUnauthorized) {
    game.showUnauthorized(message);
  } else {
    alert(message || "Unauthorized");
  }
}

async function handleSignedIn(user) {
  const email = user.email?.toLowerCase() || "";
  const allowed = email.endsWith("@fusionacademy.com") || email.endsWith("@fusionacademy.me");
  if (!allowed) {
    return handleUnauthorized("Please sign in with your @fusionacademy account to play.");
  }

  const playerName = user.displayName || (U && U.parseEmailToName ? U.parseEmailToName(user.email) : "Player");
  const isTeacher = email.endsWith("@fusionacademy.com");
  const isStudent = email.endsWith("@fusionacademy.me");

  FM.auth.playerName = playerName;
  FM.auth.email = email;
  FM.auth.isTeacher = isTeacher;
  FM.auth.isStudent = isStudent;

  showLoading();

  try {
    const userId = await backendMain.recordUserLogin(email, playerName);
    window.currentUserId = userId;
    await game.bootstrap({
      userId,
      playerName,
      isTeacher,
      isStudent
    });
  } catch (err) {
    console.error("Bootstrap failed", err);
    handleUnauthorized("Unable to load the game right now.");
    try { await signOut(auth); } catch (_) { /* ignore */ }
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    handleSignedIn(user);
  } else {
    handleUnauthorized("Please sign in from the home screen first.");
  }
});
