import { PROGRAM, DAYS, REST_NOTE, ORDER } from './program.js';

// ---------- storage ----------
const LS = 'wt1';
const DEF_SETTINGS = { theme: 'auto', unit: 'lb', rest: true, bw: '' };
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
  play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
};

// ---------- program ----------
// The program lives in program.js; edits made in the app are stored in S.program.
const prog = () => S.program || PROGRAM;
const normWarm = x => (typeof x === 'string' ? { n: x } : x);
const isRunDay = d => !!prog()[d]?.ex.length && prog()[d].ex.every(e => e.t === 'run');
// Non-run workouts in order form the cycle.
const rotation = () => ORDER.filter(d => prog()[d] && !isRunDay(d));
function nextUp() {
  const rot = rotation();
  const last = [...S.sessions].reverse().find(s => s.src !== 'strava' && rot.includes(s.day));
  return last ? rot[(rot.indexOf(last.day) + 1) % rot.length] : null;
}
function saveProgramDay(d, def) {
  S.program ||= clone(PROGRAM);
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
    ex: p.ex.map(def => newEx(pickVariant(def, now), now)),
  };
  if (n(S.settings.bw)) s.bw = S.settings.bw;
  return s;
}
const cur = () => ui.edit || S.active;
// The program entry an exercise in a session came from.
const baseDef = (w, ex) => prog()[w.day]?.ex.find(d => d.k === (ex.base || ex.k));

function catalog() {
  const m = new Map();
  for (const d of ORDER) {
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
      <span class="pname">${esc(s.title)}<small>${s.src === 'strava' ? '<em class="tag">Strava</em> · ' : ''}${mins(s.end - s.start)} min${sets ? ` · ${sets} sets` : ''}${run ? ` · ${esc(fmtRun(run))}` : ''}</small></span>
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

const preview = p => `<ul class="preview">${p.ex.map(e => `<li><span>${esc(e.n)}${e.alts?.length ? ` <small class="muted">or ${esc(e.alts.map(x => x.n).join(', '))}</small>` : ''}</span><span>${e.sets ? `${e.sets} × ` : ''}${esc(e.target)}</span></li>`).join('')}</ul>`;

function vHome() {
  const now = new Date(), today = dk(now), day = now.getDay(), a = S.active;
  const sel = ui.selDay && ui.selDay !== today ? ui.selDay : null;
  const todayDone = S.sessions.filter(s => s.date === today).at(-1);
  const next = nextUp();
  // On a workout day, follow the cycle (the workout after the last one you did);
  // run days stay on the calendar.
  const show = prog()[day] ? (isRunDay(day) ? day : next ?? day) : null;
  const strava = stravaOn();
  let hero, heroDay = null;
  if (sel) hero = vDayHero(sel);
  else if (a) {
    hero = `
      <p class="eyebrow">In progress · ${fmtDur((Date.now() - a.start) / 1000)}</p>
      <h2 class="big">${esc(a.title)}</h2>
      <p class="muted">${a.ex.filter(hasData).length} of ${a.ex.length} exercises logged</p>
      <button class="btn primary xl" data-act="resume">Resume Workout</button>`;
  } else if (todayDone) {
    const nx = next != null && prog()[next];
    hero = `
      <p class="eyebrow">${DAYS[day]}</p>
      <h2 class="big">${esc(todayDone.title)}</h2>
      <ul class="preview">${todayDone.ex.filter(hasData).map(ex => `<li><span>${esc(ex.n)}</span><span>${esc(ex.run ? fmtRun(ex) : fmtSets(ex, doneSets(ex)))}</span></li>`).join('')}</ul>
      <p class="done-note">${I.check} Done today · ${mins(todayDone.end - todayDone.start)} min</p>
      <button class="btn ghost xl" data-act="open-session" data-id="${todayDone.id}">View Workout</button>
      ${nx ? `<p class="muted small">Next in your cycle: ${esc(nx.title)}</p>` : ''}`;
  } else if (show != null) {
    const p = prog()[show];
    heroDay = show;
    const last = [...S.sessions].reverse().find(s => s.day === show && s.src !== 'strava');
    const runStrava = isRunDay(show) && strava;
    hero = `
      <p class="eyebrow">${DAYS[day]}${show !== day ? ' · Next in your cycle' : ''}</p>
      <h2 class="big">${esc(p.title)}</h2>
      ${preview(p)}
      ${runStrava ? '<p class="muted small">Track it in Strava. It shows up here once it syncs.</p>'
        : last ? `<p class="muted small">Last time ${fmtDate(last.date)} · ${mins(last.end - last.start)} min</p>` : ''}
      ${runStrava
        ? '<button class="btn primary xl" data-act="strava-sync">Sync from Strava</button>'
        : `<button class="btn primary xl" data-act="start" data-day="${show}">Start Workout</button>`}`;
  } else {
    const nx = next != null && prog()[next];
    hero = `
      <p class="eyebrow">${DAYS[day]}</p>
      <h2 class="big">Rest Day</h2>
      <p class="muted">${REST_NOTE}</p>
      ${nx ? `<p class="muted small">Next in your cycle: ${esc(nx.title)}</p>` : ''}`;
  }
  const chips = ORDER.filter(d => prog()[d] && (d !== heroDay || isRunDay(d))).map(d =>
    `<button class="chip" data-act="start" data-day="${d}">${esc(prog()[d].short)}</button>`).join('');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const tip = !standalone && !localStorage.getItem('wt-tip') && /iPhone|iPad/.test(navigator.userAgent)
    ? `<div class="tip"><span>Tip: tap Share → <b>Add to Home Screen</b> so it opens like an app and your history stays put.</span><button data-act="tip-x">✕</button></div>` : '';
  return `${topbar(`<span class="date">${now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span>`)}
    <main class="page">
      ${weekStrip()}
      <section class="hero">${hero}</section>
      ${a || sel ? '' : `<p class="eyebrow">${heroDay != null ? 'Or do a different workout' : 'Start a workout'}</p><div class="chips">${chips}</div>`}
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
  const lastTxt = last ? (ex.run ? fmtRun(last.ex) : fmtSets(last.ex, doneSets(last.ex))) : '';
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
         <label class="fld"><input inputmode="numeric" data-f="time" data-i="${i}" value="${esc(r.time)}" placeholder="mm:ss" ${done ? 'readonly' : ''}><span>time</span></label>`;
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
  const rows = ex.sets.map((s, j) => {
    const pr = isPR(ex, j, before);
    const timer = !isW && !s.d && !ui.edit
      ? `<button class="timer-btn in" data-act="set-timer" data-i="${i}" data-j="${j}">${I.play}Start</button>` : '<span></span>';
    return `<div class="set ${s.d ? 'done' : ''} ${pr ? 'is-pr' : ''}">
      <span class="sn">${pr ? '<b>PR</b>' : j + 1}</span>
      ${isW ? `<input class="in" inputmode="decimal" data-f="w" data-i="${i}" data-j="${j}" value="${esc(s.w)}" placeholder="${isBW ? (ex.assist ? '0' : 'BW') : '0'}" aria-label="${isBW && ex.assist ? 'Assistance' : 'Weight'}">` : timer}
      <input class="in" inputmode="numeric" data-f="r" data-i="${i}" data-j="${j}" value="${esc(s.r)}" placeholder="0" aria-label="${ex.t === 't' ? 'Seconds' : 'Reps'}">
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

  // delta vs last time, once something is logged
  let foot = '';
  const ts = topSet(ex), lt = last && topSet(last.ex);
  if (ts && lt) {
    const dw = sw(ex, ts) - sw(last.ex, lt), dr = n(ts.r) - n(lt.r);
    const sfx = ex.t === 't' ? 's' : ' reps';
    if (dw && isW) foot = `<span class="${dw > 0 ? 'up' : ''}">${dw > 0 ? '+' : '−'}${fw(Math.abs(dw))} ${unit()} vs last time</span>`;
    else if (dr) foot = `<span class="${dr > 0 ? 'up' : ''}">${dr > 0 ? '+' : '−'}${fw(Math.abs(dr))}${sfx} vs last time</span>`;
    else foot = '<span>Matched last time</span>';
  }
  // with body weight known, show what you're actually moving on a bodyweight lift
  const bwv = bwOf(cur());
  if (isBW && bwv) {
    const s0 = ex.sets.find(s => s.d) || ex.sets[0];
    const add = s0 ? sw(ex, s0) : 0;
    foot += `<span class="load">${foot ? ' · ' : ''}Moving ${fw(bwv + add)} ${unit()}${add ? ` (${fw(bwv)} ${add > 0 ? '+' : '−'} ${fw(Math.abs(add))})` : ''}</span>`;
  }

  return `<section class="card ex">${head}${nudge}
    <div class="set hdr"><span>Set</span>${isW ? `<span>${unitLbl}</span>` : '<span>timer</span>'}<span>${ex.t === 't' ? 'sec' : 'reps'}</span><span></span></div>
    ${rows}
    ${foot ? `<p class="foot">${foot}</p>` : ''}
  </section>`;
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
  return `<main class="page summary">
    <div class="done-badge">${I.check}</div>
    <p class="eyebrow center">Workout complete</p>
    <h1 class="big center">${esc(w.title)}</h1>
    <div class="tiles">${stats}</div>
    ${dur < 10 ? '<p class="muted small center">Logged it afterwards? Tap Minutes to set how long it really took.</p>' : ''}
    ${prs.length ? `<section class="card"><p class="eyebrow gold">Personal records</p>${prs.map(([a, b]) =>
      `<div class="row"><span>${esc(a)}</span><b class="pr">${esc(b)}</b></div>`).join('')}</section>` : ''}
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
    if (old) {
      w.ex[replace] = ex;
      if (f.keep?.checked) {
        const p = clone(prog()[w.day]), idx = p.ex.findIndex(d => d.k === prog0.k);
        p.ex[idx] = { k: def.k, n: def.n, t: def.t, sets: def.sets, target: def.target, rest: def.rest, ...(def.sec ? { sec: def.sec } : {}), ...(prog0.major ? { major: true } : {}) };
        saveProgramDay(w.day, p);
        toast(`Saved to ${p.title}`);
      }
    } else w.ex.push(ex);
    closeSheet(); persist(); render();
    if (!old) requestAnimationFrame(() => scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  });
  setTimeout(() => f.n.focus(), 50);
}

function openSettings() {
  const st = S.settings;
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${st[key] === v ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return !t ? 'not yet' : m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtDate(dk(new Date(t))); };
  const strava = stravaOn()
    ? `<div class="card info">Connected${ST.name ? ` as ${esc(ST.name)}` : ''} · last synced ${ago(ST.synced)}</div>
       <div class="row2"><button class="btn ghost" data-act="strava-sync">Sync now</button><button class="btn ghost" data-act="strava-off">Disconnect</button></div>`
    : `<input class="text-in" data-sf="sid" inputmode="numeric" placeholder="Client ID" value="${esc(ST.id)}" autocomplete="off">
       <input class="text-in" data-sf="ssec" placeholder="Client Secret" value="${esc(ST.secret)}" autocomplete="off" autocapitalize="off" spellcheck="false">
       <button class="btn ghost" data-act="strava-connect">Connect Strava</button>
       <p class="muted small">Runs you record in Strava show up here. You need your own Strava API app; the steps are in the README. These keys stay on this device.</p>`;
  ui.sheet = [];
  $sheet.innerHTML = `<div class="sheet-bg" data-act="sheet-x"></div><div class="sheet-panel">
    <p class="eyebrow center">Settings</p>
    <p class="lbl">Appearance</p>${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}
    <p class="lbl">Units</p>${seg('unit', [['lb', 'lb'], ['kg', 'kg']])}
    <p class="lbl">Body weight · ${unit()}</p>
    <input class="text-in" data-sf="bw" inputmode="decimal" placeholder="e.g. 180" value="${esc(st.bw)}">
    <p class="lbl">Rest timer after each set</p>${seg('rest', [[true, 'On'], [false, 'Off']])}
    <p class="lbl">Workouts · change exercises, sets and warm-ups</p>
    <div class="chips">${ORDER.filter(d => prog()[d]).map(d => `<button class="chip" data-act="edit-prog" data-d="${d}">${esc(prog()[d].short)}</button>`).join('')}</div>
    <p class="lbl">Strava runs</p>${strava}
    <p class="lbl">Backup · ${S.sessions.length} workouts saved on this device</p>
    <div class="row2"><button class="btn ghost" data-act="export">Export</button><button class="btn ghost" data-act="import">Import</button></div>
    <button class="sheet-btn cancel" data-act="sheet-x">Close</button></div>`;
  $sheet.classList.add('open');
}
$sheet.addEventListener('input', e => {
  const f = e.target.dataset.sf, v = e.target.value.trim();
  if (f === 'bw') { S.settings.bw = v; saveSoon(); }
  else if (f === 'sid') { ST.id = v; stSave(); }
  else if (f === 'ssec') { ST.secret = v; stSave(); }
});

// ----- program editor -----
function openProgram(d, back = null) {
  const p = clone(prog()[d]);
  p.warmup = (p.warmup || []).map(normWarm);
  ui.pd = d; ui.draft = p; ui.progBack = back; ui.progOrig = JSON.stringify(p);
  closeSheet();
  ui.screen = 'prog'; render(); scrollTo(0, 0);
}
function vProgram() {
  const p = ui.draft;
  const types = [['w', 'Weight'], ['bw', 'Bodyweight'], ['t', 'Time']];
  const warm = p.warmup.map((x, j) => `<div class="pe-warm">
      <input class="text-in" data-pf="wn" data-j="${j}" value="${esc(x.n)}" placeholder="Warm-up">
      <input class="text-in" data-pf="wr" data-j="${j}" value="${esc(x.reps || '')}" placeholder="reps">
      <input class="text-in" data-pf="ws" data-j="${j}" value="${x.sec ? fmtDur(x.sec) : ''}" placeholder="m:ss" inputmode="numeric">
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
        ${run ? '' : `<label><span>Rest</span><input class="text-in" data-pf="er" data-j="${j}" value="${fmtDur(e.rest ?? 90)}" inputmode="numeric"></label>`}
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
      </section>
      <p class="eyebrow">Warm-up · reps and time are optional</p>
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
  ui.draft = null;
  ui.screen = ui.progBack === 'workout' && S.active ? 'workout' : null;
  render(); scrollTo(0, 0);
}
function saveProgram() {
  const p = ui.draft, d = ui.pd;
  p.title = p.title.trim() || prog()[d].title;
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
  saveProgramDay(d, p);
  toast(S.active?.day === d ? 'Saved · applies next time you start it' : 'Saved');
  leaveProgram();
}

// ---------- Strava ----------
// Your Strava app keys and tokens live in their own slot on this device: not in
// the code and not in backups.
const SK = 'wt-strava';
const SV = { id: '', secret: '', access: '', refresh: '', exp: 0, name: '', after: 0, synced: 0, skip: [] };
function stLoad() { try { return { ...SV, ...JSON.parse(localStorage.getItem(SK)) }; } catch { return { ...SV }; } }
let ST = stLoad();
function stSave() { try { localStorage.setItem(SK, JSON.stringify(ST)); } catch {} }
const stravaOn = () => !!ST.refresh;
const redirectUri = () => location.origin + location.pathname;

function stravaConnect() {
  if (!ST.id || !ST.secret) { toast('Add your Strava Client ID and Secret first'); return; }
  const q = new URLSearchParams({ client_id: ST.id, response_type: 'code', redirect_uri: redirectUri(), approval_prompt: 'auto', scope: 'activity:read_all', state: 'wt-strava' });
  save();
  location.href = `https://www.strava.com/oauth/authorize?${q}`;
}
async function stravaToken(body) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: ST.id, client_secret: ST.secret, ...body }),
  });
  if (!res.ok) throw new Error(`Strava token ${res.status}`);
  const j = await res.json();
  ST.access = j.access_token; ST.refresh = j.refresh_token; ST.exp = j.expires_at;
  if (j.athlete) ST.name = [j.athlete.firstname, j.athlete.lastname].filter(Boolean).join(' ');
  stSave();
}
// Strava sends you back here with ?code=… after you approve.
async function stravaReturn() {
  const q = new URLSearchParams(location.search);
  if (q.get('state') !== 'wt-strava') return;
  history.replaceState(null, '', location.pathname);
  if (q.get('error') || !q.get('code')) { toast('Strava wasn’t connected'); return; }
  if (!(q.get('scope') || '').includes('activity:read')) { toast('Strava needs permission to see your activities'); return; }
  try {
    await stravaToken({ code: q.get('code'), grant_type: 'authorization_code' });
    toast('Strava connected');
    await stravaSync(false);
  } catch { toast('Couldn’t finish connecting to Strava'); }
}
function stravaSession(a) {
  const start = Date.parse(a.start_date), mi = Math.round((a.distance / 1609.344) * 100) / 100;
  return {
    id: `strava-${a.id}`, src: 'strava', day: 0, title: a.name || 'Run',
    date: dk(new Date(start)), start, end: start + (a.elapsed_time || a.moving_time || 60) * 1000, warm: [],
    ex: [{ k: 'easy-run', n: 'Run', t: 'run', target: '', sec: '', note: '', rest: 0, skip: false,
      run: { dist: mi ? String(mi) : '', time: a.moving_time ? fmtDur(a.moving_time) : '', d: true } }],
  };
}
let syncing = false;
async function stravaSync(manual) {
  if (!stravaOn() || syncing) return;
  syncing = true;
  try {
    if (ST.exp * 1000 < Date.now() + 60000) await stravaToken({ grant_type: 'refresh_token', refresh_token: ST.refresh });
    // first sync pulls the last 60 days; after that, only what's new
    const after = ST.after || Math.floor(Date.now() / 1000) - 60 * 86400;
    const have = new Set(S.sessions.map(s => s.id));
    let added = 0, newest = ST.after;
    for (let page = 1; page < 20; page++) {
      const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`,
        { headers: { Authorization: `Bearer ${ST.access}` } });
      if (res.status === 401) { ST.access = ST.refresh = ''; stSave(); toast('Strava disconnected · connect again in Settings'); return; }
      if (!res.ok) throw new Error(`Strava ${res.status}`);
      const list = await res.json();
      for (const a of list) {
        newest = Math.max(newest, Math.floor(Date.parse(a.start_date) / 1000));
        if (!/Run/.test(a.sport_type || a.type || '')) continue;
        const s = stravaSession(a);
        if (have.has(s.id) || ST.skip.includes(s.id)) continue;
        S.sessions.push(s); have.add(s.id); added++;
      }
      if (list.length < 100) break;
    }
    ST.after = newest; ST.synced = Date.now(); stSave();
    if (added) { sortSessions(); save(); }
    if (manual || added) toast(added ? `Added ${added} run${added > 1 ? 's' : ''} from Strava` : 'No new runs on Strava');
    if (ui.screen !== 'workout' && ui.screen !== 'prog') render();
    if ($sheet.classList.contains('open') && ui.sheet?.length === 0 && $sheet.querySelector('[data-act=strava-off]')) openSettings();
  } catch { if (manual) toast('Couldn’t reach Strava'); }
  finally { syncing = false; }
}
function stravaOff() {
  if (!confirm('Disconnect Strava? Runs already imported stay.')) return;
  const tok = ST.access;
  ST.access = ST.refresh = ''; ST.exp = 0; stSave();
  if (tok) fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }).catch(() => {});
  openSettings();
}
const stravaAuto = () => { if (stravaOn() && Date.now() - ST.synced > 10 * 60000) stravaSync(false); };

// ---------- rest timer ----------
let audio;
function beep() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.5);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.5);
  } catch {}
  navigator.vibrate?.([200, 100, 200]);
}
function startRest(sec) {
  if (!S.settings.rest || !sec) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {}
  ui.rest = { end: Date.now() + sec * 1000, total: sec, rung: false };
  renderRest();
}
// Countdown for a timed set or warm-up; when it ends the set (or warm-up) is checked off.
function startWork(sec, work) {
  if (!sec) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {}
  ui.rest = { end: Date.now() + sec * 1000, total: sec, rung: false, work };
  renderRest();
}
function finishWork(r) {
  const w = S.active, k = r.work;
  ui.rest = null;
  beep();
  if (!w) return;
  if (k.warm != null) { if (w.warm[k.warm]) w.warm[k.warm].d = true; save(); }
  else {
    const ex = w.ex[k.i], s = ex?.sets?.[k.j];
    if (s) { s.r = String(Math.round(r.total)); s.d = true; save(); startRest(ex.rest); }
  }
  if (ui.screen === 'workout' && !ui.edit) render();
}
function renderRest() {
  const r = ui.rest;
  if (r?.work && Date.now() >= r.end) return finishWork(r);
  if (!r || ui.screen !== 'workout' || ui.edit) { $rest.className = ''; $rest.innerHTML = ''; return; }
  const left = Math.ceil((r.end - Date.now()) / 1000);
  if (r.work) {
    $rest.className = 'show work';
    $rest.innerHTML = `<div class="rest-bar" style="transform:scaleX(${Math.max(0, Math.min(1, left / r.total))})"></div>
      <span class="rest-t">${esc(r.work.label)} ${fmtDur(left)}</span>
      <button data-act="rest-add">+15</button><button data-act="rest-x" aria-label="Stop">✕</button>`;
    return;
  }
  if (left <= 0 && !r.rung) { r.rung = true; beep(); }
  if (left <= -4) { ui.rest = null; $rest.className = ''; $rest.innerHTML = ''; return; }
  const pct = Math.max(0, Math.min(1, left / r.total));
  $rest.className = 'show' + (left <= 0 ? ' go' : '');
  $rest.innerHTML = `<div class="rest-bar" style="transform:scaleX(${pct})"></div>
    <span class="rest-t">${left > 0 ? `Rest ${fmtDur(left)}` : 'Go'}</span>
    <button data-act="rest-add">+30</button><button data-act="rest-x" aria-label="Dismiss">✕</button>`;
}
setInterval(() => {
  if (ui.screen === 'workout' && S.active && !ui.edit) {
    const el = $app.querySelector('[data-el=elapsed]');
    if (el) el.textContent = fmtDur((Date.now() - S.active.start) / 1000);
  }
  if (ui.rest) renderRest();
}, 1000);

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
    if (!confirm(`Discard your unfinished ${S.active.title} workout?`)) return;
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
      // keep a deleted Strava run from coming back on the next sync
      if (ui.edit.src === 'strava') { ST.skip.push(ui.edit.id); stSave(); }
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
  'warm-timer': b => { const x = S.active?.warm[+b.dataset.j]; if (x?.sec) startWork(x.sec, { warm: +b.dataset.j, label: x.n }); },
  'set-timer': b => {
    const i = +b.dataset.i, j = +b.dataset.j, ex = S.active?.ex[i], s = ex?.sets[j];
    if (!s) return;
    const sec = Math.round(n(s.r)) || firstNum(ex.target) || 30;
    s.r = String(sec);
    startWork(sec, { i, j, label: 'Hold' });
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
  'pe-more': () => openSheet(ui.draft.title, [{ label: 'Reset to the original workout', danger: true, fn: () => {
    if (!PROGRAM[ui.pd]) return;
    const p = clone(PROGRAM[ui.pd]); p.warmup = (p.warmup || []).map(normWarm);
    ui.draft = p; render(); toast('Reset · tap Save to keep it');
  } }]),
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
  'strava-connect': stravaConnect,
  'strava-sync': () => stravaSync(true),
  'strava-off': stravaOff,
  'warm-toggle': () => { ui.warmOpen = !ui.warmOpen; render(); },
  warm: b => { const x = cur().warm[+b.dataset.j]; x.d = !x.d; persist(); render(); },
  'set-done': b => {
    const ex = cur().ex[+b.dataset.i], s = ex.sets[+b.dataset.j];
    if (!s.d) {
      if (n(s.r) <= 0) { $app.querySelector(`input[data-f=r][data-i="${b.dataset.i}"][data-j="${b.dataset.j}"]`)?.focus(); return; }
      if (ex.t === 'w' && s.w === '') { $app.querySelector(`input[data-f=w][data-i="${b.dataset.i}"][data-j="${b.dataset.j}"]`)?.focus(); return; }
      s.d = true;
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
        w.ex[i] = newEx(variant(base, o), w.start);
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
  set: b => {
    const k = b.dataset.k, v = b.dataset.v;
    S.settings[k] = v === 'true' ? true : v === 'false' ? false : v;
    save(); applyTheme(); openSettings(); render();
  },
  export: exportData,
  import: importData,
  'rest-add': () => {
    const r = ui.rest; if (!r) return;
    const by = r.work ? 15 : 30;
    r.end = Math.max(r.end, Date.now()) + by * 1000; r.total += by; r.rung = false; renderRest();
  },
  'rest-x': () => { ui.rest = null; renderRest(); },
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const fn = actions[b.dataset.act];
  if (fn) { e.preventDefault(); fn(b); }
});

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
  if (e.key === 'Enter' && e.target.matches('input')) e.target.blur();
});
addEventListener('resize', () => { if (ui.screen === 'detail') bindChart(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());

// ---------- boot ----------
applyTheme();
if (S.active) ui.screen = 'workout';
render();
stravaReturn().finally(stravaAuto);
document.addEventListener('visibilitychange', () => { if (!document.hidden) stravaAuto(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // pick up new versions on the next open instead of the one after
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW) { save(); location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

// test hook
window.__wt = { get S() { return S; }, get ST() { return ST; }, ui, render, save, reload: () => { S = load(); ST = stLoad(); render(); }, stravaSession, nextUp };
