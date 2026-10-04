# Workout

A tiny personal workout log. Open it, see today's workout, tap ✓, done.

- **Today** — today's session from the weekly program, one big Start button. Weights and reps prefill from last time; tap ✓ to log a set (starts a rest timer). Change set 1's weight and the rest of the sets follow.
- **Progress** — every exercise with a sparkline; tap one for a chart (top set / est. 1RM, or distance / pace for runs), PR, and recent sessions.
- **History** — every workout; tap to edit or delete.

No build step, no backend, no account. Plain HTML/CSS/JS. Data lives on the device (localStorage), with Export/Import backup in Settings (gear icon).

## Run locally

```sh
npx http-server -c-1 .
# or: python3 -m http.server
```

## Put it on your iPhone

1. Repo → Settings → Pages → Deploy from branch → `main` / root.
2. Open the Pages URL in Safari → Share → **Add to Home Screen**.

Home-screen install matters: it opens full-screen, works offline, and iOS keeps its storage. Export a backup now and then anyway.

## Change the program

Edit `js/program.js`. Each exercise's `k` is its history key — keep it the same when renaming so history carries over. After changing files, bump `VERSION` in `sw.js` so phones pick up the update.
