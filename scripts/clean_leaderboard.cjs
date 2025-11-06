// clean_leaderboard.cjs
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

function normalizeName(name) {
  if (!name) return "Player";
  return name
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function buildCanonicalId(playerName) {
  return normalizeName(playerName);
}

async function main() {
  const db = getFirestoreFromEnv();
  const leaderboardRef = db.collection("leaderboard");
  const snapshot = await leaderboardRef.get();
  console.log(`Fetched ${snapshot.size} leaderboard docs`);

  const grouped = {};
  snapshot.forEach(doc => {
    const d = doc.data() || {};
    const key = (d.playerName || "").trim().toLowerCase();
    if (!key) return;
    (grouped[key] ||= []).push({ id: doc.id, ...d });
  });

  let updated = 0;
  let deleted = 0;
  let renamed = 0;

  for (const key of Object.keys(grouped)) {
    const entries = grouped[key];
    if (entries.length === 0) continue;

    // Sort by best first (most questions, then least total time)
    entries.sort((a, b) => {
      if (b.questionsAnswered === a.questionsAnswered)
        return (a.totalTime ?? Infinity) - (b.totalTime ?? Infinity);
      return (b.questionsAnswered ?? 0) - (a.questionsAnswered ?? 0);
    });

    const best = entries[0];
    const canonicalId = buildCanonicalId(best.playerName);

    const canonicalRef = leaderboardRef.doc(canonicalId);
    const canonicalSnap = await canonicalRef.get();

    const batch = db.batch();

    if (!canonicalSnap.exists) {
      // No existing record → create it (copy best entry)
      batch.set(canonicalRef, best);
      renamed++;
    } else {
      // Compare & update only if new one is better
      const existing = canonicalSnap.data();
      const isBetter =
        best.questionsAnswered > (existing.questionsAnswered ?? 0) ||
        (best.questionsAnswered === existing.questionsAnswered &&
          best.totalTime < (existing.totalTime ?? Infinity));

      if (isBetter) {
        batch.set(canonicalRef, best, { merge: true });
        updated++;
      }
    }

    // Delete all other redundant entries except the canonical one
    for (const extra of entries) {
      if (extra.id !== canonicalId) {
        batch.delete(leaderboardRef.doc(extra.id));
        deleted++;
      }
    }

    await batch.commit();
  }

  console.log(
    `✅ Cleanup complete: ${renamed} new names created, ${updated} updated, ${deleted} duplicates removed.`
  );
}

main().catch(err => {
  console.error("❌ Error running cleanup:", err);
  process.exit(1);
});
