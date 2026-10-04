import { PROGRAM, DAYS, REST_NOTE, ORDER } from './program.js';

// ---------- storage ----------
const LS = 'wt1';
const DEF_SETTINGS = { theme: 'auto', unit: 'lb', rest: true };

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
  rest: null,         // { end, total }
  sheet: null,
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
};

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
                     : (n(s.r) > n(b.r) || (n(s.r) === n(b.r) && n(s.w) > n(b.w)))) b = s;
  }
  return b;
}
const bestE1 = ex => Math.max(0, ...doneSets(ex).map(s => e1(n(s.w), n(s.r))));

function fmtSet(t, s) {
  if (t === 't') return `${fw(n(s.r))}s`;
  if (t === 'bw') return n(s.w) ? `+${fw(n(s.w))} × ${fw(n(s.r))}` : `${fw(n(s.r))} reps`;
  return `${fw(n(s.w))} × ${fw(n(s.r))}`;
}
function fmtSets(t, sets) {
  if (!sets.length) return '';
  if (t === 't') return sets.map(s => `${fw(n(s.r))}s`).join(', ');
  const ws = new Set(sets.map(s => n(s.w)));
  if (ws.size === 1) {
    const w = n(sets[0].w), reps = sets.map(s => fw(n(s.r))).join(', ');
    if (t === 'bw' && !w) return `${reps} reps`;
    return `${t === 'bw' ? '+' : ''}${fw(w)} × ${reps}`;
  }
  return sets.map(s => fmtSet(t, s)).join(', ');
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
  const prior = [];
  for (const h of hist(ex.k, before)) prior.push(...doneSets(h.ex));
  if (!prior.length) return false;
  prior.push(...ex.sets.slice(0, j).filter(p => p.d));
  const w = n(s.w), r = n(s.r);
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
  const last = lastFor(def.k, before);
  if (def.t === 'run') ex.run = { dist: last?.ex.run.dist || '', time: last?.ex.run.time || '', d: false };
  else if (def.t === 'strides') ex.run = { count: last?.ex.run.count || '', d: false };
  else {
    const ls = last ? doneSets(last.ex) : [];
    ex.sets = Array.from({ length: def.sets || 3 }, (_, i) => {
      const src = ls[i] || ls.at(-1);
      return { w: src?.w ?? '', r: src?.r ?? '', d: false };
    });
  }
  return ex;
}
function buildSession(day) {
  const p = PROGRAM[day], now = Date.now();
  return {
    id: uid(), day, title: p.title, date: dk(new Date()), start: now, end: null,
    warm: p.warmup.map(x => ({ n: x, d: false })),
    ex: p.ex.map(def => newEx(def, now)),
  };
}
const cur = () => ui.edit || S.active;

function catalog() {
  const m = new Map();
  for (const d of ORDER) for (const def of PROGRAM[d].ex) m.set(def.k, { ...def, group: PROGRAM[d].short });
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
  else html = (ui.tab === 'home' ? vHome() : ui.tab === 'progress' ? vProgress() : vHistory()) + vTabs();
  $app.innerHTML = html;
  if (ui.screen === 'detail') bindChart();
  renderRest();
}

function vTabs() {
  const t = (id, icon, label) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-v="${id}">${icon}<span>${label}</span></button>`;
  return `<nav class="tabs">${t('home', I.today, 'Today')}${t('progress', I.chart, 'Progress')}${t('history', I.list, 'History')}</nav>`;
}
const topbar = (title, right = `<button class="icon" data-act="settings" aria-label="Settings">${I.gear}</button>`) =>
  `<header class="topbar"><h1 class="h-title">${title}</h1>${right}</header>`;

function weekStrip() {
  const now = new Date(), mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const done = new Set(S.sessions.map(s => s.date));
  let out = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const k = dk(d), today = k === dk(now), wd = d.getDay();
    const planned = !!PROGRAM[wd];
    out += `<div class="wd ${today ? 'today' : ''}"><span>${'SMTWTFS'[wd]}</span><i class="${done.has(k) ? 'done' : planned ? 'plan' : 'rest'}"></i></div>`;
  }
  return `<div class="week">${out}</div>`;
}

function vHome() {
  const now = new Date(), day = now.getDay(), p = PROGRAM[day], a = S.active;
  const todayDone = S.sessions.filter(s => s.date === dk(now)).at(-1);
  let hero;
  if (a) {
    hero = `
      <p class="eyebrow">In progress · ${fmtDur((Date.now() - a.start) / 1000)}</p>
      <h2 class="big">${esc(a.title)}</h2>
      <p class="muted">${a.ex.filter(hasData).length} of ${a.ex.length} exercises logged</p>
      <button class="btn primary xl" data-act="resume">Resume Workout</button>`;
  } else if (p) {
    const last = [...S.sessions].reverse().find(s => s.day === day);
    hero = `
      <p class="eyebrow">${DAYS[day]}</p>
      <h2 class="big">${esc(p.title)}</h2>
      <ul class="preview">${p.ex.map(e => `<li><span>${esc(e.n)}</span><span>${e.sets ? `${e.sets} × ` : ''}${esc(e.target)}</span></li>`).join('')}</ul>
      ${todayDone ? `<p class="done-note">${I.check} Done today · ${mins(todayDone.end - todayDone.start)} min</p>`
        : last ? `<p class="muted small">Last time ${fmtDate(last.date)} · ${mins(last.end - last.start)} min</p>` : ''}
      ${todayDone
        ? `<button class="btn ghost xl" data-act="open-session" data-id="${todayDone.id}">View Workout</button>`
        : `<button class="btn primary xl" data-act="start" data-day="${day}">Start Workout</button>`}`;
  } else {
    hero = `
      <p class="eyebrow">${DAYS[day]}</p>
      <h2 class="big">Rest Day</h2>
      <p class="muted">${REST_NOTE}</p>`;
  }
  const chips = ORDER.filter(d => d !== day || !p || todayDone).map(d =>
    `<button class="chip" data-act="start" data-day="${d}">${PROGRAM[d].short}</button>`).join('');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const tip = !standalone && !localStorage.getItem('wt-tip') && /iPhone|iPad/.test(navigator.userAgent)
    ? `<div class="tip"><span>Tip: tap Share → <b>Add to Home Screen</b> so it opens like an app and your history stays put.</span><button data-act="tip-x">✕</button></div>` : '';
  return `${topbar(`<span class="date">${now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span>`)}
    <main class="page">
      ${weekStrip()}
      <section class="hero">${hero}</section>
      ${a ? '' : `<p class="eyebrow">${p && !todayDone ? 'Or do a different workout' : 'Start a workout'}</p><div class="chips">${chips}</div>`}
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
      ${ui.warmOpen ? `<div class="warm-list">${w.warm.map((x, j) =>
        `<button class="warm-item ${x.d ? 'done' : ''}" data-act="warm" data-j="${j}"><i>${I.check}</i>${esc(x.n)}</button>`).join('')}</div>` : ''}
    </section>` : '';
  return `
    <header class="topbar wk">
      <button class="icon" data-act="wk-back" aria-label="Back">${I.back}</button>
      <div class="wk-title">
        <p class="eyebrow">${editing
          ? `Editing · <input type="date" class="date-in" data-f="date" value="${w.date}"> · <input class="date-in min-in" inputmode="numeric" data-f="mins" value="${mins(w.end - w.start)}" aria-label="Duration in minutes"> min`
          : `${DAYS[w.day] ?? ''} · <span data-el="elapsed">${fmtDur((Date.now() - w.start) / 1000)}</span>`}</p>
        <h1>${esc(w.title)}</h1>
      </div>
      <button class="icon" data-act="wk-menu" aria-label="More">${I.dots}</button>
    </header>
    <main class="page wk-page">
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
  const lastTxt = last ? (ex.run ? fmtRun(last.ex) : fmtSets(ex.t, doneSets(last.ex))) : '';
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

  const isW = ex.t !== 't';
  const unitLbl = ex.t === 'w' ? unit() : ex.t === 'bw' ? `+${unit()}` : '';
  const rows = ex.sets.map((s, j) => {
    const pr = isPR(ex, j, before);
    return `<div class="set ${s.d ? 'done' : ''} ${pr ? 'is-pr' : ''}">
      <span class="sn">${pr ? '<b>PR</b>' : j + 1}</span>
      ${isW ? `<input class="in" inputmode="decimal" data-f="w" data-i="${i}" data-j="${j}" value="${esc(s.w)}" placeholder="${ex.t === 'bw' ? 'BW' : '0'}" aria-label="Weight">` : '<span></span>'}
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
    const dw = n(ts.w) - n(lt.w), dr = n(ts.r) - n(lt.r);
    const sfx = ex.t === 't' ? 's' : ' reps';
    if (dw && isW) foot = `<span class="${dw > 0 ? 'up' : ''}">${dw > 0 ? '+' : '−'}${fw(Math.abs(dw))} ${unit()} vs last time</span>`;
    else if (dr) foot = `<span class="${dr > 0 ? 'up' : ''}">${dr > 0 ? '+' : '−'}${fw(Math.abs(dr))}${sfx} vs last time</span>`;
    else foot = '<span>Matched last time</span>';
  }

  return `<section class="card ex">${head}${nudge}
    <div class="set hdr"><span>Set</span>${isW ? `<span>${unitLbl}</span>` : '<span></span>'}<span>${ex.t === 't' ? 'sec' : 'reps'}</span><span></span></div>
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
    if (j >= 0) prs.push([ex.n, fmtSet(ex.t, ex.sets[j])]);
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
    if (metric === 'w') { const t = topSet(ex); y = n(t.w); lbl = fmtSet(ex.t, t); }
    else if (metric === 'e') { y = Math.round(bestE1(ex)); lbl = `${y} ${unit()} est.`; }
    else if (metric === 'r') { const t = topSet(ex); y = n(t.r); lbl = fmtSet(ex.t, t); }
    else if (metric === 'dist') { y = n(ex.run.dist); lbl = fmtRun(ex); }
    else if (metric === 'pace') { y = paceOf(ex.run) / 60; lbl = fmtRun(ex); }
    else if (metric === 'count') { y = n(ex.run.count); lbl = fmtRun(ex); }
    return { x: s.start, date: s.date, y, lbl, id: s.id };
  }).filter(p => p.y > 0);
}
const defMetric = t => (t === 'w' ? 'w' : t === 'run' ? 'dist' : t === 'strides' ? 'count' : 'r');

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
  const metrics = t === 'w' ? [['w', 'Top set'], ['e', 'Est. 1RM']] : t === 'run' ? [['dist', 'Distance'], ['pace', 'Pace']] : [];
  const m = metrics.some(x => x[0] === ui.metric) ? ui.metric : defMetric(t);
  const pts = series(def.k, m), H = hist(def.k);
  const lastP = pts.at(-1), firstP = pts[0];
  const fmtY = y => (m === 'pace' ? fmtDur(y * 60) : fw(Math.round(y * 10) / 10));
  const yUnit = { w: unit(), e: unit(), r: t === 't' ? 'sec' : 'reps', dist: 'mi', pace: '/mi', count: 'strides' }[m];

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
    for (const h of H) { const s = topSet(h.ex); if (!best || (t === 'w' ? n(s.w) > n(best.w) || (n(s.w) === n(best.w) && n(s.r) > n(best.r)) : n(s.r) > n(best.r) || (n(s.r) === n(best.r) && n(s.w) > n(best.w)))) { best = s; bestEx = h; } }
    tiles.push([best ? fmtSet(t, best) : '—', `PR · ${bestEx ? shortDate(bestEx.s.date) : ''}`]);
    if (t === 'w') tiles.push([Math.round(Math.max(0, ...H.map(h => bestE1(h.ex)))) || '—', `Est. 1RM ${unit()}`]);
    tiles.push([H.length, 'Sessions']);
  }

  const recent = H.slice(-10).reverse().map(({ s, ex }) => {
    const pr = ex.run ? runPRs(ex, s.start).length : ex.sets.some((_, j) => isPR(ex, j, s.start));
    return `<button class="hrow" data-act="open-session" data-id="${s.id}"><span class="muted">${fmtDate(s.date)}</span>
      <span>${esc(ex.run ? fmtRun(ex) : fmtSets(ex.t, doneSets(ex)))}${pr ? ' <b class="pr">PR</b>' : ''}</span></button>`;
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
  const m = (def.t === 'w' && ui.metric === 'e') ? 'e' : (def.t === 'run' && ui.metric === 'pace') ? 'pace' : defMetric(def.t);
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
    const sets = s.ex.reduce((a, ex) => a + doneSets(ex).length, 0);
    const run = s.ex.find(ex => ex.run && hasData(ex));
    const prs = s.ex.reduce((a, ex) => a + (ex.run ? runPRs(ex, s.start).length : (ex.sets.some((_, j) => isPR(ex, j, s.start)) ? 1 : 0)), 0);
    const d = fromDk(s.date);
    out += `<button class="srow" data-act="open-session" data-id="${s.id}">
      <span class="sday"><b>${d.getDate()}</b><small>${d.toLocaleDateString(undefined, { weekday: 'short' })}</small></span>
      <span class="pname">${esc(s.title)}<small>${mins(s.end - s.start)} min${sets ? ` · ${sets} sets` : ''}${run ? ` · ${esc(fmtRun(run))}` : ''}</small></span>
      ${prs ? `<b class="pr">${prs} PR</b>` : ''}${I.chev}</button>`;
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

function openAddExercise() {
  const names = [...catalog().values()].filter(d => !['run', 'strides'].includes(d.t)).map(d => d.n);
  ui.sheet = [];
  $sheet.innerHTML = `<div class="sheet-bg" data-act="sheet-x"></div><form class="sheet-panel" id="add-form">
    <p class="eyebrow center">Add exercise</p>
    <input class="text-in" name="n" list="ex-names" placeholder="Exercise name" autocomplete="off" required>
    <datalist id="ex-names">${names.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <div class="seg" id="add-type"><button type="button" class="on" data-v="w">Weight</button><button type="button" data-v="bw">Bodyweight</button><button type="button" data-v="t">Time</button></div>
    <button class="btn primary xl" type="submit">Add</button>
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
    const k = known?.k || 'c:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const w = cur();
    w.ex.push(newEx({ k, n: known?.n || name, t, sets: known?.sets || 3, target: known?.target || '', rest: known?.rest ?? 90 }, w.start));
    closeSheet(); persist(); render();
    requestAnimationFrame(() => scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  });
  setTimeout(() => f.n.focus(), 50);
}

function openSettings() {
  const st = S.settings;
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${st[key] === v ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  ui.sheet = [];
  $sheet.innerHTML = `<div class="sheet-bg" data-act="sheet-x"></div><div class="sheet-panel">
    <p class="eyebrow center">Settings</p>
    <p class="lbl">Appearance</p>${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}
    <p class="lbl">Units</p>${seg('unit', [['lb', 'lb'], ['kg', 'kg']])}
    <p class="lbl">Rest timer after each set</p>${seg('rest', [[true, 'On'], [false, 'Off']])}
    <p class="lbl">Backup · ${S.sessions.length} workouts saved on this device</p>
    <div class="row2"><button class="btn ghost" data-act="export">Export</button><button class="btn ghost" data-act="import">Import</button></div>
    <button class="sheet-btn cancel" data-act="sheet-x">Close</button></div>`;
  $sheet.classList.add('open');
}

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
function renderRest() {
  const r = ui.rest;
  if (!r || ui.screen !== 'workout' || ui.edit) { $rest.className = ''; $rest.innerHTML = ''; return; }
  const left = Math.ceil((r.end - Date.now()) / 1000);
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
      S.sessions.push(...add); sortSessions(); save();
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
  tab: b => { ui.tab = b.dataset.v; ui.screen = null; render(); scrollTo(0, 0); },
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
    else openSheet(S.active.title, [{ label: 'Discard workout', danger: true, fn: () => {
      if (!confirm('Discard this workout? Nothing will be saved.')) return;
      S.active = null; ui.rest = null; save(); ui.screen = null; render();
    } }]);
  },
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
    const items = [{ label: 'Skip exercise', fn: () => { ex.skip = true; } }];
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
  'rest-add': () => { if (ui.rest) { ui.rest.end = Math.max(ui.rest.end, Date.now()) + 30000; ui.rest.total += 30; ui.rest.rung = false; renderRest(); } },
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
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

// test hook
window.__wt = { get S() { return S; }, ui, render, save, reload: () => { S = load(); render(); } };
