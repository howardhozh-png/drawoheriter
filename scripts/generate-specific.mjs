/**
 * One-time script: generates specific plan days by number.
 * Usage: node scripts/generate-specific.mjs 2 4 5 6 7 8 9 10
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

function parsePlan(markdown) {
  const days = [];
  const sections = markdown.split(/^### Day (\d+)\s*$/m);
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

    const themeMatch = markdown.slice(0, markdown.indexOf(`### Day ${dayNum}`))
      .match(/Overline label:\s*\*\*(.+?)\*\*/g);
    const theme = themeMatch
      ? themeMatch[themeMatch.length - 1].replace(/Overline label:\s*\*\*/, "").replace(/\*\*/, "")
      : "Navigating career";

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

async function generateDay(client, planDay, totalDays) {
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

  const prompt = `Write Day ${planDay.day} of the plan.

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
- Day 1 post (zero customers) already went out

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
    throw new Error("Parse failed");
  }

  return {
    id: `day${planDay.day}-career`,
    plan_day: planDay.day,
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
}

async function main() {
  if (!ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

  const targetDays = process.argv.slice(2).map(Number).filter(n => !isNaN(n) && n > 0);
  if (targetDays.length === 0) {
    console.error("Usage: node scripts/generate-specific.mjs 2 4 5 6 7 8 9 10");
    process.exit(1);
  }

  const planMd = fs.readFileSync(PLAN_FILE, "utf8");
  const plan = parsePlan(planMd);
  const queue = loadJSON(QUEUE_FILE, []);

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const newEntries = [];

  for (const dayNum of targetDays) {
    const existing = queue.find(e => e.plan_day === dayNum && e.status !== "skipped");
    if (existing) {
      console.log(`Day ${dayNum} already exists in queue (status: ${existing.status}), skipping.`);
      continue;
    }

    const planDay = plan.find(d => d.day === dayNum);
    if (!planDay) {
      console.error(`Day ${dayNum} not found in plan.md`);
      continue;
    }

    console.log(`\nGenerating Day ${dayNum}: ${planDay.hook?.replace(/\*\*/g, "")}`);
    console.log(`Theme: ${planDay.theme}`);

    try {
      const entry = await generateDay(client, planDay, plan.length);
      newEntries.push(entry);
      console.log(`✓ Day ${dayNum} generated (${entry.slides.length} slides)`);

      // Generate preview
      try {
        const previewPath = generatePreview(entry);
        console.log(`  Preview: ${previewPath}`);
      } catch (e) {
        console.log(`  Preview failed: ${e.message}`);
      }
    } catch (e) {
      console.error(`✗ Day ${dayNum} failed: ${e.message}`);
    }
  }

  if (newEntries.length === 0) {
    console.log("\nNo new entries generated.");
    return;
  }

  // Insert new entries after day11-career (the last approved entry) and before any existing pending
  // Find insertion point: after the last non-pending entry
  const day11Index = queue.findIndex(e => e.id === "day11-career");
  const insertAfter = day11Index >= 0 ? day11Index : queue.length - 1;

  // Sort new entries by day number for correct ordering
  newEntries.sort((a, b) => a.plan_day - b.plan_day);

  queue.splice(insertAfter + 1, 0, ...newEntries);

  saveJSON(QUEUE_FILE, queue);
  console.log(`\nDone. Added ${newEntries.length} entries to queue after position ${insertAfter + 1}.`);
  console.log("Entries added:", newEntries.map(e => `Day ${e.plan_day}`).join(", "));
}

main().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
