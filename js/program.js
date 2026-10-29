// Weekly program. Keys (k) are the history identity of an exercise — renaming
// `n` is safe, changing `k` starts a fresh history.
// Types: w = weight × reps, bw = reps (optional added or assisted weight),
//        t = seconds, run = distance + time, strides = count.
// alts: other exercises you can switch to in one tap (each keeps its own history).
// Warm-ups: { n: name, reps: '10', sec: 120 } — reps and sec are optional.
// This is the default program; edits made in the app are saved on the device
// and take priority over it.

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const REST_NOTE = 'Rest, walking, mobility, or optional light activity.';

export const PROGRAM = {
  1: {
    title: 'Push', short: 'Push',
    warmup: [{ n: 'Arm circles', reps: '10' }, { n: 'Band pull-aparts', reps: '15' }, { n: 'Scapular push-ups', reps: '10' }, { n: 'Light warm-up set', reps: '10' }],
    ex: [
      { k: 'bench', n: 'Bench Press', t: 'w', sets: 3, target: '6–8', rest: 150, major: true },
      { k: 'incline-db', n: 'Incline DB Press', t: 'w', sets: 3, target: '8–10', rest: 120, major: true },
      { k: 'db-shoulder', n: 'DB Shoulder Press', t: 'w', sets: 3, target: '8–10', rest: 120, major: true },
      { k: 'lateral', n: 'Lateral Raises', t: 'w', sets: 2, target: '12–15', rest: 60 },
      { k: 'rope-pushdown', n: 'Rope Triceps Pushdown', t: 'w', sets: 2, target: '10–15', rest: 60 },
      { k: 'oh-triceps', n: 'Overhead Triceps Extension', t: 'w', sets: 2, target: '10–12', rest: 60 },
    ],
  },
  2: {
    title: 'Speed + Core', short: 'Speed',
    warmup: [{ n: 'Easy jog', sec: 600 }, { n: 'Dynamic leg/ankle mobility' }],
    ex: [
      { k: 'strides', n: 'Strides', t: 'strides', target: '4–6 × 20s @ 70–80%', sec: 'Running',
        note: '60–90s easy recovery between · 10 min easy cooldown' },
      { k: 'knee-raise', n: 'Hanging Knee Raises', t: 'bw', sets: 3, target: '10–12', rest: 60, sec: 'Core' },
      { k: 'dead-bug', n: 'Dead Bugs', t: 'bw', sets: 3, target: '10/side', rest: 45, sec: 'Core' },
      { k: 'side-plank', n: 'Side Plank', t: 't', sets: 3, target: '30–45s/side', rest: 45, sec: 'Core' },
      { k: 'pallof', n: 'Pallof Press', t: 'w', sets: 3, target: '10/side', rest: 45, sec: 'Core' },
    ],
  },
  3: {
    title: 'Pull', short: 'Pull',
    warmup: [{ n: 'Easy row', sec: 120 }, { n: 'Band pull-aparts', reps: '15' }, { n: 'Scapular pull-ups', reps: '8' }, { n: 'Light cable row', reps: '12' }],
    ex: [
      { k: 'pullup', n: 'Pull-ups', t: 'bw', sets: 3, target: '6–10', rest: 120, major: true,
        alts: [{ k: 'lat-pulldown', n: 'Lat Pulldown', t: 'w' }] },
      { k: 'cs-row', n: 'Chest-Supported Row', t: 'w', sets: 3, target: '8–10', rest: 120, major: true },
      { k: 'sa-cable-row', n: 'Single-Arm Cable Row', t: 'w', sets: 2, target: '10/side', rest: 60 },
      { k: 'face-pull', n: 'Face Pull / Rear-Delt Fly', t: 'w', sets: 2, target: '12–15', rest: 60 },
      { k: 'hammer-curl', n: 'Hammer Curls', t: 'w', sets: 2, target: '8–12', rest: 60 },
      { k: 'curl', n: 'Cable or Incline DB Curls', t: 'w', sets: 2, target: '10–12', rest: 60 },
    ],
  },
  4: {
    title: 'Legs + Ankle', short: 'Legs',
    warmup: [{ n: 'Bodyweight squats', reps: '10' }, { n: 'Reverse lunges', reps: '8/side' }, { n: 'Leg swings', reps: '10/side' }, { n: 'Ankle rocks', reps: '10/side' }, { n: 'Glute bridges', reps: '10' }],
    ex: [
      { k: 'bss', n: 'Bulgarian Split Squat', t: 'w', sets: 3, target: '6–8/leg', rest: 120, major: true, sec: 'Strength' },
      { k: 'rdl', n: 'Romanian Deadlift', t: 'w', sets: 3, target: '6–8', rest: 150, major: true, sec: 'Strength' },
      { k: 'hip-thrust', n: 'Hip Thrust', t: 'w', sets: 3, target: '8–12', rest: 120, major: true, sec: 'Strength' },
      { k: 'sl-calf', n: 'Single-Leg Calf Raise', t: 'bw', sets: 3, target: '10–15/leg', rest: 60, sec: 'Strength' },
      { k: 'step-down', n: 'Step-Downs', t: 'bw', sets: 2, target: '8/leg', rest: 30, sec: 'Durability · 2 rounds' },
      { k: 'sl-rdl', n: 'Single-Leg RDL', t: 'bw', sets: 2, target: '8/leg', rest: 30, sec: 'Durability · 2 rounds' },
      { k: 'soleus', n: 'Bent-Knee Soleus Raises', t: 'bw', sets: 2, target: '12–15/leg', rest: 30, sec: 'Durability · 2 rounds' },
      { k: 'tib-raise', n: 'Tibialis Raises', t: 'bw', sets: 2, target: '15–20', rest: 30, sec: 'Durability · 2 rounds' },
    ],
  },
  0: {
    title: 'Easy Run', short: 'Run',
    warmup: [],
    ex: [
      { k: 'easy-run', n: 'Easy Run', t: 'run', target: '3–6 mi conversational', note: 'First 5–10 min very easy' },
    ],
  },
};

// Order workouts appear in pickers and Progress. Workouts that aren't runs
// also form the cycle: Today suggests the one after the last one you did.
export const ORDER = [1, 2, 3, 4, 0];
