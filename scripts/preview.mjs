/**
 * Generates a self-contained HTML preview of a queue entry's slides.
 * Uses the SAME buildSlideHTML as render.mjs — what you see is what gets posted.
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

// ── Design system (must stay in sync with render.mjs) ────────────────────────
const THEMES = {
  "building in public":     { band: "#7C3AED", rule: "#DDD6FE", accent: "#C4B5FD", bubbleBg: "#F5F3FF", bubbleBorder: "#C4B5FD", bubbleText: "#4C1D95" },
  "managing finances":      { band: "#16A34A", rule: "#A7F3D0", accent: "#6EE7B7", bubbleBg: "#ECFDF5", bubbleBorder: "#6EE7B7", bubbleText: "#14532D" },
  "navigating career":      { band: "#2563EB", rule: "#BFDBFE", accent: "#93C5FD", bubbleBg: "#EBF2FF", bubbleBorder: "#93C5FD", bubbleText: "#1A3A8A" },
  "growing in relationship":{ band: "#DB2777", rule: "#FBCFE8", accent: "#F9A8D4", bubbleBg: "#FDF2F8", bubbleBorder: "#F9A8D4", bubbleText: "#831843" },
  "random others":          { band: "#D97706", rule: "#FDE68A", accent: "#FCD34D", bubbleBg: "#FFFBEB", bubbleBorder: "#FCD34D", bubbleText: "#78350F" },
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

// Same overflow-prevention logic as render.mjs — must stay in sync (see comment there)
function tierSize(len, tiers) {
  for (const [maxLen, size] of tiers) if (len <= maxLen) return size;
  return tiers[tiers.length - 1][1];
}

function slideTextWeight(slide) {
  return (slide.title?.length || 0) * 0.3
    + (slide.main_text?.length || 0) * 1.3
    + (slide.sub_text?.length || 0)
    + (slide.sub_text_2 ? slide.sub_text_2.length + 100 : 0)
    + (slide.stat_label?.length || 0)
    + (slide.bubble?.length || 0) * 0.8;
}

// Same calibration as render.mjs — must stay in sync (see comment there)
function slideFontSizes(slide) {
  const w = slideTextWeight(slide);
  return {
    main:   tierSize(w, [[260, 88], [320, 76], [380, 64], [440, 54], [999, 46]]),
    sub:    tierSize(w, [[260, 42], [320, 38], [380, 34], [440, 30], [999, 26]]),
    bubble: tierSize(w, [[260, 34], [320, 32], [380, 30], [440, 27], [999, 24]]),
  };
}

// Identical to render.mjs — produces the 1080x1080 slide HTML
function buildSlideHTML(slide, idx, total, theme) {
  const c = getThemeColors(theme);
  const pageNum  = String(idx + 1).padStart(2, "0");
  const totalNum = String(total).padStart(2, "0");
  const isFirst  = idx === 0;

  const fs_ = slideFontSizes(slide);

  const bubbleHTML = slide.bubble ? `
    <div class="bubble-wrap">
      <div class="divider"></div>
      <div class="bubble" style="font-size:${fs_.bubble}px">${slide.bubble}</div>
      <svg class="bubble-tail" width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
        <polygon points="0,0 26,0 0,26" fill="${c.bubbleBg}"/>
        <polyline points="26,0 0,26 0,0" fill="none" stroke="${c.bubbleBorder}" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
    </div>` : "";

  let bodyHTML = "";

  if (isFirst) {
    bodyHTML = `
    <div class="body center">
      <div class="slide-content">
        <div class="center-content">
          ${slide.main_text ? `<div class="main" style="font-size:${fs_.main}px">${renderHighlights(slide.main_text, c.band, c.accent)}</div>` : ""}
          ${slide.sub_text  ? `<div class="sub" style="font-size:${fs_.sub}px">${slide.sub_text}</div>` : ""}
        </div>
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
        ${slide.sub_text   ? `<div class="sub" style="font-size:${fs_.sub}px">${renderHighlights(slide.sub_text, c.band, c.accent)}</div>` : ""}
        <div class="stat-num">${slide.stat_number || ""}</div>
        ${slide.stat_label ? `<div class="stat-lbl" style="font-size:${fs_.sub}px">${renderHighlights(slide.stat_label, c.band, c.accent)}</div>` : ""}`;
    } else {
      contentHTML = `
        ${slide.title      ? `<div class="title">${slide.title}</div>` : ""}
        ${slide.main_text  ? `<div class="main" style="font-size:${fs_.main}px">${renderHighlights(slide.main_text, c.band, c.accent)}</div>` : ""}
        ${slide.sub_text   ? `<div class="sub" style="font-size:${fs_.sub}px">${renderHighlights(slide.sub_text, c.band, c.accent)}</div>` : ""}
        ${slide.sub_text_2 ? `<div class="sub" style="font-size:${fs_.sub}px;margin-top:12px">${renderHighlights(slide.sub_text_2, c.band, c.accent)}</div>` : ""}
        ${slide.type === "conclusion" ? `<div class="cta">Save this post and follow my journey.</div>` : ""}`;
    }

    bodyHTML = `
    <div class="body top">
      <div class="slide-content">
        <div class="content">${contentHTML}</div>
      </div>
      ${bubbleHTML}
      <div class="foot"><span class="handle">@drawoheriter</span></div>
    </div>`;
  }

  // Slide CSS is inlined so each slide is self-contained inside the preview wrapper
  return `
    <div class="slide-outer">
      <iframe srcdoc="${escapeAttr(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1080px; overflow: hidden; }
body { font-family: 'Patrick Hand', cursive; background: #FAF6F0; width: 1080px; height: 1080px; display: flex; flex-direction: column; }
.band { height: 90px; background: ${c.band}; display: flex; align-items: center; padding: 0 160px; flex-shrink: 0; }
.band-name { font-size: 36px; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.92); }
.band-pg { margin-left: auto; font-size: 28px; color: rgba(255,255,255,0.5); }
.body { flex: 1; display: flex; flex-direction: column; padding: 0 160px; min-height: 0; }
.body.top { padding-top: 64px; }
.slide-content { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.center-content { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 32px; }
.content { display: flex; flex-direction: column; gap: 28px; }
.foot { display: flex; justify-content: space-between; align-items: center; padding-top: 24px; padding-bottom: 52px; flex-shrink: 0; }
.title { font-size: 26px; color: #B0A090; letter-spacing: 0.1em; text-transform: uppercase; }
.main { font-size: 88px; line-height: 1.2; color: #1A1208; }
.sub { font-size: 42px; color: #7A6858; line-height: 1.6; }
.stat-num { font-size: 190px; line-height: 1; letter-spacing: -0.02em; color: ${c.band}; }
.stat-lbl { font-size: 42px; color: #7A6858; line-height: 1.5; }
.cta { font-size: 40px; line-height: 1.4; color: ${c.band}; }
.handle { font-size: 24px; color: #C8B8A8; }
.swipe { font-size: 24px; color: #C8B8A8; }
.bubble-wrap { margin-top: auto; padding-top: 28px; flex-shrink: 0; }
.divider { width: 56px; height: 3px; background: ${c.rule}; margin-bottom: 24px; }
.bubble { display: block; border-radius: 24px 24px 24px 6px; border: 2px solid ${c.bubbleBorder}; background: ${c.bubbleBg}; padding: 26px 40px; font-size: 34px; line-height: 1.55; font-style: italic; color: ${c.bubbleText}; max-width: 100%; }
.bubble-tail { display: block; margin-left: 42px; margin-top: -1px; }
</style></head>
<body>
  <div class="band"><span class="band-name">${theme}</span><span class="band-pg">${pageNum} / ${totalNum}</span></div>
  ${bodyHTML}
</body></html>`)}" width="1080" height="1080" style="border:none;transform:scale(0.3148);transform-origin:top left;display:block;"></iframe>
    </div>`;
}

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
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
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, sans-serif; background: #F2F2F7; padding: 32px 24px 48px; min-height: 100vh; }
.header { max-width: 1200px; margin: 0 auto 20px; }
.label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #8E8E93; margin-bottom: 4px; }
.theme { font-size: 24px; font-weight: 800; color: #1D1D1F; margin-bottom: 2px; }
.date { font-size: 13px; color: #8E8E93; }
.text-cards { max-width: 1200px; margin: 0 auto 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 700px) { .text-cards { grid-template-columns: 1fr; } }
.card { background: #fff; border-radius: 14px; padding: 18px 20px; }
.card .label { margin-bottom: 8px; }
.card p { font-size: 14px; line-height: 1.6; color: #1D1D1F; white-space: pre-wrap; }
.slides-wrap { max-width: 1200px; margin: 0 auto; overflow-x: auto; padding-bottom: 8px; }
.slides-row { display: flex; gap: 14px; width: max-content; }
.slide-outer { width: 340px; height: 340px; flex-shrink: 0; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 14px rgba(0,0,0,0.12); }
</style>
</head>
<body>
  <div class="header">
    <div class="label">Draft preview — ${entry.date}</div>
    <div class="theme">${entry.theme}</div>
  </div>

  <div class="text-cards">
    <div class="card">
      <div class="label">Threads</div>
      <p>${entry.threads_text || entry.threads || ""}</p>
    </div>
    <div class="card">
      <div class="label">Caption</div>
      <p>${entry.caption || ""}</p>
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
