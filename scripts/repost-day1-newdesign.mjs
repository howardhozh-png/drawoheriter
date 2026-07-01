/**
 * One-off: re-render and re-post day1-mockup with the new notebook design.
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

// ── Theme colors ─────────────────────────────────────────────────────────────
const THEME = {
  band: "#2563EB", rule: "#BFDBFE", margin: "#DBEAFE", marginLine: "#93C5FD",
  bubbleBg: "#EFF6FF", bubbleBorder: "#BFDBFE",
};

function renderHighlights(text, color) {
  if (!text) return "";
  return text.replace(/\*\*(.+?)\*\*/g,
    `<span style="color:${color};text-decoration:underline;text-decoration-color:${color}40;text-underline-offset:8px;">$1</span>`
  );
}

function buildSlideHTML(slide, idx, total) {
  const c = THEME;
  const pageNum = String(idx + 1).padStart(2, "0");
  const totalNum = String(total).padStart(2, "0");
  const isFirst = idx === 0;

  const ruledBg = `repeating-linear-gradient(to bottom,transparent 0px,transparent 71px,${c.rule} 71px,${c.rule} 73px)`;

  let contentHTML = "";
  if (slide.type === "stat") {
    contentHTML = `
      ${slide.sub_text ? `<div class="sub-text">${renderHighlights(slide.sub_text, c.band)}</div>` : ""}
      <div class="stat-number" style="color:${c.band};">${slide.stat_number || ""}</div>
      ${slide.stat_label ? `<div class="stat-label">${renderHighlights(slide.stat_label, c.band)}</div>` : ""}
    `;
  } else {
    contentHTML = `
      ${slide.main_text ? `<div class="main-text">${renderHighlights(slide.main_text, c.band)}</div>` : ""}
      ${slide.sub_text ? `<div class="sub-text">${renderHighlights(slide.sub_text, c.band)}</div>` : ""}
      ${slide.sub_text_2 ? `<div class="sub-text">${renderHighlights(slide.sub_text_2, c.band)}</div>` : ""}
      ${slide.type === "conclusion" ? `<div class="follow-cta" style="color:${c.band};">Save this for later or follow for what happens next.</div>` : ""}
    `;
  }

  const bubbleHTML = slide.bubble ? `
    <div class="bubble-wrap">
      <div class="divider" style="background:${c.rule};"></div>
      <div class="bubble" style="background:${c.bubbleBg};border-color:${c.bubbleBorder};">${slide.bubble}</div>
    </div>
  ` : "";

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1080px; height:1080px; overflow:hidden; }
body {
  font-family:'Patrick Hand',cursive;
  background-color:#FFFDF5;
  background-image:${ruledBg};
  background-position:0 150px;
  width:1080px; height:1080px;
  display:flex; flex-direction:column; position:relative;
}
.margin-bg { position:absolute;top:0;left:0;bottom:0;width:14px;background:${c.margin};z-index:1; }
.margin-line { position:absolute;top:0;left:5px;bottom:0;width:2.5px;background:${c.marginLine};z-index:2; }
.band { height:90px;background:${c.band};display:flex;align-items:center;padding:0 150px;flex-shrink:0;position:relative;z-index:3; }
.band-theme { font-size:28px;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.9); }
.band-page { margin-left:auto;font-size:28px;color:rgba(255,255,255,0.5); }
.body { flex:1;display:flex;flex-direction:column;padding:60px 150px 52px;position:relative;z-index:3;min-height:0; }
.content { flex:1;display:flex;flex-direction:column;justify-content:flex-start;padding-top:60px;gap:28px;overflow:hidden;min-height:0; }
.main-text { font-size:80px;line-height:1.2;color:#1A1208;flex-shrink:0; }
.sub-text { font-size:33px;color:#9A8878;line-height:1.65;flex-shrink:0; }
.stat-number { font-size:180px;line-height:1;letter-spacing:-0.02em;flex-shrink:0; }
.stat-label { font-size:33px;color:#9A8878;line-height:1.5;flex-shrink:0; }
.follow-cta { font-size:34px;flex-shrink:0; }
.bubble-wrap { flex-shrink:0;margin-top:auto;padding-top:24px; }
.divider { width:56px;height:2px;margin-bottom:20px; }
.bubble { display:inline-block;border-radius:36px 36px 36px 8px;border:1.5px solid;padding:22px 34px;font-size:28px;color:#9A8878;font-style:italic;line-height:1.55;max-width:100%; }
.bottom-bar { flex-shrink:0;display:flex;justify-content:space-between;align-items:center;padding-top:28px; }
.handle { font-size:22px;color:#C8B8A8; }
.swipe  { font-size:22px;color:#C8B8A8; }
</style>
</head>
<body>
  <div class="margin-bg"></div>
  <div class="margin-line"></div>
  <div class="band"><span class="band-theme">Building in public</span><span class="band-page">${pageNum} / ${totalNum}</span></div>
  <div class="body">
    <div class="content">${contentHTML}${bubbleHTML}</div>
    <div class="bottom-bar"><span class="handle">@drawoheriter</span><span class="swipe">${isFirst ? "swipe →" : ""}</span></div>
  </div>
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

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    https.request({ hostname, path, method: "GET" }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    }).on("error", reject).end();
  });
}

async function getThreadsStatus(containerId, token) {
  const r = await httpsGet("graph.threads.net",
    `/v1.0/${containerId}?fields=status,error_message&access_token=${token}`);
  return r.status || "UNKNOWN";
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
  // Load day1 slides
  const queue = JSON.parse(fs.readFileSync("content/queue.json", "utf8"));
  const entry = queue.find(e => e.id === "day1-mockup");
  if (!entry) { console.error("day1-mockup not found in queue.json"); process.exit(1); }

  // Render slides
  const outDir = "content/images/day1-v2";
  fs.mkdirSync(outDir, { recursive: true });

  console.log("Rendering slides with new design...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1080 });

  const imagePaths = [];
  for (let i = 0; i < entry.slides.length; i++) {
    const html = buildSlideHTML(entry.slides[i], i, entry.slides.length);
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const filePath = join(ROOT, outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: filePath, type: "png" });
    imagePaths.push(filePath);
    console.log(`  Rendered slide ${i + 1}/${entry.slides.length}`);
  }
  await browser.close();

  // Upload images
  console.log("\nUploading to litterbox...");
  const imageUrls = [];
  for (let i = 0; i < imagePaths.length; i++) {
    console.log(`  [${i + 1}/${imagePaths.length}] uploading...`);
    const url = await uploadImage(imagePaths[i]);
    console.log(`  → ${url}`);
    imageUrls.push(url);
  }

  // Instagram carousel
  console.log("\nPosting Instagram carousel...");
  const childIds = [];
  for (const url of imageUrls) {
    const r = await post("graph.instagram.com",
      `/v21.0/${INSTAGRAM_USER_ID}/media?image_url=${encodeURIComponent(url)}&is_carousel_item=true&access_token=${INSTAGRAM_ACCESS_TOKEN}`, null);
    childIds.push(r.id);
  }
  const carouselId = (await post("graph.instagram.com",
    `/v21.0/${INSTAGRAM_USER_ID}/media?media_type=CAROUSEL&children=${encodeURIComponent(childIds.join(","))}&caption=${encodeURIComponent(entry.caption)}&access_token=${INSTAGRAM_ACCESS_TOKEN}`, null)).id;
  const igPostId = await publishInstagramMedia(carouselId);
  console.log(`  IG carousel posted: ${igPostId}`);

  // Threads text post
  console.log("\nPosting Threads text...");
  const tContainer = await post("graph.threads.net",
    `/v1.0/${META_USER_ID}/threads?media_type=TEXT&text=${encodeURIComponent(entry.threads_text)}&access_token=${META_ACCESS_TOKEN}`, null);
  const threadsId = (await post("graph.threads.net",
    `/v1.0/${META_USER_ID}/threads_publish?creation_id=${tContainer.id}&access_token=${META_ACCESS_TOKEN}`, null)).id;
  console.log(`  Threads text posted: ${threadsId}`);

  // Threads carousel reply
  console.log("\nWaiting 2 min before Threads carousel reply...");
  await new Promise(r => setTimeout(r, 2 * 60 * 1000));

  console.log("Posting Threads carousel reply...");
  const tChildIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`  [${i + 1}/${imageUrls.length}] creating Threads image container...`);
    const r = await post("graph.threads.net",
      `/v1.0/${META_USER_ID}/threads?media_type=IMAGE&image_url=${encodeURIComponent(imageUrls[i])}&is_carousel_item=true&access_token=${META_ACCESS_TOKEN}`, null);
    // Poll until container is FINISHED — Threads rejects children that aren't ready
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      const status = await getThreadsStatus(r.id, META_ACCESS_TOKEN);
      console.log(`    container ${r.id} status: ${status}`);
      if (status === "FINISHED") break;
      if (attempt === 11) throw new Error(`Container ${r.id} never reached FINISHED state`);
    }
    tChildIds.push(r.id);
  }
  const tCarousel = await post("graph.threads.net",
    `/v1.0/${META_USER_ID}/threads?media_type=CAROUSEL&children=${tChildIds.join(",")}&reply_to_id=${threadsId}&access_token=${META_ACCESS_TOKEN}`, null);
  console.log("  Carousel container:", JSON.stringify(tCarousel));
  const tCarouselId = (await post("graph.threads.net",
    `/v1.0/${META_USER_ID}/threads_publish?creation_id=${tCarousel.id}&access_token=${META_ACCESS_TOKEN}`, null)).id;
  console.log(`  Threads carousel reply posted: ${tCarouselId}`);

  console.log("\nDone. Check your IG and Threads!");
}

main().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
