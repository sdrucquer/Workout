# Workout

A tiny personal workout log. Open it, see today's workout, tap ✓, done.

- **Today** — the next workout in your cycle, one big Start button. If you skip or swap a day, it picks up from the last workout you actually did (Push → Speed → Pull → Legs), so the order stays right. Runs and rest days stay on the calendar. Weights and reps prefill from last time; tap ✓ to log a set (starts a rest timer). Change set 1's weight and the rest of the sets follow.
- **Week strip** — tap a day to see what you did; swipe it (or use the arrows) to go back to earlier weeks.
- **Bodyweight lifts** — tap the weight column header to switch between added weight (+lb) and assisted (−lb). Set your body weight in Settings and it shows what you're actually moving, plus a Load chart in Progress.
- **Swapping lifts** — Pull-ups can switch to Lat Pulldown in one tap (each keeps its own history; next time starts with whichever you did last). Any exercise can be swapped for another from its ••• menu, optionally for good.
- **Timed stuff** — warm-ups can have reps or a time (e.g. Easy row 2:00) and timed sets (Side Plank) get a Start button that counts down and checks the set off.
- **Edit workouts** — Settings → Workouts, or ••• during a workout. Rename, change sets/reps/rest/type, edit warm-ups, add or remove exercises. Saved on the device.
- **Strava** — runs you record in Strava show up automatically (see below).
- **Progress** — every exercise with a sparkline; tap one for a chart (top set / est. 1RM; for runs, distance per run, miles per week and pace), PR, and recent sessions.
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

## Connect Strava

The app talks to Strava straight from your phone, so you need your own (free) Strava API app:

1. On a computer, go to https://www.strava.com/settings/api and create an app.
   - Application name: anything, e.g. "Workout"
   - Category: anything
   - Website: your Pages URL, e.g. `https://sdrucquer.github.io/workout/`
   - **Authorization Callback Domain:** `sdrucquer.github.io` (just the domain)
2. Copy the **Client ID** and **Client Secret** from that page.
3. In the app: Settings → Strava runs → paste both → **Connect Strava** → approve.

It imports your runs from the last 60 days, then checks for new ones whenever you open the app. The ID, secret and tokens are stored only on the phone (not in this repo, and not in backups). Disconnect any time in Settings.

## Change the program

Easiest: Settings → Workouts in the app. Or edit `js/program.js` (that's the default; edits made in the app win over it). Each exercise's `k` is its history key — keep it the same when renaming so history carries over. After changing files, bump `VERSION` in `sw.js` so phones pick up the update.
