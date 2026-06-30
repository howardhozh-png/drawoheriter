# /approve — Review and approve pending posts

Show every pending post from `content/queue.json`, one at a time. Open the HTML preview in the browser first so Howard can see the actual slides, then show the text summary and ask for a decision.

## For each pending post, do this in order:

1. **Open the HTML preview** in the browser:
   ```bash
   open /Users/wonders/drawoheriter/content/previews/[entry.id].html
   ```
   If the file doesn't exist, run:
   ```bash
   node /Users/wonders/drawoheriter/scripts/preview.mjs [entry.id]
   open /Users/wonders/drawoheriter/content/previews/[entry.id].html
   ```

2. **Print this summary** — nothing more:

```
─────────────────────────────────────────
[theme]  |  [date]
─────────────────────────────────────────
THREADS:
[threads_text]

SLIDES ([N]):
  1. [main_text or stat_number — one line]
  2. ...

CAPTION:
[caption]
─────────────────────────────────────────
(slides open in browser)
approve / skip / edit ?
```

3. **Wait for a single word:**
   - **yes / approve / y** → set status to "approved", save queue.json, move to next
   - **no / skip / s** → set status to "skipped", save queue.json, move to next
   - **edit** → ask "What should change?" then edit threads_text or slides, regenerate the preview, re-open it, show the result, ask again
   - **stop / q / quit** → stop

After all reviewed: `Done. X approved, Y skipped, Z remaining.`

## Rules
- Read `content/queue.json` directly — do not run review.mjs
- Only show posts where `status === "pending"`
- Save after each decision
- Always open the browser preview BEFORE asking for the decision
- Keep text output tight — the slides in the browser are the main thing
