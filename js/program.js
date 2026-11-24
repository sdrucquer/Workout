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

// Locations. The workouts above are the School gym ones. Every other location
// has its own version of the three lifting days: `loc` is the location, `of` is
// the School workout it stands in for, so the cycle (Push → Speed → Pull → Legs)
// keeps moving whichever version you do. Speed + Core and runs are the same
// everywhere. Exercises that are the same movement share the School key (k), so
// "last time" and Progress carry over. Locations you add in the app live on the
// device, next to these.
export const LOCATIONS = [
  { id: 'school', name: 'School', note: 'Full gym' },
  { id: 'home', name: 'Home', note: 'Rack, barbell, bench, 15–40 lb DBs, band, pull-up bar' },
  { id: 'travel', name: 'Travel', note: 'No equipment · vacation, beach, hotel' },
];

// Home: rack + barbell, bench, 15–40 lb dumbbells, a band, a pull-up bar, a jump rope.
export const HOME = {
  11: {
    title: 'Push · Home', short: 'Push', of: 1, loc: 'home',
    warmup: [{ n: 'Jump rope', sec: 120 }, { n: 'Arm circles', reps: '10' }, { n: 'Band pull-aparts', reps: '15' }, { n: 'Scapular push-ups', reps: '10' }, { n: 'Empty-bar bench', reps: '10' }],
    ex: [
      { k: 'bench', n: 'Bench Press', t: 'w', sets: 3, target: '6–8', rest: 150, major: true,
        note: 'Set the rack safeties just below chest height — no spotter at home' },
      { k: 'incline-db', n: 'Incline DB Press', t: 'w', sets: 3, target: '10–15', rest: 90, major: true,
        note: 'Bench at ~30° · 3-sec lowering so the 40s are enough',
        alts: [{ k: 'db-floor-press', n: 'DB Floor Press' }] },
      { k: 'ohp', n: 'Standing Barbell Press', t: 'w', sets: 3, target: '6–8', rest: 120, major: true,
        alts: [{ k: 'db-shoulder', n: 'DB Shoulder Press' }] },
      { k: 'lateral', n: 'Lateral Raises', t: 'w', sets: 3, target: '12–15', rest: 60 },
      { k: 'band-pushdown', n: 'Band Triceps Pushdown', t: 'bw', sets: 2, target: '15–20', rest: 45,
        note: 'Loop the band over the pull-up bar' },
      { k: 'oh-triceps', n: 'Overhead DB Triceps Extension', t: 'w', sets: 2, target: '10–12', rest: 60 },
      { k: 'pushup', n: 'Push-ups', t: 'bw', sets: 1, target: 'max (stop 1–2 shy)', rest: 0 },
      { k: 'knee-raise', n: 'Hanging Knee Raises', t: 'bw', sets: 2, target: '10–12', rest: 45, sec: 'Core' },
      { k: 'plank', n: 'Plank', t: 't', sets: 2, target: '45–60s', rest: 45, sec: 'Core' },
    ],
  },
  13: {
    title: 'Pull · Home', short: 'Pull', of: 3, loc: 'home',
    warmup: [{ n: 'Jump rope', sec: 120 }, { n: 'Band pull-aparts', reps: '15' }, { n: 'Dead hang', sec: 30 }, { n: 'Scapular pull-ups', reps: '8' }, { n: 'Light DB row', reps: '12/side' }],
    ex: [
      { k: 'pullup', n: 'Pull-ups', t: 'bw', sets: 3, target: '6–10', rest: 120, major: true,
        alts: [{ k: 'chinup', n: 'Chin-ups' }] },
      { k: 'bb-row', n: 'Barbell Bent-Over Row', t: 'w', sets: 3, target: '8–10', rest: 120, major: true,
        alts: [{ k: 'cs-db-row', n: 'Chest-Supported DB Row' }] },
      { k: 'sa-db-row', n: 'Single-Arm DB Row', t: 'w', sets: 2, target: '10–12/side', rest: 60,
        note: 'Knee and hand on the bench · pause at the top' },
      { k: 'band-face-pull', n: 'Band Face Pull', t: 'bw', sets: 2, target: '15–20', rest: 45,
        note: 'Band around a rack upright at face height',
        alts: [{ k: 'rd-fly', n: 'Rear-Delt DB Fly', t: 'w' }] },
      { k: 'hammer-curl', n: 'Hammer Curls', t: 'w', sets: 2, target: '8–12', rest: 60 },
      { k: 'curl', n: 'Incline DB Curls', t: 'w', sets: 2, target: '10–12', rest: 60 },
      { k: 'dead-bug', n: 'Dead Bugs', t: 'bw', sets: 2, target: '10/side', rest: 45, sec: 'Core' },
      { k: 'side-plank', n: 'Side Plank', t: 't', sets: 2, target: '30–45s/side', rest: 45, sec: 'Core' },
    ],
  },
  14: {
    title: 'Legs · Home', short: 'Legs', of: 4, loc: 'home',
    warmup: [{ n: 'Jump rope', sec: 120 }, { n: 'Bodyweight squats', reps: '10' }, { n: 'Reverse lunges', reps: '8/side' }, { n: 'Leg swings', reps: '10/side' }, { n: 'Ankle rocks', reps: '10/side' }, { n: 'Empty-bar squats', reps: '10' }],
    ex: [
      { k: 'back-squat', n: 'Back Squat', t: 'w', sets: 3, target: '6–8', rest: 150, major: true, sec: 'Strength',
        note: 'Safeties set just below the bottom of your squat' },
      { k: 'rdl', n: 'Romanian Deadlift', t: 'w', sets: 3, target: '6–8', rest: 150, major: true, sec: 'Strength' },
      { k: 'bss', n: 'Bulgarian Split Squat', t: 'w', sets: 2, target: '8–10/leg', rest: 90, sec: 'Strength',
        note: 'Holding DBs, rear foot on the bench' },
      { k: 'hip-thrust', n: 'Hip Thrust', t: 'w', sets: 2, target: '8–12', rest: 90, sec: 'Strength',
        note: 'Barbell, back against the bench' },
      { k: 'sl-calf', n: 'Single-Leg Calf Raise', t: 'bw', sets: 3, target: '10–15/leg', rest: 60, sec: 'Strength' },
      { k: 'step-down', n: 'Step-Downs', t: 'bw', sets: 2, target: '8/leg', rest: 30, sec: 'Durability · 2 rounds' },
      { k: 'sl-rdl', n: 'Single-Leg RDL', t: 'bw', sets: 2, target: '8/leg', rest: 30, sec: 'Durability · 2 rounds' },
      { k: 'soleus', n: 'Bent-Knee Soleus Raises', t: 'bw', sets: 2, target: '12–15/leg', rest: 30, sec: 'Durability · 2 rounds' },
      { k: 'tib-raise', n: 'Tibialis Raises', t: 'bw', sets: 2, target: '15–20', rest: 30, sec: 'Durability · 2 rounds',
        note: 'Back against a wall, heels out' },
    ],
  },
};

// Travel: nothing but the floor, a chair or bench, and a wall. Higher reps and
// slow lowering stand in for weight; anything you find (a bar, a band) is a bonus.
export const TRAVEL = {
  21: {
    title: 'Push · Travel', short: 'Push', of: 1, loc: 'travel',
    warmup: [{ n: 'Arm circles', reps: '10' }, { n: 'Inchworms', reps: '5' }, { n: 'Scapular push-ups', reps: '10' }, { n: 'Easy push-ups', reps: '8' }],
    ex: [
      { k: 'pushup', n: 'Push-ups', t: 'bw', sets: 4, target: '1–2 shy of failure', rest: 90, major: true,
        note: '3-sec lowering' },
      { k: 'decline-pushup', n: 'Decline Push-ups', t: 'bw', sets: 3, target: '10–15', rest: 75, major: true,
        note: 'Feet on a chair, bench or step' },
      { k: 'pike-pushup', n: 'Pike Push-ups', t: 'bw', sets: 3, target: '8–12', rest: 75, major: true },
      { k: 'chair-dip', n: 'Chair / Bench Dips', t: 'bw', sets: 3, target: '12–15', rest: 60 },
      { k: 'diamond-pushup', n: 'Diamond Push-ups', t: 'bw', sets: 2, target: 'max', rest: 60 },
      { k: 'hollow', n: 'Hollow Hold', t: 't', sets: 2, target: '30–45s', rest: 45, sec: 'Core' },
      { k: 'plank', n: 'Plank', t: 't', sets: 2, target: '45–60s', rest: 45, sec: 'Core' },
    ],
  },
  23: {
    title: 'Pull · Travel', short: 'Pull', of: 3, loc: 'travel',
    warmup: [{ n: 'Arm circles', reps: '10' }, { n: 'Cat-cow', reps: '8' }, { n: 'Wall slides', reps: '10' }, { n: 'Prone T raises', reps: '10' }],
    ex: [
      { k: 'table-row', n: 'Inverted Row (under a sturdy table)', t: 'bw', sets: 4, target: '8–15', rest: 90, major: true,
        note: 'Or a towel around a closed door\'s handles · lean back further to make it harder',
        alts: [{ k: 'pullup', n: 'Pull-ups (if you find a bar)' }] },
      { k: 'towel-row', n: 'Single-Arm Doorframe Row', t: 'bw', sets: 3, target: '12/side', rest: 60,
        note: 'Hold the frame, feet close to it, lean back and pull' },
      { k: 'ytw', n: 'Prone Y-T-W Raises', t: 'bw', sets: 3, target: '8 each', rest: 45 },
      { k: 'superman', n: 'Superman Hold', t: 't', sets: 3, target: '20–30s', rest: 45 },
      { k: 'towel-curl', n: 'Towel Curl Isometric', t: 't', sets: 2, target: '30s/side', rest: 45,
        note: 'Stand on a towel and curl against it as hard as you can' },
      { k: 'dead-bug', n: 'Dead Bugs', t: 'bw', sets: 2, target: '10/side', rest: 45, sec: 'Core' },
      { k: 'side-plank', n: 'Side Plank', t: 't', sets: 2, target: '30–45s/side', rest: 45, sec: 'Core' },
    ],
  },
  24: {
    title: 'Legs · Travel', short: 'Legs', of: 4, loc: 'travel',
    warmup: [{ n: 'Bodyweight squats', reps: '10' }, { n: 'Reverse lunges', reps: '8/side' }, { n: 'Leg swings', reps: '10/side' }, { n: 'Ankle rocks', reps: '10/side' }, { n: 'Glute bridges', reps: '10' }],
    ex: [
      { k: 'bw-bss', n: 'Bulgarian Split Squat (bodyweight)', t: 'bw', sets: 3, target: '12–15/leg', rest: 75, major: true, sec: 'Strength',
        note: 'Rear foot on a chair or bench · 3-sec lowering' },
      { k: 'tempo-squat', n: 'Tempo Squats', t: 'bw', sets: 3, target: '15–20', rest: 60, major: true, sec: 'Strength',
        note: '3 sec down, 1 sec pause' },
      { k: 'sl-bridge', n: 'Single-Leg Glute Bridge', t: 'bw', sets: 3, target: '12/leg', rest: 60, sec: 'Strength' },
      { k: 'walk-lunge', n: 'Walking Lunges', t: 'bw', sets: 2, target: '12/leg', rest: 60, sec: 'Strength' },
      { k: 'sl-calf', n: 'Single-Leg Calf Raise', t: 'bw', sets: 3, target: '15–20/leg', rest: 45, sec: 'Strength' },
      { k: 'step-down', n: 'Step-Downs', t: 'bw', sets: 2, target: '8/leg', rest: 30, sec: 'Durability · 2 rounds' },
      { k: 'sl-rdl', n: 'Single-Leg RDL', t: 'bw', sets: 2, target: '8/leg', rest: 30, sec: 'Durability · 2 rounds' },
      { k: 'soleus', n: 'Bent-Knee Soleus Raises', t: 'bw', sets: 2, target: '15–20/leg', rest: 30, sec: 'Durability · 2 rounds' },
      { k: 'tib-raise', n: 'Tibialis Raises', t: 'bw', sets: 2, target: '15–20', rest: 30, sec: 'Durability · 2 rounds',
        note: 'Back against a wall, heels out' },
    ],
  },
};
