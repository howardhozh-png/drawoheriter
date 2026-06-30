# /approve — Review and approve pending posts

Show every pending post from `content/queue.json`, one at a time, in a clean readable format. Let Howard approve or skip each one with a single word.

## Format to show for each post

Print exactly this — nothing more:

```
─────────────────────────────────────────
Day X  |  [theme]  |  [date]
─────────────────────────────────────────
THREADS (what goes live as the text post):
[threads_text]

SLIDES ([N] total):
  1. [main_text or stat from each slide, one line each]
  2. ...

CAPTION (Instagram):
[caption]
─────────────────────────────────────────
approve / skip / edit ?
```

Wait for a single word response:
- **yes / approve / y** → set status to "approved", save queue.json, move to next
- **no / skip / s** → set status to "skipped", save queue.json, move to next
- **edit** → ask "What should change?" then make the edit to threads_text or slides, show the result, and ask approve/skip again
- **stop / q / quit** → stop reviewing

After all posts are reviewed, print a one-line summary:
`Done. X approved, Y skipped, Z remaining.`

## Rules
- Read `content/queue.json` directly — do not run review.mjs
- Only show posts where status === "pending"
- Save after each decision so nothing is lost if the session ends
- Keep the format tight — Howard should be able to approve in 10 seconds per post
- Never render images or run heavy scripts during approval
