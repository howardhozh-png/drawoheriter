// One-time retry script for Day 1 — posts IG carousel, IG story, and Threads carousel reply
import fs from 'fs';
import https from 'https';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => [l.split('=')[0], l.split('=').slice(1).join('=')])
);

const META_ACCESS_TOKEN = env.META_ACCESS_TOKEN?.trim();
const META_USER_ID = env.META_USER_ID?.trim();
const INSTAGRAM_ACCESS_TOKEN = env.INSTAGRAM_ACCESS_TOKEN?.trim();
const INSTAGRAM_USER_ID = env.INSTAGRAM_USER_ID?.trim();

const THREADS_TEXT_ID = '18009060179873823';
const IMAGE_PATHS = [
  'content/images/day1-mockup/slide-01.png',
  'content/images/day1-mockup/slide-02.png',
  'content/images/day1-mockup/slide-03.png',
  'content/images/day1-mockup/slide-04.png',
  'content/images/day1-mockup/slide-05.png',
  'content/images/day1-mockup/slide-06.png',
].map(p => join(ROOT, p));

const IG_CAPTION = `I built a SaaS and have zero paying customers.\n\nHere is what week 1 actually looked like.\n\nWhat are you building right now? Drop it in the comments.`;

function postReq(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST' }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          if (p.error) reject(new Error(p.error.message));
          else resolve(p);
        } catch (e) { reject(new Error('Bad JSON: ' + d.slice(0, 100))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function uploadImage(filePath) {
  const fileData = fs.readFileSync(filePath);
  const filename = filePath.split('/').pop();
  const boundary = '----CatboxBoundary' + Date.now();
  const CRLF = '\r\n';
  const preamble = Buffer.from(
    `--${boundary}${CRLF}Content-Disposition: form-data; name="reqtype"${CRLF}${CRLF}fileupload${CRLF}` +
    `--${boundary}${CRLF}Content-Disposition: form-data; name="fileToUpload"; filename="${filename}"${CRLF}Content-Type: image/png${CRLF}${CRLF}`,
    'utf8'
  );
  const epilogue = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
  const body = Buffer.concat([preamble, fileData, epilogue]);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'catbox.moe', path: '/user.php', method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const url = d.trim();
        if (url.startsWith('https://')) resolve(url);
        else reject(new Error('catbox: ' + url.slice(0, 100)));
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

async function main() {
  console.log('Uploading 6 images to catbox...');
  const imageUrls = [];
  for (let i = 0; i < IMAGE_PATHS.length; i++) {
    const url = await uploadImage(IMAGE_PATHS[i]);
    imageUrls.push(url);
    console.log(`  [${i + 1}/6] ${url}`);
  }

  // Instagram carousel
  console.log('\nInstagram carousel...');
  const childIds = [];
  for (const url of imageUrls) {
    const r = await postReq('graph.instagram.com',
      `/v21.0/${INSTAGRAM_USER_ID}/media?image_url=${encodeURIComponent(url)}&is_carousel_item=true&access_token=${INSTAGRAM_ACCESS_TOKEN}`);
    childIds.push(r.id);
    process.stdout.write('  .');
  }
  console.log();
  const carousel = await postReq('graph.instagram.com',
    `/v21.0/${INSTAGRAM_USER_ID}/media?media_type=CAROUSEL&children=${encodeURIComponent(childIds.join(','))}&caption=${encodeURIComponent(IG_CAPTION)}&access_token=${INSTAGRAM_ACCESS_TOKEN}`);
  const igPost = await postReq('graph.instagram.com',
    `/v21.0/${INSTAGRAM_USER_ID}/media_publish?creation_id=${carousel.id}&access_token=${INSTAGRAM_ACCESS_TOKEN}`);
  console.log(`  IG carousel: ${igPost.id}`);

  // IG Story reshare
  console.log('Instagram story...');
  try {
    const storyContainer = await postReq('graph.instagram.com',
      `/v21.0/${INSTAGRAM_USER_ID}/media?media_type=STORIES&source_media_id=${igPost.id}&access_token=${INSTAGRAM_ACCESS_TOKEN}`);
    const story = await postReq('graph.instagram.com',
      `/v21.0/${INSTAGRAM_USER_ID}/media_publish?creation_id=${storyContainer.id}&access_token=${INSTAGRAM_ACCESS_TOKEN}`);
    console.log(`  IG story: ${story.id}`);
  } catch (e) { console.error(`  IG story failed: ${e.message}`); }

  // Threads carousel reply
  console.log('\nThreads carousel reply...');
  const threadChildIds = [];
  for (const url of imageUrls) {
    const r = await postReq('graph.threads.net',
      `/v1.0/${META_USER_ID}/threads?media_type=IMAGE&image_url=${encodeURIComponent(url)}&is_carousel_item=true&access_token=${META_ACCESS_TOKEN}`);
    threadChildIds.push(r.id);
    process.stdout.write('  .');
  }
  console.log();
  const tCarousel = await postReq('graph.threads.net',
    `/v1.0/${META_USER_ID}/threads?media_type=CAROUSEL&children=${encodeURIComponent(threadChildIds.join(','))}&reply_to_id=${THREADS_TEXT_ID}&access_token=${META_ACCESS_TOKEN}`);
  const tPost = await postReq('graph.threads.net',
    `/v1.0/${META_USER_ID}/threads_publish?creation_id=${tCarousel.id}&access_token=${META_ACCESS_TOKEN}`);
  console.log(`  Threads carousel reply: ${tPost.id}`);

  // Update queue.json
  const queuePath = join(ROOT, 'content/queue.json');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const entry = queue.find(e => e.id === 'day1-mockup');
  if (entry) {
    entry.instagram_id = igPost.id;
    entry.threads_carousel_id = tPost.id;
  }
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
  console.log('\nqueue.json updated. Done.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
