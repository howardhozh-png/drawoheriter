/**
 * Generates daily carousel content using Claude, following plan.md in order.
 * Finds the next ungenerated day from the plan, passes its details to Claude.
 *
 * Run: node scripts/generate.mjs
 * Cron: 9:05pm MYT daily (5 min after post.mjs fires)
 */

import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { generatePreview } from "./preview.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const env = fs.existsSync(".env.local")
  ? Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>[l.split("=")[0],l.split("=").slice(1).join("=")]))
  : {};
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY?.trim();

const PLAN_FILE  = "content/plan.md";
const QUEUE_FILE = "content/queue.json";

function loadJSON(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

// Parse plan.md into an array of day objects
function parsePlan(markdown) {
  const days = [];
  // Split on ### Day N headers
  const sections = markdown.split(/^### Day (\d+)\s*$/m);
  // sections: [preamble, dayNum, content, dayNum, content, ...]
  for (let i = 1; i < sections.length; i += 2) {
    const dayNum = parseInt(sections[i]);
    const body = sections[i + 1] || "";

    const field = (label) => {
      const m = body.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|\\n---|\n\n--|$)`, "s"));
      return m ? m[1].trim() : null;
    };

    const angles = [];
    const anglesBlock = body.match(/\*\*Content angles:\*\*\s*([\s\S]*?)(?=\n\*\*|---)/);
    if (anglesBlock) {
      anglesBlock[1].trim().split("\n").forEach(l => {
        const clean = l.replace(/^-\s*/, "").trim();
        if (clean) angles.push(clean);
      });
    }

    const statRaw = field("Stat slide");
    let statNumber = null, statLabel = null;
    if (statRaw) {
      const parts = statRaw.split("/");
      statNumber = parts[0]?.trim() || null;
      statLabel  = parts.slice(1).join("/").trim() || null;
    }

    // Find the overline/theme for this day's section
    const themeMatch = markdown.slice(0, markdown.indexOf(`### Day ${dayNum}`))
      .match(/Overline label:\s*\*\*(.+?)\*\*/g);
    const theme = themeMatch
      ? themeMatch[themeMatch.length - 1].replace(/Overline label:\s*\*\*/, "").replace(/\*\*/, "")
      : "Building in public";

    days.push({
      day: dayNum,
      theme,
      hook: field("Hook"),
      subText: field("Sub-text"),
      statNumber,
      statLabel,
      angles,
      bubble: field("Bubble")?.replace(/^"|"$/g, ""),
      cta: field("CTA"),
      threadsHint: field("Threads"),
    });
  }
  return days;
}

async function generate() {
  if (!ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

  const planMd = fs.readFileSync(PLAN_FILE, "utf8");
  const plan = parsePlan(planMd);
  const queue = loadJSON(QUEUE_FILE, []);

  // Find the highest plan_day that has been generated (not skipped)
  const generatedDays = queue
    .filter(e => e.plan_day && e.status !== "skipped")
    .map(e => e.plan_day);
  const lastDay = generatedDays.length > 0 ? Math.max(...generatedDays) : 1;
  const nextDayNum = lastDay + 1;

  const planDay = plan.find(d => d.day === nextDayNum);
  if (!planDay) {
    console.log(`No plan entry found for Day ${nextDayNum}. Plan ends at Day ${plan[plan.length - 1]?.day}.`);
    return;
  }

  console.log(`Generating Day ${nextDayNum}: ${planDay.hook?.replace(/\*\*/g, "")}`);
  console.log(`Theme: ${planDay.theme}`);

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const system = `You are writing social media content for Howard Hozh (@drawoheriter on Instagram and Threads).

Howard is a Malaysian founder building kakisewa.com — a SaaS for Malaysian rental agents — while working full-time at Tarro, a US startup, in Malaysia. He has an MBB consulting background. He posts honestly about building in public, using AI to build, and founder life in Malaysia.

Voice: direct, honest, dry wit, no corporate speak, no motivational fluff. Sounds like a smart friend texting you.
Never: em dashes, hashtags, "journey", "game-changer", generic advice, preachy tone.

CAROUSEL STRUCTURE RULES:
- Slide 1 (hook): Big bold statement. Sub-text sets up the story. No bubble.
- Slide 2: A stat slide with the given number — always has a dry personal bubble.
- Slides 3-N (content): One idea per slide. Max 2 sub-text lines. Always has a bubble.
- Last slide (conclusion): Wraps up the lesson. Has "Follow to know what happens next or save this for later." as follow_cta. Has a bubble.
- Total slides: 5-7 depending on content.
- Bubbles: short, conversational, self-deprecating or honest. Like a text to a friend.
- Highlights: wrap key words/phrases in **like this** — these render in blue on the actual slide.
- No em dashes. No hashtags.

Respond in this exact JSON format with no extra text:
{
  "theme": "the overline theme label",
  "caption": "Instagram caption — use the CTA from the plan",
  "threads_text": "standalone Threads text post (max 500 chars, conversational, ends with a question or poll hook)",
  "slides": [
    {
      "type": "hook",
      "main_text": "Big statement with **highlighted** words",
      "sub_text": "one line setup",
      "bubble": null
    },
    {
      "type": "stat",
      "sub_text": "framing sentence",
      "stat_number": "8,471",
      "stat_label": "what the number means",
      "bubble": "dry personal aside"
    },
    {
      "type": "content",
      "main_text": "Bold claim with **highlight**",
      "sub_text": "supporting line",
      "sub_text_2": "optional second line or null",
      "bubble": "personal thought"
    },
    {
      "type": "conclusion",
      "main_text": "Lesson with **highlight**",
      "sub_text": "one closing line",
      "follow_cta": "Save this for later or follow for what happens next.",
      "bubble": "honest final thought"
    }
  ]
}`;

  const prompt = `Write Day ${nextDayNum} of the plan.

PLAN FOR THIS DAY:
Hook: ${planDay.hook}
Sub-text: ${planDay.subText}
Stat slide: ${planDay.statNumber} / ${planDay.statLabel}
Content angles (cover all of these across the content slides):
${planDay.angles.map(a => `- ${a}`).join("\n")}
Bubble (for hook slide 1, this is null — use this spirit for the other bubbles): "${planDay.bubble}"
CTA (use this for the caption and the conclusion slide): ${planDay.cta}
Threads hint: ${planDay.threadsHint}
Theme/overline: ${planDay.theme}

Live context to weave in if relevant:
- kakisewa cold email campaign: 8,471 agents scraped, 100 emails/day automated via Resend
- kakisewa.com is live, zero paying customers so far
- Howard works full-time at Tarro (US startup) based in Malaysia, building kakisewa on the side
- Day 1 post (zero customers) already went out — this is Day ${nextDayNum}

Follow the plan closely. The hook, stat number, and CTA must match. The content angles and bubbles should feel like Howard wrote them — honest, dry, not polished.`;

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: prompt }]
  });

  let data;
  try {
    const text = res.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    data = JSON.parse(match[0]);
  } catch {
    console.error("Failed to parse response:\n", res.content[0].text);
    process.exit(1);
  }

  const entry = {
    id: Date.now().toString(),
    plan_day: nextDayNum,
    date: new Date().toISOString().split("T")[0],
    topic: planDay.theme.toLowerCase().replace(/\s+/g, "-"),
    angle: planDay.hook?.replace(/\*\*/g, ""),
    status: "pending",
    theme: data.theme,
    caption: data.caption,
    threads_text: data.threads_text,
    slides: data.slides,
    images: [],
    engagement: null,
  };

  queue.push(entry);
  saveJSON(QUEUE_FILE, queue);

  const previewPath = generatePreview(entry);

  console.log("\n=== Generated ===");
  console.log(`Day: ${nextDayNum} of ${plan[plan.length - 1]?.day}`);
  console.log(`Theme: ${entry.theme}`);
  console.log(`\nThreads text:\n${entry.threads_text}`);
  console.log(`\nSlides: ${entry.slides.length}`);
  entry.slides.forEach((s, i) => {
    console.log(`  [${i+1}] ${s.type}: ${(s.main_text || s.stat_number || "").replace(/\*\*/g,"").slice(0,60)}`);
    if (s.bubble) console.log(`       bubble: "${s.bubble}"`);
  });
  console.log(`\nSaved to queue (id: ${entry.id})`);
  console.log(`Preview: ${previewPath}`);
}

generate().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
