/**
 * Posts approved content to Threads and Instagram.
 *
 * Flow:
 *  1. Threads — text post (hook + copy)
 *  2. Instagram — carousel (images uploaded to Supabase Storage once, URLs reused below)
 *  3. Instagram — Story (slide 1 posted as image story)
 *  4. Threads — carousel reply to step 1 (same hosted URLs, no re-upload)
 *
 * Run:  node scripts/post.mjs
 * Cron: daily at 9pm MYT
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

const META_ACCESS_TOKEN     = process.env.META_ACCESS_TOKEN ?? env.META_ACCESS_TOKEN?.trim();
const META_USER_ID          = process.env.META_USER_ID ?? env.META_USER_ID?.trim();
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN ?? env.INSTAGRAM_ACCESS_TOKEN?.trim();
const INSTAGRAM_USER_ID     = process.env.INSTAGRAM_USER_ID ?? env.INSTAGRAM_USER_ID?.trim();
const SUPABASE_URL              = process.env.SUPABASE_URL ?? env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const SUPABASE_BUCKET = "temp-social-images";

const QUEUE_FILE  = "content/queue.json";
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
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    }).on("error", reject).end();
  });
}

async function waitThreadsContainerFinished(containerId) {
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const r = await get("graph.threads.net",
      `/v1.0/${containerId}?fields=status,error_message&access_token=${META_ACCESS_TOKEN}`);
    if (r.status === "FINISHED") return;
    if (r.status === "ERROR") throw new Error("Threads container error: " + r.error_message);
  }
  throw new Error(`Threads container ${containerId} never reached FINISHED`);
}

function post(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body ?? {});
    const req = https.request({
      hostname, path, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        const parsed = JSON.parse(d);
        if (parsed.error) reject(new Error(`${parsed.error.code}: ${parsed.error.message}`));
        else resolve(parsed);
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// Upload image to a public Supabase Storage bucket. Instagram/Threads Media
// API requires a URL reachable from Meta's servers, so this can't just be a
// local file path.
//
// Previously used litterbox.catbox.moe (anonymous temp host) — replaced
// 2026-07-12 after it started throwing a real 500 on every file upload
// (confirmed via direct testing: the server itself responds fine, but its
// upload handler is broken, no ETA from them to fix it). This bucket lives
// in the kakisewa Supabase project since that's Howard's existing,
// already-controlled infra — not drawoheriter's own project, worth knowing
// if that project ever changes. Object path is scoped by entry id so
// different days' posts never collide, and x-upsert overwrites cleanly on
// a retry instead of erroring.
async function uploadImage(filePath) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local");
  }
  const fileData = fs.readFileSync(filePath);
  const parts = filePath.split("/");
  const filename = parts.pop();
  const entryId = parts.pop(); // content/images/{entryId}/{filename}
  const objectPath = `${entryId}/${filename}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: new URL(SUPABASE_URL).hostname,
      path: `/storage/v1/object/${SUPABASE_BUCKET}/${objectPath}`,
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "Content-Length": fileData.length,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "x-upsert": "true",
      },
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(`${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${objectPath}`);
        } else {
          reject(new Error(`Supabase upload failed (${res.statusCode}): ${d.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.write(fileData);
    req.end();
  });
}

// ── Threads ──────────────────────────────────────────────────────────────────

async function postToThreads(text) {
  const container = await post(
    "graph.threads.net",
    `/v1.0/${META_USER_ID}/threads?media_type=TEXT&text=${encodeURIComponent(text)}&access_token=${META_ACCESS_TOKEN}`,
    null
  );
  const result = await post(
    "graph.threads.net",
    `/v1.0/${META_USER_ID}/threads_publish?creation_id=${container.id}&access_token=${META_ACCESS_TOKEN}`,
    null
  );
  return result.id;
}

// Posts carousel slides as a reply to an existing Threads post
async function postThreadsCarouselReply(imageUrls, replyToId) {
  const childIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`    [${i + 1}/${imageUrls.length}] creating carousel item container...`);
    const r = await post(
      "graph.threads.net",
      `/v1.0/${META_USER_ID}/threads?media_type=IMAGE&image_url=${encodeURIComponent(imageUrls[i])}&is_carousel_item=true&access_token=${META_ACCESS_TOKEN}`,
      null
    );
    // Child containers don't reach FINISHED on their own — only wait on the parent carousel
    childIds.push(r.id);
    console.log(`      container ${r.id} queued`);
  }

  // Give Meta a moment to register all child containers before creating the parent
  await new Promise(r => setTimeout(r, 15000));

  console.log("    Creating parent carousel container...");
  const carousel = await post(
    "graph.threads.net",
    `/v1.0/${META_USER_ID}/threads?media_type=CAROUSEL&children=${childIds.join(",")}&reply_to_id=${replyToId}&access_token=${META_ACCESS_TOKEN}`,
    null
  );

  console.log("    Waiting for parent carousel container to be ready...");
  await waitThreadsContainerFinished(carousel.id);

  const result = await post(
    "graph.threads.net",
    `/v1.0/${META_USER_ID}/threads_publish?creation_id=${carousel.id}&access_token=${META_ACCESS_TOKEN}`,
    null
  );
  return result.id;
}

// ── Instagram carousel + story ────────────────────────────────────────────────

async function createInstagramImageContainer(imageUrl) {
  const r = await post(
    "graph.instagram.com",
    `/v21.0/${INSTAGRAM_USER_ID}/media?image_url=${encodeURIComponent(imageUrl)}&is_carousel_item=true&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
    null
  );
  return r.id;
}

async function createInstagramCarousel(childIds, caption) {
  const children = childIds.join(",");
  const r = await post(
    "graph.instagram.com",
    `/v21.0/${INSTAGRAM_USER_ID}/media?media_type=CAROUSEL&children=${encodeURIComponent(children)}&caption=${encodeURIComponent(caption)}&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
    null
  );
  return r.id;
}

async function publishInstagramMedia(mediaId, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await post(
        "graph.instagram.com",
        `/v21.0/${INSTAGRAM_USER_ID}/media_publish?creation_id=${mediaId}&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
        null
      );
      return r.id;
    } catch (err) {
      if (i < retries - 1 && err.message.includes("not available")) {
        await new Promise(r => setTimeout(r, 5000));
      } else throw err;
    }
  }
}

// Posts slide 1 as an image story (source_media_id reshare only works for Reels via Graph API)
async function postInstagramStory(slide1Url) {
  const container = await post(
    "graph.instagram.com",
    `/v21.0/${INSTAGRAM_USER_ID}/media?media_type=STORIES&image_url=${encodeURIComponent(slide1Url)}&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
    null
  );
  return publishInstagramMedia(container.id);
}

// Returns { postId, imageUrls } so Threads carousel reply can reuse the hosted URLs
async function postToInstagram(imagePaths, caption) {
  console.log(`  Uploading ${imagePaths.length} images...`);

  const imageUrls = [];
  const childIds = [];
  for (let i = 0; i < imagePaths.length; i++) {
    console.log(`    [${i + 1}/${imagePaths.length}] uploading ${imagePaths[i]}`);
    const url = await uploadImage(imagePaths[i]);
    console.log(`    Hosted at: ${url}`);
    imageUrls.push(url);
    const containerId = await createInstagramImageContainer(url);
    childIds.push(containerId);
  }

  console.log("  Creating carousel container...");
  const carouselId = await createInstagramCarousel(childIds, caption);

  console.log("  Publishing...");
  const postId = await publishInstagramMedia(carouselId);
  return { postId, imageUrls };
}

// Prefers an approved item whose topic differs from the most recently posted
// item's topic, so the career/building-in-public/finance/life rotation
// doesn't accidentally post the same topic twice in a row (this happened
// with day4-career -> day8-career, both leftover pre-rotation items).
// Falls back to the oldest approved item if every approved item shares that
// topic, so a day never goes unposted just for lack of a different one.
// Kept identical in render.mjs -- the two must always pick the same entry.
function pickNextApproved(queue) {
  const approved = queue.filter(e => e.status === "approved");
  if (approved.length === 0) return null;
  const posted = queue.filter(e => e.status === "posted" && e.posted_at);
  const lastPosted = posted.sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at))[0];
  if (lastPosted?.topic) {
    const differentTopic = approved.find(e => e.topic !== lastPosted.topic);
    if (differentTopic) return differentTopic;
  }
  return approved[0];
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (!META_ACCESS_TOKEN || !META_USER_ID) {
    console.error("META_ACCESS_TOKEN and META_USER_ID required in .env.local");
    process.exit(1);
  }

  const queue = loadJSON(QUEUE_FILE, []);
  const posted = loadJSON(POSTED_FILE, []);

  const entry = pickNextApproved(queue);

  if (!entry) {
    console.log("No approved posts. Run `node scripts/review.mjs` to approve.");
    return;
  }

  const idx = queue.findIndex(e => e.id === entry.id);

  console.log(`Posting: [${entry.id}] ${entry.theme} — ${entry.date}`);

  const result = { threads_id: null, threads_carousel_id: null, instagram_id: null, instagram_story_id: null };

  // Step 1: Threads text post
  try {
    console.log("\n  Threads (text)...");
    result.threads_id = await postToThreads(entry.threads_text);
    console.log(`  Threads text: done (id: ${result.threads_id})`);
  } catch (err) {
    console.error("  Threads text failed:", err.message);
  }

  // Step 2: Instagram carousel + story (images uploaded once, URLs reused for Threads reply)
  let hostedImageUrls = [];
  if (INSTAGRAM_ACCESS_TOKEN && INSTAGRAM_USER_ID && entry.images?.length > 0) {
    try {
      console.log("\n  Instagram (carousel)...");
      const { postId, imageUrls } = await postToInstagram(entry.images, entry.caption);
      result.instagram_id = postId;
      hostedImageUrls = imageUrls;
      console.log(`  Instagram carousel: done (id: ${result.instagram_id})`);
    } catch (err) {
      console.error("  Instagram carousel failed:", err.message);
      console.error("  You can post manually with the images at content/images/" + entry.id + "/");
    }

    // Step 3: Instagram Story — done manually in the app (Graph API can't reshare carousel to story)
  } else if (!entry.images?.length) {
    console.log("\n  Instagram: no images rendered — run `node scripts/render.mjs` first.");
  }

  // Step 4: Threads carousel reply — wait so the text post is indexed first
  if (result.threads_id && entry.images?.length > 0) {
    console.log("\n  Waiting 3 min before posting Threads carousel reply...");
    await new Promise(r => setTimeout(r, 3 * 60 * 1000));
    try {
      console.log("  Threads (carousel reply)...");
      const urls = hostedImageUrls.length > 0
        ? hostedImageUrls
        : await Promise.all(entry.images.map(uploadImage));
      result.threads_carousel_id = await postThreadsCarouselReply(urls, result.threads_id);
      console.log(`  Threads carousel reply: done (id: ${result.threads_carousel_id})`);
    } catch (err) {
      console.error("  Threads carousel reply failed:", err.message);
    }
  }

  queue[idx].status = "posted";
  queue[idx].posted_at = new Date().toISOString();
  queue[idx].threads_id = result.threads_id;
  queue[idx].threads_carousel_id = result.threads_carousel_id;
  queue[idx].instagram_id = result.instagram_id;
  queue[idx].instagram_story_id = result.instagram_story_id;
  saveJSON(QUEUE_FILE, queue);

  posted.push({ ...queue[idx] });
  saveJSON(POSTED_FILE, posted);

  console.log("\nDone.");
}

main().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
