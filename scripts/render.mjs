/**
 * Renders carousel slides to 1080x1080 PNG files using Playwright.
 * Usage: node scripts/render.mjs <queue-id>
 *        node scripts/render.mjs          (renders all pending with empty images[])
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const QUEUE_FILE  = "content/queue.json";
const IMAGES_DIR  = "content/images";

function loadJSON(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

// Theme → color palette
const THEMES = {
  "building in public": {
    band: "#2563EB", rule: "#BFDBFE", margin: "#DBEAFE", marginLine: "#93C5FD",
    bubbleBg: "#EFF6FF", bubbleBorder: "#BFDBFE",
  },
  "managing finances": {
    band: "#16A34A", rule: "#A7F3D0", margin: "#D1FAE5", marginLine: "#6EE7B7",
    bubbleBg: "#ECFDF5", bubbleBorder: "#A7F3D0",
  },
  "navigating career": {
    band: "#7C3AED", rule: "#DDD6FE", margin: "#EDE9FE", marginLine: "#C4B5FD",
    bubbleBg: "#F5F3FF", bubbleBorder: "#DDD6FE",
  },
  "growing in relationship": {
    band: "#DB2777", rule: "#FBCFE8", margin: "#FCE7F3", marginLine: "#F9A8D4",
    bubbleBg: "#FDF2F8", bubbleBorder: "#FBCFE8",
  },
  "random others": {
    band: "#D97706", rule: "#FDE68A", margin: "#FEF3C7", marginLine: "#FCD34D",
    bubbleBg: "#FFFBEB", bubbleBorder: "#FDE68A",
  },
};

function getThemeColors(themeName) {
  const key = (themeName || "").toLowerCase().trim();
  for (const [k, v] of Object.entries(THEMES)) {
    if (key.includes(k)) return v;
  }
  return THEMES["building in public"];
}

// Render ** markers as <span class="highlight">
function renderHighlights(text, accentColor) {
  if (!text) return "";
  return text.replace(/\*\*(.+?)\*\*/g,
    `<span style="color:${accentColor};text-decoration:underline;text-decoration-color:${accentColor}40;text-underline-offset:8px;">$1</span>`
  );
}

function buildSlideHTML(slide, idx, total, theme) {
  const c = getThemeColors(theme);
  const pageNum = String(idx + 1).padStart(2, "0");
  const totalNum = String(total).padStart(2, "0");
  const isFirst = idx === 0;
  const isLast = idx === total - 1;

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

  const swipeText = isFirst ? "swipe →" : "";

  // Notebook ruled-line background: repeat horizontal lines every 72px, offset to start below the band (90px band + 60px padding top)
  const ruledBg = `repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 71px,
    ${c.rule} 71px,
    ${c.rule} 73px
  )`;

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1080px; overflow: hidden; }
body {
  font-family: 'Patrick Hand', cursive;
  background-color: #FFFDF5;
  background-image: ${ruledBg};
  background-position: 0 150px;
  width: 1080px;
  height: 1080px;
  display: flex;
  flex-direction: column;
  position: relative;
}
/* left margin */
.margin-bg {
  position: absolute; top: 0; left: 0; bottom: 0; width: 14px;
  background: ${c.margin};
  z-index: 1;
}
.margin-line {
  position: absolute; top: 0; left: 5px; bottom: 0; width: 2.5px;
  background: ${c.marginLine};
  z-index: 2;
}
/* color band */
.band {
  height: 90px;
  background: ${c.band};
  display: flex;
  align-items: center;
  padding: 0 150px;
  flex-shrink: 0;
  position: relative;
  z-index: 3;
}
.band-theme {
  font-size: 28px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.9);
}
.band-page {
  margin-left: auto;
  font-size: 28px;
  color: rgba(255,255,255,0.5);
}
/* body */
.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 60px 150px 52px;
  position: relative;
  z-index: 3;
  min-height: 0;
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 60px;
  gap: 28px;
  overflow: hidden;
  min-height: 0;
}
.main-text {
  font-size: 80px;
  line-height: 1.2;
  color: #1A1208;
  flex-shrink: 0;
}
.sub-text {
  font-size: 33px;
  color: #9A8878;
  line-height: 1.65;
  flex-shrink: 0;
}
.stat-number {
  font-size: 180px;
  line-height: 1;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}
.stat-label {
  font-size: 33px;
  color: #9A8878;
  line-height: 1.5;
  flex-shrink: 0;
}
.follow-cta {
  font-size: 34px;
  flex-shrink: 0;
}
.bubble-wrap {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 24px;
}
.divider {
  width: 56px;
  height: 2px;
  margin-bottom: 20px;
}
.bubble {
  display: inline-block;
  border-radius: 36px 36px 36px 8px;
  border: 1.5px solid;
  padding: 22px 34px;
  font-size: 28px;
  color: #9A8878;
  font-style: italic;
  line-height: 1.55;
  max-width: 100%;
}
.bottom-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 28px;
}
.handle { font-size: 22px; color: #C8B8A8; }
.swipe  { font-size: 22px; color: #C8B8A8; }
</style>
</head>
<body>
  <div class="margin-bg"></div>
  <div class="margin-line"></div>
  <div class="band">
    <span class="band-theme">${theme}</span>
    <span class="band-page">${pageNum} / ${totalNum}</span>
  </div>
  <div class="body">
    <div class="content">
      ${contentHTML}
      ${bubbleHTML}
    </div>
    <div class="bottom-bar">
      <span class="handle">@drawoheriter</span>
      <span class="swipe">${swipeText}</span>
    </div>
  </div>
</body></html>`;
}

async function renderEntry(entry, browser) {
  const dir = join(IMAGES_DIR, entry.id);
  fs.mkdirSync(dir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1080 });

  const imagePaths = [];

  for (let i = 0; i < entry.slides.length; i++) {
    const slide = entry.slides[i];
    const html = buildSlideHTML(slide, i, entry.slides.length, entry.theme);

    await page.setContent(html, { waitUntil: "networkidle" });
    // Extra wait for font load
    await page.waitForTimeout(800);

    const filePath = join(dir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: filePath, type: "png" });

    imagePaths.push(filePath);
    console.log(`  Slide ${i + 1}/${entry.slides.length}: ${filePath}`);
  }

  await page.close();
  return imagePaths;
}

async function main() {
  const targetId = process.argv[2];
  const queue = loadJSON(QUEUE_FILE, []);

  if (queue.length === 0) {
    console.log("Queue is empty. Run `node scripts/generate.mjs` first.");
    return;
  }

  // --next: render the first approved entry (used by CI post workflow)
  const nextMode = process.argv[2] === "--next";
  const targets = nextMode
    ? queue.filter(e => e.status === "approved").slice(0, 1)
    : targetId
      ? queue.filter(e => e.id === targetId)
      : queue.filter(e => e.status === "pending" && (!e.images || e.images.length === 0));

  if (targets.length === 0) {
    console.log(targetId
      ? `No entry found with id: ${targetId}`
      : "No pending entries without images. Use: node scripts/render.mjs <id>"
    );
    return;
  }

  console.log(`Rendering ${targets.length} entr${targets.length === 1 ? "y" : "ies"}...`);

  const browser = await chromium.launch();

  for (const entry of targets) {
    console.log(`\n[${entry.id}] ${entry.theme} — ${entry.slides.length} slides`);
    const images = await renderEntry(entry, browser);
    const idx = queue.findIndex(e => e.id === entry.id);
    queue[idx].images = images;
    saveJSON(QUEUE_FILE, queue);
    console.log(`  Saved ${images.length} images to content/images/${entry.id}/`);
  }

  await browser.close();
  console.log("\nDone. Run `node scripts/review.mjs` to preview and approve.");
}

main().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
