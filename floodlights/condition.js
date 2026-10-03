// Floodlights player condition and travel maths. Pure functions, no server state, no DOM.
// The server requires this file; floodlights/test_condition.js checks it without booting anything.
//
// Effective OVR = base rating + form + morale + home or away (with a personal offset) + travel + injury return.
// Form and morale live on the player as fm and mo (only when not zero, to keep the save small).
// Injury return is ret (weeks left) and retN (weeks in total). Event effects with a duration sit on the club
// as fx entries: { ids: [playerIds] or "all", f, m, until: round }.

const T = {
  FORM_MAX: 3, MORALE_MAX: 2,
  HOME: 1, AWAY: -1, ANALYST_HOME: 1, PERSONAL_STEP: 0.5,
  RET_PENALTY: 5, RET_WEEKS: 5, RET_WEEKS_PHYSIO: 3,
  WIN_FORM: 1, BIG_WIN_FORM: 2, LOSS_FORM: -1, BIG_LOSS_FORM: -2, BIG_MARGIN: 3, FORM_DRIFT_P: 0.35,
  WIN_MORALE: 0.3, LOSS_MORALE: -0.3, MORALE_DRIFT: 0.1, SIGN_MORALE: 1, LISTED_MORALE: -1, LOAN_OUT_MORALE: -0.5,
  EVENT_P1: 0.15, EVENT_P2: 0.08, NEWS_CAP: 10, FX_CAP: 8,
  LONG_HAUL_KM: 2500, LONG_HAUL: -0.5, SHORT_TRIP_KM: 400,
  SUB_WEIGHTS: [0.07, 0.16, 0.34, 0.27, 0.11, 0.05], SUB_EARLIEST: 46, SUB_LATEST: 85,
  BENCH_GRACE: 1, BENCH_MORALE: -0.25, BENCH_STAR: -0.4, BENCH_KID: -0.15, STAR_RATING: 84, KID_AGE: 20, PLAYED_MORALE: 0.05, FULL_MINUTES: 60,
  OVR_MIN: 30, OVR_MAX: 99
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r1 = v => Math.round(v * 10) / 10;
const r3 = v => Math.round(v * 1000) / 1000;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

// ---------- the personal home or away offset: seeded from the player, never stored, never rerolled ----------
function personalOffset(p) {
  const h = hashStr(String(p.id) + "|" + String(p.name || ""));
  return ((h % 5) - 2) * T.PERSONAL_STEP; // -1, -0.5, 0, 0.5 or 1
}
// at home the offset helps, away it hurts: a strong traveller (positive) loses less away and gains less at home
function homeAway(p, home, analyst) {
  const off = personalOffset(p);
  if (home) return T.HOME - off * 0.5 + (analyst ? T.ANALYST_HOME : 0);
  return T.AWAY + off;
}

function injuryReturn(p) {
  if (!(p.ret > 0) || !(p.retN > 0)) return 0;
  return -T.RET_PENALTY * p.ret / p.retN;
}
function startInjuryReturn(p, physio) {
  p.retN = physio ? T.RET_WEEKS_PHYSIO : T.RET_WEEKS;
  p.ret = p.retN;
}
function healInjuryReturn(p) {
  if (p.ret > 0) { p.ret--; if (p.ret <= 0) { delete p.ret; delete p.retN; } }
}

// ---------- event effects with a duration ----------
function activeFx(club, p, round) {
  let f = 0, m = 0;
  for (const e of (club && club.fx) || []) {
    if (e.until < round) continue;
    if (e.ids !== "all" && !e.ids.includes(p.id)) continue;
    f += e.f || 0; m += e.m || 0;
  }
  return { f, m };
}
function pruneFx(club, round) {
  if (!club || !club.fx) return;
  club.fx = club.fx.filter(e => e.until >= round).slice(-T.FX_CAP);
  if (!club.fx.length) delete club.fx;
}

// ---------- the number everything plays with ----------
// ctx: { home: bool, analyst: bool, travel: number, club: club object or null, round: number, neutral: bool }
function effOvr(p, ctx) {
  ctx = ctx || {};
  const fx = ctx.club ? activeFx(ctx.club, p, ctx.round || 0) : { f: 0, m: 0 };
  const form = clamp((p.fm || 0) + fx.f, -T.FORM_MAX, T.FORM_MAX);
  const morale = clamp((p.mo || 0) + fx.m, -T.MORALE_MAX, T.MORALE_MAX);
  let v = p.rating + form + morale + injuryReturn(p);
  if (!ctx.neutral) v += homeAway(p, !!ctx.home, !!ctx.analyst) + (ctx.travel || 0);
  return clamp(v, T.OVR_MIN, T.OVR_MAX);
}
function parts(p, club, round) {
  const fx = club ? activeFx(club, p, round || 0) : { f: 0, m: 0 };
  return {
    form: clamp((p.fm || 0) + fx.f, -T.FORM_MAX, T.FORM_MAX),
    morale: r1(clamp((p.mo || 0) + fx.m, -T.MORALE_MAX, T.MORALE_MAX)),
    ret: injuryReturn(p),
    traveller: personalOffset(p)
  };
}

// ---------- form and morale after results ----------
function setForm(p, v) { v = r1(clamp(v, -T.FORM_MAX, T.FORM_MAX)); if (v) p.fm = v; else delete p.fm; }
function setMorale(p, v) { v = Math.round(clamp(v, -T.MORALE_MAX, T.MORALE_MAX) * 100) / 100; if (v) p.mo = v; else delete p.mo; }
function bumpMorale(p, d) { setMorale(p, (p.mo || 0) + d); }
function bumpForm(p, d) { setForm(p, (p.fm || 0) + d); }
// everyone who played: up on a win, more on a big one, down on a loss, more on a thrashing.
// Entries are players (a full match) or { p, min } so a sub who came on late gets a smaller swing.
function applyResult(list, gf, ga) {
  const margin = gf - ga;
  let f = 0, m = 0;
  if (margin > 0) { f = margin >= T.BIG_MARGIN ? T.BIG_WIN_FORM : T.WIN_FORM; m = T.WIN_MORALE; }
  else if (margin < 0) { f = -margin >= T.BIG_MARGIN ? T.BIG_LOSS_FORM : T.LOSS_FORM; m = T.LOSS_MORALE; }
  for (const e of list) {
    if (!e) continue;
    const p = e.p || e;
    const share = e.p ? clamp((e.min || 0) / 90, 0.1, 1) : 1;
    if (f) bumpForm(p, f * share);
    if (m) bumpMorale(p, m * share);
  }
}

// ---------- subs and playing time ----------
// how many subs a match brings: zero to five, mostly two or three
function rollSubCount(rng) {
  const r = (rng || Math.random)();
  let acc = 0;
  for (let i = 0; i < T.SUB_WEIGHTS.length; i++) { acc += T.SUB_WEIGHTS[i]; if (r < acc) return i; }
  return T.SUB_WEIGHTS.length - 1;
}
const LINE = p => (p.pos === "GK" ? "GK" : p.pos === "DF" ? "DF" : p.pos === "FW" ? "FW" : "MF");
// picks who comes off and who comes on. xi and bench are player objects, eff gives a player's number today.
// returns [{ off, on, min }] where min is the minute the change happens
function pickSubs(xi, bench, rng, eff) {
  const r = rng || Math.random;
  const val = eff || (p => p.rating);
  const want = rollSubCount(r);
  const out = [];
  if (!want || !bench.length) return out;
  const avg = xi.reduce((s, p) => s + p.rating, 0) / (xi.length || 1);
  const offPool = xi.filter(p => p.pos !== "GK");
  const onPool = bench.filter(p => p.pos !== "GK");
  const used = new Set();
  for (let i = 0; i < want && offPool.length && onPool.length; i++) {
    // tired or out of form starters are the likely ones to come off
    const scored = offPool.map(p => ({ p, w: 1 + Math.max(0, -(p.fm || 0)) * 0.6 + (p.rating < avg ? 0.5 : 0) + r() * 1.2 }));
    scored.sort((a, b) => b.w - a.w);
    const off = scored[0].p;
    const line = LINE(off);
    let cands = onPool.filter(p => !used.has(p.id) && LINE(p) === line);
    if (!cands.length) cands = onPool.filter(p => !used.has(p.id));
    if (!cands.length) break;
    cands.sort((a, b) => (val(b) + r() * 3) - (val(a) + r() * 3));
    const on = cands[0];
    used.add(on.id);
    offPool.splice(offPool.indexOf(off), 1);
    out.push({ off, on, min: T.SUB_EARLIEST + Math.floor(r() * (T.SUB_LATEST - T.SUB_EARLIEST + 1)) });
  }
  out.sort((a, b) => a.min - b.min);
  return out;
}
// the eleven plus the subs as { p, min, start } so strength and form can weigh minutes
function participants(xi, subs) {
  const mins = new Map();
  for (const p of xi) mins.set(p.id, { p, min: 90, start: true });
  for (const sb of subs || []) {
    const off = mins.get(sb.off.id);
    if (off) off.min = sb.min;
    mins.set(sb.on.id, { p: sb.on, min: 90 - sb.min, start: false });
  }
  return [...mins.values()];
}
// appearances, kept as a tiny array on the player: starts, sub appearances, minutes
function recordAppearance(p, start, min) {
  const a = p.ap || [0, 0, 0];
  if (start) a[0]++; else a[1]++;
  a[2] += min;
  p.ap = a;
}
// playing time and morale after a match: starters who played hold or rise, subs stay level, those left
// out start sinking after a week on the bench, stars sink fastest, kids barely notice
function playingTime(p, minutes) {
  if (minutes > 0) {
    delete p.bn;
    if (minutes >= T.FULL_MINUTES) bumpMorale(p, T.PLAYED_MORALE);
    return 0;
  }
  p.bn = (p.bn || 0) + 1;
  if (p.bn <= T.BENCH_GRACE) return 0;
  const d = p.age <= T.KID_AGE ? T.BENCH_KID : p.rating >= T.STAR_RATING ? T.BENCH_STAR : T.BENCH_MORALE;
  bumpMorale(p, d);
  return d;
}
// everyone drifts back toward zero when nothing happens: form fast and a little random, morale slow and steady
function drift(p, rng) {
  if (p.fm && (rng || Math.random)() < T.FORM_DRIFT_P) setForm(p, p.fm - Math.sign(p.fm));
  if (p.mo) {
    const next = Math.abs(p.mo) <= T.MORALE_DRIFT ? 0 : p.mo - Math.sign(p.mo) * T.MORALE_DRIFT;
    setMorale(p, next);
  }
}

// ---------- unexpected events ----------
// returns how many events fire this week for one club: 0, 1 or 2
function rollEventCount(rng) {
  const r = rng || Math.random;
  if (r() >= T.EVENT_P1) return 0;
  return r() < T.EVENT_P2 ? 2 : 1;
}
// picks the targets and writes the news line. squad is the list of senior players at the club.
function applyEvent(ev, club, squad, round, rng) {
  const r = rng || Math.random;
  const pick = arr => arr[Math.floor(r() * arr.length)];
  if (!squad.length) return null;
  let targets;
  if (ev.who === "squad") targets = squad.slice();
  else if (ev.who === "gk") { const gks = squad.filter(p => p.pos === "GK"); targets = [gks.length ? pick(gks) : pick(squad)]; }
  else if (ev.who === "few") {
    const pool = squad.slice();
    targets = [];
    const n = Math.min(pool.length, 2 + Math.floor(r() * 3));
    for (let i = 0; i < n; i++) targets.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  } else targets = [pick(squad)];
  const names = targets.map(p => p.name);
  const text = String(ev.t)
    .replace(/\{p\}/g, names[0])
    .replace(/\{q\}/g, names[1] || names[0])
    .replace(/\{n\}/g, String(names.length));
  if (ev.w > 0) {
    club.fx = club.fx || [];
    club.fx.push({ ids: ev.who === "squad" ? "all" : targets.map(p => p.id), f: ev.f || 0, m: ev.m || 0, until: round + ev.w - 1 });
    club.fx = club.fx.slice(-T.FX_CAP);
  } else {
    for (const p of targets) { if (ev.f) bumpForm(p, ev.f); if (ev.m) bumpMorale(p, ev.m); }
  }
  return { text, ids: targets.map(p => p.id), f: ev.f || 0, m: ev.m || 0, w: ev.w || 0 };
}
function addNews(club, round, text) {
  club.news = club.news || [];
  club.news.unshift({ w: round, t: text });
  club.news = club.news.slice(0, T.NEWS_CAP);
}

// ---------- travel ----------
function haversine(a, b) {
  const R = 6371, toR = d => d * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
// prices in pounds thousands for the whole travelling party, turned into millions with three decimals
const K = v => r3(v / 1000);
function transportOptions(km) {
  if (km < T.SHORT_TRIP_KM) {
    return [
      { key: "bus", label: "Team bus", price: K(3 + km * 0.015), mod: -1 },
      { key: "train", label: "Train, first class", price: K(5 + km * 0.025), mod: -0.5 }
    ];
  }
  const eco = 12 + km * 0.011;
  return [
    { key: "eco", label: "Flight, economy", price: K(eco), mod: -1 },
    { key: "prem", label: "Flight, premium", price: K(eco * 1.9), mod: 0 },
    { key: "biz", label: "Flight, business", price: K(eco * 3.2), mod: 0.5 }
  ];
}
function hotelOptions(km, hotels) {
  const nights = km >= T.LONG_HAUL_KM ? 2 : 1;
  const tiers = [["budget", 7, -0.75], ["standard", 16, 0], ["luxury", 40, 0.5]];
  return tiers.map(([tier, k, mod], i) => ({ key: tier, name: (hotels && hotels[i]) || tier, price: K(k * nights), mod, nights }));
}
function longHaul(km, transportKey) {
  return km >= T.LONG_HAUL_KM && transportKey !== "biz" ? T.LONG_HAUL : 0;
}
// the away match modifier from a booking: { t: transport key, h: hotel key }
function tripModifier(km, booking) {
  const tr = transportOptions(km), ho = hotelOptions(km);
  const t = booking && tr.find(o => o.key === booking.t) || tr[0];
  const h = booking && ho.find(o => o.key === booking.h) || ho[0];
  return Math.round((t.mod + h.mod + longHaul(km, t.key)) * 4) / 4;
}
function tripPrice(km, booking) {
  const tr = transportOptions(km), ho = hotelOptions(km);
  const t = booking && tr.find(o => o.key === booking.t) || tr[0];
  const h = booking && ho.find(o => o.key === booking.h) || ho[0];
  return r3(t.price + h.price);
}
// the three plain policies plus smart (hard away games get the money)
function policyBooking(km, policy) {
  const tr = transportOptions(km);
  if (policy === "luxury") return { t: tr[tr.length - 1].key, h: "luxury" };
  if (policy === "standard") return { t: tr.length === 3 ? "prem" : "train", h: "standard" };
  return { t: tr[0].key, h: "budget" };
}
// AI clubs travel by the size of their budget, no booking UI
function aiTravelModifier(baseBudget, km) {
  const policy = baseBudget >= 100 ? "luxury" : baseBudget >= 35 ? "standard" : "cheap";
  return tripModifier(km, policyBooking(km, policy));
}
// trips: [{ id, km, hard }] where hard is the opponent strength. fund in millions.
function smartFill(trips, fund) {
  const out = {};
  let left = fund;
  for (const t of trips) { out[t.id] = policyBooking(t.km, "cheap"); left -= tripPrice(t.km, out[t.id]); }
  if (left <= 0) return { bookings: out, left: r3(left) };
  const byHard = trips.slice().sort((a, b) => (b.hard || 0) - (a.hard || 0));
  const top = byHard.slice(0, Math.max(1, Math.round(byHard.length * 0.3)));
  for (const t of top) {
    const up = policyBooking(t.km, "luxury"), delta = tripPrice(t.km, up) - tripPrice(t.km, out[t.id]);
    if (delta <= left) { out[t.id] = up; left -= delta; }
  }
  for (const t of byHard) {
    if (out[t.id].h === "luxury") continue;
    const up = policyBooking(t.km, "standard"), delta = tripPrice(t.km, up) - tripPrice(t.km, out[t.id]);
    if (delta <= left) { out[t.id] = up; left -= delta; }
  }
  return { bookings: out, left: r3(left) };
}
function bulkCost(trips, policy) {
  return r3(trips.reduce((s, t) => s + tripPrice(t.km, policyBooking(t.km, policy)), 0));
}
// what the financial advisor suggests: standard travel for every known trip plus a cushion, within reason
function recommendFund(budget, trips) {
  const standard = bulkCost(trips, "standard");
  const cheap = bulkCost(trips, "cheap");
  const want = r1(standard * 1.15);
  const cap = r1(Math.max(cheap, budget * 0.12));
  return { recommend: Math.max(0.1, Math.min(want, cap)), cheap, standard, luxury: bulkCost(trips, "luxury") };
}

module.exports = {
  T, clamp, r1, r3, hashStr, personalOffset, homeAway, injuryReturn, startInjuryReturn, healInjuryReturn,
  activeFx, pruneFx, effOvr, parts, setForm, setMorale, bumpForm, bumpMorale, applyResult, drift,
  rollSubCount, pickSubs, participants, recordAppearance, playingTime,
  rollEventCount, applyEvent, addNews,
  haversine, transportOptions, hotelOptions, longHaul, tripModifier, tripPrice, policyBooking, aiTravelModifier, smartFill, bulkCost, recommendFund
};
