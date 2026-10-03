// Floodlights condition battery. Run: node floodlights/test_condition.js
// Pure checks of condition.js, the event pool and the travel dataset. No server, no browser.
const fs = require("fs");
const path = require("path");
const here = f => path.join(__dirname, f);
const C = require("./condition");
const { EVENTS } = require("./events_data");
const { TRAVEL } = require("./travel_data");
const { buildDatabase } = require("./players");
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); }
}
function seeded(s) { let x = s >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return (x + 0.5) / 4294967296; }; }
const EM = String.fromCharCode(8212), EN = String.fromCharCode(8211);

// ---------- files ----------
for (const f of ["condition.js", "events_data.js", "travel_data.js"]) {
  const t = fs.readFileSync(here(f), "utf8");
  ok(f + " has no em or en dashes", !t.includes(EM) && !t.includes(EN), null);
}
const serverText = fs.readFileSync(here("server.js"), "utf8");
ok("the server requires the condition maths, the events and the travel data", serverText.includes('require("./condition")') && serverText.includes('require("./events_data")') && serverText.includes('require("./travel_data")'), null);
ok("sim to an arbitrary week no longer exists on the server", !serverText.includes('"/api/simto"') && serverText.includes('"/api/simseason"'), null);
ok("the server has the travel fund and booking routes and the loan cap", serverText.includes('"/api/travelfund"') && serverText.includes('"/api/travelbook"') && serverText.includes("One loan in per week"), null);

// ---------- effective OVR ----------
const P = (id, rating, extra) => Object.assign({ id, name: "Player " + id, rating, pos: "MF" }, extra || {});
const neutral = { neutral: true };
ok("base OVR with nothing on it is the rating", C.effOvr(P(1, 80), neutral) === 80, C.effOvr(P(1, 80), neutral));
ok("form and morale stack simply: form +3 with morale -1 is net +2", C.effOvr(P(1, 80, { fm: 3, mo: -1 }), neutral) === 82, null);
ok("form is capped at plus or minus 3 and morale at plus or minus 2", C.effOvr(P(1, 80, { fm: 9, mo: 9 }), neutral) === 85 && C.effOvr(P(1, 80, { fm: -9, mo: -9 }), neutral) === 75, null);
ok("setForm and setMorale clamp and drop zeros so the save stays small", (() => { const p = P(1, 80); C.setForm(p, 7); C.setMorale(p, -4); const a = p.fm === 3 && p.mo === -2; C.setForm(p, 0); C.setMorale(p, 0); return a && !("fm" in p) && !("mo" in p); })(), null);
ok("the whole number is clamped to 30 and 99", C.effOvr(P(1, 99, { fm: 3, mo: 2 }), neutral) === 99 && C.effOvr(P(1, 31, { fm: -3, mo: -2 }), neutral) === 30, null);

// home and away with the personal offset
const pA = P(7, 80), pB = P(8, 80), pC = P(9, 80);
const offs = [pA, pB, pC].map(C.personalOffset);
ok("the personal offset is one of five steps between minus 1 and plus 1", offs.every(o => [-1, -0.5, 0, 0.5, 1].includes(o)), offs);
ok("the offset is seeded from the player and never changes", C.personalOffset(pA) === C.personalOffset({ id: 7, name: "Player 7", rating: 50 }) && C.personalOffset(pA) === C.personalOffset(pA), null);
{
  const many = [];
  for (let i = 0; i < 400; i++) many.push(C.personalOffset(P(i, 70)));
  const kinds = new Set(many);
  ok("across a squad there are strong travellers and homebodies", kinds.size === 5, [...kinds]);
}
ok("home is roughly plus 1 and away roughly minus 1", C.homeAway(P(100, 80), true) > 0 && C.homeAway(P(100, 80), false) < 0, [C.homeAway(P(100, 80), true), C.homeAway(P(100, 80), false)]);
{
  const strong = [], home = [];
  for (let i = 0; i < 200; i++) { const p = P(i, 70); if (C.personalOffset(p) === 1) strong.push(p); if (C.personalOffset(p) === -1) home.push(p); }
  ok("a strong traveller loses nothing away, a homebody loses two", strong.length && home.length && C.homeAway(strong[0], false) === 0 && C.homeAway(home[0], false) === -2, [strong.length, home.length]);
  ok("the homebody gets more out of playing at home than the traveller", C.homeAway(home[0], true) > C.homeAway(strong[0], true), null);
}
ok("the match analyst adds an extra plus 1 at home and nothing away", C.homeAway(P(100, 80), true, true) - C.homeAway(P(100, 80), true, false) === 1 && C.homeAway(P(100, 80), false, true) === C.homeAway(P(100, 80), false, false), null);
ok("the full formula: base plus form plus morale plus home plus travel plus injury return", (() => {
  const p = P(100, 80, { fm: 2, mo: 1 });
  const expect = 80 + 2 + 1 + C.homeAway(p, false, false) + (-1.25);
  return Math.abs(C.effOvr(p, { home: false, travel: -1.25 }) - expect) < 1e-9;
})(), null);

// ---------- injury return ----------
{
  const p = P(5, 80);
  C.startInjuryReturn(p, false);
  ok("a player back from injury starts at minus 5", C.injuryReturn(p) === -5 && p.ret === 5 && p.retN === 5, p);
  const steps = [];
  for (let w = 0; w < 6; w++) { C.healInjuryReturn(p); steps.push(C.injuryReturn(p)); }
  ok("the knock heals by one a week over five weeks and then is gone", steps.join() === "-4,-3,-2,-1,0,0" && !("ret" in p), steps);
  const q = P(6, 80);
  C.startInjuryReturn(q, true);
  const qN = q.retN;
  const qs = [C.injuryReturn(q)];
  for (let w = 0; w < 3; w++) { C.healInjuryReturn(q); qs.push(C.injuryReturn(q)); }
  ok("with a head physio the same minus 5 heals in three weeks", qN === 3 && Math.abs(qs[0] + 5) < 1e-9 && Math.abs(qs[1] + 10 / 3) < 1e-9 && Math.abs(qs[2] + 5 / 3) < 1e-9 && qs[3] === 0, qs);
  ok("the knock shows in the effective OVR", C.effOvr(Object.assign(P(7, 80), { ret: 2, retN: 5 }), neutral) === 78, null);
}

// ---------- form and morale after results ----------
{
  const always = () => 0, never = () => 0.99;
  const xi = []; for (let i = 0; i < 11; i++) xi.push(P(i, 75));
  C.applyResult(xi, 2, 1, always);
  ok("a win nudges form up a small step and morale a touch", xi.every(p => p.fm === C.T.WIN_FORM && p.mo === C.T.WIN_MORALE), xi[0]);
  const rare = []; for (let i = 0; i < 11; i++) rare.push(P(50 + i, 75));
  C.applyResult(rare, 2, 1, never);
  ok("on an off day a win does not lift form at all, only a touch of morale", rare.every(p => !p.fm && p.mo === C.T.WIN_MORALE), rare[0]);
  ok("a win lifts form only on some days", C.T.WIN_CHANCE > 0.3 && C.T.WIN_CHANCE < 0.8, C.T.WIN_CHANCE);
  const big = P(70, 75); C.applyResult([big], 4, 0, always);
  ok("a thrashing gives a bigger nudge than a narrow win", big.fm === C.T.BIG_WIN_FORM && big.fm > C.T.WIN_FORM, big.fm);
  const high = P(71, 75, { fm: 2.5 }); C.applyResult([high], 2, 0, always);
  ok("the closer to the top, the smaller the gain", high.fm - 2.5 < 0.1 && high.fm >= 2.5 && C.T.WIN_FORM * Math.pow(1 - 2.5 / 3, C.T.GAIN_DAMP) < 0.05, high.fm);
  const fromUp = P(72, 75, { fm: 0.4 }); C.applyResult([fromUp], 0, 4, always);
  ok("a heavy loss bites harder than a win helps: form drops far more than it rose", fromUp.fm === Math.round((0.4 + C.T.BIG_LOSS_FORM) * 10) / 10, fromUp.fm);
  ok("losing is sharper than winning in the numbers themselves", -C.T.LOSS_FORM > 2 * C.T.WIN_FORM && -C.T.BIG_LOSS_FORM > 2 * C.T.BIG_WIN_FORM && -C.T.LOSS_MORALE > 2 * C.T.WIN_MORALE, null);
  {
    const hot = P(97, 75);
    const steps = [];
    for (let w = 0; w < 10; w++) { C.applyResult([hot], 2, 0, always); C.drift(hot); steps.push(hot.fm); }
    ok("ten straight wins, every one lifting form, only nudge it to about +1, nowhere near the +3 cap", steps[0] < 0.5 && steps[4] > steps[0] && steps[9] >= 0.7 && steps[9] <= 1.4, steps);
    C.applyResult([hot], 0, 2, always);
    ok("one bad day wipes the streak out quickly", (hot.fm || 0) <= steps[9] - 0.79, [steps[9], hot.fm]);
    const held = P(96, 75, { fm: 3 });
    C.applyResult([held], 1, 0, always); C.drift(held);
    ok("a player at +3 slides back down even while winning", held.fm < 3 && held.fm >= 2.2, held.fm);
    C.drift(held);
    ok("a week without a win pulls him further off the top", held.fm < 2.3, held.fm);
    const playing = P(95, 75, { fm: -2, mo: -1 }), benched = P(94, 75, { fm: -2, mo: -1, bn: 4 });
    C.drift(playing); C.drift(benched);
    ok("a player who is playing shakes off a bad spell faster than a benched one", playing.fm > benched.fm && playing.mo > benched.mo, [playing.fm, benched.fm, playing.mo, benched.mo]);
    const lowLoss = P(93, 75, { fm: -2 }); C.applyResult([lowLoss], 0, 1, always);
    ok("a loss when already low digs in less than a loss from the top", -2 - lowLoss.fm < -C.T.LOSS_FORM, lowLoss.fm);
  }
  const q = P(99, 75, { fm: 3, mo: 2 });
  const far = [];
  for (let w = 0; w < 40; w++) { const before = q.fm || 0; C.drift(q); far.push(before - (q.fm || 0)); }
  ok("with nothing happening form and morale drift back to zero", !q.fm && !q.mo, q);
  ok("the pull back is stronger the further out he is", far[0] > far[3] && far[3] >= far[6], far.slice(0, 8));
  const slow = P(98, 75, { mo: 2 }); C.drift(slow);
  const fastF = P(95, 75, { fm: 2 }); C.drift(fastF);
  ok("morale drifts slower than form", (2 - slow.mo) < (2 - fastF.fm), [slow.mo, fastF.fm]);
  ok("hard caps hold at the formula level whatever is stacked on", (() => { const z = P(94, 75); C.bumpForm(z, 99); C.bumpMorale(z, 99); const hi = z.fm === 3 && z.mo === 2; C.bumpForm(z, -99); C.bumpMorale(z, -99); return hi && z.fm === -3 && z.mo === -2 && C.effOvr(P(93, 80, { fm: 50, mo: 50 }), neutral) === 85; })(), null);
}

// ---------- events ----------
const NEW_EVENTS = EVENTS.filter(e => e.h);
ok("the event pool holds the old 233 plus 200 more", EVENTS.length >= 433 && NEW_EVENTS.length >= 200, [EVENTS.length, NEW_EVENTS.length]);
ok("every event has a unique id and unique words", new Set(EVENTS.map(C.eventId)).size === EVENTS.length && new Set(EVENTS.map(e => e.t)).size === EVENTS.length, null);
ok("every new event has its own headline", new Set(NEW_EVENTS.map(e => e.h)).size === NEW_EVENTS.length && NEW_EVENTS.every(e => e.h.length >= 3 && e.h.length <= 26), null);
ok("every event says who it hits, what it does and how long", EVENTS.every(e => ["one", "few", "squad", "gk"].includes(e.who) && typeof e.t === "string" && e.t.length > 20 && (e.f !== undefined || e.m !== undefined || e.w !== undefined || e.inj !== undefined) && (e.w === undefined || [0, 1, 2, 3].includes(e.w)) && (e.f === undefined || Math.abs(e.f) <= 2) && (e.m === undefined || Math.abs(e.m) <= 2)), EVENTS.filter(e => !["one", "few", "squad", "gk"].includes(e.who)).slice(0, 2));
{
  const inj = EVENTS.filter(e => e.inj !== undefined);
  const span = e => (Array.isArray(e.inj) ? e.inj : [e.inj, e.inj]);
  ok("at least 40 off the pitch injury events with sensible lengths", inj.length >= 40 && inj.every(e => { const [a, b] = span(e); return Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b >= a && b <= 6; }), inj.length);
  ok("injury events name the length and only injury events do", inj.every(e => e.t.includes("{d}") && (e.who === "one" || e.who === "gk")) && EVENTS.filter(e => e.inj === undefined).every(e => !e.t.includes("{d}")), null);
  ok("the asked for injury stories are in the pool", ["kitchen|pan|toast|onion", "stairs", "dog", "gym|bench press|dumbbell", "shelves|DIY|hammer|ladder"].every(rx => inj.some(e => new RegExp(rx, "i").test(e.t + e.h))), null);
  const words = t => new Set(t.toLowerCase().replace(/\{.\}/g, "").replace(/[^a-z ]/g, " ").split(/\s+/).filter(w => w.length > 3));
  const W = EVENTS.map(e => words(e.t));
  let worst = 0;
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
    if (!EVENTS[i].h && !EVENTS[j].h) continue;
    let both = 0; for (const w of W[i]) if (W[j].has(w)) both++;
    worst = Math.max(worst, both / (W[i].size + W[j].size - both));
  }
  ok("no new event reads like a copy of another one", worst < 0.5, worst);
}
{
  const neg = EVENTS.filter(e => (e.f || 0) + (e.m || 0) < 0 || e.inj).length, pos = EVENTS.filter(e => (e.f || 0) + (e.m || 0) > 0).length;
  ok("the pool mixes bad, good and neutral news", neg >= 120 && pos >= 120, [neg, pos]);
}
ok("the asked for examples are in the pool", EVENTS.some(e => /left at the hotel/.test(e.t)) && EVENTS.some(e => /firecrackers/.test(e.t)) && EVENTS.some(e => /became a dad|newborn|baby arrived/.test(e.t)) && EVENTS.some(e => /bonding dinner/.test(e.t)) && EVENTS.some(e => /keeper did an interview trashing the coach/.test(e.t)), null);
{
  // frequency: one roll per club per week, so never two in a week, and about one every three to five weeks
  const rng = seeded(11);
  let total = 0, maxWeek = 0; const seasons = 3000; const gaps = []; let last = null, wk = 0;
  for (let i = 0; i < seasons; i++) for (let w = 0; w < 38; w++, wk++) {
    const n = C.rollEventCount(rng);
    total += n; maxWeek = Math.max(maxWeek, n);
    if (n) { if (last !== null) gaps.push(wk - last); last = wk; }
  }
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  console.log("events (pure roll): " + (total / seasons).toFixed(2) + " a club a season, one every " + avgGap.toFixed(2) + " weeks on average, at most " + maxWeek + " in a week");
  ok("a club gets one event every three to five weeks on average", avgGap >= 3 && avgGap <= 5, avgGap);
  ok("a week never brings more than one event for a club", maxWeek === 1 && C.T.EVENT_P2 === undefined, maxWeek);
  ok("the server rolls each club once a week and keeps a pending event for the week ahead", serverText.includes("function weeklyEvents(game)") && serverText.includes("pendEv") && !serverText.includes("rollEventCount") && serverText.includes("preRollEvent(game, user.team)"), null);
}
{
  const club = { name: "Test FC" };
  const squad = []; for (let i = 0; i < 20; i++) squad.push(P(i, 70, { pos: i === 0 ? "GK" : "MF" }));
  const squadEv = EVENTS.find(e => e.who === "squad" && e.w > 0 && e.m);
  const res = C.applyEvent(squadEv, club, squad, 10, seeded(4));
  ok("a squad event lands as a club wide effect with a duration", res && club.fx && club.fx.length === 1 && club.fx[0].ids === "all" && club.fx[0].until === 10 + squadEv.w - 1, club.fx);
  ok("the effect is live for the match it covers and gone after", C.activeFx(club, squad[3], 10).m === squadEv.m && C.activeFx(club, squad[3], 10 + squadEv.w).m === 0, null);
  C.pruneFx(club, 10 + squadEv.w);
  ok("old effects are pruned", !club.fx, club.fx);
  const oneEv = EVENTS.find(e => e.who === "one" && e.w === 0 && e.m);
  const r2 = C.applyEvent(oneEv, club, squad, 11, seeded(5));
  ok("a lingering event moves the player's own morale and names him in the news", r2 && !r2.text.includes("{p}") && squad.some(p => p.mo === oneEv.m) && r2.ids.length === 1, r2);
  const gkEv = EVENTS.find(e => e.who === "gk");
  const r3 = C.applyEvent(gkEv, club, squad, 12, seeded(6));
  ok("a keeper event hits the keeper", r3 && r3.ids[0] === 0, r3);
  for (let i = 0; i < 30; i++) C.addNews(club, i, "line " + i);
  ok("club news is capped so the save stays small", club.news.length === C.T.NEWS_CAP && club.news[0].t === "line 29", club.news.length);
  for (let i = 0; i < 20; i++) C.applyEvent(squadEv, club, squad, 20, seeded(i));
  ok("active effects are capped too", club.fx.length === C.T.FX_CAP, club.fx.length);
}

// ---------- travel ----------
const { clubs } = buildDatabase();
ok("every club in the world has a travel row", Object.keys(clubs).every(n => TRAVEL[n]) && Object.keys(TRAVEL).every(n => clubs[n]), Object.keys(clubs).filter(n => !TRAVEL[n]).slice(0, 5));
ok("every row has a city, a country, coordinates, an airport with a code and three named hotels", Object.values(TRAVEL).every(r => r.length === 9 && r[0] && r[1] && Math.abs(r[2]) <= 90 && Math.abs(r[3]) <= 180 && r[4] && /^[A-Z]{3}$/.test(r[5]) && r[6] && r[7] && r[8] && r[6] !== r[7] && r[7] !== r[8]), null);
const g = n => ({ lat: TRAVEL[n][2], lon: TRAVEL[n][3] });
const d = (a, b) => C.haversine(g(a), g(b));
ok("distances come out of the coordinates and look right", d("Arsenal", "Man City") > 240 && d("Arsenal", "Man City") < 280 && d("Real Madrid", "Barcelona") > 480 && d("Real Madrid", "Barcelona") < 530 && d("Inter Miami", "Seattle Sounders") > 4300, [d("Arsenal", "Man City"), d("Real Madrid", "Barcelona")]);
ok("short trips offer bus or train, long trips offer three flight classes", C.transportOptions(250).map(o => o.key).join() === "bus,train" && C.transportOptions(900).map(o => o.key).join() === "eco,prem,biz", null);
ok("prices rise with distance and class", C.transportOptions(900)[0].price < C.transportOptions(3000)[0].price && C.transportOptions(900)[0].price < C.transportOptions(900)[1].price && C.transportOptions(900)[1].price < C.transportOptions(900)[2].price && C.hotelOptions(500)[0].price < C.hotelOptions(500)[2].price, null);
ok("long haul needs two nights", C.hotelOptions(3000)[1].nights === 2 && C.hotelOptions(300)[1].nights === 1, null);
ok("the hotel options carry the real names in order budget, standard, luxury", C.hotelOptions(500, TRAVEL["Man City"].slice(6)).map(h => h.name).join("|") === TRAVEL["Man City"].slice(6).join("|"), null);
ok("better transport and hotels mean a better modifier, cheaper means worse", C.tripModifier(900, { t: "biz", h: "luxury" }) > C.tripModifier(900, { t: "prem", h: "standard" }) && C.tripModifier(900, { t: "prem", h: "standard" }) > C.tripModifier(900, { t: "eco", h: "budget" }) && C.tripModifier(250, { t: "train", h: "standard" }) > C.tripModifier(250, { t: "bus", h: "budget" }), null);
ok("a long haul in economy costs an extra half point, business class does not", C.tripModifier(3000, { t: "eco", h: "standard" }) === C.tripModifier(900, { t: "eco", h: "standard" }) - 0.5 && C.tripModifier(3000, { t: "biz", h: "standard" }) === C.tripModifier(900, { t: "biz", h: "standard" }), null);
ok("the modifier range is small next to base quality", C.tripModifier(3000, { t: "eco", h: "budget" }) >= -2.5 && C.tripModifier(900, { t: "biz", h: "luxury" }) <= 1.5, null);
ok("AI clubs travel by budget: rich clubs go luxury, poor clubs go cheap", C.aiTravelModifier(150, 900) > C.aiTravelModifier(50, 900) && C.aiTravelModifier(50, 900) > C.aiTravelModifier(10, 900), [C.aiTravelModifier(150, 900), C.aiTravelModifier(50, 900), C.aiTravelModifier(10, 900)]);
{
  const trips = [{ id: "a", km: 300, hard: 90 }, { id: "b", km: 1200, hard: 60 }, { id: "c", km: 800, hard: 85 }, { id: "d", km: 3000, hard: 70 }];
  const cheap = C.bulkCost(trips, "cheap"), standard = C.bulkCost(trips, "standard"), luxury = C.bulkCost(trips, "luxury");
  ok("bulk policies cost more as they get nicer", cheap < standard && standard < luxury, [cheap, standard, luxury]);
  const sf = C.smartFill(trips, standard);
  ok("smart fill spends on the hardest away game first and stays inside the fund", sf.bookings.a.h === "luxury" && sf.left >= 0 && Object.keys(sf.bookings).length === 4, sf);
  const tight = C.smartFill(trips, cheap);
  ok("smart fill with only the cheap money books everything cheap", Object.values(tight.bookings).every(b => b.h === "budget") && tight.left >= 0, tight);
  const adv = C.recommendFund(160, trips);
  ok("the advisor recommends about standard travel plus a cushion, within the budget", adv.recommend >= standard && adv.recommend <= 160 * 0.12 + 0.1 && adv.cheap === cheap && adv.luxury === luxury, adv);
  const poor = C.recommendFund(2, trips);
  ok("a poor club is told to set aside at least the cheapest way round", poor.recommend >= Math.min(cheap, 2 * 0.12), poor);
}

// ---------- subs and playing time ----------
{
  const rng = seeded(21);
  const cnt = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 30000; i++) cnt[C.rollSubCount(rng)]++;
  const share = cnt.map(c => c / 30000);
  ok("a match brings zero to five subs, mostly two or three", share[2] + share[3] >= 0.55 && share[2] > share[1] && share[3] > share[4] && share[0] > 0.03 && share[5] > 0.02 && share[5] < 0.08, share.map(x => x.toFixed(3)));
  const mk = (id, pos, r, fm) => ({ id, name: "P" + id, pos, rating: r, fm });
  const xi = [mk(0, "GK", 80), mk(1, "DF", 80), mk(2, "DF", 78), mk(3, "DF", 75, -3), mk(4, "DF", 80), mk(5, "MF", 82), mk(6, "MF", 70, -3), mk(7, "MF", 80), mk(8, "FW", 85), mk(9, "FW", 79), mk(10, "FW", 74, -2)];
  const bench = [mk(11, "GK", 70), mk(12, "DF", 76), mk(13, "MF", 77), mk(14, "FW", 78), mk(15, "MF", 72), mk(16, "FW", 70)];
  let posOk = 0, total = 0, gkOff = 0, offForm = 0, dup = 0, mins = true;
  for (let i = 0; i < 400; i++) {
    const subs = C.pickSubs(xi, bench, rng);
    const ons = new Set();
    for (const sb of subs) {
      total++;
      if (sb.off.pos === "GK" || sb.on.pos === "GK") gkOff++;
      if ((sb.off.pos === "DF" ? "DF" : sb.off.pos === "FW" ? "FW" : "MF") === (sb.on.pos === "DF" ? "DF" : sb.on.pos === "FW" ? "FW" : "MF")) posOk++;
      if ((sb.off.fm || 0) < 0) offForm++;
      if (ons.has(sb.on.id)) dup++; ons.add(sb.on.id);
      if (sb.min < 46 || sb.min > 85) mins = false;
    }
  }
  ok("subs come on for a player in the same line when one is free, never for the keeper", total > 500 && posOk / total > 0.85 && gkOff === 0, [posOk, total, gkOff]);
  ok("poor form starters are the ones who usually come off", offForm / total > 0.6, offForm / total);
  ok("a bench player comes on once and changes happen between the 46th and 85th minute", dup === 0 && mins, null);
  const parts = C.participants(xi, [{ off: xi[6], on: bench[2], min: 60 }, { off: xi[10], on: bench[3], min: 80 }]);
  ok("participants carry minutes: starters 90 unless subbed, subs the rest", parts.length === 13 && parts.find(e => e.p.id === 6).min === 60 && parts.find(e => e.p.id === 13).min === 30 && parts.find(e => e.p.id === 14).min === 10 && parts.find(e => e.p.id === 0).min === 90 && parts.find(e => e.p.id === 13).start === false, null);
  for (const e of parts) { delete e.p.fm; delete e.p.mo; }
  C.applyResult(parts, 0, 2);
  const full = parts.find(e => e.p.id === 0).p, sub10 = parts.find(e => e.p.id === 14).p, sub30 = parts.find(e => e.p.id === 13).p, off60 = parts.find(e => e.p.id === 6).p;
  ok("form swings scale with minutes: a full match gets the whole swing, a late sub a sliver", full.fm === -0.9 && sub30.fm === -0.3 && Math.abs(sub10.fm + 0.1) < 1e-9 && Math.abs(off60.fm + 0.6) < 1e-9, [full.fm, sub30.fm, sub10.fm, off60.fm]);
  for (const e of parts) C.recordAppearance(e.p, e.start, e.min);
  ok("appearances are kept as a tiny array: starts, sub games, minutes", full.ap.join() === "1,0,90" && sub30.ap.join() === "0,1,30" && off60.ap.join() === "1,0,60", null);
  const star = mk(50, "MF", 88), kid = mk(51, "MF", 70); kid.age = 19; const reg = mk(52, "MF", 78);
  const regTrail = [];
  for (let w = 0; w < 10; w++) { C.playingTime(star, 0); C.playingTime(kid, 0); C.playingTime(reg, 0); C.drift(star); C.drift(kid); C.drift(reg); regTrail.push((reg.mo || 0) + "|" + (reg.fm || 0)); }
  ok("not playing is gradual: two weeks barely felt, a month plus clearly negative, in both morale and form", regTrail[1] === "0|0" && (reg.mo || 0) <= -0.5 && (reg.fm || 0) <= -0.4, regTrail);
  ok("ten weeks on the bench sinks morale, stars fastest, kids least", star.mo < reg.mo && reg.mo < kid.mo && kid.mo < 0, [star.mo, reg.mo, kid.mo]);
  ok("rust on form has a floor", (() => { const r2 = mk(56, "MF", 80); for (let w = 0; w < 60; w++) { C.playingTime(r2, 0); } return r2.fm >= C.T.RUST_FORM_FLOOR - 0.3; })(), null);
  const rot = mk(53, "MF", 80);
  for (let w = 0; w < 10; w++) { C.playingTime(rot, 25); C.drift(rot); }
  ok("a rotation player who keeps coming on stays level", !rot.mo && !rot.bn, [rot.mo, rot.bn]);
  const starter = mk(54, "MF", 80);
  for (let w = 0; w < 10; w++) { C.playingTime(starter, 90); C.drift(starter); }
  ok("a regular starter holds steady or rises slowly", (starter.mo || 0) >= 0 && (starter.mo || 0) < 1, starter.mo);
  const back = mk(55, "MF", 80); for (let w = 0; w < 7; w++) { C.playingTime(back, 0); C.drift(back); }
  const low = back.mo;
  for (let w = 0; w < 8; w++) { C.playingTime(back, 90); C.applyResult([back], 1, 1); C.drift(back); }
  ok("playing again stops the slide at once and he climbs back toward level", !back.bn && low < -0.3 && (back.mo || 0) > low && (back.mo || 0) <= 0.6, [low, back.mo]);
  // five seasons of a made up 20 club league with a real strength spread: the league average stays put,
  // only a few players sit at the extremes, and the champions' regulars end slightly up, not maxed
  {
    const rng = seeded(77);
    const pois = l => { const L = Math.exp(-l); let k = 0, q = 1; do { k++; q *= rng(); } while (q > L); return k - 1; };
    const teams = []; let pid = 5000;
    for (let t = 0; t < 20; t++) {
      const base = 68 + Math.round(t * 0.8), sq = [];
      for (let i = 0; i < 24; i++) sq.push(Object.assign(mk(pid++, i === 0 || i === 11 ? "GK" : i % 11 < 5 ? "DF" : i % 11 < 8 ? "MF" : "FW", base + Math.floor(rng() * 8) - (i >= 11 ? 3 : 0)), { age: 18 + Math.floor(rng() * 16) }));
      teams.push({ sq, club: {} });
    }
    const neu = { neutral: true };
    const xiOf = T2 => { const s2 = T2.sq.filter(p => !(p.inj > 0)).sort((a, b) => C.effOvr(b, neu) - C.effOvr(a, neu)); const gk = s2.find(p => p.pos === "GK"); return [gk].concat(s2.filter(p => p.pos !== "GK").slice(0, 10)); };
    const strength = (pp, T2, home, w) => pp.reduce((x, e) => x + C.effOvr(e.p, { home, club: T2.club, round: w }) * e.min, 0) / pp.reduce((x, e) => x + e.min, 0);
    const delta = (p, T2, w) => C.effOvr(p, { neutral: true, club: T2.club, round: w }) - p.rating;
    const rows = []; const evWeeks = new Map(teams.map(T2 => [T2, []])); let maxPerWeek = 0, extWorst = 0;
    for (let season = 0; season < 5; season++) {
      const pts = new Map(teams.map(T2 => [T2, 0]));
      for (const p of teams.flatMap(T2 => T2.sq)) delete p.ap;
      for (let w = 0; w < 38; w++) {
        const order = teams.slice().sort(() => rng() - 0.5);
        for (let k = 0; k < 20; k += 2) {
          const A = order[k], B = order[k + 1], xa = xiOf(A), xb = xiOf(B);
          const pa = C.participants(xa, C.pickSubs(xa, A.sq.filter(p => !xa.includes(p) && !(p.inj > 0)), rng));
          const pb = C.participants(xb, C.pickSubs(xb, B.sq.filter(p => !xb.includes(p) && !(p.inj > 0)), rng));
          const sA = strength(pa, A, true, w), sB = strength(pb, B, false, w);
          const ga = pois(1.42 * Math.exp((sA - sB) / 10)), gb = pois(1.12 * Math.exp((sB - sA) / 10));
          C.applyResult(pa, ga, gb, rng); C.applyResult(pb, gb, ga, rng);
          pts.set(A, pts.get(A) + (ga > gb ? 3 : ga === gb ? 1 : 0)); pts.set(B, pts.get(B) + (gb > ga ? 3 : ga === gb ? 1 : 0));
          for (const [T2, pp] of [[A, pa], [B, pb]]) for (const p of T2.sq) { const e = pp.find(x => x.p === p); C.playingTime(p, e ? e.min : 0); if (e) C.recordAppearance(p, e.start, e.min); }
        }
        let ext = 0, all = 0;
        for (const T2 of teams) {
          for (const p of T2.sq) { C.drift(p); if (p.inj > 0) p.inj--; }
          C.pruneFx(T2.club, w + 1);
          let n = 0;
          // the same one roll a week the server makes, for every club
          if (C.rollEvent(rng)) { n++; evWeeks.get(T2).push(season * 38 + w); C.applyEvent(EVENTS[Math.floor(rng() * EVENTS.length)], T2.club, T2.sq, w + 1, rng); }
          maxPerWeek = Math.max(maxPerWeek, n);
          for (const p of T2.sq) { all++; if (Math.abs(delta(p, T2, w + 1)) >= 4) ext++; }
        }
        extWorst = Math.max(extWorst, ext / all);
      }
      const all = teams.flatMap(T2 => T2.sq.map(p => delta(p, T2, 38)));
      const reg = teams.flatMap(T2 => T2.sq.filter(p => p.ap && p.ap[0] >= 19).map(p => delta(p, T2, 38)));
      const champ = teams.slice().sort((a, b) => pts.get(b) - pts.get(a))[0];
      const cs = champ.sq.filter(p => p.ap && p.ap[0] >= 19).map(p => delta(p, champ, 38));
      const mean = v => v.reduce((a, b) => a + b, 0) / (v.length || 1);
      const flat = teams.flatMap(T2 => T2.sq);
      rows.push({ season: season + 1, everyone: +mean(all).toFixed(2), regulars: +mean(reg).toFixed(2), atExtremes: +(flat.filter(p => Math.abs(p.fm || 0) >= 2.5 || Math.abs(p.mo || 0) >= 1.8).length / flat.length).toFixed(3), champPts: pts.get(champ), champRegulars: +mean(cs).toFixed(2), champBest: +Math.max(...cs).toFixed(2) });
    }
    console.log("OVR balance, made up league, effective minus base at the end of each season:");
    console.table(rows);
    const gaps = []; for (const ws of evWeeks.values()) for (let i = 1; i < ws.length; i++) gaps.push(ws[i] - ws[i - 1]);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    console.log("events in the made up league: one every " + avgGap.toFixed(2) + " weeks per club, at most " + maxPerWeek + " in a week, worst week with " + (extWorst * 100).toFixed(1) + " percent of players 4 or more off their base");
    ok("over five seasons the league average does not creep up or sink", rows.every(r => Math.abs(r.regulars) <= 0.6) && Math.abs(rows[4].regulars - rows[0].regulars) <= 0.4 && Math.abs(rows[4].everyone - rows[0].everyone) <= 0.4, rows);
    ok("only a few percent of players sit at the extremes at any moment", rows.every(r => r.atExtremes < 0.05) && extWorst < 0.05, [rows.map(r => r.atExtremes), extWorst]);
    const champAvg = rows.reduce((a, r) => a + r.champRegulars, 0) / rows.length;
    ok("the champions' regulars end slightly up, never maxed out", champAvg >= 0.3 && champAvg <= 2.5 && rows.every(r => r.champBest < 4), [champAvg, rows.map(r => r.champBest)]);
    ok("in a long run each club gets one event every three to five weeks and never two in a week", avgGap >= 3 && avgGap <= 5 && maxPerWeek === 1, [avgGap, maxPerWeek]);
  }
}
{
  // off the pitch injuries go through the normal injury system
  const club = {};
  const squad = []; for (let i = 0; i < 6; i++) squad.push(P(700 + i, 70, { pos: i === 0 ? "GK" : "MF" }));
  squad[1].inj = 2; squad[2].ban = 1;
  const injEv = EVENTS.find(e => e.inj && e.who === "one" && Array.isArray(e.inj) && e.inj[0] >= 2);
  let fitOnly = true, lengthsOk = true, textOk = true;
  for (let i = 0; i < 40; i++) {
    for (const p of squad) if (p.id !== 701) delete p.inj;
    const r = C.applyEvent(injEv, club, squad, 3, seeded(100 + i));
    const hit = squad.find(p => p.id === r.ids[0]);
    if (hit.id === 701 || hit.id === 702) fitOnly = false;
    if (!(hit.inj >= injEv.inj[0] && hit.inj <= injEv.inj[1] && r.inj === hit.inj)) lengthsOk = false;
    if (r.text.includes("{") || !/out for (a week|\d+ weeks)/i.test(r.text)) textOk = false;
  }
  ok("an injury event only picks a fit player and puts him out for the stated weeks", fitOnly && lengthsOk, injEv.t);
  ok("the news line says how long he is out", textOk, null);
  for (const p of squad) if (p.id !== 701) delete p.inj;
  const rp = C.applyEvent(injEv, club, squad, 3, seeded(5), { physio: true });
  ok("a head physio takes a week off an off the pitch injury", rp.inj >= Math.max(1, injEv.inj[0] - 1) && rp.inj <= injEv.inj[1] - 1 && C.injuryWeeks({ inj: 3 }, null, true) === 2 && C.injuryWeeks({ inj: 1 }, null, true) === 1, [rp.inj]);
  const card = C.eventCard(rp);
  ok("the event card carries the headline, the injury length and who it hit for the popup", card.h === injEv.h && card.j === rp.inj && card.k === "one" && card.p.length === 1 && card.n === 1, card);
  const cl2 = {}; C.addNews(cl2, 4, "line", 40, { e: card });
  ok("news items can carry the event card", cl2.news[0].e === card && cl2.news[0].w === 4 && cl2.news[0].i === 1, cl2.news[0]);
}

// ---------- the display rule (same logic as the page's ovrFace) ----------
{
  const page = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const src = /function ovrFace\(base, eff\) \{[\s\S]*?\n\}/.exec(page);
  ok("the page has the one number plus arrow rule", !!src, null);
  if (src) {
    const ovrFace = new Function(src[0] + "; return ovrFace;")();
    ok("effective equal to base shows one number and no arrow", ovrFace(91, 91).text === "91" && ovrFace(91, 91).arrow === "" && ovrFace(91, 91).dir === "flat", ovrFace(91, 91));
    ok("above base shows the effective number with an up arrow", ovrFace(82, 84).text === "84" && ovrFace(82, 84).dir === "up" && ovrFace(82, 84).arrow === String.fromCharCode(9650), ovrFace(82, 84));
    ok("below base shows the effective number with a down arrow", ovrFace(82, 79).text === "79" && ovrFace(82, 79).dir === "down" && ovrFace(82, 79).arrow === String.fromCharCode(9660), ovrFace(82, 79));
  }
  ok("the face never shows two numbers side by side", !page.includes('class="ovb"') && !page.includes("' . '"), null);
  ok("the event cause reaches the tooltip", C.shortCause("Away fans let off firecrackers outside the team hotel all night. Players are shattered.") === "Away fans let off firecrackers outside the team hotel all night" && C.shortCause("x".repeat(90)).length <= 70, null);
  const club = {}; const sq = []; for (let i = 0; i < 12; i++) sq.push(P(300 + i, 70));
  const ev = EVENTS.find(e => e.who === "squad" && e.w > 0 && e.m);
  C.applyEvent(ev, club, sq, 5, seeded(8));
  const parts2 = C.parts(sq[0], club, 5);
  ok("the breakdown names the event behind an active modifier", parts2.causes.length === 1 && parts2.causes[0].s.length > 10 && !parts2.causes[0].s.includes("{p}") && parts2.causes[0].m === ev.m, parts2.causes);
  C.addNews(club, 5, "one", 40); C.addNews(club, 6, "two", 40);
  ok("news items carry rising ids so a manager can be shown only what is new", club.news[0].i === 2 && club.news[1].i === 1 && club.news[0].t === "two", club.news);
}

// ---------- transfer window events: 200 templates ----------
{
  const { TRANSFER_EVENTS: TE } = require("./transfer_events_data");
  for (const f of ["transfer_events_data.js", "interest.js"]) {
    const t = fs.readFileSync(here(f), "utf8");
    ok(f + " has no em or en dashes", !t.includes(EM) && !t.includes(EN), null);
  }
  ok("there are 200 transfer window events", TE.length === 200, TE.length);
  ok("every transfer event has its own words and its own headline", new Set(TE.map(e => e.t)).size === TE.length && new Set(TE.map(e => e.h)).size === TE.length && TE.every(e => e.h.length >= 3 && e.h.length <= 26 && !/[{}]/.test(e.h)), null);
  ok("every transfer event names the player, his club, his position and roughly his price", TE.every(e => e.t.includes("{t}") && e.t.includes("{c}") && e.t.includes("{fee}") && (e.t.includes("{pos}") || e.t.includes("{apos}"))), TE.filter(e => !e.t.includes("{fee}")).map(e => e.h).slice(0, 3));
  ok("transfer events only use known conditions and fill ins", TE.every(e => [undefined, "intl", "home", "young", "vet", "bench", "league"].includes(e.need) && (e.t.match(/\{[a-z]+\}/g) || []).every(x => ["{t}", "{c}", "{pos}", "{apos}", "{fee}", "{cap}", "{mate}", "{nat}", "{pl}", "{you}", "{age}", "{lg}"].includes(x))), null);
  ok("the national team mate events name the team mate and the country", TE.filter(e => e.need === "intl").length >= 10 && TE.filter(e => e.need === "intl").every(e => e.t.includes("{mate}") && e.t.includes("{nat}")), null);
  ok("the captain, the agent, family, a boyhood fan and coming home are all in the pool", TE.some(e => e.t.includes("{cap}")) && TE.some(e => /agent/i.test(e.t)) && TE.some(e => /family/i.test(e.t)) && TE.some(e => /grew up supporting/.test(e.t)) && TE.some(e => e.need === "home"), null);
  // no two feel copy pasted: no pair shares 80 percent of its words
  const words = t => new Set(t.toLowerCase().replace(/\{[a-z]+\}/g, " ").split(/[^a-z']+/).filter(w => w.length > 3));
  const W = TE.map(e => words(e.t));
  let worst = 0;
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
    const a = W[i], b = W[j];
    let common = 0; for (const w of a) if (b.has(w)) common++;
    worst = Math.max(worst, common / Math.max(1, Math.min(a.size, b.size)));
  }
  ok("no two transfer events read like copies", worst < 0.8, worst.toFixed(2));
}

// ---------- player interest (interest.js) on a small made up world ----------
{
  const I = require("./interest");
  const BIGS = ["Giant"];
  const mk = (name, league, budget, base, n) => ({ name, league, budget, baseBudget: budget, squad: [], n, base });
  const clubs = { Giant: mk("Giant", "Premier League", 200, 86), Mid: mk("Mid", "Premier League", 50, 78), Small: mk("Small", "Scottish Premiership", 4, 67), Other: mk("Other", "Eredivisie", 20, 74) };
  const players = {};
  let pid = 1;
  for (const c of Object.values(clubs)) {
    const pos = ["GK", "GK", "DF", "DF", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "MF", "FW", "FW", "FW", "FW"];
    pos.forEach((ps, i) => {
      const p = { id: pid++, name: c.name + " player " + i, pos: ps, age: 22 + (i % 10), rating: c.base + 3 - (i % 7), club: c.name, league: c.league, contractYears: 2 };
      players[p.id] = p; c.squad.push(p.id);
    });
  }
  const game = { code: "TINT", season: 1, round: 0, clubs, players, leagueFixtures: {}, cups: {}, history: [], nations: {} };
  const L = I.LABELS;
  const shapeOk = it => it && [0, 1, 2, 3].includes(it.lv) && it.label === L[it.lv] && Array.isArray(it.why) && it.why.length === 2 && it.why.every(w => typeof w === "string" && w.length > 3) && it.why[0] !== it.why[1];
  const all = Object.values(players);
  ok("interest has the shape the page reads: lv 0 to 3, the label and two reasons", all.every(p => ["Giant", "Mid", "Small"].filter(c => c !== p.club).every(c => shapeOk(I.interest(game, p, c, BIGS)))), I.interest(game, all[0], "Small", BIGS));
  ok("the four labels are Very Low, Low, Medium and High", L.join("|") === "Very Low|Low|Medium|High", L);
  const star = players[clubs.Giant.squad[2]];
  star.rating = 89; star.age = 27; star.mo = 1;
  const lowly = players[clubs.Small.squad[9]];
  ok("a happy star at a big club sits at very low for a small club", I.interest(game, star, "Small", BIGS).lv === 0, I.interest(game, star, "Small", BIGS));
  ok("and is not keen on a mid club either", I.interest(game, star, "Mid", BIGS).lv <= 1, I.interest(game, star, "Mid", BIGS));
  ok("a squad player at a small club is high for a big club", I.interest(game, lowly, "Giant", BIGS).lv === 3, I.interest(game, lowly, "Giant", BIGS));
  const keenForMid = Object.values(players).filter(p => p.club === "Other" || p.club === "Small").map(p => I.level(game, p, "Mid", BIGS));
  ok("lower rated players mostly sit at medium to high for a mid club", keenForMid.filter(v => v >= 2).length / keenForMid.length >= 0.7, keenForMid);
  const coldReason = I.interest(game, star, "Small", BIGS).why;
  ok("a cold player's reasons say why he is cold, in plain words", coldReason.some(w => /step down|bigger stage|Happy|Loves life|league/.test(w)), coldReason);
  // a bench player and a transfer listed player are more open than the same player happy in the side
  const mover = players[clubs.Mid.squad[5]];
  const before = I.rawScore(game, mover, "Other", BIGS).score;
  mover.bn = 6; mover.mo = -1.2;
  const after = I.rawScore(game, mover, "Other", BIGS).score;
  ok("a player stuck on the bench and low on morale is more open to a move", after > before + 1, [before, after]);
  mover.listed = true;
  ok("a transfer listed player is more open still", I.rawScore(game, mover, "Other", BIGS).score > after + 2, null);
  delete mover.bn; delete mover.mo; delete mover.listed;
  // contract length
  const cp = players[clubs.Other.squad[8]];
  cp.contractYears = 1; const shortC = I.rawScore(game, cp, "Mid", BIGS).score;
  cp.contractYears = 4; const longC = I.rawScore(game, cp, "Mid", BIGS).score;
  ok("a short contract makes him more open than a long one", shortC > longC + 1, [shortC, longC]);
  cp.contractYears = 2;
  // coming home: a player in a national squad whose country is the club's country
  const homeP = players[clubs.Other.squad[10]];
  game.nations = { England: { name: "England", playerIds: [homeP.id] } };
  game.code = "TINT2";
  ok("a player in the England squad abroad would be coming home to a Premier League club", I.rawScore(game, homeP, "Mid", BIGS).parts.some(x => x.k === "home" && x.v > 0) && I.interest(game, homeP, "Mid", BIGS).why.includes("Would be coming home") === (I.interest(game, homeP, "Mid", BIGS).why.indexOf("Would be coming home") >= 0), I.interest(game, homeP, "Mid", BIGS));
  ok("a player with no known nation simply skips the home factor", !I.rawScore(game, cp, "Mid", BIGS).parts.some(x => x.k === "home" || x.k === "homeNow"), null);
  // bumps from transfer events: up one or two levels, gone when the time is up
  const bp = players[clubs.Other.squad[0]];
  bp.rating = 82;
  const base = I.level(game, bp, "Small", BIGS);
  I.addBump(game, "Small", bp.id, 2, I.bumpUntil(game));
  ok("a transfer event bump raises interest by two levels", I.level(game, bp, "Small", BIGS) === Math.min(3, base + 2) && I.interest(game, bp, "Small", BIGS).why[0] === "Keen on your club", [base, I.level(game, bp, "Small", BIGS)]);
  ok("a summer bump lasts to the end of the January window", I.bumpUntil(game) === 122, I.bumpUntil(game));
  game.round = 20; game.code = "TINT3";
  ok("a January bump lasts to the end of next summer's window", I.bumpUntil(game) === 203, I.bumpUntil(game));
  game.round = 23; game.code = "TINT4";
  ok("the summer bump is gone after the January window shuts", I.bumpFor(game, "Small", bp.id) === 0 && !I.interest(game, bp, "Small", BIGS).why.includes("Keen on your club"), I.bumpFor(game, "Small", bp.id));
  game.round = 0; game.code = "TINT5";
  // the player's answer: a very low player almost always says no, a high one never, and a no sticks
  const rng = seeded(41);
  const askMany = (p, club, scout) => { let yes = 0; for (let i = 0; i < 400; i++) { delete game.interestNo; if (!I.playerAnswer(game, p, club, BIGS, { rng, scout })) yes++; } delete game.interestNo; return yes / 400; };
  const vlYes = askMany(star, "Small", false), hiYes = askMany(lowly, "Giant", false);
  ok("a very low star says yes far less often than a high squad player", vlYes < 0.15 && hiYes === 1, [vlYes, hiYes]);
  const midP = Object.values(players).find(p => p.club !== "Mid" && I.level(game, p, "Mid", BIGS) === 2);
  const lowP = Object.values(players).find(p => p.club !== "Mid" && I.level(game, p, "Mid", BIGS) === 1);
  if (midP && lowP) {
    const m = askMany(midP, "Mid", false), l = askMany(lowP, "Mid", false);
    ok("medium is noticeably harder than high, low fails most of the time", m > 0.5 && m < 0.85 && l > 0.15 && l < 0.45, [m, l]);
  }
  ok("a chief scout helps but nothing below high becomes automatic", I.T.ACCEPT_SCOUT.slice(0, 3).every((v, i) => v >= I.T.ACCEPT[i] && Math.min(v, I.T.ACCEPT_CAP) < 0.9) && askMany(star, "Small", true) < 0.2, I.T.ACCEPT_SCOUT);
  delete game.interestNo;
  const no = I.playerAnswer(game, star, "Small", BIGS, { rng: () => 0.99 });
  ok("a no comes with a plain reason and sticks for the rest of the window", no && /does not want the move/.test(no.note) && I.saidNo(game, "Small", star.id) && I.interest(game, star, "Small", BIGS).why[0] === "Already said no this window", no);
  game.round = 4; game.code = "TINT6";
  ok("after the window shuts he will listen again next time", !I.saidNo(game, "Small", star.id), null);
  game.round = 0; game.code = "TINT7";
  // AI clubs: a very low player never drops down, a high one always goes
  ok("AI clubs use the light version: a very low star never drops to a small club", [...Array(50)].every(() => !I.aiWilling(game, star, "Small", BIGS)) && [...Array(50)].every(() => I.aiWilling(game, lowly, "Giant", BIGS)), null);
  // a title: the club's pull goes up on the same group of players
  const group = Object.values(players).filter(p => p.club === "Other" || p.club === "Giant");
  const pullOf = () => group.reduce((s2, p) => s2 + I.rawScore(game, p, "Mid", BIGS).score, 0) / group.length;
  const pre = pullOf(), lvPre = I.clubLevel(game, "Mid", BIGS).level;
  game.history = [{ season: 1, champions: { "Premier League": "Mid" }, cupWinners: {} }];
  game.lastTables = { "Premier League": ["Mid", "Giant"] };
  game.cups = { ucl: { rounds: [[{ home: "Mid", away: "Giant" }]], byes: [] } };
  game.season = 2; game.code = "TINT8";
  ok("winning the league lifts the club's standing and its pull on players", I.clubLevel(game, "Mid", BIGS).level > lvPre + 3 && pullOf() > pre + 1, [lvPre, I.clubLevel(game, "Mid", BIGS).level, pre, pullOf()]);
}

console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
