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

// Render ** markers as <span class="highlight">
function renderHighlights(text) {
  if (!text) return "";
  return text.replace(/\*\*(.+?)\*\*/g, '<span class="highlight">$1</span>');
}

function buildSlideHTML(slide, idx, total, theme) {
  const pageNum = String(idx + 1).padStart(2, "0");
  const totalNum = String(total).padStart(2, "0");
  const isLast = idx === total - 1;
  const isFirst = idx === 0;

  let contentHTML = "";

  if (slide.type === "stat") {
    contentHTML = `
      ${slide.sub_text ? `<div class="sub-text">${renderHighlights(slide.sub_text)}</div>` : ""}
      <div class="stat-number">${slide.stat_number || ""}</div>
      ${slide.stat_label ? `<div class="stat-label">${renderHighlights(slide.stat_label)}</div>` : ""}
    `;
  } else {
    contentHTML = `
      ${slide.main_text ? `<div class="main-text">${renderHighlights(slide.main_text)}</div>` : ""}
      ${slide.sub_text ? `<div class="sub-text">${renderHighlights(slide.sub_text)}</div>` : ""}
      ${slide.sub_text_2 ? `<div class="sub-text">${renderHighlights(slide.sub_text_2)}</div>` : ""}
      ${slide.type === "conclusion" ? `<div class="follow-cta">Follow to know what happens next or save this for later.</div>` : ""}
    `;
  }

  const bubbleHTML = slide.bubble ? `
    <div class="bubble-wrap">
      <div class="divider"></div>
      <div class="bubble">${slide.bubble}</div>
    </div>
  ` : "";

  const rightBottomText = isFirst ? "swipe →" : (isLast ? "" : "");

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1080px; overflow: hidden; }
body {
  font-family: 'Inter', sans-serif;
  background: #FFFFFF;
  width: 1080px;
  height: 1080px;
  display: flex;
  flex-direction: column;
  padding: 70px 80px;
}
.top-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  margin-bottom: 52px;
}
.overline {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #999999;
}
.page-num {
  font-size: 22px;
  font-weight: 500;
  color: #BBBBBB;
  letter-spacing: 0.05em;
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 24px;
  overflow: hidden;
  min-height: 0;
}
.main-text {
  font-size: 72px;
  font-weight: 800;
  line-height: 1.15;
  color: #0A0A0A;
  letter-spacing: -0.03em;
  flex-shrink: 0;
}
.highlight { color: #3333FF; }
.sub-text {
  font-size: 30px;
  font-weight: 500;
  color: #555555;
  line-height: 1.5;
  flex-shrink: 0;
}
.stat-number {
  font-size: 160px;
  font-weight: 900;
  color: #3333FF;
  letter-spacing: -0.04em;
  line-height: 1;
  flex-shrink: 0;
}
.stat-label {
  font-size: 30px;
  font-weight: 600;
  color: #0A0A0A;
  line-height: 1.4;
  flex-shrink: 0;
}
.follow-cta {
  font-size: 28px;
  font-weight: 700;
  color: #3333FF;
  flex-shrink: 0;
}
.bubble-wrap {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 28px;
}
.divider {
  width: 56px;
  height: 2px;
  background: #E0E0E0;
  margin-bottom: 18px;
}
.bubble {
  display: inline-block;
  background: #F0F0F0;
  border-radius: 36px 36px 36px 8px;
  padding: 20px 32px;
  font-size: 24px;
  color: #444444;
  font-style: italic;
  font-weight: 400;
  line-height: 1.5;
  max-width: 100%;
}
.bottom-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  margin-top: 36px;
}
.handle {
  font-size: 22px;
  font-weight: 600;
  color: #AAAAAA;
  letter-spacing: 0.02em;
}
.swipe {
  font-size: 22px;
  font-weight: 600;
  color: #AAAAAA;
  letter-spacing: 0.04em;
}
</style>
</head>
<body>
  <div class="top-bar">
    <span class="overline">${theme}</span>
    <span class="page-num">${pageNum} / ${totalNum}</span>
  </div>
  <div class="content">
    ${contentHTML}
    ${bubbleHTML}
  </div>
  <div class="bottom-bar">
    <span class="handle">@drawoheriter</span>
    <span class="swipe">${rightBottomText}</span>
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
