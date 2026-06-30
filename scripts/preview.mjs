/**
 * Generates a self-contained HTML preview of a queue entry's slides.
 * Called by generate.mjs automatically. Also runnable manually:
 *   node scripts/preview.mjs <queue-id>
 */

import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE_FILE = "content/queue.json";
const PREVIEWS_DIR = "content/previews";

function loadJSON(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function hl(text) {
  if (!text) return "";
  return text.replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>');
}

function buildSlideHTML(slide, idx, total, theme) {
  const pageNum = String(idx + 1).padStart(2, "0");
  const totalNum = String(total).padStart(2, "0");
  const isFirst = idx === 0;
  const isLast = idx === total - 1;

  let contentHTML = "";
  if (slide.type === "stat") {
    contentHTML = `
      ${slide.sub_text ? `<div class="sub">${hl(slide.sub_text)}</div>` : ""}
      <div class="stat-num">${slide.stat_number || ""}</div>
      ${slide.stat_label ? `<div class="stat-lbl">${hl(slide.stat_label)}</div>` : ""}
    `;
  } else {
    contentHTML = `
      ${slide.main_text ? `<div class="main">${hl(slide.main_text)}</div>` : ""}
      ${slide.sub_text ? `<div class="sub">${hl(slide.sub_text)}</div>` : ""}
      ${slide.sub_text_2 ? `<div class="sub">${hl(slide.sub_text_2)}</div>` : ""}
      ${slide.type === "conclusion" ? `<div class="cta">Follow to know what happens next.</div>` : ""}
    `;
  }

  const bubbleHTML = slide.bubble ? `
    <div class="bubble-wrap">
      <div class="divider"></div>
      <div class="bubble">${slide.bubble}</div>
    </div>` : "";

  return `
    <div class="slide">
      <div class="slide-inner">
        <div class="top-bar">
          <span class="overline">${theme}</span>
          <span class="page">${pageNum} / ${totalNum}</span>
        </div>
        <div class="content">
          ${contentHTML}
          ${bubbleHTML}
        </div>
        <div class="bottom-bar">
          <span class="handle">@drawoheriter</span>
          <span class="swipe">${isFirst ? "swipe →" : ""}</span>
        </div>
      </div>
    </div>`;
}

export function generatePreview(entry) {
  fs.mkdirSync(join(ROOT, PREVIEWS_DIR), { recursive: true });

  const slidesHTML = entry.slides
    .map((s, i) => buildSlideHTML(s, i, entry.slides.length, entry.theme))
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${entry.theme} — ${entry.date}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', sans-serif;
  background: #F2F2F7;
  padding: 32px 24px 48px;
  min-height: 100vh;
}

/* Header */
.header {
  max-width: 1100px;
  margin: 0 auto 28px;
}
.label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8E8E93;
  margin-bottom: 6px;
}
.theme {
  font-size: 28px;
  font-weight: 800;
  color: #1D1D1F;
  margin-bottom: 4px;
}
.date { font-size: 14px; color: #8E8E93; }

/* Text cards */
.text-cards {
  max-width: 1100px;
  margin: 0 auto 28px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 700px) { .text-cards { grid-template-columns: 1fr; } }
.card {
  background: #fff;
  border-radius: 16px;
  padding: 20px 22px;
}
.card .label { margin-bottom: 8px; }
.card p {
  font-size: 15px;
  line-height: 1.6;
  color: #1D1D1F;
  white-space: pre-wrap;
}

/* Slides row */
.slides-wrap {
  max-width: 1100px;
  margin: 0 auto;
  overflow-x: auto;
  padding-bottom: 8px;
}
.slides-row {
  display: flex;
  gap: 16px;
  width: max-content;
}

/* Individual slide — 1080x1080 scaled to 340x340 */
.slide {
  width: 340px;
  height: 340px;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.10);
  background: #fff;
}
.slide-inner {
  width: 1080px;
  height: 1080px;
  transform: scale(0.3148);
  transform-origin: top left;
  display: flex;
  flex-direction: column;
  padding: 70px 80px;
  background: #FFFFFF;
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
  color: #999;
}
.page { font-size: 22px; font-weight: 500; color: #BBB; letter-spacing: 0.05em; }
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 24px;
  overflow: hidden;
  min-height: 0;
}
.main {
  font-size: 72px;
  font-weight: 800;
  line-height: 1.15;
  color: #0A0A0A;
  letter-spacing: -0.03em;
  flex-shrink: 0;
}
.hl { color: #3333FF; }
.sub {
  font-size: 30px;
  font-weight: 500;
  color: #555;
  line-height: 1.5;
  flex-shrink: 0;
}
.stat-num {
  font-size: 160px;
  font-weight: 900;
  color: #3333FF;
  letter-spacing: -0.04em;
  line-height: 1;
  flex-shrink: 0;
}
.stat-lbl {
  font-size: 30px;
  font-weight: 600;
  color: #0A0A0A;
  line-height: 1.4;
  flex-shrink: 0;
}
.cta { font-size: 28px; font-weight: 700; color: #3333FF; flex-shrink: 0; }
.bubble-wrap { flex-shrink: 0; margin-top: auto; padding-top: 28px; }
.divider { width: 56px; height: 2px; background: #E0E0E0; margin-bottom: 18px; }
.bubble {
  display: inline-block;
  background: #F0F0F0;
  border-radius: 36px 36px 36px 8px;
  padding: 20px 32px;
  font-size: 24px;
  color: #444;
  font-style: italic;
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
.handle { font-size: 22px; font-weight: 600; color: #AAA; }
.swipe { font-size: 22px; font-weight: 600; color: #AAA; letter-spacing: 0.04em; }
</style>
</head>
<body>
  <div class="header">
    <div class="label">Draft preview — ${entry.date}</div>
    <div class="theme">${entry.theme}</div>
  </div>

  <div class="text-cards">
    <div class="card">
      <div class="label">Threads text post</div>
      <p>${entry.threads_text}</p>
    </div>
    <div class="card">
      <div class="label">Instagram caption</div>
      <p>${entry.caption}</p>
    </div>
  </div>

  <div class="slides-wrap">
    <div class="slides-row">
      ${slidesHTML}
    </div>
  </div>
</body>
</html>`;

  const outPath = join(ROOT, PREVIEWS_DIR, `${entry.id}.html`);
  fs.writeFileSync(outPath, html);
  return outPath;
}

// Allow running directly: node scripts/preview.mjs <id>
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const queue = loadJSON(join(ROOT, QUEUE_FILE), []);
  const targetId = process.argv[2];
  const entry = targetId
    ? queue.find(e => e.id === targetId)
    : queue.filter(e => e.status === "pending").at(-1);

  if (!entry) { console.error("No matching entry found."); process.exit(1); }

  const outPath = generatePreview(entry);
  console.log(`Preview: ${outPath}`);
}
