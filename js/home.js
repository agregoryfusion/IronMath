import "./utils.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  OAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const FM = (window.FastMath = window.FastMath || {});
const U = FM.utils || {};

const loginScreen = document.getElementById("login-screen");
const loginBtn = document.getElementById("loginBtn");
const loginStatus = document.getElementById("loginStatus");
const homeScreen = document.getElementById("home-screen");
const userNameEl = document.getElementById("userName");
const userEmailEl = document.getElementById("userEmail");
const signOutBtn = document.getElementById("signOutBtn");
const placeholderCard = document.querySelector(".app-card.placeholder");
const filterButtons = Array.from(document.querySelectorAll(".filter-pill"));
const appCards = Array.from(document.querySelectorAll(".app-card[data-field]"));
let activeField = null;

// Konami code easter egg to replace the "Coming Soon?" text with an image
const KONAMI_SEQUENCE = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let konamiIndex = 0;
function revealKonamiImage() {
  if (!placeholderCard || placeholderCard.dataset.konamiShown === "1") return;
  placeholderCard.dataset.konamiShown = "1";
  const existingText = placeholderCard.querySelector(".muted");
  if (existingText) existingText.remove();
  const img = document.createElement("img");
  img.src = "https://images.squarespace-cdn.com/content/v1/56608ba6e4b0527b5cbad513/1679335688247-43ISQGVR7SLDS1HMUXAG/mothra.png?format=750w";
  img.alt = "Hidden preview unlocked";
  img.className = "konami-img";
  placeholderCard.appendChild(img);
}
window.addEventListener("keydown", (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const expected = KONAMI_SEQUENCE[konamiIndex];
  if (key === expected || (expected === "b" && key === "b") || (expected === "a" && key === "a")) {
    konamiIndex += 1;
    if (konamiIndex === KONAMI_SEQUENCE.length) {
      revealKonamiImage();
      konamiIndex = 0;
    }
  } else {
    konamiIndex = key === KONAMI_SEQUENCE[0] ? 1 : 0;
  }
});

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
const provider = new OAuthProvider("microsoft.com");
await setPersistence(auth, browserLocalPersistence);

function showHome(user) {
  const displayName = user?.displayName || (U.parseEmailToName ? U.parseEmailToName(user?.email) : "Player");
  if (userNameEl) userNameEl.textContent = "Welcome " + displayName || "Player";
  if (userEmailEl) userEmailEl.textContent = user?.email || "";

  if (loginScreen) loginScreen.style.display = "none";
  if (homeScreen) {
    homeScreen.style.display = "flex";
    homeScreen.style.opacity = "1";
  }
  if (loginStatus) loginStatus.textContent = "";
}

function showLogin(message = "") {
  if (homeScreen) {
    homeScreen.style.display = "none";
    homeScreen.style.opacity = "0";
  }
  if (loginScreen) loginScreen.style.display = "flex";
  if (loginStatus) loginStatus.textContent = message;
}

function applyFilter(field) {
  appCards.forEach((card) => {
    const cardField = (card.dataset.field || "").toLowerCase();
    if (!field || cardField === field.toLowerCase()) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
}

function bindFilters() {
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.field || "";
      const isAlreadyActive = activeField && activeField.toLowerCase() === field.toLowerCase();
      activeField = isAlreadyActive ? null : field;

      filterButtons.forEach((b) => b.classList.toggle("active", b === btn && !isAlreadyActive));
      applyFilter(activeField);
    });
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    showHome(user);
  } else {
    showLogin();
  }
});

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    try {
      if (loginStatus) loginStatus.textContent = "Signing in...";
      const result = await signInWithPopup(auth, provider);
      showHome(result.user);
    } catch (e) {
      console.error("Sign-in error:", e);
      showLogin("Sign-in failed: " + (e?.message || e));
    }
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showLogin();
    } catch (e) {
      console.error("Sign-out error:", e);
      if (loginStatus) loginStatus.textContent = "Sign-out failed: " + (e?.message || e);
    }
  });
}

// set up category filters immediately
bindFilters();
