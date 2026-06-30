/**
 * Generates daily carousel content using Claude.
 * Picks topic by weight, generates structured slides + Threads text.
 * Saves to content/queue.json with status "pending".
 *
 * Run: node scripts/generate.mjs
 * Cron: 9am MYT daily
 */

import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const env = fs.existsSync(".env.local")
  ? Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>[l.split("=")[0],l.split("=").slice(1).join("=")]))
  : {};
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY?.trim();

const TOPICS_FILE = "content/topics.json";
const QUEUE_FILE  = "content/queue.json";

function loadJSON(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}
function pickTopic(topics) {
  const total = topics.reduce((s,t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of topics) { r -= t.weight; if (r <= 0) return t; }
  return topics[0];
}

async function generate() {
  if (!ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

  const { persona, topics } = loadJSON(TOPICS_FILE);
  const queue = loadJSON(QUEUE_FILE, []);
  const topic = pickTopic(topics);
  const angle = topic.prompts[Math.floor(Math.random() * topic.prompts.length)];

  console.log(`Topic: ${topic.label}`);
  console.log(`Angle: ${angle}`);

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const system = `You are writing social media content for ${persona.name}.

Bio: ${persona.bio}

Voice: ${persona.voice}

Never: ${persona.never.join(", ")}

CAROUSEL STRUCTURE RULES:
- Slide 1 (hook): Big bold statement. Sub-text sets up the story. No bubble.
- Slide 2: A number/stat slide OR a strong counterpoint. Always has a bubble with a dry personal aside.
- Slides 3-N (content): One idea per slide. Max 2 sub-text lines. Always has a bubble.
- Last slide (conclusion): Wraps up the lesson. Has "Follow to know what happens next." as follow_cta. Has a bubble.
- Total slides: 5-7 depending on content. Be flexible.
- Bubbles: short, conversational, self-deprecating or honest. Like a text to a friend. Never preachy.
- Highlights: wrap key words/phrases in ** like **this** — these render in blue (#3333FF).
- No em dashes. No hashtags. No corporate speak.

Respond in this exact JSON format:
{
  "theme": "short theme label e.g. Building in public / Building my finances / Managing ambition",
  "caption": "first slide hook text — used as Instagram/Threads caption",
  "threads_text": "standalone Threads text post version (max 500 chars, conversational)",
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
      "stat_label": "supporting context label",
      "bubble": "dry personal aside"
    },
    {
      "type": "content",
      "main_text": "Bold claim with **highlight**",
      "sub_text": "supporting line",
      "sub_text_2": "optional second line",
      "bubble": "personal thought"
    },
    {
      "type": "conclusion",
      "main_text": "Lesson or takeaway with **highlight**",
      "sub_text": "one closing line",
      "follow_cta": "Follow to know what happens next.",
      "bubble": "honest final thought"
    }
  ]
}`;

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system,
    messages: [{
      role: "user",
      content: `Write content about: ${angle}

Live context to use if relevant:
- kakisewa cold email campaign: 8,471 agents, 100 emails/day automated, Resend API
- kakisewa.com is live, zero paying customers so far
- Howard works full-time at Tarro (US startup, Malaysia-based) while building this`
    }]
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
    date: new Date().toISOString().split("T")[0],
    topic: topic.id,
    angle,
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

  console.log("\n=== Generated ===");
  console.log(`Theme: ${entry.theme}`);
  console.log(`Caption: ${entry.caption}`);
  console.log(`\nThreads text:\n${entry.threads_text}`);
  console.log(`\nSlides: ${entry.slides.length}`);
  entry.slides.forEach((s,i) => {
    console.log(`  [${i+1}] ${s.type}: ${(s.main_text || s.stat_number || "").replace(/\*\*/g,"").slice(0,60)}`);
    if (s.bubble) console.log(`       bubble: "${s.bubble}"`);
  });
  console.log(`\nSaved to queue (id: ${entry.id})`);
  console.log(`Next: node scripts/render.mjs ${entry.id}   — generate images`);
  console.log(`Then: node scripts/review.mjs               — approve and post`);
}

generate().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
