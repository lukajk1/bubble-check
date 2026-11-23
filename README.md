# Bubble Check

A 10-minute quiz on how well your picture of the U.S. matches the country as a whole: what
Americans believe, know, buy, watch and do, beyond your own feed and friends. Every
question uses a recent (2023+) survey or market source, and nothing is revealed until the end.
Then you get a score, a per-topic breakdown, every answer with context, and the citations.

> **Spoiler warning:** `research/*.json` holds every answer in plain text. If you want to
> take the quiz, don't open it. `questions.js` is base64-encoded so it doesn't spoil at a glance.

## Run it

It's a static site (no build step to serve it):

```powershell
python -m http.server 4810 --bind 127.0.0.1
```

Then open http://127.0.0.1:4810. Progress saves to `localStorage`, mirrored to a cookie, so a
reload resumes where you left off. **Reset quiz** clears it.

## Questions

- `research/<topic>.json` are the source files, one per topic (politics, music, tech, shopping,
  screen, lifestyle). Each question has a type (`rank`, `bins`, `percent` or `number`), the true
  values, an explanation, a source and any caveat.
- `python build.py` validates them, interleaves the topics and writes `questions.js`. Add
  `"reserve": true` to a question to keep it on the bench (used to hold the quiz near 10
  minutes), or `"drop": true` if it failed fact-checking.

Scoring: each question is worth one point. A ranking gets partial credit for every pair in the
right order. A range is right or wrong. A percentage gets full credit within 3 points, falling to
zero at 25 points off.

## Hosting

GitHub Pages serves it from the repository root on `main`.
