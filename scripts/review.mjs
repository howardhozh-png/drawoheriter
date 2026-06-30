/**
 * CLI review tool — shows pending posts, approve/skip/delete/edit.
 * Run: node scripts/review.mjs
 */

import fs from "fs";
import readline from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const QUEUE_FILE = "content/queue.json";

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  return JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
}
function saveQueue(q) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2), "utf8");
}
function ask(rl, q) {
  return new Promise(r => rl.question(q, r));
}
function stripMarkers(text) {
  return (text || "").replace(/\*\*/g, "");
}

async function main() {
  const queue = loadQueue();
  const pending = queue.filter(e => e.status === "pending");

  if (pending.length === 0) {
    const approved = queue.filter(e => e.status === "approved").length;
    console.log(`No pending posts. ${approved} already approved.`);
    console.log("Run `node scripts/generate.mjs` to generate more.");
    process.exit(0);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (const entry of pending) {
    console.log("\n" + "=".repeat(64));
    console.log(`Date: ${entry.date} | Topic: ${entry.topic} | Theme: ${entry.theme}`);
    console.log(`Angle: ${entry.angle}`);

    console.log("\n--- THREADS TEXT ---");
    console.log(entry.threads_text || "(none)");
    console.log(`(${(entry.threads_text || "").length}/500 chars)`);

    console.log("\n--- CAROUSEL SLIDES ---");
    (entry.slides || []).forEach((s, i) => {
      const label = s.type.toUpperCase();
      if (s.type === "stat") {
        console.log(`  [${i+1}] ${label}: ${stripMarkers(s.sub_text)} — ${s.stat_number} ${stripMarkers(s.stat_label)}`);
      } else {
        console.log(`  [${i+1}] ${label}: ${stripMarkers(s.main_text || "")}`);
        if (s.sub_text) console.log(`       ${stripMarkers(s.sub_text)}`);
      }
      if (s.bubble) console.log(`       bubble: "${s.bubble}"`);
    });

    console.log(`\nCaption: ${entry.caption}`);

    if (entry.images?.length > 0) {
      console.log(`\nImages rendered (${entry.images.length} slides):`);
      entry.images.forEach(p => console.log(`  ${p}`));
    } else {
      console.log("\nImages: not yet rendered. Run `node scripts/render.mjs` to generate.");
    }

    const action = await ask(rl, "\n[a]pprove / [r]ender+approve / [s]kip / [d]elete / [e]dit threads / [q]uit: ");
    const idx = queue.findIndex(e => e.id === entry.id);

    if (action === "a") {
      queue[idx].status = "approved";
      saveQueue(queue);
      console.log("Approved.");
    } else if (action === "r") {
      // Render then approve
      console.log("Rendering images first...");
      rl.close();
      const { execSync } = await import("child_process");
      try {
        execSync(`node scripts/render.mjs ${entry.id}`, { stdio: "inherit" });
        const fresh = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
        const freshIdx = fresh.findIndex(e => e.id === entry.id);
        fresh[freshIdx].status = "approved";
        saveQueue(fresh);
        console.log("Rendered and approved.");
      } catch (err) {
        console.error("Render failed:", err.message);
      }
      return;
    } else if (action === "s") {
      queue[idx].status = "skipped";
      saveQueue(queue);
      console.log("Skipped.");
    } else if (action === "d") {
      queue.splice(idx, 1);
      saveQueue(queue);
      console.log("Deleted.");
    } else if (action === "e") {
      console.log("\nCurrent Threads text:");
      console.log(entry.threads_text);
      const newText = await ask(rl, "\nPaste edited text (or Enter to keep): ");
      if (newText.trim()) {
        queue[idx].threads_text = newText.trim();
        saveQueue(queue);
        console.log("Updated.");
      }
      const confirm = await ask(rl, "[a]pprove / [s]kip: ");
      if (confirm === "a") {
        queue[idx].status = "approved";
        saveQueue(queue);
        console.log("Approved.");
      } else {
        queue[idx].status = "skipped";
        saveQueue(queue);
      }
    } else if (action === "q") {
      break;
    }
  }

  rl.close();
  const approved = queue.filter(e => e.status === "approved").length;
  console.log(`\nDone. ${approved} post(s) approved and ready to post.`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
