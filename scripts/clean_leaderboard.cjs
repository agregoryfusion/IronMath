// scripts/clean_leaderboard.js
const { Firestore } = require("@google-cloud/firestore");

function getFirestoreFromEnv() {
  const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  return new Firestore({
    projectId: creds.project_id,
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
  });
}

async function main() {
  const db = getFirestoreFromEnv();
  const leaderboardRef = db.collection("leaderboard");
  const snap = await leaderboardRef.get();
  console.log(`Fetched ${snap.size} leaderboard docs`);

  const grouped = {};
  snap.forEach(doc => {
    const d = doc.data() || {};
    const key = (d.playerName || "").trim().toLowerCase();
    if (!key) return;
    (grouped[key] ||= []).push({ id: doc.id, ...d });
  });

  const toDelete = [];
  for (const key of Object.keys(grouped)) {
    const list = grouped[key];
    if (list.length <= 1) continue;

    list.sort((a, b) => {
      const qa = a.questionsAnswered ?? 0;
      const qb = b.questionsAnswered ?? 0;
      if (qb === qa) {
        const ta = a.totalTime ?? Number.POSITIVE_INFINITY;
        const tb = b.totalTime ?? Number.POSITIVE_INFINITY;
        return ta - tb;
      }
      return qb - qa;
    });

    for (const extra of list.slice(1)) {
      toDelete.push(extra.id);
    }
  }

  // Chunk deletes
  const chunk = 450;
  for (let i = 0; i < toDelete.length; i += chunk) {
    const batch = db.batch();
    for (const id of toDelete.slice(i, i + chunk)) {
      batch.delete(leaderboardRef.doc(id));
    }
    await batch.commit();
  }

  console.log(`Deleted ${toDelete.length} duplicate docs.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
