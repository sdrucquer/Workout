import { PROGRAM, DAYS, REST_NOTE, LOCATIONS, HOME, TRAVEL, TEMPLATES } from './program.js';
const DEFAULTS = { ...PROGRAM, ...HOME, ...TRAVEL };

// ---------- storage ----------
const LS = 'wt1';
const DEF_SETTINGS = { theme: 'auto', unit: 'lb', rest: true, bw: '', where: 'school', splash: true };
// Stored state only ever gains fields (program, settings.bw, …) and stays
// v: 1, so an older copy of the app can still read it without wiping anything.

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS));
    if (s && s.v === 1) { s.settings = { ...DEF_SETTINGS, ...s.settings }; return s; }
  } catch {}
  return { v: 1, sessions: [], active: null, settings: { ...DEF_SETTINGS } };
}
let S = load();
let saveT = 0;
function save() {
  clearTimeout(saveT);
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch { toast('Could not save — storage full?'); }
}
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 400); }
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
try { navigator.storage?.persist?.(); } catch {}

// ---------- ui state ----------
const ui = {
  tab: 'home',        // home | progress | history
  screen: null,       // null | workout | detail | summary
  edit: null,         // clone of a finished session being edited
  detail: null,       // exercise key
  metric: null,
  summary: null,
  warmOpen: false,
  rest: null,         // { end, total, work?: { i, j } | { warm } }
  sheet: null,
  weekOff: 0,         // 0 = this week, -1 = last week, …
  selDay: null,       // date key picked in the week strip
  pd: null,           // program editor: which workout
  draft: null,        // program editor: working copy
};

// ---------- helpers ----------
const $app = document.getElementById('app');
const $rest = document.getElementById('rest');
const $sheet = document.getElementById('sheet');
const $toast = document.getElementById('toast');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const fw = x => String(+(Math.round(x * 100) / 100));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const unit = () => S.settings.unit;
const inc = () => (S.settings.unit === 'kg' ? 2.5 : 5);
const e1 = (w, r) => (w > 0 && r > 0 && r <= 15 ? w * (1 + r / 30) : 0);

const pad2 = x => String(x).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromDk = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (s, o = { weekday: 'short', month: 'short', day: 'numeric' }) => fromDk(s).toLocaleDateString(undefined, o);
const shortDate = s => fmtDate(s, { month: 'short', day: 'numeric' });

function parseDur(v) {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const p = s.split(':').map(x => n(x));
  if (p.length === 1) return p[0] * 60;            // "32" = 32 min
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] * 3600 + p[1] * 60 + p[2];
}
function fmtDur(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}
const paceOf = r => { const d = n(r.dist), t = parseDur(r.time); return d > 0 && t > 0 ? t / d : 0; };
const mins = ms => Math.max(1, Math.round(ms / 60000));
const topRep = target => Math.max(0, ...(String(target).match(/\d+/g) || []).map(Number));
const firstNum = target => +(String(target).match(/\d+/) || [0])[0];
const clone = x => JSON.parse(JSON.stringify(x));
const slug = name => 'c:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// "2:00" = 2 min, "45" = 45 s
const parseSec = v => { const s = String(v ?? '').trim(); return !s ? 0 : s.includes(':') ? parseDur(s) : Math.round(n(s)); };

function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.remove('show'), 2200);
}

// ---------- icons ----------
const I = {
  today: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5h11M6.5 17.5h11M4 9v6M20 9v6M2 11v2M22 11v2"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>',
};

// ---------- program ----------
// The program lives in program.js; edits made in the app are stored in S.program.
// Home workouts are merged in so an older saved program still gets them.
// Someone who set up their own program (S.settings.own) sees only S.program;
// otherwise the built-in program with edits on top. A null entry is a deleted workout.
function prog() {
  const all = S.settings.own ? { ...(S.program || {}) } : S.program ? { ...DEFAULTS, ...S.program } : { ...DEFAULTS };
  for (const k in all) if (!all[k]) delete all[k];
  return all;
}
// Main-location workouts in cycle order: days of the week Monday-first, then any with no set day.
const dayRank = d => (d < 7 ? (d + 6) % 7 : d);
const order = () => Object.keys(prog()).map(Number).filter(d => !prog()[d].loc).sort((a, b) => dayRank(a) - dayRank(b));
const weekTarget = () => Math.max(1, order().filter(d => d < 7).length || order().length);
const newKey = () => Math.max(99, ...Object.keys({ ...DEFAULTS, ...(S.program || {}) }).map(Number)) + 1;
// The gym workout a workout stands in for (Push · Home → Push).
const baseDay = d => prog()[d]?.of ?? d;
// Locations: School (the main program), Home, Travel, plus any added in the app (S.locs).
// Built-in places can be renamed; the new names live in settings.locNames.
const locs = () => (S.settings.own ? (S.locs?.length ? S.locs : [{ id: 'school', name: 'Gym' }])
  : [...LOCATIONS.map(l => ({ ...l, name: S.settings.locNames?.[l.id] || l.name })), ...(S.locs || [])]);
const curLoc = () => locs().find(l => l.id === S.settings.where) || locs()[0];
const locDays = id => (id === 'school' ? order()
  : Object.keys(prog()).map(Number).filter(d => prog()[d].loc === id).sort((a, b) => a - b));
// The version of a School workout to do where you are now (Push → Push · Home).
const here = d => {
  const id = curLoc().id;
  return id === 'school' ? d : locDays(id).find(h => prog()[h].of === d) ?? d;
};
const allDays = () => locs().flatMap(l => locDays(l.id));
const normWarm = x => (typeof x === 'string' ? { n: x } : x);
const isRunDay = d => !!prog()[d]?.ex.length && prog()[d].ex.every(e => e.t === 'run');
// Non-run workouts in order form the cycle.
const rotation = () => order().filter(d => !isRunDay(d));
function nextUp() {
  const rot = rotation();
  const last = [...S.sessions].reverse().find(s => rot.includes(baseDay(s.day)));
  return last ? rot[(rot.indexOf(baseDay(last.day)) + 1) % rot.length] : null;
}
function saveProgramDay(d, def) {
  S.program ||= clone(DEFAULTS);
  S.program[d] = def;
  save();
}

// ---------- data queries ----------
const sortSessions = () => S.sessions.sort((a, b) => a.start - b.start);
const doneSets = ex => (ex.sets || []).filter(s => s.d);
const hasData = ex => !ex.skip && (ex.run ? ex.run.d : doneSets(ex).length > 0);

function hist(k, before = Infinity) {
  const out = [];
  for (const s of S.sessions) {
    if (s.start >= before) continue;
    for (const ex of s.ex) if (ex.k === k && hasData(ex)) out.push({ s, ex });
  }
  return out;
}
const lastFor = (k, before) => hist(k, before).at(-1) || null;

function topSet(ex) {
  let b = null;
  for (const s of doneSets(ex)) {
    if (!b) { b = s; continue; }
    if (ex.t === 'w' ? (n(s.w) > n(b.w) || (n(s.w) === n(b.w) && n(s.r) > n(b.r)))
                     : (n(s.r) > n(b.r) || (n(s.r) === n(b.r) && sw(ex, s) > sw(ex, b)))) b = s;
  }
  return b;
}
const bestE1 = ex => Math.max(0, ...doneSets(ex).map(s => e1(n(s.w), n(s.r))));
// Weight on a set: bodyweight lifts count assistance as negative.
const sw = (ex, s) => (ex.assist ? -n(s.w) : n(s.w));
const sgn = w => (w > 0 ? `+${fw(w)}` : w < 0 ? `−${fw(-w)}` : '');
// Body weight for a session (saved when it started) or from Settings.
const bwOf = sess => n(sess?.bw) || n(S.settings.bw);

function fmtSet(ex, s) {
  if (ex.t === 't') return `${fw(n(s.r))}s`;
  if (ex.t === 'bw') { const w = sw(ex, s); return w ? `${sgn(w)} × ${fw(n(s.r))}` : `${fw(n(s.r))} reps`; }
  return `${fw(n(s.w))} × ${fw(n(s.r))}`;
}
function fmtSets(ex, sets) {
  if (!sets.length) return '';
  if (ex.t === 't') return sets.map(s => `${fw(n(s.r))}s`).join(', ');
  const ws = new Set(sets.map(s => sw(ex, s)));
  if (ws.size === 1) {
    const w = sw(ex, sets[0]), reps = sets.map(s => fw(n(s.r))).join(', ');
    if (ex.t === 'bw') return w ? `${sgn(w)} × ${reps}` : `${reps} reps`;
    return `${fw(w)} × ${reps}`;
  }
  return sets.map(s => fmtSet(ex, s)).join(', ');
}
function fmtRun(ex) {
  const r = ex.run;
  if (ex.t === 'strides') return `${fw(n(r.count))} strides`;
  const p = paceOf(r);
  return [n(r.dist) ? `${fw(n(r.dist))} mi` : '', parseDur(r.time) ? fmtDur(parseDur(r.time)) : '', p ? `${fmtDur(p)}/mi` : ''].filter(Boolean).join(' · ');
}

// Is set j of ex a PR versus all earlier history + earlier sets this session?
function isPR(ex, j, before) {
  const s = ex.sets[j];
  if (!s?.d) return false;
  // compare as { w, r } with signed weight so assisted and added sets line up
  const prior = [];
  for (const h of hist(ex.k, before)) prior.push(...doneSets(h.ex).map(p => ({ w: sw(h.ex, p), r: n(p.r) })));
  if (!prior.length) return false;
  prior.push(...ex.sets.slice(0, j).filter(p => p.d).map(p => ({ w: sw(ex, p), r: n(p.r) })));
  const w = sw(ex, s), r = n(s.r);
  if (r <= 0) return false;
  if (ex.t === 'w') {
    if (w <= 0) return false;
    const mw = Math.max(...prior.map(p => n(p.w)));
    const me = Math.max(...prior.map(p => e1(n(p.w), n(p.r))));
    return w > mw || e1(w, r) > me + 0.05;
  }
  // bw / t: more reps (or seconds) at the same-or-heavier load, or heavier load at all
  const heavier = prior.filter(p => n(p.w) >= w);
  if (!heavier.length) return true;
  return r > Math.max(...heavier.map(p => n(p.r)));
}
function runPRs(ex, before) {
  const H = hist(ex.k, before);
  if (!H.length || !ex.run?.d) return [];
  const out = [];
  if (ex.t === 'strides') {
    if (n(ex.run.count) > Math.max(...H.map(h => n(h.ex.run.count)))) out.push('Most strides');
    return out;
  }
  if (n(ex.run.dist) > Math.max(...H.map(h => n(h.ex.run.dist)))) out.push('Longest run');
  const p = paceOf(ex.run);
  const prior = H.map(h => paceOf(h.ex.run)).filter(Boolean);
  if (p && n(ex.run.dist) >= 1 && prior.length && p < Math.min(...prior)) out.push('Fastest pace');
  return out;
}

// ---------- building sessions ----------
function newEx(def, before) {
  const ex = { k: def.k, n: def.n, t: def.t, target: def.target || '', sec: def.sec || '', note: def.note || '', rest: def.rest ?? 90, skip: false };
  if (def.base) ex.base = def.base;
  const last = lastFor(def.k, before);
  if (def.t === 'run') ex.run = { dist: last?.ex.run.dist || '', time: last?.ex.run.time || '', d: false };
  else if (def.t === 'strides') ex.run = { count: last?.ex.run.count || '', d: false };
  else {
    if (def.t === 'bw' && last?.ex.assist) ex.assist = true;
    const ls = last ? doneSets(last.ex) : [];
    ex.sets = Array.from({ length: def.sets || 3 }, (_, i) => {
      const src = ls[i] || ls.at(-1);
      return { w: src?.w ?? '', r: src?.r ?? (def.t === 't' && firstNum(def.target) ? String(firstNum(def.target)) : ''), d: false };
    });
  }
  return ex;
}
// An exercise with alts (Pull-ups ↔ Lat Pulldown): the variant as a def, sharing
// sets/target/rest with the base exercise.
const variant = (def, alt) => (alt.k === def.k ? def : { ...def, ...alt, alts: undefined, base: def.k });
// Start with whichever variant you did most recently.
function pickVariant(def, before) {
  if (!def.alts?.length) return def;
  let best = def, bt = -1;
  for (const o of [def, ...def.alts]) { const l = lastFor(o.k, before); if (l && l.s.start > bt) { bt = l.s.start; best = o; } }
  return variant(def, best);
}
function buildSession(day) {
  const p = prog()[day], now = Date.now();
  const s = {
    id: uid(), day, title: p.title, date: dk(new Date()), start: now, end: null,
    warm: (p.warmup || []).map(x => ({ ...normWarm(x), d: false })),
    // from = the program slot an exercise fills, so edits made mid-workout land on the right one
    ex: p.ex.map(def => ({ ...newEx(pickVariant(def, now), now), from: def.k })),
  };
  if (n(S.settings.bw)) s.bw = S.settings.bw;
  return s;
}
const cur = () => ui.edit || S.active;
const isNeon = () => S.settings.theme === 'neon';
function weekCount() {
  const now = new Date(), mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
  return S.sessions.filter(s => s.start >= mon.getTime()).length;
}
// The program entry an exercise in a session came from.
const baseDef = (w, ex) => prog()[w.day]?.ex.find(d => d.k === (ex.base || ex.k));

function catalog() {
  const m = new Map();
  for (const d of allDays()) {
    const p = prog()[d];
    if (!p) continue;
    for (const def of p.ex) {
      if (!m.has(def.k)) m.set(def.k, { ...def, group: p.short });
      for (const a of def.alts || []) if (!m.has(a.k)) m.set(a.k, { ...variant(def, a), group: p.short });
    }
  }
  for (const s of S.sessions) for (const ex of s.ex) if (!m.has(ex.k)) m.set(ex.k, { k: ex.k, n: ex.n, t: ex.t, group: 'Other' });
  return m;
}

// ---------- rendering ----------
function render() {
  document.documentElement.dataset.screen = ui.screen || ui.tab;
  let html;
  if (ui.screen === 'workout') html = vWorkout();
  else if (ui.screen === 'detail') html = vDetail();
  else if (ui.screen === 'summary') html = vSummary();
  else if (ui.screen === 'prog') html = vProgram();
  else if (ui.screen === 'onboard') html = vOnboard();
  else html = (ui.tab === 'home' ? vHome() : ui.tab === 'progress' ? vProgress() : vHistory()) + vTabs();
  $app.innerHTML = html;
  if (ui.screen === 'detail') bindChart();
  bindWeekSwipe();
  renderRest();
}
// swipe the week strip right for the week before, left to come back
function bindWeekSwipe() {
  const el = document.getElementById('week');
  if (!el) return;
  let x0 = null, y0 = 0;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    moveWeek(dx > 0 ? -1 : 1);
    swiped = Date.now();
  });
}
let swiped = 0;
function moveWeek(by) {
  const next = Math.min(0, ui.weekOff + by);
  if (next === ui.weekOff) return;
  ui.weekOff = next;
  ui.selDay = null;
  render();
}

function vTabs() {
  const t = (id, icon, label) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-v="${id}">${icon}<span>${label}</span></button>`;
  return `<nav class="tabs">${t('home', I.today, 'Today')}${t('progress', I.chart, 'Progress')}${t('history', I.list, 'History')}</nav>`;
}
const topbar = (title, right = `<button class="icon" data-act="settings" aria-label="Settings">${I.gear}</button>`) =>
  `<header class="topbar"><h1 class="h-title">${title}</h1>${right}</header>`;

function weekStart(off) {
  const now = new Date(), mon = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  mon.setDate(mon.getDate() - ((now.getDay() + 6) % 7) + off * 7);
  return mon;
}
// Monday–Sunday strip; arrows or a swipe move between weeks, a tap shows that day.
function weekStrip() {
  const today = dk(new Date()), mon = weekStart(ui.weekOff), sel = ui.selDay || today;
  const done = new Set(S.sessions.map(s => s.date));
  let out = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const k = dk(d), wd = d.getDay();
    const planned = !!prog()[wd];
    out += `<button class="wd ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''}" data-act="day" data-v="${k}"><span>${'SMTWTFS'[wd]}</span><small>${d.getDate()}</small><i class="${done.has(k) ? 'done' : planned ? 'plan' : 'rest'}"></i></button>`;
  }
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const label = ui.weekOff === 0 ? 'This week' : ui.weekOff === -1 ? 'Last week' : `${shortDate(dk(mon))} – ${shortDate(dk(sun))}`;
  return `<div class="week-head">
      <button class="icon sm" data-act="week" data-v="-1" aria-label="Previous week">${I.back}</button>
      <span>${label}</span>
      <button class="icon sm" data-act="week" data-v="1" aria-label="Next week" ${ui.weekOff >= 0 ? 'disabled' : ''}>${I.chev}</button>
    </div><div class="week" id="week">${out}</div>`;
}

function sRow(s) {
  const sets = s.ex.reduce((a, ex) => a + doneSets(ex).length, 0);
  const run = s.ex.find(ex => ex.run && hasData(ex));
  const prs = s.ex.reduce((a, ex) => a + (ex.run ? runPRs(ex, s.start).length : (ex.sets.some((_, j) => isPR(ex, j, s.start)) ? 1 : 0)), 0);
  const d = fromDk(s.date);
  return `<button class="srow" data-act="open-session" data-id="${s.id}">
      <span class="sday"><b>${d.getDate()}</b><small>${d.toLocaleDateString(undefined, { weekday: 'short' })}</small></span>
      <span class="pname">${esc(s.title)}<small>${mins(s.end - s.start)} min${sets ? ` · ${sets} sets` : ''}${run ? ` · ${esc(fmtRun(run))}` : ''}</small></span>
      ${prs ? `<b class="pr">${prs} PR</b>` : ''}${I.chev}</button>`;
}

// A past (or future) day picked in the week strip.
function vDayHero(k) {
  const list = S.sessions.filter(s => s.date === k), wd = fromDk(k).getDay(), cal = prog()[wd];
  const future = k > dk(new Date());
  return `
    <p class="eyebrow">${fmtDate(k, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
    <h2 class="big">${list.length ? esc(list.map(s => s.title).join(' + ')) : future ? (cal ? esc(cal.title) : 'Rest Day') : 'Nothing logged'}</h2>
    ${list.length ? `<section class="card list day-list">${list.map(sRow).join('')}</section>`
      : `<p class="muted">${future ? (cal ? 'On the plan for this day.' : REST_NOTE) : cal ? `${esc(cal.title)} was on the plan.` : 'Rest day.'}</p>`}
    <button class="btn link" data-act="day" data-v="${dk(new Date())}">Back to today</button>`;
}

// Today's finished workout: totals up top, then each exercise with its sets as chips (PRs in gold).
function vDoneCard(w) {
  const exs = w.ex.filter(hasData);
  const sets = exs.reduce((t, ex) => t + (ex.run ? 0 : doneSets(ex).length), 0);
  const vol = exs.reduce((t, ex) => t + (ex.t === 'w' ? doneSets(ex).reduce((b, s) => b + n(s.w) * n(s.r), 0) : 0), 0);
  const chip = (ex, s) => ex.t === 't' ? `${fw(n(s.r))}s`
    : ex.t === 'bw' ? (sw(ex, s) ? `${sgn(sw(ex, s))}×${fw(n(s.r))}` : fw(n(s.r)))
    : `${fw(n(s.w))}×${fw(n(s.r))}`;
  const rows = exs.map(ex => {
    if (ex.run) return `<li><div class="dn-top"><b>${esc(ex.n)}</b></div><div class="dn-sets"><span class="dn-chip">${esc(fmtRun(ex))}</span></div></li>`;
    const ds = ex.sets.map((s, j) => [s, j]).filter(([s]) => s.d);
    const anyPR = ds.some(([, j]) => isPR(ex, j, w.start));
    return `<li><div class="dn-top"><b>${esc(ex.n)}</b>${anyPR ? '<span class="dn-pr">PR</span>' : ''}</div>
      <div class="dn-sets">${ds.map(([s, j]) => `<span class="dn-chip ${isPR(ex, j, w.start) ? 'pr' : ''}">${esc(chip(ex, s))}</span>`).join('')}${ex.t === 'bw' && !ds.some(([s]) => sw(ex, s)) ? '<small>reps</small>' : ''}</div></li>`;
  }).join('');
  return `<section class="done-card">
    <p class="dn-head">${I.check} Done today</p>
    <div class="dn-stats">
      <div><b>${mins(w.end - w.start)}</b><span>min</span></div>
      <div><b>${sets}</b><span>sets</span></div>
      ${vol ? `<div><b>${Math.round(vol).toLocaleString()}</b><span>${unit()} volume</span></div>` : `<div><b>${exs.length}</b><span>exercises</span></div>`}
    </div>
    <ul class="dn-list">${rows}</ul>
  </section>`;
}
const preview = p => `<ul class="preview">${p.ex.map(e => `<li><span>${esc(e.n)}${e.alts?.length ? ` <small class="muted">or ${esc(e.alts.map(x => x.n).join(', '))}</small>` : ''}</span><span>${e.sets ? `${e.sets} × ` : ''}${esc(e.target)}</span></li>`).join('')}</ul>`;

function vHome() {
  const now = new Date(), today = dk(now), day = now.getDay(), a = S.active;
  const sel = ui.selDay && ui.selDay !== today ? ui.selDay : null;
  const todayDone = S.sessions.filter(s => s.date === today).at(-1);
  const gymNext = nextUp(), next = gymNext == null ? null : here(gymNext);
  // On a workout day, follow the cycle (the workout after the last one you did);
  // run days stay on the calendar. At home, lifting days become their home version.
  const gymShow = prog()[day] ? (isRunDay(day) ? day : gymNext ?? day) : null;
  const show = gymShow == null ? null : here(gymShow);
  let hero, heroDay = null;
  if (!order().length && !a && !sel) hero = `
      <p class="eyebrow">Getting started</p>
      <h2 class="big">Add your first workout</h2>
      <p class="muted">Name it, pick its day, then add a warm-up and exercises. You can add as many as you like.</p>
      <button class="btn primary xl" data-act="prog-add" data-loc="school">${I.plus} Add a workout</button>
      <button class="btn link" data-act="starter">Or pick a starter program</button>`;
  else if (sel) hero = vDayHero(sel);
  else if (a) {
    hero = `
      <p class="eyebrow">In progress · ${fmtDur((Date.now() - a.start) / 1000)}</p>
      <h2 class="big">${esc(a.title)}</h2>
      <p class="muted">${a.ex.filter(hasData).length} of ${a.ex.length} exercises logged</p>
      <button class="btn primary xl" data-act="resume">Resume Workout</button>
      <p class="eyebrow switch-lbl">Switch workout</p>
      <div class="chips">${order().map(here).filter(d => d !== a.day).map(d =>
        `<button class="chip" data-act="start" data-day="${d}">${esc(prog()[d].short)}</button>`).join('')}</div>`;
  } else if (todayDone) {
    const nx = next != null && prog()[next];
    hero = `
      <p class="eyebrow">${DAYS[day]}</p>
      <h2 class="big">${esc(todayDone.title)}</h2>
      ${vDoneCard(todayDone)}
      <button class="btn ghost xl" data-act="open-session" data-id="${todayDone.id}">View Workout</button>
      ${nx ? `<p class="muted small">Next in your cycle: ${esc(nx.title)}</p>` : ''}`;
  } else if (show != null) {
    const p = prog()[show];
    heroDay = show;
    const last = [...S.sessions].reverse().find(s => s.day === show);
    hero = `
      <p class="eyebrow">${DAYS[day]}${gymShow !== day ? ' · Next in your cycle' : ''}</p>
      <h2 class="big">${esc(p.title)}</h2>
      ${preview(p)}
      ${last ? `<p class="muted small">Last time ${fmtDate(last.date)} · ${mins(last.end - last.start)} min</p>` : ''}
      <button class="btn primary xl" data-act="start" data-day="${show}">Start Workout</button>`;
  } else {
    const nx = next != null && prog()[next];
    hero = `
      <p class="eyebrow">${DAYS[day]}</p>
      <h2 class="big">Rest Day</h2>
      <p class="muted">${REST_NOTE}</p>
      ${nx ? `<p class="muted small">Next in your cycle: ${esc(nx.title)}</p>` : ''}`;
  }
  const chips = order().map(here).filter(d => d !== heroDay || isRunDay(d)).map(d =>
    `<button class="chip" data-act="start" data-day="${d}">${esc(prog()[d].short)}</button>`).join('');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const tip = !standalone && !localStorage.getItem('wt-tip') && /iPhone|iPad/.test(navigator.userAgent)
    ? `<div class="tip"><span>Tip: tap Share → <b>Add to Home Screen</b> so it opens like an app and your history stays put.</span><button data-act="tip-x">✕</button></div>` : '';
  return `${topbar(`${S.settings.name ? `<span class="hey">Hey ${esc(S.settings.name)}</span>` : ''}<span class="date">${now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span>`)}
    <main class="page">
      ${weekStrip()}
      ${a || sel ? '' : `<button class="loc-pill" data-act="loc">${I.pin}<span>${esc(curLoc().name)}</span>${I.down}</button>`}
      <section class="hero">${hero}</section>
      ${a || sel ? '' : `<p class="eyebrow">${heroDay != null ? 'Or do a different workout' : 'Start a workout'}</p><div class="chips">${chips}</div>
      <button class="rt-open" data-act="rounds">${I.clock}<span><b>Timer</b><small>Countdown or intervals · boxing, jump rope, anything</small></span>${I.chev}</button>`}
      ${tip}
    </main>`;
}

// ----- workout -----
function vWorkout() {
  const w = cur(), editing = !!ui.edit;
  const before = w.start;
  let sec = '', cards = '';
  w.ex.forEach((ex, i) => {
    if (ex.sec && ex.sec !== sec) cards += `<h3 class="sec">${esc(ex.sec)}</h3>`;
    sec = ex.sec;
    cards += vCard(ex, i, before);
  });
  const warmDone = w.warm.filter(x => x.d).length;
  const warm = w.warm.length ? `
    <section class="card warm ${ui.warmOpen ? 'open' : ''}">
      <button class="warm-head" data-act="warm-toggle"><span>Warm-up</span><span class="muted">${warmDone}/${w.warm.length}</span>${I.chev}</button>
      ${ui.warmOpen ? `<div class="warm-list">${w.warm.map((x, j) => `<div class="warm-row">
        <button class="warm-item ${x.d ? 'done' : ''}" data-act="warm" data-j="${j}"><i>${I.check}</i><span>${esc(x.n)}</span>${x.reps ? `<em>× ${esc(x.reps)}</em>` : ''}</button>
        ${x.sec ? `<button class="timer-btn" data-act="warm-timer" data-j="${j}" ${editing ? 'disabled' : ''}>${I.play}${fmtDur(x.sec)}</button>` : ''}</div>`).join('')}</div>` : ''}
    </section>` : '';
  return `
    <header class="topbar wk">
      <button class="icon" data-act="wk-back" aria-label="Back">${I.back}</button>
      <div class="wk-title">
        <p class="eyebrow">${editing
          ? 'Editing'
          : `${DAYS[fromDk(w.date).getDay()]} · <span data-el="elapsed">${fmtDur((Date.now() - w.start) / 1000)}</span>`}</p>
        <h1>${esc(w.title)}</h1>
      </div>
      <button class="icon" data-act="wk-menu" aria-label="More">${I.dots}</button>
    </header>
    <main class="page wk-page">
      ${editing ? `<section class="card when">
        <label><span>Date</span><input type="date" class="text-in" data-f="date" value="${w.date}"></label>
        <label><span>Duration · min</span><input class="text-in" inputmode="numeric" data-f="mins" value="${mins(w.end - w.start)}"></label>
      </section>` : ''}
      ${warm}
      ${cards}
      <button class="btn ghost add" data-act="add-ex">${I.plus} Add exercise</button>
      ${!editing && prog()[w.day] ? `<button class="btn link edit-wk" data-act="edit-active">Edit this workout</button>` : ''}
    </main>
    <footer class="bar"><button class="btn primary xl" data-act="${editing ? 'save-edit' : 'finish'}">${editing ? 'Save Changes' : 'Finish Workout'}</button></footer>`;
}

function vCard(ex, i, before) {
  const last = lastFor(ex.k, before);
  const menu = `<button class="icon sm" data-act="ex-menu" data-i="${i}" aria-label="Exercise options">${I.dots}</button>`;
  if (ex.skip) {
    return `<section class="card ex skipped"><div class="ex-top"><div><h2>${esc(ex.n)}</h2><p class="sub">Skipped</p></div>
      <button class="btn link" data-act="unskip" data-i="${i}">Undo</button></div></section>`;
  }
  // Set rows show last time's same set in place, so the header only lists last time's sets
  // when it's a run or when there were more sets than today's rows can show.
  const lastSets = last && !ex.run ? doneSets(last.ex) : [];
  const lastTxt = !last ? '' : ex.run ? fmtRun(last.ex)
    : lastSets.length > (ex.sets || []).length ? fmtSets(last.ex, lastSets) : '';
  const head = `<div class="ex-top"><div>
      <h2>${esc(ex.n)}</h2>
      <p class="sub">${ex.sets ? `${ex.sets.length} × ` : ''}${esc(ex.target)}${lastTxt ? ` <span class="dot">·</span> Last: ${esc(lastTxt)}` : ''}</p>
      ${ex.note ? `<p class="note">${esc(ex.note)}</p>` : ''}
    </div>${menu}</div>`;

  if (ex.run) {
    const r = ex.run, done = r.d, prs = done ? runPRs(ex, before) : [];
    const fields = ex.t === 'strides'
      ? `<label class="fld wide"><input inputmode="numeric" data-f="count" data-i="${i}" value="${esc(r.count)}" placeholder="0" ${done ? 'readonly' : ''}><span>strides</span></label>`
      : `<label class="fld"><input inputmode="decimal" data-f="dist" data-i="${i}" value="${esc(r.dist)}" placeholder="0.0" ${done ? 'readonly' : ''}><span>miles</span></label>
         <label class="fld"><input class="dur" data-long="1" inputmode="numeric" pattern="[0-9]*" data-f="time" data-i="${i}" value="${esc(r.time)}" placeholder="mm:ss" ${done ? 'readonly' : ''}><span>time</span></label>`;
    const p = paceOf(r);
    return `<section class="card ex ${done ? 'complete' : ''}">${head}
      <div class="run-row ${done ? 'done' : ''}">${fields}
        <button class="chk ${done ? 'on' : ''}" data-act="run-done" data-i="${i}" aria-label="Done">${I.check}</button></div>
      <p class="foot" data-el="pace-${i}">${ex.t === 'run' && p ? `Pace ${fmtDur(p)}/mi` : ''}${prs.map(x => ` <b class="pr">PR · ${x}</b>`).join('')}</p>
    </section>`;
  }

  const isW = ex.t !== 't', isBW = ex.t === 'bw';
  // Bodyweight lifts: tap the column header to switch between added (+) and assisted (−) weight.
  const unitLbl = ex.t === 'w' ? unit()
    : isBW ? `<button class="mode" data-act="assist" data-i="${i}">${ex.assist ? `−${unit()} assist` : `+${unit()}`} ⇄</button>` : '';
  // tiny "last …" caption inside each box: what you did on this same set last time
  const cap = t => (t === '' ? '' : `<small class="was">last ${esc(t)}</small>`);
  const rows = ex.sets.map((s, j) => {
    const pr = isPR(ex, j, before), l = lastSets[j];
    const lw = !l ? '' : isBW ? (sw(last.ex, l) ? sgn(sw(last.ex, l)) : 'BW') : fw(n(l.w));
    const lr = !l ? '' : fw(n(l.r)) + (ex.t === 't' ? 's' : '');
    const timer = !isW && !s.d && !ui.edit
      ? `<button class="timer-btn in" data-act="set-timer" data-i="${i}" data-j="${j}">${I.play}Start</button>` : '<span></span>';
    const fl = s.d && ui.flash && ui.flash.i === i && ui.flash.j === j && Date.now() - ui.flash.at < 1200 && !ui.edit;
    return `<div class="set ${s.d ? 'done' : ''} ${pr ? 'is-pr' : ''} ${fl ? 'flash' : ''}">${fl ? '<b class="plus" aria-hidden="true">+1 set</b>' : ''}
      <span class="sn">${pr ? '<b>PR</b>' : j + 1}</span>
      ${isW ? `<span class="cell"><input class="in ${l ? 'has-was' : ''}" inputmode="decimal" data-f="w" data-i="${i}" data-j="${j}" value="${esc(s.w)}" placeholder="${isBW ? (ex.assist ? '0' : 'BW') : '0'}" aria-label="${isBW && ex.assist ? 'Assistance' : 'Weight'}">${cap(lw)}</span>` : timer}
      <span class="cell"><input class="in ${l ? 'has-was' : ''}" inputmode="numeric" data-f="r" data-i="${i}" data-j="${j}" value="${esc(s.r)}" placeholder="0" aria-label="${ex.t === 't' ? 'Seconds' : 'Reps'}">${cap(lr)}</span>
      <button class="chk ${s.d ? 'on' : ''}" data-act="set-done" data-i="${i}" data-j="${j}" aria-label="Done">${I.check}</button>
    </div>`;
  }).join('');

  // nudge: hit the top of the rep range on every set last time → suggest adding weight
  let nudge = '';
  if (ex.t === 'w' && last && !ex.sets.some(s => s.d)) {
    const ls = doneSets(last.ex), top = topRep(ex.target);
    const sameW = ex.sets.every((s, j) => n(s.w) === n((ls[j] || ls.at(-1)).w));
    if (top && ls.length && ls.every(s => n(s.r) >= top) && sameW)
      nudge = `<button class="nudge" data-act="bump" data-i="${i}">Hit ${top} reps every set last time · <b>Add ${inc()} ${unit()}</b></button>`;
  }

  // vs last time: only sets you've checked, each against the same set number last time
  const foot = vsLast(ex, last);
  // with body weight known, show what you're actually moving on a bodyweight lift
  const bwv = bwOf(cur());
  let load = '';
  if (isBW && bwv) {
    const s0 = ex.sets.find(s => s.d) || ex.sets[0];
    const add = s0 ? sw(ex, s0) : 0;
    load = `<span class="load">${foot ? ' · ' : ''}Moving ${fw(bwv + add)} ${unit()}${add ? ` (${fw(bwv)} ${add > 0 ? '+' : '−'} ${fw(Math.abs(add))})` : ''}</span>`;
  }

  return `<section class="card ex">${head}${nudge}
    <div class="set hdr"><span>Set</span>${isW ? `<span>${unitLbl}</span>` : '<span>timer</span>'}<span>${ex.t === 't' ? 'sec' : 'reps'}</span><span></span></div>
    ${rows}
    ${foot || load ? `<p class="foot">${foot}${load}</p>` : ''}
  </section>`;
}

// "Vs last time" line for a set-based exercise. Compares only checked sets, each against
// the same set number last time, so an unchecked heavier set never counts against you.
// Returns '' until a set is checked.
function vsLast(ex, last) {
  if (!last || !ex.sets.some(s => s.d)) return '';
  const ls = doneSets(last.ex), isW = ex.t !== 't';
  const wu = ` ${unit()}`, rs = ex.t === 't' ? 's' : ' reps';
  const signed = (d, sfx) => `${d > 0 ? '+' : '−'}${fw(Math.abs(d))}${sfx}`;
  const changed = [];
  let paired = 0, extra = 0;
  ex.sets.forEach((s, j) => {
    if (!s.d) return;
    const l = ls[j];
    if (!l) { extra++; return; }
    paired++;
    const dw = isW ? sw(ex, s) - sw(last.ex, l) : 0, dr = n(s.r) - n(l.r);
    if (dw || dr) changed.push({ j, dw, dr });
  });
  // once every set is checked, also say if you did more or fewer sets than last time
  const fewer = ex.sets.every(s => s.d) ? Math.max(0, ls.length - ex.sets.length) : 0;
  const dSets = extra - fewer;
  const setsTxt = dSets ? signed(dSets, Math.abs(dSets) === 1 ? ' set' : ' sets') : '';
  const what = c => [c.dw ? signed(c.dw, wu) : '', c.dr ? signed(c.dr, rs) : ''].filter(Boolean).join(', ');
  // heavier counts as up (for timed holds, longer counts as up)
  const dir = c => Math.sign(isW && c.dw ? c.dw : c.dr);
  let txt, d = 0;
  if (!changed.length) {
    if (!paired) return `<span class="${dSets > 0 ? 'up' : ''}">${setsTxt} vs last time</span>`;
    txt = 'Matched last time';
    if (setsTxt) txt += ` · ${setsTxt}`;
    return `<span class="${dSets > 0 ? 'up' : ''}">${txt}</span>`;
  }
  const same = changed.every(c => c.dw === changed[0].dw && c.dr === changed[0].dr);
  if (same && changed.length === paired && paired > 1) {
    txt = `${what(changed[0])} every set`; d = dir(changed[0]);
  } else if (changed.length <= 2) {
    txt = changed.map(c => `Set ${c.j + 1} ${what(c)}`).join(' · ');
    d = changed.every(c => dir(c) > 0) ? 1 : changed.every(c => dir(c) < 0) ? -1 : 0;
  } else {
    const up = changed.filter(c => dir(c) > 0).length, down = changed.length - up;
    txt = [up ? `Up on ${up} set${up > 1 ? 's' : ''}` : '', down ? `down on ${down}` : ''].filter(Boolean).join(', ');
    txt = txt[0].toUpperCase() + txt.slice(1);
    d = down ? (up ? 0 : -1) : 1;
  }
  if (setsTxt) txt += ` · ${setsTxt}`;
  return `<span class="${d > 0 ? 'up' : ''}">${txt} vs last time</span>`;
}

// ----- summary -----
function vSummary() {
  const w = S.sessions.find(s => s.id === ui.summary);
  if (!w) { ui.screen = null; return vHome(); }
  const sets = w.ex.reduce((a, ex) => a + doneSets(ex).length, 0);
  const vol = w.ex.reduce((a, ex) => a + (ex.t === 'w' ? doneSets(ex).reduce((b, s) => b + n(s.w) * n(s.r), 0) : 0), 0);
  const prs = [], deltas = [];
  for (const ex of w.ex) {
    if (!hasData(ex)) continue;
    if (ex.run) {
      for (const p of runPRs(ex, w.start)) prs.push([ex.n, `${p} · ${fmtRun(ex)}`]);
      continue;
    }
    const j = ex.sets.findIndex((_, j) => isPR(ex, j, w.start));
    if (j >= 0) prs.push([ex.n, fmtSet(ex, ex.sets[j])]);
    const last = lastFor(ex.k, w.start), ts = topSet(ex), lt = last && topSet(last.ex);
    if (lt && ex.t === 'w' && n(ts.w) !== n(lt.w)) deltas.push([ex.n, n(ts.w) - n(lt.w)]);
  }
  const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
  const dur = mins(w.end - w.start);
  const minTile = `<label class="tile"><input class="tile-in" inputmode="numeric" data-f="mins" value="${dur}" aria-label="Duration in minutes"><span>Minutes ✎</span></label>`;
  const stats = w.ex.some(e => e.t === 'run' && hasData(e))
    ? tile(fmtRun(w.ex.find(e => e.t === 'run')).split(' · ')[0], 'Distance') + minTile
    : minTile + tile(sets, 'Sets') + (vol ? tile(Math.round(vol).toLocaleString(), `${unit()} volume`) : '');
  const neon = isNeon(), tgt = weekTarget(), wk = Math.min(tgt, weekCount());
  const head = neon
    ? `<div class="nc-burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
       <div class="nc-stamp"><h1>Workout<br>complete</h1></div>
       <p class="eyebrow center gold nc-sub">${esc(w.title)}</p>`
    : `<div class="done-badge">${I.check}</div>
    <p class="eyebrow center">Workout complete</p>
    <h1 class="big center">${esc(w.title)}</h1>`;
  const prBlock = !prs.length ? '' : neon
    ? prs.map(([a, b]) => `<div class="nc-best"><span>New best</span><b>${esc(a)} · ${esc(b)}</b></div>`).join('')
    : `<section class="card"><p class="eyebrow gold">Personal records</p>${prs.map(([a, b]) =>
      `<div class="row"><span>${esc(a)}</span><b class="pr">${esc(b)}</b></div>`).join('')}</section>`;
  const weekBlock = neon && w.date === dk(new Date())
    ? `<section class="card nc-week"><div class="row"><span class="eyebrow">This week</span><b>${wk} / ${tgt}</b></div>
       <div class="nc-bars" style="grid-template-columns:repeat(${tgt},minmax(0,1fr))">${Array.from({ length: tgt }, (_, i) => `<i class="${i < wk ? (i === wk - 1 ? 'new' : 'on') : ''}"></i>`).join('')}</div>
       <p class="muted small">${wk >= tgt ? 'Week fully lit.' : wk === tgt - 1 ? 'One more and the week is fully lit.' : `${tgt - wk} more to light up the week.`}</p></section>` : '';
  return `<main class="page summary ${neon ? 'nc' : ''}">
    ${head}
    <div class="tiles">${stats}</div>
    ${dur < 10 ? '<p class="muted small center">Logged it afterwards? Tap Minutes to set how long it really took.</p>' : ''}
    ${prBlock}${weekBlock}
    ${deltas.length ? `<section class="card"><p class="eyebrow">Vs last time</p>${deltas.map(([a, d]) =>
      `<div class="row"><span>${esc(a)}</span><b class="${d > 0 ? 'up' : 'muted'}">${d > 0 ? '+' : '−'}${fw(Math.abs(d))} ${unit()}</b></div>`).join('')}</section>` : ''}
    <button class="btn primary xl" data-act="summary-done">Done</button>
  </main>`;
}

// ----- progress -----
function series(k, metric) {
  return hist(k).map(({ s, ex }) => {
    let y = 0, lbl = '';
    if (metric === 'w') { const t = topSet(ex); y = n(t.w); lbl = fmtSet(ex, t); }
    else if (metric === 'e') { y = Math.round(bestE1(ex)); lbl = `${y} ${unit()} est.`; }
    else if (metric === 'r') { const t = topSet(ex); y = n(t.r); lbl = fmtSet(ex, t); }
    else if (metric === 'l') { const b = bwOf(s); y = b ? b + Math.max(...doneSets(ex).map(x => sw(ex, x))) : 0; lbl = `${fw(y)} ${unit()} · ${fmtSet(ex, topSet(ex))}`; }
    else if (metric === 'dist') { y = n(ex.run.dist); lbl = fmtRun(ex); }
    else if (metric === 'pace') { y = paceOf(ex.run) / 60; lbl = fmtRun(ex); }
    else if (metric === 'count') { y = n(ex.run.count); lbl = fmtRun(ex); }
    return { x: s.start, date: s.date, y, lbl, id: s.id };
  }).filter(p => p.y > 0);
}
const defMetric = t => (t === 'w' ? 'w' : t === 'run' ? 'dist' : t === 'strides' ? 'count' : 'r');
function metricsFor(def) {
  const t = def.t;
  if (t === 'w') return [['w', 'Top set'], ['e', 'Est. 1RM']];
  if (t === 'run') return [['dist', 'Distance'], ['pace', 'Pace']];
  if (t === 'bw' && series(def.k, 'l').length) return [['r', 'Reps'], ['l', 'Load']];
  return [];
}
const pickMetric = def => (metricsFor(def).some(x => x[0] === ui.metric) ? ui.metric : defMetric(def.t));

function spark(pts) {
  if (pts.length < 2) return '<svg class="spark"></svg>';
  const W = 64, H = 24, xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const px = x => 2 + ((x - x0) / (x1 - x0 || 1)) * (W - 4), py = y => H - 3 - ((y - y0) / (y1 - y0 || 1)) * (H - 6);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}"><polyline points="${pts.map(p => `${px(p.x)},${py(p.y)}`).join(' ')}"/><circle cx="${px(pts.at(-1).x)}" cy="${py(pts.at(-1).y)}" r="2.5"/></svg>`;
}

function vProgress() {
  const total = S.sessions.length;
  const now = new Date(), mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const week = S.sessions.filter(s => s.start >= mon.getTime()).length;
  const d30 = Date.now() - 30 * 864e5;
  const miles = S.sessions.filter(s => s.start >= d30).reduce((a, s) => a + s.ex.reduce((b, ex) => b + (ex.t === 'run' && hasData(ex) ? n(ex.run.dist) : 0), 0), 0);
  const tiles = `<div class="tiles">
    <div class="tile"><b>${total}</b><span>Workouts</span></div>
    <div class="tile"><b>${week}<small>/5</small></b><span>This week</span></div>
    <div class="tile"><b>${fw(Math.round(miles * 10) / 10)}</b><span>Miles · 30d</span></div></div>`;

  const groups = new Map();
  for (const def of catalog().values()) {
    const m = defMetric(def.t), pts = series(def.k, m);
    if (!pts.length) continue;
    const g = def.t === 'run' || def.t === 'strides' ? 'Running' : def.group === 'Speed' ? 'Core' : def.group;
    if (!groups.has(g)) groups.set(g, []);
    const last = pts.at(-1), first = pts.find(p => p.x >= Date.now() - 56 * 864e5) || pts[0];
    const d = last.y - first.y;
    const good = m === 'pace' ? d < 0 : d > 0;
    const dTxt = pts.length > 1 && d ? `<span class="delta ${good ? 'up' : ''}">${d > 0 ? '+' : '−'}${fw(Math.abs(Math.round(d * 10) / 10))}${m === 'w' ? '' : ''}</span>` : '';
    groups.get(g).push(`<button class="prow" data-act="detail" data-k="${esc(def.k)}">
      <span class="pname">${esc(def.n)}<small>${esc(last.lbl)}</small></span>${dTxt}${spark(pts.slice(-12))}${I.chev}</button>`);
  }
  const order = ['Push', 'Pull', 'Legs', 'Core', 'Running', 'Other'];
  const lists = order.filter(g => groups.has(g)).map(g => `<p class="eyebrow">${g}</p><section class="card list">${groups.get(g).join('')}</section>`).join('');
  return `${topbar('Progress')}<main class="page">${tiles}${lists ||
    '<div class="empty">Finish your first workout and your progress shows up here.</div>'}</main>`;
}

function vDetail() {
  const def = catalog().get(ui.detail);
  if (!def) { ui.screen = null; return vProgress(); }
  const t = def.t;
  const metrics = metricsFor(def), m = pickMetric(def);
  const pts = series(def.k, m), H = hist(def.k);
  const lastP = pts.at(-1), firstP = pts[0];
  const fmtY = y => (m === 'pace' ? fmtDur(y * 60) : fw(Math.round(y * 10) / 10));
  const yUnit = { w: unit(), e: unit(), l: unit(), r: t === 't' ? 'sec' : 'reps', dist: 'mi', pace: '/mi', count: 'strides' }[m];

  let hero = '';
  if (lastP) {
    const d = lastP.y - firstP.y, good = m === 'pace' ? d < 0 : d > 0;
    hero = `<div class="hero-num"><b>${fmtY(lastP.y)}</b><span>${yUnit}</span>
      ${pts.length > 1 && Math.abs(d) > 0.01 ? `<em class="delta ${good ? 'up' : ''}">${d > 0 ? '+' : '−'}${fmtY(Math.abs(d))} since ${shortDate(firstP.date)}</em>` : ''}</div>
      <p class="muted small">Latest · ${esc(lastP.lbl)} · ${fmtDate(lastP.date)}</p>`;
  }

  // stat tiles
  const tiles = [];
  if (def.run || t === 'run') {
    const runs = H.map(h => h.ex.run);
    const tot = runs.reduce((a, r) => a + n(r.dist), 0), longest = Math.max(0, ...runs.map(r => n(r.dist)));
    const best = runs.filter(r => n(r.dist) >= 1).map(paceOf).filter(Boolean);
    tiles.push([fw(Math.round(tot * 10) / 10), 'Total mi'], [fw(longest), 'Longest mi'], [best.length ? fmtDur(Math.min(...best)) : '—', 'Best pace']);
  } else if (t === 'strides') {
    tiles.push([H.length, 'Sessions'], [Math.max(0, ...H.map(h => n(h.ex.run.count))), 'Most strides']);
  } else {
    let best = null, bestEx = null;
    for (const h of H) {
      const s = topSet(h.ex), bw = best && sw(bestEx.ex, best);
      if (!best || (t === 'w' ? n(s.w) > n(best.w) || (n(s.w) === n(best.w) && n(s.r) > n(best.r))
                              : n(s.r) > n(best.r) || (n(s.r) === n(best.r) && sw(h.ex, s) > bw))) { best = s; bestEx = h; }
    }
    tiles.push([best ? fmtSet(bestEx.ex, best) : '—', `PR · ${bestEx ? shortDate(bestEx.s.date) : ''}`]);
    if (t === 'w') tiles.push([Math.round(Math.max(0, ...H.map(h => bestE1(h.ex)))) || '—', `Est. 1RM ${unit()}`]);
    tiles.push([H.length, 'Sessions']);
  }

  const recent = H.slice(-10).reverse().map(({ s, ex }) => {
    const pr = ex.run ? runPRs(ex, s.start).length : ex.sets.some((_, j) => isPR(ex, j, s.start));
    return `<button class="hrow" data-act="open-session" data-id="${s.id}"><span class="muted">${fmtDate(s.date)}</span>
      <span>${esc(ex.run ? fmtRun(ex) : fmtSets(ex, doneSets(ex)))}${pr ? ' <b class="pr">PR</b>' : ''}</span></button>`;
  }).join('');

  return `<header class="topbar"><button class="icon" data-act="detail-back" aria-label="Back">${I.back}</button><span></span></header>
    <main class="page">
      <p class="eyebrow">${esc(def.group === 'Other' ? 'Custom' : def.group || '')}</p>
      <h1 class="title">${esc(def.n)}</h1>
      ${hero}
      ${metrics.length ? `<div class="seg">${metrics.map(([k, l]) => `<button class="${k === m ? 'on' : ''}" data-act="metric" data-v="${k}">${l}</button>`).join('')}</div>` : ''}
      <section class="card chart-card">${pts.length ? `<div class="chart" id="chart"></div>${m === 'pace' ? '<p class="muted small">Lower is faster</p>' : ''}` : '<div class="empty">No data yet</div>'}</section>
      <div class="tiles">${tiles.map(([v, l]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      ${recent ? `<p class="eyebrow">Recent</p><section class="card list">${recent}</section>` : ''}
    </main>`;
}

// line chart: single series, crosshair + tooltip on touch/hover
function bindChart() {
  const el = document.getElementById('chart');
  if (!el) return;
  const def = catalog().get(ui.detail);
  const m = pickMetric(def);
  const pts = series(def.k, m);
  const fmtY = y => (m === 'pace' ? fmtDur(y * 60) : fw(Math.round(y * 10) / 10));
  const W = el.clientWidth, H = 190, L = 40, R = 12, T = 14, B = 26;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 864e5 * 3; x1 += 864e5 * 3; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const padY = (y1 - y0) * 0.15 || Math.max(1, y1 * 0.1);
  y0 = Math.max(0, y0 - padY); y1 += padY;
  const px = x => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const py = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = [0, 0.5, 1].map(f => y0 + (y1 - y0) * f);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join('');
  const area = pts.length > 1 ? `${line}L${px(pts.at(-1).x)},${H - B}L${px(pts[0].x)},${H - B}Z` : '';
  const bestI = m === 'pace' ? ys.indexOf(Math.min(...ys)) : ys.indexOf(Math.max(...ys));
  const showDots = pts.length <= 24;
  el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Chart">
      <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${py(t)}" y2="${py(t)}"/><text class="axis" x="${L - 8}" y="${py(t) + 4}" text-anchor="end">${fmtY(t)}</text>`).join('')}
      <text class="axis" x="${px(pts[0].x)}" y="${H - 6}" text-anchor="${pts.length > 1 ? 'start' : 'middle'}">${shortDate(pts[0].date)}</text>
      ${pts.length > 1 ? `<text class="axis" x="${px(pts.at(-1).x)}" y="${H - 6}" text-anchor="end">${shortDate(pts.at(-1).date)}</text>` : ''}
      ${area ? `<path d="${area}" fill="url(#g)" stroke="none"/>` : ''}
      <path class="ln" d="${line}"/>
      ${pts.map((p, i) => (showDots || i === pts.length - 1 || i === bestI)
        ? `<circle class="pt ${i === bestI && pts.length > 1 ? 'best' : ''}" cx="${px(p.x)}" cy="${py(p.y)}" r="4"/>` : '').join('')}
      ${pts.length > 1 ? `<text class="axis best-l" x="${Math.min(Math.max(px(pts[bestI].x), L + 10), W - R - 10)}" y="${Math.max(py(pts[bestI].y) - 10, 10)}" text-anchor="middle">PR</text>` : ''}
      <line class="xh" id="xh" y1="${T}" y2="${H - B}" style="display:none"/>
      <circle class="pt hov" id="hov" r="5" style="display:none"/>
    </svg><div class="tt" id="tt"></div>`;
  const xh = el.querySelector('#xh'), hov = el.querySelector('#hov'), tt = el.querySelector('#tt');
  const show = e => {
    const r = el.getBoundingClientRect(), x = (e.touches?.[0] || e).clientX - r.left;
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(px(p.x) - x); if (d < bd) { bd = d; bi = i; } });
    const p = pts[bi], cx = px(p.x), cy = py(p.y);
    xh.setAttribute('x1', cx); xh.setAttribute('x2', cx); xh.style.display = '';
    hov.setAttribute('cx', cx); hov.setAttribute('cy', cy); hov.style.display = '';
    tt.innerHTML = `<b>${esc(p.lbl)}</b><span>${fmtDate(p.date)}</span>`;
    tt.style.display = 'block';
    tt.style.left = Math.min(Math.max(cx - tt.offsetWidth / 2, 0), W - tt.offsetWidth) + 'px';
  };
  const hide = () => { xh.style.display = hov.style.display = tt.style.display = 'none'; };
  el.addEventListener('pointermove', show);
  el.addEventListener('pointerdown', show);
  el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
}

// ----- history -----
function vHistory() {
  const list = [...S.sessions].reverse();
  if (!list.length) return `${topbar('History')}<main class="page"><div class="empty">No workouts yet.</div></main>`;
  let out = '', month = '';
  for (const s of list) {
    const mo = fromDk(s.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (mo !== month) { if (month) out += '</section>'; out += `<p class="eyebrow">${mo}</p><section class="card list">`; month = mo; }
    out += sRow(s);
  }
  return `${topbar('History')}<main class="page">${out}</section></main>`;
}

// ----- sheets -----
function openSheet(title, items) {
  ui.sheet = items;
  $sheet.innerHTML = `<div class="sheet-bg" data-act="sheet-x"></div><div class="sheet-panel">
    ${title ? `<p class="eyebrow center">${esc(title)}</p>` : ''}
    ${items.map((it, i) => it.html ?? `<button class="sheet-btn ${it.danger ? 'danger' : ''}" data-act="sheet" data-i="${i}">${esc(it.label)}</button>`).join('')}
    <button class="sheet-btn cancel" data-act="sheet-x">Cancel</button></div>`;
  $sheet.classList.add('open');
}
function closeSheet() { ui.sheet = null; $sheet.classList.remove('open'); $sheet.innerHTML = ''; }

// Add an exercise, or (with replace) swap one in the workout for another.
function openAddExercise(replace = null) {
  const names = [...catalog().values()].filter(d => !['run', 'strides'].includes(d.t)).map(d => d.n);
  const w = cur(), old = replace != null ? w.ex[replace] : null;
  const prog0 = old && !ui.edit && baseDef(w, old);
  ui.sheet = [];
  $sheet.innerHTML = `<div class="sheet-bg" data-act="sheet-x"></div><form class="sheet-panel" id="add-form">
    <p class="eyebrow center">${old ? `Swap ${esc(old.n)}` : 'Add exercise'}</p>
    <input class="text-in" name="n" list="ex-names" placeholder="Exercise name" autocomplete="off" required>
    <datalist id="ex-names">${names.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <div class="seg" id="add-type"><button type="button" class="on" data-v="w">Weight</button><button type="button" data-v="bw">Bodyweight</button><button type="button" data-v="t">Time</button></div>
    ${prog0 ? `<label class="check"><input type="checkbox" name="keep"> Use it in ${esc(prog()[w.day].title)} from now on</label>` : ''}
    <button class="btn primary xl" type="submit">${old ? 'Swap' : 'Add'}</button>
    <button type="button" class="sheet-btn cancel" data-act="sheet-x">Cancel</button></form>`;
  $sheet.classList.add('open');
  const f = $sheet.querySelector('#add-form');
  f.querySelector('#add-type').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    f.querySelectorAll('#add-type button').forEach(x => x.classList.toggle('on', x === b));
  });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const name = f.n.value.trim(); if (!name) return;
    const known = [...catalog().values()].find(d => d.n.toLowerCase() === name.toLowerCase());
    const t = known?.t || f.querySelector('#add-type .on').dataset.v;
    const k = known?.k || slug(name);
    // a swap keeps the sets, target and rest of the exercise it replaces
    const src = old ? { sets: old.sets?.length || 3, target: old.target, rest: old.rest, sec: old.sec } : {};
    const def = { k, n: known?.n || name, t, sets: known?.sets || src.sets || 3, target: known?.target || src.target || '', rest: known?.rest ?? src.rest ?? 90, sec: src.sec || '' };
    const ex = newEx(def, w.start);
    if (old?.from) ex.from = old.from;
    if (old) {
      w.ex[replace] = ex;
      if (f.keep?.checked) {
        const p = clone(prog()[w.day]), idx = p.ex.findIndex(d => d.k === prog0.k);
        p.ex[idx] = { k: def.k, n: def.n, t: def.t, sets: def.sets, target: def.target, rest: def.rest, ...(def.sec ? { sec: def.sec } : {}), ...(prog0.major ? { major: true } : {}) };
        saveProgramDay(w.day, p);
        ex.from = def.k;
        toast(`Saved to ${p.title}`);
      }
    } else w.ex.push(ex);
    closeSheet(); persist(); render();
    if (!old) requestAnimationFrame(() => scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  });
  setTimeout(() => f.n.focus(), 50);
}

// ----- locations -----
function openLocations() {
  const cur = curLoc().id;
  ui.sheet = [];
  $sheet.innerHTML = `<div class="sheet-bg" data-act="sheet-x"></div><div class="sheet-panel">
    <p class="eyebrow center">Where are you working out?</p>
    ${locs().map(l => `<div class="loc-row">
      <button class="loc-opt ${l.id === cur ? 'on' : ''}" data-act="loc-pick" data-v="${esc(l.id)}">
        <span><b>${esc(l.name)}</b><small>${esc(l.note || locDays(l.id).map(d => prog()[d].short).join(' · '))}</small></span>
        ${l.id === cur ? I.check : ''}</button>
      <button class="icon sm" data-act="loc-ren" data-v="${esc(l.id)}" aria-label="Rename ${esc(l.name)}">${I.pencil}</button>
      ${l.custom ? `<button class="icon sm" data-act="loc-del" data-v="${esc(l.id)}" aria-label="Remove ${esc(l.name)}">✕</button>` : ''}</div>`).join('')}
    <button class="btn link" data-act="loc-add">${I.plus} Add a location</button>
    <p class="muted small center">${S.settings.own ? '' : 'Speed + Core and runs stay the same everywhere. '}Edit any location's workouts in Settings.</p>
    <button class="sheet-btn cancel" data-act="sheet-x">Done</button></div>`;
  $sheet.classList.add('open');
}
// A new location starts as a copy of the one you're at now; edit it in Settings → Workouts.
function addLocation() {
  const name = (prompt('Name the new location (e.g. Hotel, Grandma\'s)') || '').trim();
  if (!name) return;
  const from = curLoc(), id = 'loc-' + uid();
  const keys = Object.keys(prog()).map(Number);
  const base = (Math.floor(Math.max(29, ...keys) / 10) + 1) * 10;
  S.program ||= clone(DEFAULTS);
  for (const d of locDays(from.id)) {
    if (isRunDay(d)) continue;
    const of = baseDay(d);
    if (!S.settings.own && of === 2) continue; // the built-in Speed + Core day is shared
    const p = clone(prog()[d]);
    Object.assign(p, { title: `${p.short} · ${name}`, of, loc: id });
    S.program[base + of] = p;
  }
  (S.locs ||= []).push({ id, name, custom: true, note: `Copied from ${from.name} · edit in Settings` });
  S.settings.where = id;
  save(); closeSheet(); render();
  toast(`Added ${name} · edit its workouts in Settings`);
}
function renameLocation(id) {
  const l = locs().find(x => x.id === id); if (!l) return;
  const name = (prompt('Rename this place', l.name) || '').trim();
  if (!name || name === l.name) return;
  const mine = (S.locs || []).find(x => x.id === id);
  if (mine) mine.name = name;
  else (S.settings.locNames ||= {})[id] = name;
  // "Push · Home" becomes "Push · Grandma's"
  const suffix = ` · ${l.name}`;
  for (const d of locDays(id)) {
    const p = prog()[d];
    if (p.title.endsWith(suffix)) { S.program ||= clone(DEFAULTS); S.program[d] = { ...clone(p), title: p.title.slice(0, -suffix.length) + ` · ${name}` }; }
  }
  save(); openLocations(); render(); toast(`Renamed to ${name}`);
}
function removeLocation(id) {
  const l = (S.locs || []).find(x => x.id === id);
  if (!l || !confirm(`Remove ${l.name} and its workouts? Workouts you've logged there stay in History.`)) return;
  for (const d of locDays(id)) delete S.program[d];
  S.locs = S.locs.filter(x => x.id !== id);
  if (S.settings.where === id) S.settings.where = 'school';
  save(); openLocations(); render();
}

// ---------- making and removing workouts ----------
function addProgram(locId) {
  closeSheet();
  const blank = (title, extra = {}) => ({ title, short: '', warmup: [], ex: [], ...extra });
  const open = (d, def) => {
    ui.pd = d; ui.draft = def; ui.progBack = null; ui.progOrig = JSON.stringify(def); ui.progNew = true;
    ui.draftDay = d < 7 ? d : 'none';
    ui.screen = 'prog'; render(); scrollTo(0, 0);
    setTimeout(() => $app.querySelector('[data-pf=title]')?.select(), 50);
  };
  if (locId === 'school') {
    const taken = new Set(order().filter(d => d < 7));
    const days = [1, 2, 3, 4, 5, 6, 0].filter(d => !taken.has(d));
    setTimeout(() => openSheet('Which day is it on?', [
      ...days.map(d => ({ label: DAYS[d], fn: () => open(d, blank('New workout')) })),
      { label: 'No set day (just in the cycle)', fn: () => open(newKey(), blank('New workout')) },
    ]), 260);
  } else {
    const loc = locs().find(l => l.id === locId);
    const have = new Set(locDays(locId).map(d => prog()[d].of));
    const opts = rotation().filter(d => !have.has(d));
    if (!opts.length) { toast(`Every workout already has a ${loc.name} version`); return; }
    setTimeout(() => openSheet(`At ${loc.name}, this replaces…`, opts.map(d => ({
      label: prog()[d].title,
      fn: () => open(newKey(), blank(`${prog()[d].short} · ${loc.name}`, { short: prog()[d].short, of: d, loc: locId })),
    }))), 260);
  }
}
// Re-key a workout: its place versions, past sessions and any workout in progress follow it,
// so the cycle and "next up" stay right.
function moveProgram(from, to) {
  S.program ||= clone(DEFAULTS);
  for (const k of Object.keys(prog()).map(Number)) {
    if (prog()[k].of === from) S.program[k] = { ...clone(prog()[k]), of: to };
  }
  if (S.settings.own || !DEFAULTS[from]) delete S.program[from]; else S.program[from] = null;
  for (const x of S.sessions) if (x.day === from) x.day = to;
  if (S.active?.day === from) S.active.day = to;
}
function deleteProgram() {
  const d = ui.pd, p = prog()[d];
  const kids = p.loc ? [] : Object.keys(prog()).map(Number).filter(k => prog()[k].of === d);
  if (!confirm(`Delete ${p.title}?${S.active?.day === d ? ' You’re doing it right now; this discards it.' : ''}${kids.length ? ` Its ${kids.length} location version${kids.length > 1 ? 's go' : ' goes'} too.` : ''} Workouts you've logged stay in History.`)) return;
  S.program ||= clone(DEFAULTS);
  for (const k of [d, ...kids]) { if (S.settings.own) delete S.program[k]; else S.program[k] = null; }
  if (S.active?.day === d) S.active = null;
  save(); leaveProgram(); toast('Deleted');
}

// ---------- first-time setup ----------
function needsOnboard() {
  if (S.settings.onboarded) return false;
  if (S.sessions.length || S.program || S.active) { S.settings.onboarded = true; save(); return false; }
  return true;
}
function openOnboard(step = 0) {
  ui.ob = { step, tpl: ui.ob?.tpl || 'shanin', locs: [], extra: [], base: 'Gym' };
  ui.screen = 'onboard'; closeSheet(); render(); scrollTo(0, 0);
}
function obNext() {
  const ob = ui.ob;
  if (ob.step === 0) {
    S.settings.name = ($app.querySelector('[data-ob=name]')?.value || '').trim();
    const bw = ($app.querySelector('[data-ob=bw]')?.value || '').trim();
    if (bw) S.settings.bw = bw;
    save();
  }
  if (ob.step === 2) {
    ob.base = (ob.base || '').trim() || 'Gym';
    return applyTemplate();
  }
  ob.step++; render(); scrollTo(0, 0);
}
function applyTemplate() {
  const ob = ui.ob, t = TEMPLATES.find(x => x.id === ob.tpl);
  S.program = clone(t.program);
  S.settings.own = true; // from here prog() is only this program
  S.locs = [{ id: 'school', name: ob.base }];
  for (const name of ob.locs) {
    const pre = t.locs?.find(l => l.name === name);
    const id = 'loc-' + uid();
    if (pre) {
      for (const def of Object.values(pre.days)) S.program[newKey()] = { ...clone(def), loc: id, title: def.title.replace(/· .*$/, `· ${name}`) };
    } else {
      for (const d of order()) {
        if (isRunDay(d)) continue;
        const p = clone(prog()[d]);
        S.program[newKey()] = { ...p, title: `${p.short} · ${name}`, of: d, loc: id };
      }
    }
    S.locs.push({ id, name, custom: true });
  }
  // Point past sessions at the matching new workout (by name) so "next up" carries on.
  const byName = new Map(order().flatMap(d => [[prog()[d].title.toLowerCase(), d], [prog()[d].short.toLowerCase(), d]]));
  for (const x of S.sessions) {
    if (prog()[x.day]) continue;
    const base = (x.title || '').split(' · ')[0].trim().toLowerCase();
    if (byName.has(base)) x.day = byName.get(base);
  }
  Object.assign(S.settings, { own: true, onboarded: true, where: 'school', theme: S.settings.theme === 'auto' ? 'neon' : S.settings.theme, template: t.id });
  save(); applyTheme();
  ui.ob = null; ui.screen = null; ui.tab = 'home'; render(); scrollTo(0, 0);
  toast(order().length ? `You're set${S.settings.name ? `, ${S.settings.name}` : ''}` : 'Add your first workout in Settings');
  if (!order().length) setTimeout(openSettings, 400);
}
function vOnboard() {
  const ob = ui.ob, st = S.settings;
  const dots = `<div class="ob-dots">${[0, 1, 2].map(i => `<i class="${i === ob.step ? 'on' : i < ob.step ? 'done' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (ob.step === 0) body = `
    <p class="ob-kick">Welcome</p>
    <h1 class="big">Let's set up your workouts</h1>
    <p class="muted">Takes about a minute. You can change everything later in Settings.</p>
    <label class="ob-field"><span>Your name</span><input class="text-in" data-ob="name" value="${esc(st.name || '')}" placeholder="First name" autocomplete="given-name"></label>
    <div class="ob-field"><span>Units</span><div class="seg">${['lb', 'kg'].map(u => `<button class="${st.unit === u ? 'on' : ''}" data-act="ob-unit" data-v="${u}">${u}</button>`).join('')}</div></div>
    <label class="ob-field"><span>Body weight · optional</span><input class="text-in" data-ob="bw" inputmode="decimal" value="${esc(st.bw || '')}" placeholder="${st.unit === 'kg' ? 'e.g. 80' : 'e.g. 175'}"></label>
    <p class="muted small">Body weight is used for pull-ups, dips and other bodyweight lifts.</p>`;
  if (ob.step === 1) body = `
    <p class="ob-kick">Step 2 of 3</p>
    <h1 class="big">Pick a starting program</h1>
    <p class="muted">Every workout is editable. Swap exercises, change sets, add your own.</p>
    <div class="ob-tpls">${TEMPLATES.map(t => `<button class="ob-tpl ${ob.tpl === t.id ? 'on' : ''}" data-act="ob-tpl" data-v="${t.id}">
      <span class="ob-tpl-top"><b>${esc(t.name)}</b>${ob.tpl === t.id ? I.check : ''}</span>
      <small class="ob-days">${esc(t.days)}</small><span class="ob-blurb">${esc(t.blurb)}</span></button>`).join('')}</div>`;
  if (ob.step === 2) {
    const t = TEMPLATES.find(x => x.id === ob.tpl);
    const opts = [...new Set(['Home', 'Travel', ...ob.extra])];
    body = `
    <p class="ob-kick">Step 3 of 3</p>
    <h1 class="big">Where do you work out?</h1>
    <p class="muted">Each place gets its own version of your workouts, so home can use dumbbells while the gym uses machines. Switch places from the pin on Today.</p>
    <label class="ob-field"><span>Main place</span><input class="text-in" data-ob="base" value="${esc(ob.base)}" placeholder="Gym"></label>
    <div class="ob-field"><span>Other places · optional</span><div class="chips">${opts.map(o =>
      `<button class="chip ${ob.locs.includes(o) ? 'on' : ''}" data-act="ob-loc" data-v="${esc(o)}">${ob.locs.includes(o) ? I.check : I.plus}${esc(o)}</button>`).join('')}</div></div>
    <div class="ob-add"><input class="text-in" data-ob="newloc" value="${esc(ob.newloc || '')}" placeholder="Another place, e.g. Hotel" enterkeyhint="done"><button class="btn ghost" data-act="ob-locadd">Add</button></div>
    <p class="muted small">${t.locs?.length ? 'Home and Travel come ready-made with this program. ' : ''}Other places start as a copy of your main workouts. Edit them in Settings → Workouts.</p>`;
  }
  return `<main class="page onboard">${dots}${body}</main>
    <footer class="bar ob-bar">${ob.step ? '<button class="btn ghost" data-act="ob-back">Back</button>' : ''}
      <button class="btn primary xl" data-act="ob-next">${ob.step === 2 ? "Let's go" : 'Next'}</button></footer>`;
}
async function shareApp() {
  const url = location.origin + location.pathname.replace(/index\.html$/, '');
  const text = `Here's my workout app. Open it in Safari, tap Share, then Add to Home Screen. It walks you through setup.`;
  try {
    if (navigator.share) { await navigator.share({ title: 'Workout app', text, url }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied'); } catch { prompt('Copy this link', url); }
}

function openSettings() {
  const st = S.settings;
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${st[key] === v ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  ui.sheet = [];
  $sheet.innerHTML = `<div class="sheet-bg" data-act="sheet-x"></div><div class="sheet-panel">
    <p class="eyebrow center">Settings</p>
    <p class="lbl">Appearance</p>${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark'], ['neon', 'Neon']])}
    ${isNeon() ? `<p class="lbl">Opening screen · phone home screen when the app opens</p>${seg('splash', [[true, 'On'], [false, 'Off']])}` : ''}
    <p class="lbl">Your name</p>
    <input class="text-in" data-sf="name" placeholder="Name" value="${esc(st.name || '')}" autocomplete="given-name">
    <p class="lbl">Units</p>${seg('unit', [['lb', 'lb'], ['kg', 'kg']])}
    <p class="lbl">Body weight · ${unit()}</p>
    <input class="text-in" data-sf="bw" inputmode="decimal" placeholder="e.g. 180" value="${esc(st.bw)}">
    <p class="lbl">Rest timer after each set</p>${seg('rest', [[true, 'On'], [false, 'Off']])}
    <p class="lbl">Workouts · change exercises, sets and warm-ups</p>
    ${locs().map(l => `<div class="set-loc"><span>${esc(l.name)}</span><div class="chips">${locDays(l.id).map(d =>
      `<button class="chip" data-act="edit-prog" data-d="${d}">${esc(prog()[d].short)}</button>`).join('')}<button class="chip add" data-act="prog-add" data-loc="${esc(l.id)}" aria-label="Add a workout to ${esc(l.name)}">${I.plus}</button></div></div>`).join('')}
    <button class="btn link" data-act="loc-add">${I.plus} Add a location</button>
    <button class="btn ghost" data-act="starter">Switch to a starter program</button>
    <p class="lbl">Share</p>
    <button class="btn ghost share" data-act="share-app">Send this app to a friend</button>
    <p class="muted small">They get their own copy with a quick setup. Nothing of yours is shared.</p>
    <p class="lbl">Backup · ${S.sessions.length} workouts saved on this device</p>
    <div class="row2"><button class="btn ghost" data-act="export">Export</button><button class="btn ghost" data-act="import">Import</button></div>
    <button class="sheet-btn cancel" data-act="sheet-x">Close</button></div>`;
  $sheet.classList.add('open');
}
$sheet.addEventListener('input', e => {
  const f = e.target.dataset.sf, v = e.target.value.trim();
  if (f === 'bw') { S.settings.bw = v; saveSoon(); }
  if (f === 'name') { S.settings.name = v; saveSoon(); }
});

// ----- program editor -----
function openProgram(d, back = null) {
  const p = clone(prog()[d]);
  p.warmup = (p.warmup || []).map(normWarm);
  ui.pd = d; ui.draft = p; ui.progBack = back; ui.progOrig = JSON.stringify(p);
  ui.draftDay = d < 7 ? d : 'none';
  closeSheet();
  ui.screen = 'prog'; render(); scrollTo(0, 0);
}
function vProgram() {
  const p = ui.draft;
  const types = [['w', 'Weight'], ['bw', 'Bodyweight'], ['t', 'Time']];
  const warm = p.warmup.map((x, j) => `<div class="pe-warm">
      <input class="text-in" data-pf="wn" data-j="${j}" value="${esc(x.n)}" placeholder="Warm-up">
      <input class="text-in" data-pf="wr" data-j="${j}" value="${esc(x.reps || '')}" placeholder="reps">
      <input class="text-in dur" data-pf="ws" data-j="${j}" value="${x.sec ? fmtDur(x.sec) : ''}" placeholder="m:ss" inputmode="numeric" pattern="[0-9]*" aria-label="Time">
      <button class="icon sm" data-act="pe-wdel" data-j="${j}" aria-label="Remove">✕</button></div>`).join('');
  const exs = p.ex.map((e, j) => {
    const run = ['run', 'strides'].includes(e.t);
    return `<section class="card pe-ex">
      <div class="pe-top"><input class="text-in" data-pf="en" data-j="${j}" value="${esc(e.n)}" placeholder="Exercise name">
        <button class="icon sm" data-act="pe-menu" data-j="${j}" aria-label="Options">${I.dots}</button></div>
      ${run ? '' : `<div class="seg">${types.map(([v, l]) => `<button class="${e.t === v ? 'on' : ''}" data-act="pe-type" data-j="${j}" data-v="${v}">${l}</button>`).join('')}</div>`}
      <div class="pe-grid">
        ${run ? '' : `<label><span>Sets</span><input class="text-in" data-pf="es" data-j="${j}" value="${esc(e.sets ?? 3)}" inputmode="numeric"></label>`}
        <label class="${run ? 'wide' : ''}"><span>${e.t === 't' ? 'Target (sec)' : 'Target reps'}</span><input class="text-in" data-pf="et" data-j="${j}" value="${esc(e.target || '')}" placeholder="${e.t === 't' ? '30–45s' : '8–10'}"></label>
        ${run ? '' : `<label><span>Rest</span><input class="text-in dur" data-pf="er" data-j="${j}" value="${fmtDur(e.rest ?? 90)}" placeholder="m:ss" inputmode="numeric" pattern="[0-9]*"></label>`}
      </div>
      ${e.alts?.length ? `<p class="muted small">Can switch to ${esc(e.alts.map(a => a.n).join(', '))} during the workout.</p>` : ''}
    </section>`;
  }).join('');
  return `
    <header class="topbar wk">
      <button class="icon" data-act="pe-back" aria-label="Back">${I.back}</button>
      <div class="wk-title"><p class="eyebrow">Edit workout</p><h1>${esc(p.title)}</h1></div>
      <button class="icon" data-act="pe-more" aria-label="More">${I.dots}</button>
    </header>
    <main class="page wk-page">
      <section class="card when">
        <label><span>Name</span><input class="text-in" data-pf="title" value="${esc(p.title)}"></label>
        <label><span>Short name</span><input class="text-in" data-pf="short" value="${esc(p.short)}"></label>
        ${p.loc ? '' : (() => {
          const taken = new Set(order().filter(k => k < 7 && k !== ui.pd));
          return `<div class="pe-days"><span>Day</span><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(k =>
            `<button class="chip ${ui.draftDay === k ? 'on' : ''}" data-act="pe-day" data-v="${k}" ${taken.has(k) ? `disabled aria-label="${DAYS[k]} (taken)"` : ''}>${DAYS[k].slice(0, 3)}</button>`).join('')}
            <button class="chip ${ui.draftDay === 'none' ? 'on' : ''}" data-act="pe-day" data-v="none">No set day</button></div>
            <small class="muted">Days with another workout are greyed out.</small></div>`;
        })()}
      </section>
      ${S.active?.day === ui.pd ? '<p class="pe-live">You’re doing this workout now. Saving updates it right away and keeps the sets you’ve logged.</p>' : ''}
      <p class="eyebrow">Warm-up · reps, and time as digits (200 = 2:00)</p>
      <section class="card">${warm || '<p class="muted small">No warm-up.</p>'}
        <button class="btn link" data-act="pe-wadd">${I.plus} Add warm-up</button></section>
      <p class="eyebrow">Exercises</p>
      ${exs}
      <button class="btn ghost add" data-act="pe-eadd">${I.plus} Add exercise</button>
      <p class="muted small">Renaming an exercise keeps its history. To switch to a different exercise, remove it and add the new one.</p>
    </main>
    <footer class="bar"><button class="btn primary xl" data-act="pe-save">Save</button></footer>`;
}
function leaveProgram() {
  ui.draft = null; ui.progNew = false;
  ui.screen = ui.progBack === 'workout' && S.active ? 'workout' : null;
  render(); scrollTo(0, 0);
}
function saveProgram() {
  const p = ui.draft, d = ui.pd;
  p.title = p.title.trim() || prog()[d]?.title || 'Workout';
  p.short = (p.short || '').trim() || p.title.split(/\s+/)[0];
  p.warmup = p.warmup.filter(x => x.n.trim()).map(x => ({ n: x.n.trim(), ...(x.reps ? { reps: x.reps.trim() } : {}), ...(x.sec ? { sec: x.sec } : {}) }));
  p.ex = p.ex.filter(e => e.n.trim());
  if (!p.ex.length) { toast('Add at least one exercise'); return; }
  const cat = catalog(), used = new Set();
  for (const e of p.ex) {
    e.n = e.n.trim();
    if (!e.k) e.k = [...cat.values()].find(c => c.n.toLowerCase() === e.n.toLowerCase())?.k || slug(e.n);
    let k = e.k, i = 2;
    while (used.has(k)) k = `${e.k}-${i++}`;
    e.k = k; used.add(k);
    if (!['run', 'strides'].includes(e.t)) e.sets = Math.max(1, Math.round(n(e.sets)) || 3);
  }
  const old = prog()[d];
  // Moved to another day (or off the calendar)?
  let to = d;
  if (!p.loc) to = ui.draftDay === 'none' ? (d < 7 ? newKey() : d) : ui.draftDay;
  if (to !== d && !ui.progNew) moveProgram(d, to);
  saveProgramDay(to, p);
  if (S.active?.day === to && old) { applyToActive(old, p); save(); toast(to !== d ? `Saved · moved to ${to < 7 ? DAYS[to] : 'no set day'}` : 'Saved · updated this workout too'); }
  else if (to !== d) toast(`Saved · moved to ${to < 7 ? DAYS[to] : 'no set day'}`);
  else toast('Saved');
  leaveProgram();
}

// Bring the workout in progress in line with an edited program: new order, sets,
// targets and warm-ups, while keeping everything already checked off, skipped
// exercises, and exercises added or swapped in during the workout.
function applyToActive(oldDef, def) {
  const w = S.active, oldKeys = new Set((oldDef?.ex || []).map(e => e.k));
  w.title = def.title;

  // warm-ups: keep check marks, matching by name first, then by position
  const prevW = w.warm, usedW = new Set();
  const nextW = (def.warmup || []).map(x => ({ ...normWarm(x), d: false }));
  nextW.forEach(x => {
    const j = prevW.findIndex((y, k) => !usedW.has(k) && y.n.trim().toLowerCase() === x.n.toLowerCase());
    if (j >= 0) { usedW.add(j); x.d = prevW[j].d; x.matched = true; }
  });
  nextW.forEach((x, j) => {
    if (!x.matched && prevW[j] && !usedW.has(j)) { usedW.add(j); x.d = prevW[j].d; }
    delete x.matched;
  });
  w.warm = nextW;

  // exercises
  const slot = ex => ex.from ?? (oldKeys.has(ex.base || ex.k) ? ex.base || ex.k : null);
  const used = new Set();
  const out = def.ex.map(d => {
    const ex = w.ex.find(e => !used.has(e) && slot(e) === d.k);
    if (!ex) return { ...newEx(pickVariant(d, w.start), w.start), from: d.k };
    used.add(ex);
    return syncEx(ex, d, w.start);
  });
  // keep the rest when they were added during the workout, or already have sets logged
  w.ex.forEach((ex, i) => {
    if (used.has(ex)) return;
    const s = slot(ex);
    if (s != null && oldKeys.has(s) && !hasLogged(ex)) return; // removed from the program, nothing logged
    let prev = null;
    for (let k = i - 1; k >= 0 && !prev; k--) if (out.includes(w.ex[k])) prev = w.ex[k];
    out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, ex);
    used.add(ex);
  });
  w.ex = out;
}
const hasLogged = ex => !!(ex.run ? ex.run.d : ex.sets?.some(s => s.d));
function syncEx(ex, d, start) {
  const alt = d.alts?.find(a => a.k === ex.k);
  const v = ex.k === d.k ? d : alt ? variant(d, alt) : null; // null: swapped for something else
  if (v && v.t !== ex.t) {
    if (!hasLogged(ex)) return { ...newEx(v, start), from: d.k };
  } else if (v) ex.n = v.n;
  ex.target = d.target || '';
  ex.rest = d.rest ?? 90;
  ex.sec = d.sec || '';
  ex.note = d.note || '';
  if (ex.sets && d.sets) {
    const want = Math.max(1, Math.round(n(d.sets)));
    while (ex.sets.length < want) { const l = ex.sets.at(-1); ex.sets.push({ w: l?.w ?? '', r: l?.r ?? '', d: false }); }
    while (ex.sets.length > want && !ex.sets.at(-1).d) ex.sets.pop();
  }
  ex.from = d.k;
  return ex;
}

// ---------- rest timer + work timer ----------
let audio;
function tone(freq = 880, dur = 0.5, at = 0, vol = 0.3) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + at;
    o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + dur);
  } catch {}
}
function beep() { tone(); navigator.vibrate?.([200, 100, 200]); }
// end of a timed set: three rising chimes and a long buzz
function chime() { tone(784, 0.25, 0); tone(988, 0.25, 0.22); tone(1319, 0.6, 0.44, 0.35); navigator.vibrate?.([300, 120, 300, 120, 500]); }
function wakeAudio() { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {} }
// keep the screen on while a timed set runs
let lock = null;
async function keepAwake(on) {
  try {
    if (on && !lock) { lock = await navigator.wakeLock?.request('screen'); lock?.addEventListener?.('release', () => { lock = null; }); }
    else if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}

function startRest(sec) {
  if (!S.settings.rest || !sec) return;
  wakeAudio();
  keepAwake(false);
  ui.rest = { end: Date.now() + sec * 1000, total: sec, rung: false };
  renderRest();
}
// Countdown for a timed set or warm-up, shown as a big ring. When it ends the
// set (or warm-up) is checked off and the rest timer starts.
// ready: open the timer full and waiting, so you can get set up (grab the bar) and tap the circle to go.
function startWork(sec, work, ready = false) {
  if (!sec) return;
  wakeAudio();
  if (!ready) keepAwake(true);
  ui.rest = { end: Date.now() + sec * 1000, total: sec, rung: false, work, paused: ready ? sec * 1000 : null, ready, min: false, done: false, cue: null };
  renderRest(true);
}
const workLeft = r => (r.paused != null ? r.paused : r.end - Date.now());
function finishWork(r) {
  const k = r.work;
  r.done = true; r.paused = null; r.end = Date.now();
  chime();
  keepAwake(false);
  if (k.warm) k.warm.d = true;
  else if (k.set) { k.set.r = String(Math.round(r.total)); k.set.d = true; }
  if (S.active) save();
  if (ui.screen === 'workout' && !ui.edit) render();
  else renderRest(true);
  // show "Done" for a moment, then move on to rest
  setTimeout(() => {
    if (ui.rest !== r) return;
    ui.rest = null;
    if (k.ex && S.active?.ex.includes(k.ex)) startRest(k.ex.rest);
    renderRest(true);
  }, 2500);
}

const $timer = document.getElementById('timer');
const RING = 2 * Math.PI * 92;
function renderRest(rebuild = false) {
  const r = ui.rest;
  const visible = r && ui.screen === 'workout' && !ui.edit;
  if (r?.work && !r.done && r.paused == null && Date.now() >= r.end) return finishWork(r);
  // big timer
  if (visible && r.work && !r.min) {
    $rest.className = ''; $rest.innerHTML = '';
    if (rebuild || $timer.dataset.state !== timerState(r)) buildTimer(r);
    tickTimer(r);
    return;
  }
  if ($timer.className) { $timer.className = ''; $timer.innerHTML = ''; $timer.dataset.state = ''; }
  if (!visible) { $rest.className = ''; $rest.innerHTML = ''; return; }
  if (r.work) {
    const left = Math.max(0, Math.ceil(workLeft(r) / 1000));
    $rest.className = 'show work';
    $rest.innerHTML = `<div class="rest-bar" style="transform:scaleX(${r.done ? 1 : Math.max(0, Math.min(1, left / r.total))})"></div>
      <button class="rest-t" data-act="tm-max">${esc(r.work.label)} ${r.done ? '· Done' : r.paused != null ? `${fmtDur(left)} · Paused` : fmtDur(left)}</button>
      ${r.done ? '' : `<button data-act="tm-pause">${r.paused != null ? 'Go' : 'Pause'}</button>`}<button data-act="rest-x" aria-label="Stop">✕</button>`;
    return;
  }
  const left = Math.ceil((r.end - Date.now()) / 1000);
  if (left <= 0 && !r.rung) { r.rung = true; beep(); }
  if (left <= -4) { ui.rest = null; $rest.className = ''; $rest.innerHTML = ''; return; }
  const pct = Math.max(0, Math.min(1, left / r.total));
  $rest.className = 'show' + (left <= 0 ? ' go' : left <= 10 ? ' urgent' : '');
  $rest.innerHTML = `<div class="rest-bar" style="transform:scaleX(${pct})"></div>
    <span class="rest-t">${left > 0 ? `Rest ${fmtDur(left)}` : 'Go'}</span>
    <button data-act="rest-add">+30</button><button data-act="rest-x" aria-label="Dismiss">✕</button>`;
}
const timerState = r => (r.done ? 'done' : r.ready ? 'ready' : r.paused != null ? 'paused' : 'run');
function buildTimer(r) {
  const st = timerState(r);
  $timer.dataset.state = st;
  $timer.className = `show ${st}`;
  $timer.innerHTML = `<div class="tm-top">
      <button class="icon" data-act="tm-min" aria-label="Minimize">${I.down}</button>
      <p class="eyebrow">${esc(r.work.label)}</p>
      <button class="icon" data-act="rest-x" aria-label="Stop timer">✕</button>
    </div>
    <button class="tm-ring" ${st === 'done' ? 'data-act="rest-x"' : 'data-act="tm-pause"'} aria-label="${st === 'run' ? 'Pause' : st === 'done' ? 'Close' : 'Start'}">
      <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="tm-track" cx="100" cy="100" r="92"/><circle class="tm-prog" cx="100" cy="100" r="92" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>
      <span class="tm-num">${st === 'done' ? `<i class="tm-check">${I.check}</i><b class="tm-done">Done</b>` : '<b data-tm="t"></b>'}<span data-tm="s"></span></span>
      <i class="tm-ripple" aria-hidden="true"></i>
    </button>
    <p class="tm-sub">${esc(r.work.sub || '')}</p>
    <div class="tm-btns">${st === 'done'
      ? `<button class="btn primary xl" data-act="rest-x">${r.work.ex?.rest && S.settings.rest ? 'Start rest' : 'Close'}</button>`
      : `<button class="tm-b" data-act="tm-reset" ${st === 'ready' ? 'disabled' : ''}>Reset</button>
         <button class="tm-b main" data-act="tm-pause">${st === 'ready' ? `${I.play}Start` : st === 'paused' ? `${I.play}Resume` : `${I.pause}Pause`}</button>
         <button class="tm-b" data-act="rest-add">+15s</button>`}</div>`;
}
function tickTimer(r) {
  const ms = Math.max(0, workLeft(r)), left = Math.ceil(ms / 1000);
  const t = $timer.querySelector('[data-tm=t]'), sub = $timer.querySelector('[data-tm=s]'), ring = $timer.querySelector('.tm-prog');
  if (t) t.textContent = fmtDur(left);
  if (sub) sub.textContent = r.done ? `${fmtDur(r.total)} held` : r.ready ? 'Tap to start' : r.paused != null ? 'Paused · tap to resume' : 'Tap to pause';
  ring?.setAttribute('stroke-dashoffset', r.done ? 0 : (RING * (1 - Math.min(1, ms / (r.total * 1000)))).toFixed(1));
  $timer.classList.toggle('last', !r.done && left <= 3);
  // 3-2-1 ticks before the end
  if (!r.done && r.paused == null && left <= 3 && left >= 1 && r.cue !== left) { r.cue = left; tone(660, 0.12, 0, 0.25); }
}
setInterval(() => {
  if (ui.screen === 'workout' && S.active && !ui.edit) {
    const el = $app.querySelector('[data-el=elapsed]');
    if (el) el.textContent = fmtDur((Date.now() - S.active.start) / 1000);
  }
  if (ui.rest) renderRest();
}, 1000);
// smooth ring while the big timer is on screen
(function frame() {
  const r = ui.rest;
  if (r?.work && !r.min && !r.done && $timer.className) {
    if (r.paused == null && Date.now() >= r.end) renderRest(); else tickTimer(r);
  }
  requestAnimationFrame(frame);
})();
document.addEventListener('visibilitychange', () => { if (!document.hidden && ui.rest?.work && !ui.rest.done && ui.rest.paused == null) keepAwake(true); });

// ---------- actions ----------
function persist() { if (!ui.edit) save(); }

function cleanSession(w) {
  for (const ex of w.ex) {
    if (ex.sets) { ex.sets = ex.sets.filter(s => s.d); if (!ex.sets.length) ex.skip = true; }
    else if (!ex.run.d) ex.skip = true;
  }
}

function startWorkout(day) {
  if (S.active) {
    if (S.active.day === day) return resume();
    const logged = S.active.ex.some(hasData);
    if (!confirm(logged ? `Switch to ${prog()[day]?.title}? Your unfinished ${S.active.title} will be discarded.` : `Switch from ${S.active.title} to ${prog()[day]?.title}?`)) return;
  }
  S.active = buildSession(day);
  ui.warmOpen = false; ui.rest = null;
  save();
  ui.screen = 'workout'; ui.edit = null;
  render(); scrollTo(0, 0);
}
function resume() { ui.screen = 'workout'; ui.edit = null; render(); scrollTo(0, 0); }

function finish() {
  const w = S.active;
  if (!w.ex.some(hasData)) {
    if (confirm('Nothing logged yet. Discard this workout?')) { S.active = null; save(); ui.screen = null; ui.rest = null; render(); }
    return;
  }
  const undone = w.ex.filter(ex => !ex.skip && ex.sets?.some(s => !s.d && (s.r !== '' || s.w !== ''))).length;
  if (undone && !confirm('Some sets aren’t checked off — they won’t be saved. Finish anyway?')) return;
  w.end = Date.now();
  cleanSession(w);
  S.sessions.push(w); sortSessions();
  S.active = null; ui.rest = null;
  save();
  ui.summary = w.id; ui.screen = 'summary';
  if (isNeon()) { wakeAudio(); chime(); }
  render(); scrollTo(0, 0);
}

function openSession(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return;
  ui.edit = JSON.parse(JSON.stringify(s));
  ui.warmOpen = false;
  ui.back = { tab: ui.tab, screen: ui.screen };
  ui.screen = 'workout';
  render(); scrollTo(0, 0);
}
function leaveEdit() {
  ui.edit = null;
  const b = ui.back || { screen: null };
  ui.screen = b.screen === 'detail' ? 'detail' : null;
  render();
}
function saveEdit() {
  const w = ui.edit;
  cleanSession(w);
  if (!w.ex.some(hasData)) { toast('Nothing logged — delete the workout instead'); return; }
  const i = S.sessions.findIndex(s => s.id === w.id);
  if (i >= 0) S.sessions[i] = w;
  sortSessions(); save();
  toast('Saved');
  leaveEdit();
}

function exportData() {
  const blob = new Blob([JSON.stringify({ ...S, active: null }, null, 1)], { type: 'application/json' });
  const name = `workouts-${dk(new Date())}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importData() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const data = JSON.parse(await inp.files[0].text());
      if (!Array.isArray(data.sessions)) throw 0;
      const have = new Set(S.sessions.map(s => s.id));
      const add = data.sessions.filter(s => s && s.id && Array.isArray(s.ex) && !have.has(s.id));
      S.sessions.push(...add); sortSessions();
      if (data.program && !S.program) S.program = data.program;
      if (data.settings?.bw && !S.settings.bw) S.settings.bw = data.settings.bw;
      save();
      closeSheet(); render(); toast(`Imported ${add.length} workouts`);
    } catch { toast('That file isn’t a workout backup'); }
  };
  inp.click();
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.querySelectorAll('meta[name=theme-color]').forEach(m => {
    m.dataset.orig ??= m.content;
    m.content = t === 'neon' ? '#120a24' : m.dataset.orig;
  });
  // Neon's display fonts load only when the theme is on; offline it falls back to the system font.
  if (t === 'neon' && !document.getElementById('neon-fonts')) {
    const l = document.createElement('link');
    l.id = 'neon-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Monoton&family=Space+Grotesk:wght@500;700&display=swap';
    document.head.append(l);
  }
}

// ----- Round timer: boxing, jump rope, any work/rest intervals -----
const RT_PRESETS = [['Boxing', 180, 60, 3], ['Jump rope', 60, 30, 5], ['Tabata', 20, 10, 8], ['Bag sprints', 30, 30, 6]];
const RT_QUICK = [30, 60, 90, 120, 180, 300];
const rtCfg = () => {
  const c = (S.settings.rt ||= {});
  c.mode ??= 'timer'; c.timer ??= 60; c.work ??= 180; c.rest ??= 60; c.rounds ??= 3;
  return c;
};
// What the clock actually runs: one countdown in Timer mode, work/rest rounds in Intervals.
const rtEff = () => { const c = rtCfg(); return c.mode === 'timer' ? { work: c.timer, rest: 0, rounds: 1, single: true } : c; };
let rt = null, rtT = 0;
const rtBell = () => { tone(1320, 0.5, 0, 0.35); tone(1320, 0.5, 0.35, 0.35); tone(1320, 0.8, 0.7, 0.35); navigator.vibrate?.([250, 100, 250, 100, 400]); };
function openRounds() {
  if (!document.getElementById('rounds')) {
    const el = document.createElement('div'); el.id = 'rounds'; document.body.append(el);
  }
  rtReset();
}
function closeRounds() {
  clearInterval(rtT); rt = null; keepAwake(false);
  const el = document.getElementById('rounds');
  if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 250); }
}
function rtReset() {
  clearInterval(rtT);
  rt = { phase: 'ready', round: 1, end: 0, left: rtEff().work * 1000, paused: true, cue: null };
  renderRounds(true);
}
function rtToggle() {
  wakeAudio();
  if (rt.phase === 'done') return rtReset();
  if (rt.paused) {
    if (rt.phase === 'ready') { rt.phase = 'work'; if (!rtEff().single) rtBell(); else tone(880, 0.15, 0, 0.3); }
    rt.end = Date.now() + rt.left; rt.paused = false;
    keepAwake(true);
    clearInterval(rtT); rtT = setInterval(rtTick, 200);
  } else {
    rt.left = Math.max(0, rt.end - Date.now()); rt.paused = true;
    clearInterval(rtT); keepAwake(false);
  }
  renderRounds(true);
}
function rtTick() {
  if (!rt || rt.paused) return;
  const c = rtEff(), ms = rt.end - Date.now(), s = Math.ceil(ms / 1000);
  if (rt.phase === 'work' && s === 10 && rt.cue !== 10 && c.work > 20) { rt.cue = 10; tone(660, 0.15, 0, 0.3); tone(660, 0.15, 0.2, 0.3); }
  if (s <= 3 && s >= 1 && rt.cue !== s) { rt.cue = s; tone(rt.phase === 'work' ? 520 : 660, 0.12, 0, 0.25); }
  if (ms <= 0) {
    if (rt.phase === 'work' && rt.round >= c.rounds) {
      rt.phase = 'done'; rt.paused = true; clearInterval(rtT); keepAwake(false); chime();
    } else if (rt.phase === 'work' && c.rest > 0) {
      rt.phase = 'rest'; rt.end = Date.now() + c.rest * 1000; rtBell();
    } else {
      if (rt.phase === 'rest' || c.rest === 0) rt.round++;
      rt.phase = 'work'; rt.end = Date.now() + c.work * 1000; rtBell();
    }
    rt.cue = null;
    return renderRounds(true);
  }
  renderRounds(false);
}
function renderRounds(rebuild) {
  const el = document.getElementById('rounds'); if (!el || !rt) return;
  const c = rtEff(), cfg = rtCfg(), single = !!c.single;
  const ms = rt.paused ? rt.left : Math.max(0, rt.end - Date.now());
  const total = (rt.phase === 'rest' ? c.rest : c.work) * 1000 || 1;
  if (rt.paused && rt.phase !== 'ready' && rt.phase !== 'done') { /* keep left */ }
  const label = single ? { ready: 'Timer', work: 'Timer', rest: 'Rest', done: 'Done' }[rt.phase] : { ready: 'Ready', work: 'Work', rest: 'Rest', done: 'Done' }[rt.phase];
  if (rebuild) {
    const adj = (f, d, txt) => `<button class="rt-adj" data-act="rt-adj" data-f="${f}" data-d="${d}" aria-label="${txt}">${d > 0 ? '+' : '−'}</button>`;
    const running = !rt.paused || (rt.phase !== 'ready' && rt.phase !== 'done');
    el.className = `rt-${rt.phase}${rt.paused ? ' paused' : ''}`;
    el.innerHTML = `<div class="rt-top">
        <button class="icon" data-act="rt-x" aria-label="Close timer">${I.down}</button>
        <p class="eyebrow">Timer</p><span style="width:44px"></span></div>
      ${running ? '' : `<div class="seg rt-mode"><button class="${single ? 'on' : ''}" data-act="rt-mode" data-v="timer">Timer</button><button class="${single ? '' : 'on'}" data-act="rt-mode" data-v="rounds">Intervals</button></div>
      <div class="rt-presets">${single
        ? RT_QUICK.map(sec => `<button class="chip ${cfg.timer === sec ? 'on' : ''}" data-act="rt-quick" data-v="${sec}">${fmtDur(sec)}</button>`).join('')
        : RT_PRESETS.map(([nm, w, r, n]) => `<button class="chip ${c.work === w && c.rest === r && c.rounds === n ? 'on' : ''}" data-act="rt-preset" data-v="${w},${r},${n}">${nm}</button>`).join('')}</div>`}
      <button class="rt-ring" data-act="rt-go" aria-label="${rt.paused ? 'Start' : 'Pause'}">
        <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="tm-track" cx="100" cy="100" r="92"/><circle class="rt-prog" cx="100" cy="100" r="92" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>
        <span class="rt-num"><span class="rt-phase">${label}</span><b data-rt="t"></b>${single ? '' : `<span class="rt-round">${rt.phase === 'done' ? `${c.rounds} rounds` : `Round ${rt.round} of ${c.rounds}`}</span>`}
          <small class="rt-tap">${rt.phase === 'done' ? 'Tap to go again' : rt.paused ? (rt.phase === 'ready' ? 'Tap to start' : 'Paused · tap to resume') : 'Tap to pause'}</small></span>
        <i class="tm-ripple" aria-hidden="true"></i>
      </button>
      ${running ? '' : single ? `<div class="rt-cfg">
        <div><span>Time</span><div class="rt-step">${adj('timer', -15, 'Less time')}<b>${fmtDur(cfg.timer)}</b>${adj('timer', 15, 'More time')}</div></div>
      </div>` : `<div class="rt-cfg">
        <div><span>Round</span><div class="rt-step">${adj('work', -30, 'Shorter rounds')}<b>${fmtDur(c.work)}</b>${adj('work', 30, 'Longer rounds')}</div></div>
        <div><span>Rest</span><div class="rt-step">${adj('rest', -15, 'Less rest')}<b>${fmtDur(c.rest)}</b>${adj('rest', 15, 'More rest')}</div></div>
        <div><span>Rounds</span><div class="rt-step">${adj('rounds', -1, 'Fewer rounds')}<b>${c.rounds}</b>${adj('rounds', 1, 'More rounds')}</div></div>
      </div>`}
      <div class="rt-btns">
        ${rt.phase !== 'ready' ? '<button class="tm-b" data-act="rt-reset">Reset</button>' : ''}
        <button class="btn primary xl rt-go" data-act="rt-go">${rt.phase === 'done' ? 'Again' : rt.paused ? (rt.phase === 'ready' ? 'Start' : 'Resume') : 'Pause'}</button>
      </div>
      <p class="muted small center">${rt.phase !== 'ready' ? 'Keep the app open so the alarm can sound.' : single ? 'Chimes when time is up' : `Total ${fmtDur(c.work * c.rounds + c.rest * (c.rounds - 1))} · bell at each switch, double beep 10s before a round ends`}</p>`;
  }
  const t = el.querySelector('[data-rt=t]'), ring = el.querySelector('.rt-prog');
  if (t) t.textContent = rt.phase === 'done' ? '0:00' : fmtDur(Math.ceil(ms / 1000));
  ring?.setAttribute('stroke-dashoffset', rt.phase === 'ready' ? 0 : rt.phase === 'done' ? RING : (RING * (1 - ms / total)).toFixed(1));
}

// ----- Neon: phone home screen on open -----
const PALM_A = '<svg class="sp-palm a" viewBox="0 0 170 240" aria-hidden="true"><path d="M92 240 C88 180 86 120 98 70" stroke-width="9"/><path class="f" d="M98 70 C70 50 40 52 8 70 C40 58 70 64 96 76Z M98 70 C80 36 56 20 26 18 C56 30 78 48 94 74Z M98 70 C112 36 136 22 166 24 C138 34 118 50 102 74Z M98 70 C128 60 152 70 168 96 C146 78 124 74 100 76Z M98 70 C100 44 96 20 84 2 C104 22 108 46 102 72Z"/></svg>';
const PALM_B = '<svg class="sp-palm b" viewBox="0 0 140 200" aria-hidden="true"><path d="M60 200 C64 150 70 100 62 58" stroke-width="8"/><path class="f" d="M62 58 C40 42 20 44 0 58 C24 48 44 52 60 64Z M62 58 C50 30 32 16 8 14 C32 26 48 42 58 62Z M62 58 C74 30 96 18 120 20 C98 28 80 42 66 62Z M62 58 C88 50 108 60 136 82 C110 66 88 62 64 64Z"/></svg>';
let splashT = 0;
function showSplash() {
  if (document.getElementById('splash')) return;
  const el = document.createElement('div');
  el.id = 'splash';
  const tgt = weekTarget(), wk = Math.min(tgt, weekCount()), today = dk(new Date());
  const pending = !S.active && !S.sessions.some(x => x.date === today);
  const stars = [[46, 56], [300, 42], [338, 120], [26, 170], [250, 200], [96, 28], [190, 90]].map(([x, y], i) =>
    `<i class="sp-star" style="left:${(x / 3.9).toFixed(1)}%;top:${y}px;animation-delay:${i * .6}s"></i>`).join('');
  const bldg = [[26, 38], [20, 58], [34, 80, 1], [22, 50], [30, 66], [0, 0], [24, 46], [38, 84, 2], [22, 60], [28, 42]].map(([w, h, k]) =>
    w ? `<span class="${k === 2 ? 'top' : ''}" style="width:${w}px;height:${h}px">${k ? '<i></i><i></i><i></i>' : ''}</span>` : '<b></b>').join('');
  // Every icon opens the app: Workout on Today, the others on their own screen.
  const app = (cls, icon, label, to) =>
    `<button class="sp-app ${to === 'home' ? 'hero' : ''}" data-act="splash-go" data-to="${to}"><span class="sp-ic ${cls}">${icon}</span>${to === 'home' && pending ? '<em>1</em>' : ''}<small>${label}</small></button>`;
  el.innerHTML = `<div class="sp-sky"></div>${stars}
    <div class="sp-sunbox"><div class="sp-sun"></div></div>
    <div class="sp-city">${bldg}</div>
    <div class="sp-sea"></div><div class="sp-refl"></div><div class="sp-wave"></div>
    ${PALM_A}${PALM_B}
    <div class="sp-clock"><p class="sp-date"></p><p class="sp-time"></p><p class="sp-name">Gains Coast</p></div>
    <div class="sp-dock">
      <div class="sp-week"><span>This week</span><span class="sp-bars">${Array.from({ length: tgt }, (_, i) => `<i class="${i < wk ? 'on' : ''}"></i>`).join('')}</span><b>${wk} / ${tgt}</b></div>
      <div class="sp-apps">
        ${app('w', '<svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>', 'Workout', 'home')}
        ${app('p', '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>', 'Progress', 'progress')}
        ${app('t', '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>', 'History', 'history')}
        ${app('m', '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V5"/></svg>', 'Timer', 'rounds')}
      </div>
      <p class="sp-hint">Tap an app to open</p>
    </div>`;
  document.body.append(el);
  const tick = () => {
    const d = new Date();
    el.querySelector('.sp-time').textContent = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
    el.querySelector('.sp-date').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  };
  tick(); clearInterval(splashT); splashT = setInterval(tick, 10000);
}
function hideSplash(b) {
  const el = document.getElementById('splash');
  if (!el) return;
  const to = b?.dataset?.to;
  if ((to === 'progress' || to === 'history') && !S.active) { ui.tab = to; ui.screen = null; render(); scrollTo(0, 0); }
  if (to === 'rounds') openRounds();
  clearInterval(splashT);
  el.classList.add('out');
  setTimeout(() => el.remove(), 450);
}

const actions = {
  tab: b => { ui.tab = b.dataset.v; ui.screen = null; ui.selDay = null; ui.weekOff = 0; render(); scrollTo(0, 0); },
  settings: () => openSettings(),
  start: b => startWorkout(+b.dataset.day),
  resume,
  'tip-x': () => { try { localStorage.setItem('wt-tip', '1'); } catch {} render(); },
  'open-session': b => openSession(b.dataset.id),
  'wk-back': () => (ui.edit ? leaveEdit() : (ui.screen = null, ui.tab = 'home', render())),
  'wk-menu': () => {
    if (ui.edit) openSheet(ui.edit.title, [{ label: 'Delete workout', danger: true, fn: () => {
      if (!confirm('Delete this workout permanently?')) return;
      S.sessions = S.sessions.filter(s => s.id !== ui.edit.id); save(); toast('Deleted'); leaveEdit();
    } }]);
    else {
      const p = prog()[S.active.day];
      openSheet(S.active.title, [
        ...(p ? [{ label: `Edit the ${p.title} workout`, fn: () => openProgram(S.active.day, 'workout') }] : []),
        { label: 'Discard workout', danger: true, fn: () => {
          if (!confirm('Discard this workout? Nothing will be saved.')) return;
          S.active = null; ui.rest = null; save(); ui.screen = null; render();
        } },
      ]);
    }
  },
  'warm-timer': b => { const x = S.active?.warm[+b.dataset.j]; if (x?.sec) startWork(x.sec, { warm: x, label: x.n, sub: 'Warm-up' }, true); },
  'set-timer': b => {
    const i = +b.dataset.i, j = +b.dataset.j, ex = S.active?.ex[i], s = ex?.sets[j];
    if (!s) return;
    const sec = Math.round(n(s.r)) || firstNum(ex.target) || 30;
    s.r = String(sec);
    startWork(sec, { ex, set: s, label: ex.n, sub: `Set ${j + 1} of ${ex.sets.length}` }, true);
    persist(); render();
  },
  assist: b => { const ex = cur().ex[+b.dataset.i]; ex.assist = !ex.assist; persist(); render(); },
  week: b => moveWeek(+b.dataset.v),
  day: b => {
    if (Date.now() - swiped < 500) return;
    const k = b.dataset.v;
    ui.selDay = k === dk(new Date()) ? null : k;
    if (!ui.selDay) ui.weekOff = 0;
    render();
  },
  'edit-prog': b => openProgram(+b.dataset.d),
  'pe-back': () => {
    if (JSON.stringify(ui.draft) !== ui.progOrig && !confirm('Discard your changes?')) return;
    leaveProgram();
  },
  'pe-save': saveProgram,
  'pe-more': () => {
    const items = [];
    if (!S.settings.own && DEFAULTS[ui.pd] && !ui.progNew) items.push({ label: 'Reset to the original workout', fn: () => {
      const p = clone(DEFAULTS[ui.pd]); p.warmup = (p.warmup || []).map(normWarm);
      ui.draft = p; render(); toast('Reset · tap Save to keep it');
    } });
    if (!ui.progNew) items.push({ label: 'Delete this workout', danger: true, fn: deleteProgram });
    if (items.length) openSheet(ui.draft.title, items);
  },
  'prog-add': b => addProgram(b.dataset.loc),
  starter: () => { if (S.active) { toast('Finish or discard your current workout first'); return; } if (confirm('Pick a new starter program? It replaces your workouts and locations. Your history stays.')) openOnboard(1); },
  'share-app': shareApp,
  'ob-next': () => obNext(),
  'ob-back': () => { ui.ob.step = Math.max(0, ui.ob.step - 1); render(); scrollTo(0, 0); },
  'ob-tpl': b => { ui.ob.tpl = b.dataset.v; render(); },
  'ob-unit': b => { S.settings.unit = b.dataset.v; save(); render(); },
  'ob-loc': b => { const L = ui.ob.locs, v = b.dataset.v; L.includes(v) ? L.splice(L.indexOf(v), 1) : L.push(v); render(); },
  'ob-locadd': () => {
    const inp = $app.querySelector('[data-ob=newloc]'), v = (inp?.value || '').trim();
    if (!v) { inp?.focus(); return; }
    if (!ui.ob.extra.includes(v)) ui.ob.extra.push(v), ui.ob.locs.push(v);
    ui.ob.newloc = ''; render();
  },
  'pe-wadd': () => { ui.draft.warmup.push({ n: '' }); render(); $app.querySelector(`[data-pf=wn][data-j="${ui.draft.warmup.length - 1}"]`)?.focus(); },
  'pe-wdel': b => { ui.draft.warmup.splice(+b.dataset.j, 1); render(); },
  'pe-eadd': () => {
    ui.draft.ex.push({ n: '', t: 'w', sets: 3, target: '8–10', rest: 90 }); render();
    $app.querySelector(`[data-pf=en][data-j="${ui.draft.ex.length - 1}"]`)?.focus();
  },
  'pe-type': b => { ui.draft.ex[+b.dataset.j].t = b.dataset.v; render(); },
  'pe-menu': b => {
    const j = +b.dataset.j, ex = ui.draft.ex;
    const items = [];
    if (j > 0) items.push({ label: 'Move up', fn: () => { [ex[j - 1], ex[j]] = [ex[j], ex[j - 1]]; } });
    if (j < ex.length - 1) items.push({ label: 'Move down', fn: () => { [ex[j + 1], ex[j]] = [ex[j], ex[j + 1]]; } });
    items.push({ label: 'Remove', danger: true, fn: () => { ex.splice(j, 1); } });
    openSheet(ex[j].n || 'Exercise', items.map(it => ({ ...it, fn: () => { it.fn(); render(); } })));
  },
  'warm-toggle': () => { ui.warmOpen = !ui.warmOpen; render(); },
  warm: b => { const x = cur().warm[+b.dataset.j]; x.d = !x.d; persist(); render(); },
  'set-done': b => {
    const ex = cur().ex[+b.dataset.i], s = ex.sets[+b.dataset.j];
    if (!s.d) {
      if (n(s.r) <= 0) { $app.querySelector(`input[data-f=r][data-i="${b.dataset.i}"][data-j="${b.dataset.j}"]`)?.focus(); return; }
      if (ex.t === 'w' && s.w === '') { $app.querySelector(`input[data-f=w][data-i="${b.dataset.i}"][data-j="${b.dataset.j}"]`)?.focus(); return; }
      s.d = true;
      ui.flash = { i: +b.dataset.i, j: +b.dataset.j, at: Date.now() };
      if (!ui.edit) startRest(ex.rest);
    } else s.d = false;
    document.activeElement?.blur?.();
    persist(); render();
  },
  'run-done': b => {
    const ex = cur().ex[+b.dataset.i];
    if (!ex.run.d && (ex.t === 'strides' ? n(ex.run.count) <= 0 : n(ex.run.dist) <= 0 && parseDur(ex.run.time) <= 0)) {
      $app.querySelector(`input[data-i="${b.dataset.i}"]`)?.focus(); return;
    }
    ex.run.d = !ex.run.d;
    document.activeElement?.blur?.();
    persist(); render();
  },
  bump: b => {
    const ex = cur().ex[+b.dataset.i];
    for (const s of ex.sets) if (!s.d && s.w !== '') s.w = fw(n(s.w) + inc());
    persist(); render();
  },
  'ex-menu': b => {
    const i = +b.dataset.i, w = cur(), ex = w.ex[i];
    const items = [];
    // one-tap switch between an exercise and its alternatives (Pull-ups ↔ Lat Pulldown)
    const base = baseDef(w, ex);
    if (base?.alts?.length) for (const o of [base, ...base.alts]) {
      if (o.k === ex.k) continue;
      items.push({ label: `Switch to ${o.n}`, fn: () => {
        if (ex.sets?.some(s => s.d) && !confirm(`Switch to ${o.n}? Sets you checked off here will be cleared.`)) return;
        w.ex[i] = { ...newEx(variant(base, o), w.start), ...(ex.from ? { from: ex.from } : {}) };
      } });
    }
    items.push({ label: 'Swap for another exercise', fn: () => openAddExercise(i) });
    if (ex.t === 'bw') items.push({ label: ex.assist ? 'Log added weight instead' : 'Log assisted weight instead', fn: () => { ex.assist = !ex.assist; } });
    items.push({ label: 'Skip exercise', fn: () => { ex.skip = true; } });
    if (ex.sets) {
      items.push({ label: 'Add set', fn: () => { const l = ex.sets.at(-1); ex.sets.push({ w: l?.w ?? '', r: l?.r ?? '', d: false }); } });
      if (ex.sets.length > 1) items.push({ label: 'Remove last set', fn: () => { ex.sets.pop(); } });
    }
    if (i > 0) items.push({ label: 'Move up', fn: () => { [w.ex[i - 1], w.ex[i]] = [w.ex[i], w.ex[i - 1]]; } });
    if (i < w.ex.length - 1) items.push({ label: 'Move down', fn: () => { [w.ex[i + 1], w.ex[i]] = [w.ex[i], w.ex[i + 1]]; } });
    items.push({ label: 'Remove from workout', danger: true, fn: () => { w.ex.splice(i, 1); } });
    openSheet(ex.n, items.map(it => ({ ...it, fn: () => { it.fn(); persist(); render(); } })));
  },
  unskip: b => { cur().ex[+b.dataset.i].skip = false; persist(); render(); },
  'add-ex': () => openAddExercise(),
  finish,
  'save-edit': saveEdit,
  'summary-done': () => { ui.screen = null; ui.tab = 'home'; render(); scrollTo(0, 0); },
  detail: b => { ui.detail = b.dataset.k; ui.metric = null; ui.screen = 'detail'; render(); scrollTo(0, 0); },
  'detail-back': () => { ui.screen = null; ui.tab = 'progress'; render(); },
  metric: b => { ui.metric = b.dataset.v; render(); },
  sheet: b => { const it = ui.sheet?.[+b.dataset.i]; closeSheet(); it?.fn(); },
  'sheet-x': closeSheet,
  'splash-go': hideSplash,
  rounds: () => openRounds(),
  'rt-x': closeRounds,
  'rt-preset': b => { const [w, r, n] = b.dataset.v.split(',').map(Number); Object.assign(rtCfg(), { work: w, rest: r, rounds: n }); save(); rtReset(); },
  'rt-adj': b => {
    const c = rtCfg(), f = b.dataset.f, d = +b.dataset.d;
    const lim = { work: [10, 600], rest: [0, 300], rounds: [1, 20], timer: [5, 3600] }[f];
    c[f] = Math.max(lim[0], Math.min(lim[1], c[f] + d)); save(); rtReset();
  },
  'rt-go': rtToggle,
  'rt-mode': b => { rtCfg().mode = b.dataset.v; save(); rtReset(); },
  'rt-quick': b => { rtCfg().timer = +b.dataset.v; save(); rtReset(); },
  'rt-reset': () => rtReset(),
  loc: openLocations,
  'loc-pick': b => { S.settings.where = b.dataset.v; save(); closeSheet(); render(); toast(`Working out at ${curLoc().name}`); },
  'loc-add': addLocation,
  'loc-del': b => removeLocation(b.dataset.v),
  'loc-ren': b => renameLocation(b.dataset.v),
  'pe-day': b => { ui.draftDay = b.dataset.v === 'none' ? 'none' : +b.dataset.v; render(); },
  set: b => {
    const k = b.dataset.k, v = b.dataset.v;
    S.settings[k] = v === 'true' ? true : v === 'false' ? false : v;
    save(); applyTheme(); openSettings(); render();
  },
  export: exportData,
  import: importData,
  'rest-add': () => {
    const r = ui.rest; if (!r || r.done) return;
    const by = r.work ? 15 : 30;
    if (r.paused != null) r.paused += by * 1000;
    else r.end = Math.max(r.end, Date.now()) + by * 1000;
    r.total += by; r.rung = false; r.cue = null; renderRest();
  },
  'rest-x': () => {
    const r = ui.rest;
    ui.rest = null;
    keepAwake(false);
    // closing a finished timed set goes straight to rest
    if (r?.done && r.work.ex && S.active?.ex.includes(r.work.ex)) startRest(r.work.ex.rest);
    renderRest(true);
  },
  'tm-pause': () => {
    const r = ui.rest; if (!r?.work || r.done) return;
    wakeAudio();
    if (r.paused != null) { r.end = Date.now() + r.paused; r.paused = null; r.ready = false; keepAwake(true); }
    else { r.paused = Math.max(0, r.end - Date.now()); keepAwake(false); }
    renderRest(true);
  },
  'tm-reset': () => {
    const r = ui.rest; if (!r?.work || r.done) return;
    if (r.paused != null) r.paused = r.total * 1000; else r.end = Date.now() + r.total * 1000;
    r.cue = null; renderRest(true);
  },
  'tm-min': () => { if (ui.rest?.work) { ui.rest.min = true; renderRest(true); } },
  'tm-max': () => { if (ui.rest?.work) { ui.rest.min = false; renderRest(true); } },
  'edit-active': () => openProgram(S.active.day, 'workout'),
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const fn = actions[b.dataset.act];
  if (fn) { e.preventDefault(); fn(b); }
});

// Time fields fill from the right like a microwave: 2 → 0:02, 20 → 0:20, 200 → 2:00.
// The iPhone number pad has no ":", so it's added for you.
const durDigits = v => String(v ?? '').replace(/\D/g, '').replace(/^0+/, '');
function fmtDigits(d, long) {
  d = d.replace(/^0+/, '').slice(0, long ? 6 : 4); // extra digits are ignored
  if (!d) return '';
  const p = d.padStart(3, '0');
  if (long && d.length > 4) return `${p.slice(0, -4)}:${p.slice(-4, -2)}:${p.slice(-2)}`;
  return `${+p.slice(0, -2)}:${p.slice(-2)}`;
}
function setDur(el, digits) {
  el.value = fmtDigits(digits, !!el.dataset.long);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
document.addEventListener('focusin', e => { if (e.target.matches?.('input.dur')) e.target.dataset.fresh = '1'; });
document.addEventListener('beforeinput', e => {
  const el = e.target;
  if (!el.matches?.('input.dur') || el.readOnly) return;
  e.preventDefault();
  const fresh = el.dataset.fresh === '1';
  el.dataset.fresh = '';
  let d = durDigits(el.value);
  if (e.inputType.startsWith('insert')) d = durDigits((fresh ? '' : d) + String(e.data ?? e.dataTransfer?.getData('text') ?? '').replace(/\D/g, ''));
  else if (e.inputType === 'deleteContentBackward') d = d.slice(0, -1);
  else if (e.inputType.startsWith('delete')) d = '';
  setDur(el, d);
});
// fallback for keyboards that skip beforeinput (dictation, autofill)
document.addEventListener('input', e => {
  const el = e.target;
  if (e.isTrusted && el.matches?.('input.dur') && /[^\d:]/.test(el.value)) setDur(el, durDigits(el.value));
}, true);

// typing: update state in place, no re-render (keeps focus and keyboard)
$app.addEventListener('focusin', e => {
  const el = e.target;
  if (el.matches('input.in, .fld input')) { el.dataset.prev = el.value; requestAnimationFrame(() => el.select()); }
});
$app.addEventListener('input', e => {
  const el = e.target, f = el.dataset.f;
  const pf = el.dataset.pf;
  if (pf && ui.draft) {
    const p = ui.draft, j = +el.dataset.j, v = el.value;
    if (pf === 'title' || pf === 'short') p[pf] = v;
    else if (pf === 'wn') p.warmup[j].n = v;
    else if (pf === 'wr') p.warmup[j].reps = v;
    else if (pf === 'ws') p.warmup[j].sec = parseSec(v);
    else if (pf === 'en') p.ex[j].n = v;
    else if (pf === 'es') p.ex[j].sets = v;
    else if (pf === 'et') p.ex[j].target = v;
    else if (pf === 'er') p.ex[j].rest = parseSec(v);
    return;
  }
  if (f === 'mins') {
    const s = ui.edit || S.sessions.find(x => x.id === ui.summary), m = Math.round(n(el.value));
    if (s && m > 0) { s.end = s.start + m * 60000; if (!ui.edit) saveSoon(); }
    return;
  }
  const w = cur();
  if (!f || !w) return;
  if (f === 'date') {
    if (!el.value) return;
    const shift = fromDk(el.value) - fromDk(w.date);
    w.date = el.value; w.start += shift; w.end += shift;
    return;
  }
  const ex = w.ex[+el.dataset.i];
  if (ex.run) {
    ex.run[f] = el.value;
    const p = $app.querySelector(`[data-el="pace-${el.dataset.i}"]`);
    if (p && ex.t === 'run') { const pc = paceOf(ex.run); p.textContent = pc ? `Pace ${fmtDur(pc)}/mi` : ''; }
  } else {
    const j = +el.dataset.j, s = ex.sets[j];
    if (f === 'w') {
      // carry a weight change down to later unchecked sets that still match the old value
      const prev = el.dataset.prev ?? s.w;
      for (let k = j + 1; k < ex.sets.length; k++) {
        const t = ex.sets[k];
        if (!t.d && t.w === prev) {
          t.w = el.value;
          const inp = $app.querySelector(`input[data-f=w][data-i="${el.dataset.i}"][data-j="${k}"]`);
          if (inp) inp.value = el.value;
        }
      }
      el.dataset.prev = el.value;
    }
    s[f] = el.value;
  }
  if (!ui.edit) saveSoon();
});
$app.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset.ob === 'newloc') { e.preventDefault(); actions['ob-locadd'](); return; }
  if (e.key === 'Enter' && e.target.matches('input')) e.target.blur();
});
// Setup: keep what's typed when a tap re-draws the step.
$app.addEventListener('input', e => {
  const f = e.target.dataset.ob; if (!f || !ui.ob) return;
  const v = e.target.value;
  if (f === 'name') S.settings.name = v.trim();
  if (f === 'bw') S.settings.bw = v.trim();
  if (f === 'base') ui.ob.base = v;
  if (f === 'newloc') ui.ob.newloc = v;
});
addEventListener('resize', () => { if (ui.screen === 'detail') bindChart(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());

// ---------- boot ----------
applyTheme();
const firstRun = needsOnboard();
if (!firstRun && isNeon() && S.settings.splash !== false) showSplash();
if (firstRun) { S.settings.theme = 'neon'; applyTheme(); openOnboard(0); }
else if (S.active) ui.screen = 'workout';
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // pick up new versions on the next open instead of the one after
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW) { save(); location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

// test hook
window.__wt = { get S() { return S; }, ui, render, save, reload: () => { S = load(); render(); }, nextUp };
