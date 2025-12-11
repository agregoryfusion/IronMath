const lbMonthlyBtn = document.getElementById("lbMonthlyBtn");
const lbAllTimeBtn = document.getElementById("lbAllTimeBtn");
const viewAllBtn = document.getElementById("viewAllBtn");
const viewStudentsBtn = document.getElementById("viewStudentsBtn");
const viewTeachersBtn = document.getElementById("viewTeachersBtn");
const FM = (window.FastMath = window.FastMath || {});
const backend = FM.backendRuleStack || {};

let currentScope = "all";
let currentTime = "monthly";

function highlightTimeButton(time) {
  lbMonthlyBtn?.classList.remove("active");
  lbAllTimeBtn?.classList.remove("active");
  if ((time || "").toString().trim().toLowerCase() === "alltime") {
    lbAllTimeBtn?.classList.add("active");
  } else {
    lbMonthlyBtn?.classList.add("active");
  }
}

function highlightScopeButton(scope) {
  viewAllBtn?.classList.remove("active");
  viewStudentsBtn?.classList.remove("active");
  viewTeachersBtn?.classList.remove("active");
  if (scope === "all") viewAllBtn?.classList.add("active");
  if (scope === "students") viewStudentsBtn?.classList.add("active");
  if (scope === "teachers") viewTeachersBtn?.classList.add("active");
}

lbMonthlyBtn?.addEventListener("click", () => {
  currentTime = "monthly";
  highlightTimeButton(currentTime);
  backend.loadLeaderboard(currentScope, "monthly", true);
});

lbAllTimeBtn?.addEventListener("click", () => {
  currentTime = "alltime";
  highlightTimeButton(currentTime);
  backend.loadLeaderboard(currentScope, "alltime", true);
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
highlightTimeButton(currentTime);
