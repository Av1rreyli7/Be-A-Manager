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
  ok("a win nudges form up a little and morale a touch", xi.every(p => p.fm === 0.6 && p.mo === 0.2), xi[0]);
  C.applyResult(xi, 5, 0);
  ok("a thrashing gives a bigger nudge", xi.every(p => p.fm === 1.6), xi[0].fm);
  C.applyResult(xi, 0, 4);
  ok("a heavy loss bites harder than a win helps: form drops more than it rose", xi.every(p => !p.fm && Math.abs(p.mo - 0.05) < 1e-9), [xi[0].fm, xi[0].mo]);
  ok("losing is sharper than winning in the numbers themselves", -C.T.LOSS_FORM > C.T.WIN_FORM && -C.T.BIG_LOSS_FORM > C.T.BIG_WIN_FORM && -C.T.LOSS_MORALE > C.T.WIN_MORALE, null);
  {
    const hot = P(97, 75);
    const steps = [];
    for (let w = 0; w < 10; w++) { C.applyResult([hot], 2, 0); C.drift(hot); steps.push(hot.fm); }
    ok("a hot streak takes several good weeks to build and never quite reaches the cap by itself", steps[0] < 1 && steps[4] > steps[0] && steps[9] >= 2 && steps[9] <= 3, steps);
    C.applyResult([hot], 0, 2);
    ok("one bad day dents the streak quickly", hot.fm <= steps[9] - 0.9, [steps[9], hot.fm]);
    const held = P(96, 75, { fm: 3 });
    C.applyResult([held], 1, 0); C.drift(held);
    ok("holding +3 needs a win every week: a win keeps him at the top end", held.fm >= 2.4, held.fm);
    C.drift(held);
    ok("a week without a win pulls him off the top", held.fm < 2.4, held.fm);
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
  C.applyResult(parts, 2, 0);
  const full = parts.find(e => e.p.id === 0).p, sub10 = parts.find(e => e.p.id === 14).p, sub30 = parts.find(e => e.p.id === 13).p, off60 = parts.find(e => e.p.id === 6).p;
  ok("form swings scale with minutes: a full match gets the whole swing, a late sub a sliver", full.fm === 0.6 && sub30.fm === 0.2 && Math.abs(sub10.fm - 0.1) < 1e-9 && Math.abs(off60.fm - 0.4) < 1e-9, [full.fm, sub30.fm, sub10.fm, off60.fm]);
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
  ok("playing again stops the slide at once and recovers at the normal slow rate", !back.bn && low < -0.3 && back.mo > low && back.mo <= 0.6, [low, back.mo]);
  // several seasons of a made up league: averages stay near zero, only a few at the extremes
  {
    const rng = seeded(77);
    const teams = [];
    for (let t = 0; t < 20; t++) { const sq = []; for (let i = 0; i < 22; i++) sq.push(Object.assign(mk(t * 100 + i, i === 0 || i === 11 ? "GK" : i % 11 < 5 ? "DF" : i % 11 < 8 ? "MF" : "FW", 60 + t + Math.floor(rng() * 12)), { age: 18 + Math.floor(rng() * 16) })); teams.push({ sq, str: 60 + t }); }
    const pool = EVENTS;
    let creep = [];
    for (let season = 0; season < 4; season++) {
      for (let w = 0; w < 38; w++) {
        for (let t = 0; t < 20; t += 2) {
          const A = teams[t], B = teams[t + 1];
          const xiOf = T2 => T2.sq.slice().sort((a, b) => C.effOvr(b, { neutral: true }) - C.effOvr(a, { neutral: true })).filter((p, i, arr) => arr.indexOf(arr.find(x => x.pos === "GK")) === i || p.pos !== "GK").slice(0, 11);
          const xa = xiOf(A), xb = xiOf(B);
          const pa = C.participants(xa, C.pickSubs(xa, A.sq.filter(p => !xa.includes(p)), rng)), pb = C.participants(xb, C.pickSubs(xb, B.sq.filter(p => !xb.includes(p)), rng));
          const ga = Math.floor(rng() * 3 + (A.str - B.str) / 10 + 0.5), gb = Math.floor(rng() * 3);
          C.applyResult(pa, ga, gb); C.applyResult(pb, gb, ga);
          for (const T2 of [[A, pa], [B, pb]]) for (const p of T2[0].sq) { const e = T2[1].find(x => x.p === p); C.playingTime(p, e ? e.min : 0); }
        }
        for (const T2 of teams) {
          for (const p of T2.sq) C.drift(p);
          const club = {};
          const cnt = C.rollEventCount(rng);
          for (let i = 0; i < cnt; i++) C.applyEvent(pool[Math.floor(rng() * pool.length)], club, T2.sq, w, rng);
        }
        teams.forEach((T2, ti) => { [T2, teams[(ti + 7) % 20]] = [teams[(ti + 7) % 20], T2]; });
      }
      const all = teams.flatMap(T2 => T2.sq);
      const avgF = all.reduce((s2, p) => s2 + (p.fm || 0), 0) / all.length, avgM = all.reduce((s2, p) => s2 + (p.mo || 0), 0) / all.length;
      const ext = all.filter(p => Math.abs(p.fm || 0) >= 2.5 || Math.abs(p.mo || 0) >= 1.8).length / all.length;
      creep.push({ avgF: +avgF.toFixed(2), avgM: +avgM.toFixed(2), ext: +ext.toFixed(3) });
    }
    ok("over four seasons league wide form and morale sit near zero with no upward creep", creep.every(c => Math.abs(c.avgF) < 0.5 && Math.abs(c.avgM) < 0.5) && creep[3].avgF <= creep[0].avgF + 0.25 && creep[3].avgM <= creep[0].avgM + 0.25, creep);
    ok("only a few percent of players sit at the extremes at any moment", creep.every(c => c.ext < 0.08), creep.map(c => c.ext));
  }
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

console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
