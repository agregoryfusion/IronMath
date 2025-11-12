// scripts/export_sessions.cjs
const fs = require("fs");
const path = require("path");
const { Firestore } = require("@google-cloud/firestore");

function getFirestoreFromEnv() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) {
    throw new Error("Missing env GOOGLE_APPLICATION_CREDENTIALS_JSON");
  }
  const creds = JSON.parse(raw);
  return new Firestore({
    projectId: creds.project_id,
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Escape if contains comma, quote, or newline
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  const db = getFirestoreFromEnv();

  const outDir = path.join(process.cwd(), "outputs");
  fs.mkdirSync(outDir, { recursive: true });

  const sessionsCsv = [
    "dateAdded,penaltyTime,playerName,questionsAnswered,sessionID,stageReached,totalTime",
  ];
  const answersCsv = [
    "a,b,dateAdded,mistakes,stage,success,timeTaken,playerName",
  ];

  // Pull all session docs
  const snap = await db.collection("sessions").get();
  console.log(`Found ${snap.size} session docs`);

  snap.forEach((doc) => {
    const s = doc.data() || {};

    // --- Sessions CSV row ---
    const row = [
      s.dateAdded ?? "",
      s.penaltyTime ?? "",
      s.playerName ?? "",
      s.questionsAnswered ?? "",
      s.sessionID ?? doc.id, // fall back to doc id if needed
      s.stageReached ?? "",
      s.totalTime ?? "",
    ]
      .map(csvEscape)
      .join(",");

    sessionsCsv.push(row);

    // --- Answers CSV rows (flatten) ---
    const answers = Array.isArray(s.answers) ? s.answers : null;
    if (answers && answers.length) {
      for (const a of answers) {
        const arow = [
          a.a ?? "",
          a.b ?? "",
          a.dateAdded ?? "",
          a.mistakes ?? "",
          a.stage ?? "",
          a.success ?? "",
          a.timeTaken ?? "",
          s.playerName ?? "",
        ]
          .map(csvEscape)
          .join(",");
        answersCsv.push(arow);
      }
    }
  });

  // Write files
  const sessionsPath = path.join(outDir, "sessions_export.csv");
  const answersPath = path.join(outDir, "answers_export.csv");
  fs.writeFileSync(sessionsPath, sessionsCsv.join("\n"));
  fs.writeFileSync(answersPath, answersCsv.join("\n"));

  console.log("Wrote:");
  console.log(" -", sessionsPath);
  console.log(" -", answersPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
