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

Scoring: each question is worth one point, and every type gives more credit the closer you get,
with zero only for the worst possible answer.

- **Ranking:** the share of item pairs in the right order (a fully reversed list scores 0).
- **Range:** one range off keeps a share of the point, the farthest range scores 0.
- **Percentage:** full credit within 3 points, then falling off steeply at first (about 0.6 at
  10 points off, 0.3 at 20) and reaching 0 only at the farthest possible guess.

## Hosting

GitHub Pages serves it from the repository root on `main`.
