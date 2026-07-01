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

const THEMES = {
  "building in public": {
    band: "#2563EB", rule: "#BFDBFE", accent: "#93C5FD",
    bubbleBg: "#EBF2FF", bubbleBorder: "#93C5FD", bubbleText: "#1A3A8A",
  },
  "managing finances": {
    band: "#16A34A", rule: "#A7F3D0", accent: "#6EE7B7",
    bubbleBg: "#ECFDF5", bubbleBorder: "#6EE7B7", bubbleText: "#14532D",
  },
  "navigating career": {
    band: "#7C3AED", rule: "#DDD6FE", accent: "#C4B5FD",
    bubbleBg: "#F5F3FF", bubbleBorder: "#C4B5FD", bubbleText: "#4C1D95",
  },
  "growing in relationship": {
    band: "#DB2777", rule: "#FBCFE8", accent: "#F9A8D4",
    bubbleBg: "#FDF2F8", bubbleBorder: "#F9A8D4", bubbleText: "#831843",
  },
  "random others": {
    band: "#D97706", rule: "#FDE68A", accent: "#FCD34D",
    bubbleBg: "#FFFBEB", bubbleBorder: "#FCD34D", bubbleText: "#78350F",
  },
};

function getThemeColors(themeName) {
  const key = (themeName || "").toLowerCase().trim();
  for (const [k, v] of Object.entries(THEMES)) {
    if (key.includes(k)) return v;
  }
  return THEMES["building in public"];
}

function renderHighlights(text, bandColor, accentColor) {
  if (!text) return "";
  return text.replace(/\*\*(.+?)\*\*/g,
    `<span style="color:${bandColor};text-decoration:underline;text-decoration-color:${accentColor};text-underline-offset:10px;">$1</span>`
  );
}

function buildSlideHTML(slide, idx, total, theme) {
  const c = getThemeColors(theme);
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
        ${slide.main_text ? `<div class="main">${renderHighlights(slide.main_text, c.band, c.accent)}</div>` : ""}
        ${slide.sub_text  ? `<div class="sub">${slide.sub_text}</div>` : ""}
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
        ${slide.title      ? `<div class="title">${slide.title}</div>` : ""}
        ${slide.sub_text   ? `<div class="sub">${renderHighlights(slide.sub_text, c.band, c.accent)}</div>` : ""}
        <div class="stat-num">${slide.stat_number || ""}</div>
        ${slide.stat_label ? `<div class="stat-lbl">${renderHighlights(slide.stat_label, c.band, c.accent)}</div>` : ""}`;
    } else {
      contentHTML = `
        ${slide.title      ? `<div class="title">${slide.title}</div>` : ""}
        ${slide.main_text  ? `<div class="main">${renderHighlights(slide.main_text, c.band, c.accent)}</div>` : ""}
        ${slide.sub_text   ? `<div class="sub">${renderHighlights(slide.sub_text, c.band, c.accent)}</div>` : ""}
        ${slide.type === "conclusion" ? `<div class="cta">Save this for later or follow for what happens next.</div>` : ""}`;
    }

    bodyHTML = `
    <div class="body top">
      <div class="content">${contentHTML}</div>
      ${bubbleHTML}
      <div class="foot"><span class="handle">@drawoheriter</span></div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head>
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
  height: 90px; background: ${c.band};
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
  padding-top: 32px; flex-shrink: 0;
}
.title  { font-size: 26px; color: #B0A090; letter-spacing: 0.1em; text-transform: uppercase; }
.main   { font-size: 88px; line-height: 1.2; color: #1A1208; }
.sub    { font-size: 42px; color: #7A6858; line-height: 1.6; }
.stat-num { font-size: 190px; line-height: 1; letter-spacing: -0.02em; color: ${c.band}; }
.stat-lbl { font-size: 42px; color: #7A6858; line-height: 1.5; }
.cta    { font-size: 40px; line-height: 1.4; color: ${c.band}; }
.handle { font-size: 24px; color: #C8B8A8; }
.swipe  { font-size: 24px; color: #C8B8A8; }
.bubble-wrap { margin-top: auto; padding-top: 28px; flex-shrink: 0; }
.divider { width: 56px; height: 3px; background: ${c.rule}; margin-bottom: 24px; }
.bubble {
  display: block;
  border-radius: 24px 24px 24px 6px;
  border: 2px solid ${c.bubbleBorder};
  background: ${c.bubbleBg};
  padding: 26px 40px;
  font-size: 34px; line-height: 1.55; font-style: italic;
  color: ${c.bubbleText}; max-width: 100%;
}
.bubble-tail {
  width: 0; height: 0;
  border-top: 22px solid ${c.bubbleBg};
  border-right: 22px solid transparent;
  margin-left: 42px;
}
</style>
</head>
<body>
  <div class="band">
    <span class="band-name">${theme}</span>
    <span class="band-pg">${pageNum} / ${totalNum}</span>
  </div>
  ${bodyHTML}
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
