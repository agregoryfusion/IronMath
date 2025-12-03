const lbMonthlyBtn = document.getElementById("lbMonthlyBtn");
const lbAllTimeBtn = document.getElementById("lbAllTimeBtn");
const viewAllBtn = document.getElementById("viewAllBtn");
const viewStudentsBtn = document.getElementById("viewStudentsBtn");
const viewTeachersBtn = document.getElementById("viewTeachersBtn");
const FM = (window.FastMath = window.FastMath || {});
const backend = FM.backendAddingUp || {};

let currentScope = "all";
let currentTime = "monthly";

function highlightTimeButton(time) {
  if (!lbMonthlyBtn && !lbAllTimeBtn) return;
  lbMonthlyBtn?.classList.remove("active");
  lbAllTimeBtn?.classList.remove("active");
  if ((time || "").toString().trim().toLowerCase() === "alltime") {
    lbAllTimeBtn?.classList.add("active");
  } else {
    lbMonthlyBtn?.classList.add("active");
  }
}

function highlightScopeButton(scope) {
  viewAllBtn.classList.remove("active");
  viewStudentsBtn.classList.remove("active");
  viewTeachersBtn.classList.remove("active");

  if (scope === "all") viewAllBtn.classList.add("active");
  if (scope === "students") viewStudentsBtn.classList.add("active");
  if (scope === "teachers") viewTeachersBtn.classList.add("active");
}

lbMonthlyBtn?.addEventListener("click", () => {
  currentTime = "monthly";
  highlightTimeButton(currentTime);
  backend.loadLeaderboard(currentScope === "all" ? "all" : currentScope, "monthly", true);
});

lbAllTimeBtn?.addEventListener("click", () => {
  currentTime = "alltime";
  highlightTimeButton(currentTime);
  backend.loadLeaderboard(currentScope === "all" ? "all" : currentScope, "alltime", true);
});

viewAllBtn?.addEventListener("click", () => {
  currentScope = "all";
  highlightScopeButton("all");
  backend.loadLeaderboard("all", currentTime, false);
});

viewStudentsBtn?.addEventListener("click", () => {
  currentScope = "students";
  highlightScopeButton("students");
  backend.loadLeaderboard("students", currentTime, false);
});

viewTeachersBtn?.addEventListener("click", () => {
  currentScope = "teachers";
  highlightScopeButton("teachers");
  backend.loadLeaderboard("teachers", currentTime, false);
});

highlightScopeButton(currentScope);

if (backend && typeof backend.loadLeaderboard === "function") {
  const _origLoad = backend.loadLeaderboard.bind(backend);
  backend.loadLeaderboard = async function (scopeFilter = "all", timeFilter = "monthly", forceRefresh = false) {
    let normalized = timeFilter;
    if (typeof normalized === "boolean") {
      forceRefresh = normalized;
      normalized = "monthly";
    }
    if (typeof normalized === "string") {
      normalized = normalized.trim().toLowerCase();
      if (normalized === "all" || normalized === "alltime" || normalized === "all-time") normalized = "alltime";
      else normalized = "monthly";
    } else normalized = "monthly";

    highlightTimeButton(normalized);
    return await _origLoad(scopeFilter, timeFilter, forceRefresh);
  };
}

highlightTimeButton(currentTime);
