/**
 * Fetches engagement metrics for all posted content and updates posted.json.
 *
 * What we track and why:
 *
 *   THREADS
 *   ├── views      → raw reach (equivalent of "1M views" on Threads text posts)
 *   ├── likes      → passive approval
 *   ├── replies    → community signal — people cared enough to respond
 *   ├── reposts    → distribution — amplified to other feeds
 *   └── quotes     → high-intent reposts with commentary
 *
 *   INSTAGRAM (carousel — not Reels, so no "play count")
 *   ├── reach        → unique accounts who saw it — the carousel equivalent of "views"
 *   ├── impressions  → total exposures (reach × avg repeat views)
 *   ├── saved        → strongest quality signal: people bookmarked it to return to
 *   ├── shares       → sent it to someone — distribution beyond followers
 *   ├── likes        → passive approval
 *   ├── comments     → community signal
 *   ├── follows      → direct conversions from this post
 *   └── profile_visits → interest generated, even if no follow yet
 *
 * Note on "1M views": that metric is from Instagram REELS (video play count).
 * Carousels use `reach` instead — unique eyeballs. Same concept, different label.
 * To get a views-style number for carousels, use `reach`.
 *
 * Run:  node scripts/track.mjs
 * Cron: daily at 10am MYT (midnight ET) — runs after the previous night's post has 12h of data
 */

import fs from "fs";
import https from "https";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const env = fs.existsSync(".env.local")
  ? Object.fromEntries(
      fs.readFileSync(".env.local", "utf8")
        .split("\n")
        .filter(l => l.includes("="))
        .map(l => [l.split("=")[0], l.split("=").slice(1).join("=")])
    )
  : {};

const META_ACCESS_TOKEN      = process.env.META_ACCESS_TOKEN      ?? env.META_ACCESS_TOKEN?.trim();
const META_USER_ID           = process.env.META_USER_ID           ?? env.META_USER_ID?.trim();
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN ?? env.INSTAGRAM_ACCESS_TOKEN?.trim();

const POSTED_FILE = "content/posted.json";

function loadJSON(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

function get(hostname, path) {
  return new Promise((resolve, reject) => {
    https.request({ hostname, path, method: "GET" }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    }).on("error", reject).end();
  });
}

// ── Threads insights ──────────────────────────────────────────────────────────

async function fetchThreadsMetrics(threadId) {
  const metrics = "views,likes,replies,reposts,quotes";
  const r = await get(
    "graph.threads.net",
    `/v1.0/${threadId}/insights?metric=${metrics}&access_token=${META_ACCESS_TOKEN}`
  );
  if (!r.data) return null;

  const out = {};
  for (const item of r.data) {
    out[item.name] = item.values?.[0]?.value ?? item.value ?? 0;
  }
  return out;
}

// ── Instagram insights ────────────────────────────────────────────────────────

async function fetchInstagramMetrics(mediaId) {
  const metrics = "impressions,reach,saved,shares,likes,comments,follows,profile_visits";
  const r = await get(
    "graph.instagram.com",
    `/v21.0/${mediaId}/insights?metric=${metrics}&access_token=${INSTAGRAM_ACCESS_TOKEN}`
  );
  if (!r.data) return null;

  const out = {};
  for (const item of r.data) {
    out[item.name] = item.values?.[0]?.value ?? item.value ?? 0;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

function score(e) {
  if (!e) return null;
  // Weighted score: saves and reposts are high-intent, views/reach give scale
  const saves   = (e.ig?.saved       ?? 0) * 5;
  const reposts = (e.threads?.reposts ?? 0) * 4;
  const shares  = (e.ig?.shares      ?? 0) * 4;
  const quotes  = (e.threads?.quotes  ?? 0) * 3;
  const replies = (e.threads?.replies ?? 0) * 2;
  const comments= (e.ig?.comments    ?? 0) * 2;
  const follows = (e.ig?.follows     ?? 0) * 3;
  const likes   = ((e.threads?.likes ?? 0) + (e.ig?.likes ?? 0)) * 1;
  const reach   = (e.ig?.reach       ?? 0) * 0.1;
  const views   = (e.threads?.views  ?? 0) * 0.1;
  return Math.round(saves + reposts + shares + quotes + replies + comments + follows + likes + reach + views);
}

async function main() {
  const posted = loadJSON(POSTED_FILE, []);
  if (posted.length === 0) {
    console.log("No posted entries.");
    return;
  }

  // Only track entries from the last 30 days (older data is stable)
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const toTrack = posted.filter(e => e.posted_at && new Date(e.posted_at).getTime() > cutoff);

  if (toTrack.length === 0) {
    console.log("No recent posts to track.");
    return;
  }

  console.log(`Tracking ${toTrack.length} recent post(s)...\n`);

  for (const entry of toTrack) {
    console.log(`[${entry.id}] ${entry.date}`);

    const engagement = entry.engagement ?? {};

    // Threads text post
    if (entry.threads_id && META_ACCESS_TOKEN) {
      try {
        const m = await fetchThreadsMetrics(entry.threads_id);
        if (m) {
          engagement.threads = m;
          console.log(`  Threads: ${m.views ?? 0} views · ${m.likes ?? 0} likes · ${m.replies ?? 0} replies · ${m.reposts ?? 0} reposts`);
        }
      } catch (err) {
        console.error(`  Threads fetch failed: ${err.message}`);
      }
    }

    // Instagram carousel
    if (entry.instagram_id && INSTAGRAM_ACCESS_TOKEN) {
      try {
        const m = await fetchInstagramMetrics(entry.instagram_id);
        if (m) {
          engagement.ig = m;
          console.log(`  Instagram: ${m.reach ?? 0} reach · ${m.saved ?? 0} saves · ${m.shares ?? 0} shares · ${m.follows ?? 0} follows`);
        }
      } catch (err) {
        console.error(`  Instagram fetch failed: ${err.message}`);
      }
    }

    engagement.score = score(engagement);
    engagement.tracked_at = new Date().toISOString();
    console.log(`  Score: ${engagement.score ?? "n/a"}\n`);

    // Write back into posted.json
    const idx = posted.findIndex(e => e.id === entry.id);
    if (idx !== -1) posted[idx].engagement = engagement;
  }

  saveJSON(POSTED_FILE, posted);
  console.log("Done. posted.json updated.");

  // Print leaderboard (top 5 by score)
  const scored = posted
    .filter(e => e.engagement?.score != null)
    .sort((a, b) => b.engagement.score - a.engagement.score)
    .slice(0, 5);

  if (scored.length > 0) {
    console.log("\n── Top posts so far ─────────────────────────────");
    for (const e of scored) {
      const ig = e.engagement?.ig;
      const th = e.engagement?.threads;
      console.log(
        `  ${e.date}  score ${e.engagement.score}` +
        `  |  reach ${ig?.reach ?? "-"}  saves ${ig?.saved ?? "-"}  shares ${ig?.shares ?? "-"}` +
        `  |  th-views ${th?.views ?? "-"}  reposts ${th?.reposts ?? "-"}`
      );
    }
  }
}

main().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
