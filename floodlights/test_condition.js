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
  const xi = []; for (let i = 0; i < 11; i++) xi.push(P(i, 75));
  C.applyResult(xi, 2, 1);
  ok("a win puts form up one and morale up a little", xi.every(p => p.fm === 1 && p.mo === 0.3), xi[0]);
  C.applyResult(xi, 5, 0);
  ok("a thrashing puts form up two", xi.every(p => p.fm === 3), xi[0].fm);
  C.applyResult(xi, 0, 4);
  ok("a heavy loss drops form by two and morale down", xi.every(p => p.fm === 1 && Math.abs(p.mo - 0.3) < 1e-9), [xi[0].fm, xi[0].mo]);
  const rng = seeded(3);
  const q = P(99, 75, { fm: 3, mo: 2 });
  for (let w = 0; w < 40; w++) C.drift(q, rng);
  ok("with nothing happening form and morale drift back to zero", !q.fm && !q.mo, q);
  const slow = P(98, 75, { mo: 2 }); C.drift(slow, seeded(1));
  ok("morale drifts slower than form", slow.mo === 1.9, slow.mo);
}

// ---------- events ----------
ok("the event pool has at least 200 distinct events", EVENTS.length >= 200 && new Set(EVENTS.map(e => e.t)).size === EVENTS.length, EVENTS.length);
ok("every event says who it hits, what it does and how long", EVENTS.every(e => ["one", "few", "squad", "gk"].includes(e.who) && typeof e.t === "string" && e.t.length > 20 && (e.f !== undefined || e.m !== undefined || e.w !== undefined) && (e.w === undefined || [0, 1, 2, 3].includes(e.w))), null);
{
  const neg = EVENTS.filter(e => (e.f || 0) + (e.m || 0) < 0).length, pos = EVENTS.filter(e => (e.f || 0) + (e.m || 0) > 0).length;
  ok("the pool mixes bad, good and neutral news", neg >= 60 && pos >= 60, [neg, pos]);
}
ok("the asked for examples are in the pool", EVENTS.some(e => /left at the hotel/.test(e.t)) && EVENTS.some(e => /firecrackers/.test(e.t)) && EVENTS.some(e => /became a dad|newborn|baby arrived/.test(e.t)) && EVENTS.some(e => /bonding dinner/.test(e.t)) && EVENTS.some(e => /keeper did an interview trashing the coach/.test(e.t)), null);
{
  // frequency: many clubs, many seasons, independent rolls
  const rng = seeded(11);
  let total = 0; const seasons = 3000; const perClub = [];
  for (let i = 0; i < seasons; i++) { let n = 0; for (let w = 0; w < 38; w++) n += C.rollEventCount(rng); total += n; perClub.push(n); }
  const avg = total / seasons;
  ok("a club sees about 5 to 7 events a season on average", avg >= 5 && avg <= 7, avg);
  ok("a week brings at most two events and a second one is rare", perClub.every(n => n <= 76) && C.T.EVENT_P2 < 0.2, null);
  const weekly = []; for (let w = 0; w < 20000; w++) weekly.push(C.rollEventCount(rng));
  const one = weekly.filter(n => n >= 1).length / weekly.length;
  ok("roughly 15 to 20 percent of weeks bring an event", one >= 0.13 && one <= 0.2, one);
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

console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
