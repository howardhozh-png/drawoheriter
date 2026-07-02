/**
 * One-shot: post carousel reply to an existing Threads text post.
 * Usage: node scripts/retry-carousel.mjs <threads_post_id> <queue_entry_id>
 */
import fs from "fs";
import https from "https";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const env = fs.existsSync(".env.local")
  ? Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>[l.split("=")[0],l.split("=").slice(1).join("=")]))
  : {};

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN ?? env.META_ACCESS_TOKEN?.trim();
const META_USER_ID      = process.env.META_USER_ID ?? env.META_USER_ID?.trim();

const [,, threadsPostId, entryId] = process.argv;
if (!threadsPostId || !entryId) {
  console.error("Usage: node scripts/retry-carousel.mjs <threads_post_id> <queue_entry_id>");
  process.exit(1);
}

function get(hostname, path) {
  return new Promise((resolve, reject) => {
    https.request({ hostname, path, method: "GET" }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    }).on("error", reject).end();
  });
}

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
  const filename = filePath.split("/").pop();
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
      hostname: "litterbox.catbox.moe",
      path: "/resources/internals/api.php",
      method: "POST",
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

async function waitThreadsContainerFinished(containerId) {
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const r = await get("graph.threads.net",
      `/v1.0/${containerId}?fields=status,error_message&access_token=${META_ACCESS_TOKEN}`);
    console.log(`  poll ${i+1}: status=${r.status}`);
    if (r.status === "FINISHED") return;
    if (r.status === "ERROR") throw new Error("Container error: " + r.error_message);
  }
  throw new Error(`Container ${containerId} never reached FINISHED`);
}

async function main() {
  if (!META_ACCESS_TOKEN || !META_USER_ID) {
    console.error("META_ACCESS_TOKEN and META_USER_ID required");
    process.exit(1);
  }

  const queue = JSON.parse(fs.readFileSync("content/queue.json", "utf8"));
  const entry = queue.find(e => e.id === entryId);
  if (!entry) { console.error("Entry not found:", entryId); process.exit(1); }
  if (!entry.images?.length) { console.error("No images in entry"); process.exit(1); }

  console.log(`Posting carousel reply to Threads post ${threadsPostId}`);
  console.log(`Entry: ${entryId} (${entry.images.length} slides)`);

  // Upload all images
  const imageUrls = [];
  for (let i = 0; i < entry.images.length; i++) {
    console.log(`\nUploading [${i+1}/${entry.images.length}] ${entry.images[i]}`);
    const url = await uploadImage(entry.images[i]);
    console.log(`  → ${url}`);
    imageUrls.push(url);
  }

  // Create child containers (no wait — they don't reach FINISHED independently)
  console.log("\nCreating child carousel item containers...");
  const childIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const r = await post(
      "graph.threads.net",
      `/v1.0/${META_USER_ID}/threads?media_type=IMAGE&image_url=${encodeURIComponent(imageUrls[i])}&is_carousel_item=true&access_token=${META_ACCESS_TOKEN}`,
      null
    );
    childIds.push(r.id);
    console.log(`  [${i+1}] container ${r.id}`);
  }

  // Short pause to let Meta register all children
  console.log("\nWaiting 15s for containers to register...");
  await new Promise(r => setTimeout(r, 15000));

  // Create parent carousel with reply_to_id
  console.log("Creating parent carousel container...");
  const carousel = await post(
    "graph.threads.net",
    `/v1.0/${META_USER_ID}/threads?media_type=CAROUSEL&children=${childIds.join(",")}&reply_to_id=${threadsPostId}&access_token=${META_ACCESS_TOKEN}`,
    null
  );
  console.log(`Parent carousel container: ${carousel.id}`);

  // Wait for parent to be FINISHED
  console.log("Waiting for parent carousel to be ready...");
  await waitThreadsContainerFinished(carousel.id);

  // Publish
  console.log("Publishing...");
  const result = await post(
    "graph.threads.net",
    `/v1.0/${META_USER_ID}/threads_publish?creation_id=${carousel.id}&access_token=${META_ACCESS_TOKEN}`,
    null
  );
  console.log(`\n✓ Carousel reply posted! ID: ${result.id}`);

  // Update queue + posted
  const qIdx = queue.findIndex(e => e.id === entryId);
  if (qIdx >= 0) queue[qIdx].threads_carousel_id = result.id;
  fs.writeFileSync("content/queue.json", JSON.stringify(queue, null, 2));

  const posted = JSON.parse(fs.readFileSync("content/posted.json", "utf8"));
  const pIdx = posted.findLastIndex(e => e.id === entryId);
  if (pIdx >= 0) posted[pIdx].threads_carousel_id = result.id;
  fs.writeFileSync("content/posted.json", JSON.stringify(posted, null, 2));

  console.log("queue.json and posted.json updated.");
}

main().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
