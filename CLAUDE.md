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
