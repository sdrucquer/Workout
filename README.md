# Workout

A tiny personal workout log. Open it, see today's workout, tap ✓, done.

- **Today** — the next workout in your cycle, one big Start button. If you skip or swap a day, it picks up from the last workout you actually did (Push → Speed → Pull → Legs), so the order stays right. Runs and rest days stay on the calendar. Weights and reps prefill from last time; tap ✓ to log a set (starts a rest timer). Change set 1's weight and the rest of the sets follow.
- **Week strip** — tap a day to see what you did; swipe it (or use the arrows) to go back to earlier weeks.
- **Bodyweight lifts** — tap the weight column header to switch between added weight (+lb) and assisted (−lb). Set your body weight in Settings and it shows what you're actually moving, plus a Load chart in Progress.
- **Swapping lifts** — Pull-ups can switch to Lat Pulldown in one tap (each keeps its own history; next time starts with whichever you did last). Any exercise can be swapped for another from its ••• menu, optionally for good.
- **Timed stuff** — warm-ups can have reps or a time (e.g. Easy row 2:00) and timed sets (Side Plank) get a Start button. It opens a big countdown ring with Pause, Reset and +15s (or tuck it away to a small pill), ticks at 3-2-1, chimes and buzzes at the end, checks the set off and starts your rest. Time fields take plain digits on the number pad: 200 is 2:00, 45 is 0:45.
- **Edit workouts** — Settings → Workouts, or “Edit this workout” / ••• during a workout. Rename, change sets/reps/rest/type, edit warm-ups, add, remove or reorder exercises. Editing the workout you're doing updates it right away and keeps the sets you've logged; it's also saved for next time.
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

Easiest: Settings → Workouts in the app. Or edit `js/program.js` (that's the default; edits made in the app win over it). Each exercise's `k` is its history key — keep it the same when renaming so history carries over. After changing files, bump `VERSION` in `sw.js` so phones pick up the update.
