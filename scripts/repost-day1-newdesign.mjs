/**
 * Re-render and re-post day1 with v3 design + updated copy.
 * Run: node scripts/repost-day1-newdesign.mjs
 */

import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const env = fs.existsSync(".env.local")
  ? Object.fromEntries(
      fs.readFileSync(".env.local", "utf8")
        .split("\n").filter(l => l.includes("="))
        .map(l => [l.split("=")[0], l.split("=").slice(1).join("=")])
    )
  : {};

const META_ACCESS_TOKEN      = process.env.META_ACCESS_TOKEN      ?? env.META_ACCESS_TOKEN?.trim();
const META_USER_ID           = process.env.META_USER_ID           ?? env.META_USER_ID?.trim();
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN ?? env.INSTAGRAM_ACCESS_TOKEN?.trim();
const INSTAGRAM_USER_ID      = process.env.INSTAGRAM_USER_ID      ?? env.INSTAGRAM_USER_ID?.trim();

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  band: "#2563EB",
  bubbleBg: "#EBF2FF", bubbleBorder: "#93C5FD", bubbleText: "#1A3A8A",
  divider: "#BFDBFE", accent: "#93C5FD",
};

// ── Slide content ─────────────────────────────────────────────────────────────
const SLIDES = [
  {
    type: "hook",
    main_text: "I spent **240 hours** building a SaaS and have zero paying customers.",
    sub_text: "Here is what that week actually looked like.",
  },
  {
    type: "stat",
    title: "Week 1 results",
    sub_text: "After 7 days live, with real people signed up and able to pay.",
    stat_number: "0",
    stat_label: "paying customers",
    bubble: "I kept refreshing Stripe expecting something to happen. Nothing happened.",
  },
  {
    type: "content",
    title: "The build",
    main_text: "I built it in **evenings and weekends,**",
    sub_text: "working around a full-time job, with no co-founder, investors, or any announcement to the world.",
    bubble: "My colleagues think I just go to bed early.",
  },
  {
    type: "content",
    title: "The launch",
    main_text: "I launched **quietly.**",
    sub_text: "No big announcement, no fanfare. I just pushed it live one night and waited to see if anyone noticed.",
    bubble: "The scariest part was not the launch. It was nobody noticing.",
  },
  {
    type: "content",
    title: "The lesson",
    main_text: 'The gap between **"it is ready"** and anyone caring.',
    sub_text: "Nobody is waiting for your product, so you have to go find them.",
    bubble: "Week 1 taught me: building is the easy part. Distribution is the job.",
  },
  {
    type: "conclusion",
    title: "The takeaway",
    main_text: "Zero customers does not mean **zero progress.**",
    sub_text: "It means you are still early enough to get it right.",
    bubble: "Month 2 starts tomorrow. Let's see if the numbers change.",
  },
];

const CAPTION = `I spent 240 hours building a SaaS and have zero paying customers.

Here is what week 1 actually looked like.

What are you building right now? Drop it in the comments.`;

const THREADS_TEXT = `I spent 240 hours building a SaaS and have zero paying customers.

Here is what week 1 actually looked like: the launch nobody saw, the Stripe dashboard I kept refreshing, and what building while employed actually costs you.

What are you building right now?`;

// ── HTML builder ──────────────────────────────────────────────────────────────

function renderHighlights(text, color, underlineColor) {
  if (!text) return "";
  return text.replace(/\*\*(.+?)\*\*/g,
    `<span style="color:${color};text-decoration:underline;text-decoration-color:${underlineColor};text-underline-offset:10px;">$1</span>`
  );
}

function buildSlideHTML(slide, idx, total) {
  const pageNum  = String(idx + 1).padStart(2, "0");
  const totalNum = String(total).padStart(2, "0");
  const isFirst  = idx === 0;

  const bubbleHTML = slide.bubble ? `
    <div class="bubble-wrap">
      <div class="divider"></div>
      <div class="bubble">${slide.bubble}</div>
      <div class="bubble-tail"></div>
    </div>` : "";

  let bodyHTML = "";

  if (isFirst) {
    bodyHTML = `
    <div class="body center">
      <div class="center-content">
        <div class="main">${renderHighlights(slide.main_text, C.band, C.accent)}</div>
        <div class="sub">${slide.sub_text || ""}</div>
      </div>
      <div class="foot">
        <span class="handle">@drawoheriter</span>
        <span class="swipe">swipe →</span>
      </div>
    </div>`;
  } else {
    let contentHTML = "";
    if (slide.type === "stat") {
      contentHTML = `
        ${slide.title ? `<div class="title">${slide.title}</div>` : ""}
        <div class="sub">${renderHighlights(slide.sub_text || "", C.band, C.accent)}</div>
        <div class="stat-num">${slide.stat_number || ""}</div>
        <div class="stat-lbl">${renderHighlights(slide.stat_label || "", C.band, C.accent)}</div>`;
    } else {
      contentHTML = `
        ${slide.title ? `<div class="title">${slide.title}</div>` : ""}
        ${slide.main_text ? `<div class="main">${renderHighlights(slide.main_text, C.band, C.accent)}</div>` : ""}
        ${slide.sub_text ? `<div class="sub">${renderHighlights(slide.sub_text, C.band, C.accent)}</div>` : ""}
        ${slide.type === "conclusion" ? `<div class="cta">Save this for later or follow for what happens next.</div>` : ""}`;
    }

    bodyHTML = `
    <div class="body top">
      <div class="content">${contentHTML}</div>
      ${bubbleHTML}
      <div class="foot"><span class="handle">@drawoheriter</span></div>
    </div>`;
  }

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1080px; overflow: hidden; }
body {
  font-family: 'Patrick Hand', cursive;
  background: #FAF6F0;
  width: 1080px; height: 1080px;
  display: flex; flex-direction: column;
}
.band {
  height: 90px; background: ${C.band};
  display: flex; align-items: center;
  padding: 0 160px; flex-shrink: 0;
}
.band-name { font-size: 36px; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.92); }
.band-pg   { margin-left: auto; font-size: 28px; color: rgba(255,255,255,0.5); }
.body {
  flex: 1; display: flex; flex-direction: column;
  padding: 0 160px 52px; min-height: 0;
}
.body.center { justify-content: flex-start; }
.center-content { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 32px; }
.body.top { justify-content: flex-start; padding-top: 64px; }
.content { display: flex; flex-direction: column; gap: 28px; }
.foot {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 0; padding-top: 32px; flex-shrink: 0;
}
.title { font-size: 26px; color: #B0A090; letter-spacing: 0.1em; text-transform: uppercase; }
.main  { font-size: 88px; line-height: 1.2; color: #1A1208; }
.sub   { font-size: 42px; color: #7A6858; line-height: 1.6; }
.stat-num { font-size: 190px; line-height: 1; letter-spacing: -0.02em; color: ${C.band}; }
.stat-lbl { font-size: 42px; color: #7A6858; line-height: 1.5; }
.cta  { font-size: 40px; line-height: 1.4; color: ${C.band}; }
.handle { font-size: 24px; color: #C8B8A8; }
.swipe  { font-size: 24px; color: #C8B8A8; }
.bubble-wrap { margin-top: auto; padding-top: 28px; flex-shrink: 0; }
.divider { width: 56px; height: 3px; background: ${C.divider}; margin-bottom: 24px; }
.bubble {
  display: block;
  border-radius: 24px 24px 24px 6px;
  border: 2px solid ${C.bubbleBorder};
  background: ${C.bubbleBg};
  padding: 26px 40px;
  font-size: 34px; line-height: 1.55;
  font-style: italic;
  color: ${C.bubbleText};
  max-width: 100%;
}
.bubble-tail {
  width: 0; height: 0;
  border-top: 22px solid ${C.bubbleBg};
  border-right: 22px solid transparent;
  margin-left: 42px;
}
</style>
</head>
<body>
  <div class="band">
    <span class="band-name">Building in public</span>
    <span class="band-pg">${pageNum} / ${totalNum}</span>
  </div>
  ${bodyHTML}
</body></html>`;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

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

function get(hostname, path) {
  return new Promise((resolve, reject) => {
    https.request({ hostname, path, method: "GET" }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    }).on("error", reject).end();
  });
}

async function uploadImage(filePath) {
  const fileData = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const boundary = "----LitterboxBoundary" + Date.now();
  const CRLF = "\r\n";
  const preamble = Buffer.from(
    `--${boundary}${CRLF}Content-Disposition: form-data; name="reqtype"${CRLF}${CRLF}fileupload${CRLF}` +
    `--${boundary}${CRLF}Content-Disposition: form-data; name="time"${CRLF}${CRLF}24h${CRLF}` +
    `--${boundary}${CRLF}Content-Disposition: form-data; name="fileToUpload"; filename="${filename}"${CRLF}Content-Type: image/png${CRLF}${CRLF}`,
    "utf8"
  );
  const epilogue = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, "utf8");
  const body = Buffer.concat([preamble, fileData, epilogue]);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "litterbox.catbox.moe", path: "/resources/internals/api.php", method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": body.length },
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        const url = d.trim();
        if (url.startsWith("https://")) resolve(url);
        else reject(new Error("litterbox upload failed: " + url.slice(0, 200)));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function waitThreadsFinished(containerId) {
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const r = await get("graph.threads.net",
      `/v1.0/${containerId}?fields=status,error_message&access_token=${META_ACCESS_TOKEN}`);
    if (r.status === "FINISHED") return;
    if (r.status === "ERROR") throw new Error("Threads container error: " + r.error_message);
    console.log(`    container ${containerId}: ${r.status}`);
  }
  throw new Error(`Container ${containerId} never reached FINISHED`);
}

async function publishInstagramMedia(mediaId, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await post("graph.instagram.com",
        `/v21.0/${INSTAGRAM_USER_ID}/media_publish?creation_id=${mediaId}&access_token=${INSTAGRAM_ACCESS_TOKEN}`, null);
      return r.id;
    } catch (err) {
      if (i < retries - 1 && err.message.includes("not available")) {
        await new Promise(r => setTimeout(r, 5000));
      } else throw err;
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const outDir = "content/images/day1-v3";
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Render slides
  console.log("Rendering slides...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1080 });

  const imagePaths = [];
  for (let i = 0; i < SLIDES.length; i++) {
    const html = buildSlideHTML(SLIDES[i], i, SLIDES.length);
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const filePath = join(ROOT, outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: filePath, type: "png" });
    imagePaths.push(filePath);
    console.log(`  Rendered slide ${i + 1}/${SLIDES.length}`);
  }
  await browser.close();

  // 2. Upload to litterbox
  console.log("\nUploading images...");
  const imageUrls = [];
  for (let i = 0; i < imagePaths.length; i++) {
    console.log(`  [${i + 1}/${imagePaths.length}] uploading...`);
    const url = await uploadImage(imagePaths[i]);
    console.log(`  → ${url}`);
    imageUrls.push(url);
  }

  // 3. Instagram carousel
  console.log("\nPosting Instagram carousel...");
  const igChildIds = [];
  for (const url of imageUrls) {
    const r = await post("graph.instagram.com",
      `/v21.0/${INSTAGRAM_USER_ID}/media?image_url=${encodeURIComponent(url)}&is_carousel_item=true&access_token=${INSTAGRAM_ACCESS_TOKEN}`, null);
    igChildIds.push(r.id);
  }
  const carouselId = (await post("graph.instagram.com",
    `/v21.0/${INSTAGRAM_USER_ID}/media?media_type=CAROUSEL&children=${encodeURIComponent(igChildIds.join(","))}&caption=${encodeURIComponent(CAPTION)}&access_token=${INSTAGRAM_ACCESS_TOKEN}`, null)).id;
  const igPostId = await publishInstagramMedia(carouselId);
  console.log(`  IG carousel posted: ${igPostId}`);

  // 4. Threads text post
  console.log("\nPosting Threads text...");
  const tTextContainer = await post("graph.threads.net",
    `/v1.0/${META_USER_ID}/threads?media_type=TEXT&text=${encodeURIComponent(THREADS_TEXT)}&access_token=${META_ACCESS_TOKEN}`, null);
  const threadsId = (await post("graph.threads.net",
    `/v1.0/${META_USER_ID}/threads_publish?creation_id=${tTextContainer.id}&access_token=${META_ACCESS_TOKEN}`, null)).id;
  console.log(`  Threads text posted: ${threadsId}`);

  // 5. Threads carousel reply (wait 2 min first)
  console.log("\nWaiting 2 min before Threads carousel reply...");
  await new Promise(r => setTimeout(r, 2 * 60 * 1000));

  console.log("Posting Threads carousel reply...");
  const tChildIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`  [${i + 1}/${imageUrls.length}] creating Threads image container...`);
    const r = await post("graph.threads.net",
      `/v1.0/${META_USER_ID}/threads?media_type=IMAGE&image_url=${encodeURIComponent(imageUrls[i])}&is_carousel_item=true&access_token=${META_ACCESS_TOKEN}`, null);
    await waitThreadsFinished(r.id);
    tChildIds.push(r.id);
  }
  const tCarousel = await post("graph.threads.net",
    `/v1.0/${META_USER_ID}/threads?media_type=CAROUSEL&children=${tChildIds.join(",")}&reply_to_id=${threadsId}&access_token=${META_ACCESS_TOKEN}`, null);
  const tCarouselId = (await post("graph.threads.net",
    `/v1.0/${META_USER_ID}/threads_publish?creation_id=${tCarousel.id}&access_token=${META_ACCESS_TOKEN}`, null)).id;
  console.log(`  Threads carousel reply posted: ${tCarouselId}`);

  console.log("\nDone. Check IG and Threads!");
}

main().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
