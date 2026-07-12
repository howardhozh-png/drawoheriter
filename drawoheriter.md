@.claude/skills/approve.md

# drawoheriter

Automated content posting system for Howard's personal brand.

## About Howard (verify every post against this — get it wrong and the whole post is untrustworthy)

- **Consulting (MBB): 5 years, ending August 2025.** Not "2+ years," not "3 years" — those numbers
  appeared in earlier drafts and were wrong. Any post citing consulting tenure must say 5 years.
- **US startup: joined August 2025, so just over 1 year in as of writing this.** This is the
  "startup" side of the consulting-vs-startup posts.
- **Invests in the US market.** Not yet used in any post — a real detail available if a relevant
  angle comes up (e.g. a "Managing finances" topic post).
- **Building his own product using Claude Code, as a non-coder — "vibe coding."** This is the
  building-in-public thread. Per the reveal-level rule below, do not name the product yet.
- **Has a fiancée.** Available for "Growing in relationship" topic posts. Not yet used.

## Reveal level (as of 2026-07-12)

- **Do not name the product ("kakisewa") in any post yet.** It's fine to reference "the thing I'm
  building" / "something new" / "it" — just not the name. Numbers about it (users, cold email
  volume, contacts scraped) are fine to share as long as the post doesn't also name the product
  and doesn't read like a pitch — the goal is a genuine personal journey, not a sales post.
  One already-posted post from before this rule existed does name it; that's done and not being
  retracted, but don't compound it going forward.
- A handful of posts have gone further and stated exact operational numbers (e.g. "8,471 agents
  scraped," "100 cold emails a day"). Howard has approved that level of specificity case by case —
  it is not a blanket rule, ask if unsure whether a new number crosses a line he'd want to keep private.

## Stack
- Node.js scripts in `scripts/`
- Content in `content/queue.json` (pending → approved → posted)
- Posts to Threads (text + carousel reply) + Instagram (carousel + story)
- GitHub Actions handles daily generate + post — Mac doesn't need to be on

## Daily workflow
1. `generate.mjs` runs at 9am MYT — creates a new pending post from plan.md, giving Howard the day to review it
2. Howard runs `/approve` to approve it (any time before 9pm MYT that day)
3. `post.mjs` runs at 9pm MYT — posts all approved entries
4. `track.mjs` runs at 10pm MYT — fetches engagement and updates posted.json

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
- **One post, one thing.** Don't let a post pivot mid-story to tease the next
  topic or the thing being built — that dilutes the actual point and reads as
  a pitch. If a post is about leaving consulting, stay on leaving consulting;
  save the "building something new" angle for its own post.
- **Lean into vulnerability, not just analysis.** Bubbles and closing lines
  should admit what was hard, what Howard got wrong, or what he still doesn't
  have figured out — not just state a lesson cleanly in retrospect. A polished
  takeaway with no visible cost to it reads as generic advice, not a real story.
- **Every slide in a post (except the hook) renders at the same font size.**
  `render.mjs`/`preview.mjs` size text per-slide based on how much content it
  has, which used to mean two slides in the same carousel could render at
  visibly different sizes just because one had less text — technically safe
  from clipping, but it makes a single post look inconsistent swiping through
  it. `postFontSizes()` fixes this by sizing every non-hook slide off the
  heaviest slide in that post, not its own content. **Don't reintroduce
  per-slide sizing** (e.g. by calling `slideFontSizes()` directly again
  outside the hook-slide case) — always go through `postFontSizes()` so a
  post's slides stay visually matched, even if it means a short slide has
  more breathing room than it strictly needs.
- **Keep every slide's text light — `postFontSizes()` sizes off the
  heaviest slide, so one bloated slide shrinks the whole post.** Confirmed
  2026-07-12: `vibe-coding-mcp-tools` (the size Howard wants as the
  standard) has a heaviest-slide weight of ~287, landing at 76px main text.
  A batch of 5 posts wasn't trimmed for length and hit weights up to 476,
  collapsing the whole post to 46px — "everything is tiny" was a direct
  report of this. `sub_text_2` is the single biggest lever: it adds a flat
  +100 to that slide's weight on top of its own length, which is why nearly
  every over-280-weight slide had one. Before finishing a post: check each
  slide's weight (`title*0.3 + main*1.3 + sub + (sub_text_2 ? len+100 : 0) +
  bubble*0.8 + (conclusion ? 70 : 0)`), and if the heaviest slide is over
  ~290, cut it — merge sub_text_2 into sub_text as one tighter sentence (or
  drop it) and trim main_text/bubble, rather than accepting a smaller
  shared size for the whole post. Target: every post's heaviest slide
  should land at 76px or better, matching the reference post.
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
