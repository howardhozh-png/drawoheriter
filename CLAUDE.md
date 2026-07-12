@.claude/skills/approve.md

# drawoheriter

Automated content posting system for Howard's personal brand.

## Stack
- Node.js scripts in `scripts/`
- Content in `content/queue.json` (pending → approved → posted)
- Posts to Threads (text + carousel reply) + Instagram (carousel + story)
- GitHub Actions handles daily posting at 9am MYT — Mac doesn't need to be on

## Daily workflow
1. `generate.mjs` runs at 9pm MYT — creates a new pending post from plan.md
2. Howard runs `/approve` to approve it (any time before 9am MYT next day)
3. `post.mjs` runs at 9am MYT — posts all approved entries
4. `track.mjs` runs at 10am MYT — fetches engagement and updates posted.json

## Skills
- `/approve` — review and approve pending posts (fast, one word per post)

## Content strategy principles

Adapted from a generic "viral prompts" list Howard found (2026-07-08). The claimed
result (194k followers in 2 months) is unverifiable marketing copy for the prompt
pack itself — not evidence, ignore it. The underlying techniques are standard
direct-response copywriting and worth keeping on their own merits. Two of the
original seven don't apply here and are intentionally skipped (see below).

- **Hook = a real pain point, stated directly.** Already how plan.md hooks are
  written — no change needed, just the explicit rule.
- **CTAs must be specific and curiosity-driven, never generic.** "Comment below"
  by itself is the generic phrase to avoid — it's currently the closing line on
  most of plan.md's CTA fields and should be phased out as new days are written.
  Prefer a vote/number/fill-in-the-blank format ("Vote: A or B", "Drop your
  number") over a bare instruction to comment.
- **Social proof only with real numbers.** Never fabricate a stat to sound more
  credible (this is why the RM55k post backfired) — if there's no real number,
  skip the social-proof angle entirely rather than inventing one.
- **Repurpose one piece of content across formats deliberately.** Already
  happening structurally (caption / threads_text / slides all derive from one
  day's plan entry) — keep doing this rather than writing each format from
  scratch.
- **Caption and threads_text must stay under 60 words each.** This is a hard
  check, not a vibe — before showing any caption/threads_text to Howard,
  count the actual words and cut it if it's over. Don't write one paragraph
  per outline point; compress each point to a short phrase. If it's still
  long after cutting, that's a sign the post is trying to cover too much —
  drop a point rather than keep every point at half length.
- **Verify every fact and number before presenting, not after.** If a post
  claims a count (skills, tools, stats), check it across every relevant
  project/source, not just the first one that comes to mind — and if the
  number is inherently subjective (e.g. "skills I'm grateful for"), say what
  was found and ask rather than asserting it as settled.

**Explicitly not adopted:**
- Trend-analysis prompt ("analyze latest viral Instagram trends") — generate.mjs
  has no live search/trends tool, so this would just be Claude guessing at
  trends from training data and presenting it as current research. Skip unless
  a real trends data source gets wired in.
- Reels-script structuring — Reels/TikTok was evaluated and dropped
  (2026-07-05): unaudited TikTok apps can only post privately, a real audit
  takes 2-4 weeks, and the account is currently restricted anyway. Don't
  reintroduce unless Howard raises it again.
