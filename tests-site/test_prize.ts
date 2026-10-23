// PRIZE FIGHTER headless battery. Run: npx tsx tests-site/test_prize.ts
// The whole fight engine with no browser: full fights to every end state (KO both ways, TKO, every kind of
// decision), no NaN anywhere, knockdown counts and the referee's count, ten point must scoring checked by hand,
// every real boxer loads and fights, created fighters (extreme inputs) save and come back, stance and guard switches
// never stick, a fight saved mid round carries on exactly, the get up mini game, clinches and holding points, the
// computer reading a spammed punch, tiers, range, spam, combinations, guards, slips and the corner.
import {
  ROSTER, aiInput, begin, blankInput, createFight, decide, nextRound, restore, scoreRound, snapshot, step, testKnockDown, validState,
  toDef, sanitize, fitAttrs, attrsUsed, defaultCreated, cleanName, emptyStats, makeJudges, PUNCH, ATTR_BUDGET, ATTR_MAX, ATTR_MIN, NAME_MAX, KINDS,
  type FightState, type FighterDef, type Input, type Judge, type RoundStats, type Tier, type FightConfig,
} from "../src/prize/engine/index";
import * as save from "../src/prize/save";

let passed = 0, failed = 0;
function ok(name: string, cond: unknown, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 500));
  }
}
const by = (id: string) => ROSTER.find(f => f.id === id)!;
const EM = String.fromCharCode(8212), EN = String.fromCharCode(8211);

/** a full computer fight, checked every step; returns the state and what it saw */
function runFight(a: FighterDef, b: FighterDef, seed: number, cfg: Partial<FightConfig> = {}, opts: { maxSteps?: number } = {}) {
  const conf: FightConfig = { rounds: 3, roundSec: 60, tier: 2, human: false, ...cfg };
  const st = createFight([a, b], conf, seed);
  const ins: [Input, Input] = [blankInput(), blankInput()];
  const seen = { kdEvents: [0, 0], counts: [] as number[][], badCount: "", nan: -1, koBeforeTen: false, countOrder: true, maxAction: 0, steps: 0, clinchLong: 0, roundsSeen: 0 };
  let curCount: number[] = [];
  let clinchT = 0;
  const max = opts.maxSteps ?? 4e6;
  while (st.phase !== "over" && seen.steps < max) {
    if (st.phase === "pre") begin(st);
    if (st.phase === "corner") nextRound(st);
    aiInput(st, 0, ins[0]);
    aiInput(st, 1, ins[1]);
    step(st, ins);
    seen.steps++;
    if (seen.nan < 0 && !validState(st)) seen.nan = seen.steps;
    for (const f of st.f) {
      if (f.action && f.action.type !== "down" && f.action.type !== "clinch" && f.action.type !== "getup") seen.maxAction = Math.max(seen.maxAction, f.action.t);
    }
    if (st.clinch) clinchT++;
    else clinchT = 0;
    seen.clinchLong = Math.max(seen.clinchLong, clinchT);
    for (const e of st.ev) {
      if (e.type === "kd") {
        seen.kdEvents[e.who]++;
        curCount = [];
        seen.counts.push(curCount);
      }
      if (e.type === "count") {
        if (curCount.length && e.n !== curCount[curCount.length - 1] + 1) seen.countOrder = false;
        if (!curCount.length && e.n !== 1) seen.countOrder = false;
        curCount.push(e.n!);
      }
      if (e.type === "end" && st.result?.method === "KO" && st.result.detail === "counted out" && curCount[curCount.length - 1] !== 10) seen.koBeforeTen = true;
    }
  }
  return { st, seen };
}

/** the checks every finished fight must pass */
function checkFight(label: string, st: FightState, seen: ReturnType<typeof runFight>["seen"]) {
  ok(label + ": the fight finished", st.phase === "over" && !!st.result, { phase: st.phase, round: st.round });
  ok(label + ": no NaN or out of range number at any step", seen.nan < 0, seen.nan);
  ok(label + ": knockdowns counted the same in events and on each boxer", seen.kdEvents[0] === st.f[0].kdFight && seen.kdEvents[1] === st.f[1].kdFight, [seen.kdEvents, st.f[0].kdFight, st.f[1].kdFight]);
  const kdByRounds = [0, 1].map(i => st.rounds.reduce((s, r) => s + r[i].kd, 0));
  ok(label + ": knockdowns per round add up to the fight total", [0, 1].every(i => st.f[i].fs.kd === st.f[i].kdFight && (st.result!.method === "KO" || st.result!.method === "TKO" || kdByRounds[i] === st.f[i].kdFight)), [kdByRounds, st.f[0].fs.kd, st.f[1].fs.kd]);
  ok(label + ": the referee counts 1, 2, 3 in order", seen.countOrder, seen.counts.slice(0, 3));
  ok(label + ": a count out only after the count reaches ten", !seen.koBeforeTen, seen.counts.slice(-1));
  ok(label + ": no punch, slip or stagger runs on forever", seen.maxAction < 200, seen.maxAction);
  ok(label + ": every clinch is broken by the referee", seen.clinchLong < 400, seen.clinchLong);
  const r = st.result!;
  if (r.method === "TKO" && r.detail === "three knockdowns in the round") ok(label + ": three knockdowns in the round means exactly three", st.f[r.winner === 0 ? 1 : 0].kdRound === 3, st.f.map(f => f.kdRound));
  if (["UD", "SD", "MD", "DRAW"].includes(r.method)) {
    ok(label + ": a decision goes the distance", st.rounds.length === st.cfg.rounds && st.cards.every(c => c.length === st.cfg.rounds), [st.rounds.length, st.cards.map(c => c.length)]);
    const again = decide(st.cards);
    ok(label + ": the decision matches the cards", again.method === r.method && again.winner === r.winner && JSON.stringify(again.totals) === JSON.stringify(r.totals), [again, r]);
    for (let j = 0; j < 3; j++) {
      const t = st.cards[j].reduce((s, c) => [s[0] + c[0], s[1] + c[1]], [0, 0]);
      ok(label + ": judge " + (j + 1) + " totals add up", t[0] === r.totals[j][0] && t[1] === r.totals[j][1], [t, r.totals[j]]);
    }
    // every round card: the winner has 10 (before points taken away), the loser 6 to 10
    const bad: unknown[] = [];
    st.cards.forEach(card => card.forEach((c, k) => {
      const [sa, sb] = st.rounds[k];
      const pa = c[0] + sa.deducted, pb = c[1] + sb.deducted;
      if (Math.max(pa, pb) !== 10 || Math.min(pa, pb) < 6) bad.push([k, c]);
      if (sa.kd > sb.kd && !(pa < pb)) bad.push(["kd round not lost", k, c]);
      if (sb.kd > sa.kd && !(pb < pa)) bad.push(["kd round not lost", k, c]);
    }));
    ok(label + ": every round is scored ten point must", bad.length === 0, bad.slice(0, 3));
  }
}

const t0 = Date.now();

// ============================================================ the roster
{
  ok("at least 20 real boxers", ROSTER.length >= 20 && ROSTER.every(f => f.real), ROSTER.length);
  ok("every boxer has a unique id", new Set(ROSTER.map(f => f.id)).size === ROSTER.length);
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const badRow = ROSTER.filter(f => !f.name || !["orthodox", "southpaw"].includes(f.stance) || !["pressure", "counter", "outboxer", "body"].includes(f.style) || !["high", "philly", "normal"].includes(f.guard)
    || Object.values(f.attrs).some(v => !(v >= 40 && v <= 99)) || !(f.heightCm >= 155 && f.heightCm <= 210) || !(f.reachIn >= 60 && f.reachIn <= 90) || !(f.weightKg >= 50 && f.weightKg <= 130)
    || ![f.look.gloves, f.look.gloveTrim, f.look.boots, ...f.look.trunks].every(c => HEX.test(c)) || !(f.look.skin >= 0 && f.look.skin <= 1) || !f.blurb || f.blurb.split(" ").length > 22);
  ok("every boxer's data is in range (stance, style, guard, attributes, build, colours, one short line)", badRow.length === 0, badRow.map(f => f.id));
  const text = JSON.stringify(ROSTER);
  ok("no em or en dashes in the roster", !text.includes(EM) && !text.includes(EN));
  ok("the brief's boxers are in: Ali, Tyson, Mayweather, Canelo, Fury", ["ali", "tyson", "mayweather", "canelo", "fury"].every(id => !!by(id)));
  ok("they differ the way they should: Ali fast and slick, Tyson explosive pressure, Mayweather the Philly shell, Canelo the body, Fury the giant",
    by("ali").attrs.speed >= 90 && by("ali").style === "outboxer" && by("tyson").attrs.power >= 95 && by("tyson").style === "pressure" && by("mayweather").guard === "philly" && by("mayweather").traits.includes("shell")
    && by("canelo").style === "body" && by("canelo").traits.includes("body") && by("fury").heightCm >= 200 && by("fury").reachIn >= 84);
  ok("southpaws are in the roster", ROSTER.filter(f => f.stance === "southpaw").length >= 4);
  ok("every style is in the roster", ["pressure", "counter", "outboxer", "body"].every(s => ROSTER.some(f => f.style === s)));
  // every real boxer loads and fights at least one round, against a varied opponent
  const fails: string[] = [];
  ROSTER.forEach((f, i) => {
    const o = ROSTER[(i + 7) % ROSTER.length];
    const { st, seen } = runFight(f, o, 1000 + i, { rounds: 3, roundSec: 60 }, { maxSteps: 60 * 75 });
    if (seen.nan >= 0 || st.f[0].fs.thrown + st.f[0].rs.thrown === 0) fails.push(f.id);
  });
  ok("every real boxer loads and fights a round (throws punches, no NaN)", fails.length === 0, fails);
}

// ============================================================ scoring by hand
{
  const card = (rounds: [number, number][]) => rounds;
  const cards = (a: [number, number][], b: [number, number][], c: [number, number][]) => [card(a), card(b), card(c)];
  const W: [number, number] = [10, 9], L: [number, number] = [9, 10], E: [number, number] = [10, 10];
  let d = decide(cards([W, W, W], [W, L, W], [W, W, L]));
  ok("decide: all three judges for the red corner is a unanimous decision", d.method === "UD" && d.winner === 0, d);
  d = decide(cards([L, L, W], [L, L, L], [W, L, L]));
  ok("decide: unanimous for the blue corner", d.method === "UD" && d.winner === 1, d);
  d = decide(cards([W, W, L], [W, W, L], [L, L, W]));
  ok("decide: two to one is a split decision", d.method === "SD" && d.winner === 0, d);
  d = decide(cards([W, W, L], [W, E, L], [W, W, W]));
  ok("decide: two for one and one even is a majority decision", d.method === "MD" && d.winner === 0 && d.totals[1][0] === d.totals[1][1], d);
  d = decide(cards([W, L, E], [W, L, E], [L, L, W]));
  ok("decide: two even cards and one for blue is a majority draw", d.method === "DRAW" && d.winner === null && d.detail === "Majority draw", d);
  d = decide(cards([W, W, L], [L, L, W], [W, L, E]));
  ok("decide: one each way and one even is a split draw", d.method === "DRAW" && d.detail === "Split draw", d);
  d = decide(cards([W, L, E], [E, E, E], [L, W, E]));
  ok("decide: three even cards is a unanimous draw", d.method === "DRAW" && d.detail === "Unanimous draw", d);
  d = decide(cards([W, W, W, [10, 8], W, W, W, W, W, W, W, W], [L, L, L, L, L, L, W, W, W, W, W, W], [W, W, W, W, W, W, W, W, W, W, W, W]));
  ok("decide: twelve round totals (120 108 and so on) are added right", d.totals[0][0] === 120 && d.totals[0][1] === 107 && d.totals[1][0] === 114 && d.totals[1][1] === 114 && d.totals[2][0] === 120 && d.totals[2][1] === 108 && d.method === "MD", d);

  const rs = { rng: 12345 };
  const j: Judge = { name: "Test", wLanded: 1, wPower: 0.7, wDamage: 0.08, wAggr: 0.1, wDef: 0.1, noise: 0.01, even: 0.3, dom: 2.5 };
  const mk = (o: Partial<RoundStats>): RoundStats => ({ ...emptyStats(), ...o });
  const busyA = mk({ landed: 20, powerLanded: 10, damage: 60 }), busyB = mk({ landed: 10, powerLanded: 3, damage: 20 });
  ok("round: the busier, harder hitting boxer wins 10 9", JSON.stringify(scoreRound(j, busyA, busyB, rs)) === "[10,9]");
  ok("round: knocked down in a round he was losing anyway is 10 8", JSON.stringify(scoreRound(j, busyA, mk({ ...busyB, kd: 1 }), rs)) === "[10,8]");
  ok("round: knocked down while winning the punches is 10 9 the other way", JSON.stringify(scoreRound(j, mk({ ...busyA, kd: 1 }), busyB, rs)) === "[9,10]");
  ok("round: two knockdowns in a lost round is 10 7", JSON.stringify(scoreRound(j, busyA, mk({ ...busyB, kd: 2 }), rs)) === "[10,7]");
  ok("round: a knockdown each way cancels out, 10 9 on punches", JSON.stringify(scoreRound(j, mk({ ...busyA, kd: 1 }), mk({ ...busyB, kd: 1 }), rs)) === "[10,9]");
  ok("round: a point taken away comes off the card", JSON.stringify(scoreRound(j, mk({ ...busyA, deducted: 1 }), busyB, rs)) === "[9,9]");
  ok("round: a one sided round with no knockdown can be 10 8", JSON.stringify(scoreRound(j, mk({ landed: 30, powerLanded: 18, damage: 70 }), mk({ landed: 4, powerLanded: 1, damage: 6 }), rs)) === "[10,8]");
  const evenTally = new Set<string>();
  const nj: Judge = { ...j, noise: 1.2, even: 0.6 };
  for (let k = 0; k < 400; k++) evenTally.add(JSON.stringify(scoreRound(nj, mk({ landed: 6 }), mk({ landed: 6 }), rs)));
  ok("round: an even round can go either way or 10 10, nothing else", [...evenTally].every(s => ["[10,9]", "[9,10]", "[10,10]"].includes(s)) && evenTally.has("[10,10]") && evenTally.size === 3, [...evenTally]);
  const judges = makeJudges({ rng: 99 });
  ok("three judges with names and their own eye", judges.length === 3 && new Set(judges.map(x => x.name)).size === 3 && judges.every(x => x.noise > 0));
}

// ============================================================ every end state from real fights
{
  const weak = toDef(sanitize({ id: "glass", name: "Glass Jaw", attrs: { power: 40, speed: 40, chin: 40, stamina: 40, defense: 40 } }));
  const found: Record<string, boolean> = {};
  const tkoWhy = new Set<string>();
  let checked = 0;
  // knockouts both ways: a huge puncher against a glass jaw, then the same with the corners swapped
  const bigs = ["foreman", "tyson", "wilder", "joshua", "golovkin", "marciano"];
  // a tough but outgunned boxer: a good chin keeps him up, so beatings end with the referee or the doctor
  const tough = toDef(sanitize({ id: "tough", name: "Iron Will", heightCm: 175, body: "lean", attrs: { power: 40, speed: 40, chin: 95, stamina: 95, defense: 40 } }));
  for (let s = 0; s < 120 && !(found.KO0 && found.KO1 && tkoWhy.size >= 3); s++) {
    for (const flip of [false, true]) {
      const big = by(bigs[s % bigs.length]);
      const victim = s % 2 ? tough : weak;
      const pair: [FighterDef, FighterDef] = flip ? [victim, big] : [big, victim];
      const { st, seen } = runFight(pair[0], pair[1], 500 + s * 13 + (flip ? 1 : 0), { rounds: 6, roundSec: 120 });
      if (checked++ < 12) checkFight("mismatch " + (flip ? "blue" : "red"), st, seen);
      const r = st.result!;
      if (r.method === "KO") found["KO" + r.winner] = true;
      if (r.method === "TKO") tkoWhy.add(r.detail);
    }
  }
  ok("a knockout for the red corner happens", found.KO0);
  ok("a knockout for the blue corner happens", found.KO1);
  // stoppages of every kind across varied matchups
  const pairs: [string, string][] = [["tyson", "holyfield"], ["golovkin", "canelo"], ["wilder", "joshua"], ["foreman", "frazier"], ["hearns", "hagler"], ["duran", "leonard"]];
  for (let s = 0; s < 40 && tkoWhy.size < 3; s++) {
    for (const [a, b] of pairs) {
      const { st, seen } = runFight(by(a), by(b), 9000 + s * 31, { rounds: 12, roundSec: 120 });
      if (checked++ < 24) checkFight(a + " v " + b, st, seen);
      if (st.result!.method === "TKO") tkoWhy.add(st.result!.detail);
      if (st.result!.method === "KO") found["KO" + st.result!.winner] = true;
    }
  }
  ok("technical knockouts happen in real fights", tkoWhy.size >= 1, [...tkoWhy]);
  // every kind of stoppage, set up on purpose
  const setUp = (seed: number) => {
    const st = createFight([by("foreman"), by("hearns")], { rounds: 6, roundSec: 120, tier: 2, human: false }, seed);
    begin(st);
    return st;
  };
  {
    let stopped = false;
    for (let s = 0; s < 20 && !stopped; s++) {
      const st = setUp(40 + s);
      let k = 0;
      while (st.phase === "fight" && k++ < 60 * 20) {
        const f = st.f[1];
        f.rocked = 3; f.headHP = 22; f.stun = 30; f.unanswered = 6; f.hurtAt = st.frame;
        step(st, [blankInput(), blankInput()]);
      }
      stopped = st.result?.method === "TKO" && st.result.detail === "the referee stopped it";
    }
    ok("the referee stops a rocked, battered boxer who takes shot after shot without an answer", stopped);
  }
  {
    const st = setUp(50);
    st.f[1].cut = [100, 0];
    let k = 0;
    while (st.phase === "fight" && k++ < 60) step(st, [blankInput(), blankInput()]);
    ok("the doctor stops a cut that has gone too far, in the round", st.result?.method === "TKO" && /doctor/.test(st.result.detail) && st.result.winner === 0, st.result);
    const st2 = setUp(51);
    st2.clock = 0.05;
    st2.f[0].cut = [0, 93];
    let k2 = 0;
    while (st2.phase !== "over" && st2.phase !== "corner" && k2++ < 400) step(st2, [blankInput(), blankInput()]);
    ok("and between rounds, before the next one", st2.result?.method === "TKO" && /doctor/.test(st2.result.detail) && st2.result.winner === 1, st2.result);
  }
  // decisions of every kind: mirror matches over three short rounds
  const kinds: Record<string, number> = {};
  const mirror = ["ali", "mayweather", "lomachenko", "usyk", "crawford", "leonard", "robinson", "delahoya"];
  for (let s = 0; s < 900; s++) {
    const f = by(mirror[s % mirror.length]);
    const { st, seen } = runFight(f, f, 20000 + s, { rounds: 3, roundSec: 60 });
    if (s < 10) checkFight("mirror " + f.id, st, seen);
    else if (seen.nan >= 0) ok("mirror fight " + s + " stays finite", false, seen.nan);
    const r = st.result!;
    const key = r.method === "DRAW" ? r.detail : r.method;
    kinds[key] = (kinds[key] || 0) + 1;
    if (["UD", "SD", "MD"].every(k => kinds[k]) && ["Majority draw", "Split draw", "Unanimous draw"].some(k => kinds[k]) && s > 60) break;
  }
  ok("unanimous decisions happen", !!kinds.UD, kinds);
  ok("split decisions happen", !!kinds.SD, kinds);
  ok("majority decisions happen", !!kinds.MD, kinds);
  ok("draws happen", !!(kinds["Majority draw"] || kinds["Split draw"] || kinds["Unanimous draw"]), kinds);
  // all three round lengths of fight finish with the right number of rounds
  for (const rounds of [3, 6, 12] as const) {
    const f = by("usyk");
    let st: FightState | null = null;
    for (let s = 0; s < 30; s++) {
      const r = runFight(f, by("lomachenko"), 777 + s, { rounds, roundSec: 60 });
      if (["UD", "SD", "MD", "DRAW"].includes(r.st.result!.method)) { st = r.st; break; }
    }
    ok(rounds + " round fights go to the cards with " + rounds + " rounds scored", !!st && st.cards.every(c => c.length === rounds) && st.rounds.length === rounds, st && st.cards.map(c => c.length));
  }
}

// ============================================================ the referee's count and the get up mini game
{
  const human: FightConfig = { rounds: 3, roundSec: 120, tier: 2, human: true };
  const setup = (seed: number) => {
    const st = createFight([by("ali"), by("frazier")], human, seed);
    begin(st);
    const ins: [Input, Input] = [blankInput(), blankInput()];
    for (let k = 0; k < 30; k++) step(st, ins);
    testKnockDown(st, 0);
    return { st, ins };
  };
  // no taps: counted out at ten
  {
    const { st, ins } = setup(1);
    ok("a knockdown starts the count with the boxer down", st.phase === "kd" && st.kd?.who === 0 && st.f[0].action?.type === "down" && !!st.f[0].getup, st.phase);
    const counts: number[] = [];
    let k = 0;
    while (st.phase === "kd" && k++ < 60 * 15) {
      step(st, ins);
      for (const e of st.ev) if (e.type === "count") counts.push(e.n!);
    }
    ok("no taps: the count runs 1 to 10, one a second, and it is a knockout", JSON.stringify(counts) === "[1,2,3,4,5,6,7,8,9,10]" && st.result?.method === "KO" && st.result.winner === 1 && Math.abs(k / 60 - 10) < 0.2, [counts, st.result, k]);
  }
  // perfect taps: up before ten, the eight count, back to the fight
  {
    const { st, ins } = setup(2);
    const g = st.f[0].getup!;
    let k = 0;
    while (st.phase === "kd" && k++ < 60 * 15) {
      const inp = blankInput();
      const kd = st.kd!;
      if (g.stage === "rhythm") {
        const kk = Math.round((kd.t + 1 / 60 - g.first) / g.beat);
        if (kk >= 0 && kk !== g.lastBeat && Math.abs(kd.t + 1 / 60 - (g.first + kk * g.beat)) < 0.01) inp.tap = true;
      }
      if (st.f[0].getup?.stage === "balance") inp.ms = Math.max(-1, Math.min(1, -st.f[0].getup!.needle * 2.5 - st.f[0].getup!.needleV * 0.5));
      step(st, [inp, ins[1]]);
    }
    ok("taps on the beat get him up before ten and the fight goes on after the eight count", st.phase === "fight" && !st.result && st.f[0].action === null && k / 60 >= 8, [st.phase, st.result, k]);
  }
  // mashing off the beat: misses cost hits and he stays down
  {
    const { st, ins } = setup(3);
    let k = 0, misses = 0;
    while (st.phase === "kd" && k++ < 60 * 15) {
      const inp = blankInput();
      inp.tap = k % 7 === 0;
      step(st, [inp, ins[1]]);
      for (const e of st.ev) if (e.type === "tap" && e.tag === "miss") misses++;
    }
    ok("mashing the key off the beat is punished: misses and a knockout", misses > 5 && st.result?.method === "KO", [misses, st.result]);
  }
  // a badly hurt boxer must steady himself on his feet or the referee waves it off
  {
    const { st, ins } = setup(4);
    st.f[0].getup!.balance = true;
    const g = st.f[0].getup!;
    let k = 0, sawBalance = false;
    while (st.phase === "kd" && k++ < 60 * 16) {
      const inp = blankInput();
      const kd = st.kd!;
      if (g.stage === "rhythm") {
        const kk = Math.round((kd.t + 1 / 60 - g.first) / g.beat);
        if (kk >= 0 && kk !== g.lastBeat && Math.abs(kd.t + 1 / 60 - (g.first + kk * g.beat)) < 0.01) inp.tap = true;
      }
      if (st.f[0].getup?.stage === "balance") { sawBalance = true; inp.ms = st.f[0].getup!.needle > 0 ? 1 : -1; inp.ms = -inp.ms * 0 + 1; }
      step(st, [inp, ins[1]]);
    }
    ok("the balance check comes after the rise for a badly hurt boxer, and losing it gets the fight waved off", sawBalance && st.result?.method === "TKO" && /waved/.test(st.result.detail), [sawBalance, st.result]);
  }
  // the computer gets up, or stays down, by its own will
  {
    let up = 0, out = 0;
    for (let s = 0; s < 40; s++) {
      const st = createFight([by("tyson"), by("lewis")], { rounds: 3, roundSec: 120, tier: 2, human: false }, 300 + s);
      begin(st);
      const ins: [Input, Input] = [blankInput(), blankInput()];
      for (let k = 0; k < 30; k++) step(st, ins);
      st.f[1].headHP = s < 20 ? 70 : 4;
      testKnockDown(st, 1);
      let k = 0;
      while (st.phase === "kd" && k++ < 60 * 16) step(st, ins);
      if (st.phase === "fight") up++;
      else out++;
    }
    ok("the computer gets up when it can and stays down when it is badly hurt", up >= 15 && out >= 12, [up, out]);
  }
  // three knockdowns in one round
  {
    const st = createFight([by("ali"), by("frazier")], { rounds: 3, roundSec: 120, tier: 2, human: false }, 5);
    begin(st);
    const ins: [Input, Input] = [blankInput(), blankInput()];
    for (let n = 0; n < 3; n++) {
      for (let k = 0; k < 10 && st.phase === "fight"; k++) step(st, ins);
      st.f[1].headHP = 90;
      testKnockDown(st, 1);
      let k = 0;
      st.ai[1].riseAt = 3;
      while (st.phase === "kd" && k++ < 60 * 16) step(st, ins);
    }
    ok("three knockdowns in one round stop the fight", st.result?.method === "TKO" && st.result.detail === "three knockdowns in the round" && st.f[1].kdRound === 3, st.result);
  }
}

// ============================================================ stance and guard switches never stick (fuzz)
{
  const kinds = KINDS;
  const guards = ["high", "philly", "normal"] as const;
  const evs = ["slipL", "slipR", "duck", "back"] as const;
  let rs = 4242;
  const rnd = () => ((rs = (Math.imul(rs, 1103515245) + 12345) | 0) >>> 0) / 4294967296;
  const issues: unknown[] = [];
  for (let fz = 0; fz < 6; fz++) {
    const st = createFight([by("crawford"), by("pacquiao")], { rounds: 3, roundSec: 60, tier: 3, human: true }, 77 + fz);
    begin(st);
    for (let k = 0; k < 60 * 70 && st.phase !== "over"; k++) {
      if (st.phase === "pre") begin(st);
      if (st.phase === "corner") nextRound(st);
      const ins: [Input, Input] = [blankInput(), blankInput()];
      for (let i = 0; i < 2; i++) {
        const inp = ins[i];
        // every key at once, at random: punches, the body key, slips, guards, stance, clinch, sprint, feet
        inp.mf = rnd() * 2 - 1;
        inp.ms = rnd() * 2 - 1;
        if (rnd() < 0.3) inp.punch = kinds[Math.floor(rnd() * 6)];
        inp.body = rnd() < 0.5;
        if (rnd() < 0.15) inp.evade = evs[Math.floor(rnd() * 4)];
        if (rnd() < 0.08) inp.guard = guards[Math.floor(rnd() * 3)];
        inp.stance = rnd() < 0.01;
        inp.clinch = rnd() < 0.02;
        inp.sprint = rnd() < 0.05;
        inp.tap = rnd() < 0.3;
        inp.aimX = rnd() * 2 - 1;
        inp.aimY = rnd() * 2 - 1;
      }
      step(st, ins);
      for (let i = 0; i < 2; i++) {
        const g = ins[i].guard;
        if (g && st.f[i].guard !== g) issues.push(["guard did not take", fz, k, i, g, st.f[i].guard, st.phase]);
      }
      if (!validState(st)) { issues.push(["invalid state", fz, k]); break; }
      for (const f of st.f) if (f.action && ["punch", "evade", "stance", "hitstun"].includes(f.action.type) && f.action.t > 140) issues.push(["action stuck", fz, k, f.action.type, f.action.t]);
    }
  }
  // a single stance key press always switches the stance, whatever else is going on
  {
    const st = createFight([by("crawford"), by("pacquiao")], { rounds: 6, roundSec: 60, tier: 3, human: true }, 501);
    begin(st);
    let flips = 0, misses = 0;
    for (let n = 0; n < 60 && st.phase !== "over"; n++) {
      const before = st.f[0].stance;
      const press = blankInput();
      press.stance = true;
      press.punch = kinds[n % 6];
      step(st, [press, aiInput(st, 1, blankInput())]);
      let k = 0;
      while (st.f[0].stance === before && k++ < 200 && (st.phase as string) !== "over") {
        if (st.phase === "pre") begin(st);
        if (st.phase === "corner") nextRound(st);
        const inp = blankInput();
        if (rnd() < 0.2) inp.punch = kinds[Math.floor(rnd() * 6)];
        if (rnd() < 0.05) inp.evade = evs[Math.floor(rnd() * 4)];
        step(st, [inp, aiInput(st, 1, blankInput())]);
      }
      if (st.f[0].stance !== before) flips++;
      else if ((st.phase as string) !== "over") misses++;
    }
    ok("one press of the stance key always switches the stance (mid punch, mid slip, between rounds, in a clinch)", misses === 0 && flips > 20, [flips, misses]);
  }
  ok("every key at once for minutes: guards always take, nothing gets stuck, nothing goes NaN", issues.length === 0, issues.slice(0, 6));
  // a guard switch in the middle of a punch lands at once, a stance switch lands when the punch is done
  {
    const st = createFight([by("crawford"), by("pacquiao")], { rounds: 3, roundSec: 60, tier: 2, human: true }, 3);
    begin(st);
    const i0 = blankInput();
    i0.punch = "rhook";
    step(st, [i0, blankInput()]);
    const mid = blankInput();
    mid.guard = "philly";
    mid.stance = true;
    step(st, [mid, blankInput()]);
    ok("a guard switch mid punch lands at once", st.f[0].guard === "philly" && st.f[0].action?.type === "punch");
    ok("a stance switch mid punch waits for the punch", st.f[0].stance === by("crawford").stance && st.f[0].wantStance);
    for (let k = 0; k < 80; k++) step(st, [blankInput(), blankInput()]);
    ok("and then lands", st.f[0].stance !== by("crawford").stance && !st.f[0].wantStance, st.f[0].stance);
  }
}

// ============================================================ saving a fight mid round
{
  const { st: base } = (() => {
    const st = createFight([by("canelo"), by("golovkin")], { rounds: 6, roundSec: 120, tier: 3, human: false }, 31337);
    const ins: [Input, Input] = [blankInput(), blankInput()];
    let k = 0;
    while (k++ < 60 * 200) {
      if (st.phase === "pre") begin(st);
      if (st.phase === "corner") nextRound(st);
      aiInput(st, 0, ins[0]);
      aiInput(st, 1, ins[1]);
      step(st, ins);
    }
    return { st };
  })();
  const json = snapshot(base);
  const copy = restore(json)!;
  ok("a fight saved mid round comes back", !!copy && copy.round === base.round && copy.frame === base.frame && Math.abs(copy.clock - base.clock) < 1e-9);
  const finish = (st: FightState) => {
    const ins: [Input, Input] = [blankInput(), blankInput()];
    while (st.phase !== "over") {
      if (st.phase === "pre") begin(st);
      if (st.phase === "corner") nextRound(st);
      aiInput(st, 0, ins[0]);
      aiInput(st, 1, ins[1]);
      step(st, ins);
    }
    return JSON.stringify([st.result, st.cards, st.f.map(f => [f.fs, f.headHP, f.kdFight])]);
  };
  ok("and carries on exactly as it would have (same punches, same cards, same result)", finish(base) === finish(copy));
  ok("the saved fight is small", json.length < 120000, json.length);
  ok("a broken save is refused, never half loaded", restore("{") === null && restore("null") === null && restore(JSON.stringify({ v: 2 })) === null && restore(json.replace(/"headHP":[0-9.]+/, '"headHP":"x"')) === null);
  const nanSave = JSON.parse(json);
  nanSave.f[0].stamina = null;
  ok("a save with a missing number is refused", restore(JSON.stringify(nanSave)) === null);
}

// ============================================================ created fighters
{
  const long = "A".repeat(1000);
  const ch = (...c: number[]) => String.fromCharCode(...c);
  const weird = "  Tom" + ch(0, 0x200b) + "  " + ch(0x202e) + "O'Neil" + EM + "Smith" + EN + "Jr  \n\t";
  ok("a very long name is cut to the limit", cleanName(long, NAME_MAX).length === NAME_MAX);
  const w = cleanName(weird, NAME_MAX);
  ok("control characters, zero width marks and long dashes are cleaned from names", ![0, 0x200b, 0x202e].some(c => w.includes(String.fromCharCode(c))) && !w.includes(EM) && !w.includes(EN) && w.startsWith("Tom O'Neil-Smith"), w);
  const jose = "Jos" + ch(0xe9) + " " + ch(0xc1) + "lvarez", inoue = ch(0x4e95, 0x4e0a, 0x5c1a, 0x5f25);
  ok("names in other alphabets and with accents are kept", cleanName(jose, 24) === jose && cleanName(inoue, 24) === inoue);
  ok("an emoji name does not break the limit", Array.from(cleanName(ch(0xd83e, 0xdd4a).repeat(40), 24)).length === 24);
  const over = fitAttrs({ power: 95, speed: 95, chin: 95, stamina: 95, defense: 95 });
  ok("attributes over the budget are taken back to it", attrsUsed(over) === ATTR_BUDGET && Object.values(over).every(v => v >= ATTR_MIN && v <= ATTR_MAX), over);
  const junk = fitAttrs({ power: NaN, speed: -50, chin: 1e9, stamina: "x" as unknown as number, defense: undefined });
  ok("broken attributes fall back to safe numbers", Object.values(junk).every(v => Number.isInteger(v) && v >= ATTR_MIN && v <= ATTR_MAX) && attrsUsed(junk) <= ATTR_BUDGET, junk);
  const extreme = sanitize({ id: "x1", name: long, nick: long, country: "Atlantis", stance: "sideways", body: "giant", heightCm: 999, skin: 7, hair: 99, hairCol: -3, beard: 77, gloves: "red", trunks: ["#zzzzzz", 5], boots: null, attrs: { power: 999 } });
  ok("every creator option is clamped to what exists", extreme.name.length === NAME_MAX && extreme.nick.length <= 18 && extreme.country === "United States" && extreme.stance === "orthodox" && extreme.body === "athletic" && extreme.heightCm === 206 && extreme.skin === 1 && extreme.hair <= 15 && extreme.hairCol === 0 && extreme.beard <= 5 && /^#[0-9a-f]{6}$/.test(extreme.gloves) && extreme.trunks.every(c => /^#[0-9a-f]{6}$/.test(c)) && attrsUsed(extreme.attrs) <= ATTR_BUDGET, extreme);
  ok("an empty name gets a stand in", sanitize({ name: "   " }).name === "Unnamed Fighter");
  // every option, both stances, every body type: a fighter that fights
  const types = ["lean", "athletic", "muscular", "heavy"] as const;
  let allFight = true;
  for (let k = 0; k < 16; k++) {
    const c = sanitize({ ...defaultCreated(), id: "t" + k, name: "Test " + k, stance: k % 2 ? "southpaw" : "orthodox", body: types[k % 4], heightCm: 160 + k * 3, hair: k, beard: k % 6, attrs: { power: 40 + k * 3, speed: 95 - k * 3, chin: 72, stamina: 72, defense: 72 } });
    const d = toDef(c);
    const { st, seen } = runFight(d, by("ali"), 60 + k, { rounds: 3, roundSec: 60 }, { maxSteps: 60 * 70 });
    if (seen.nan >= 0 || d.weightKg < 50 || d.weightKg > 135 || !(d.reachIn > 60 && d.reachIn < 90) || st.f[0].rs.thrown + st.f[0].fs.thrown === 0) allFight = false;
  }
  ok("created fighters of every build, stance and spread become boxers that fight", allFight);
  // saving and loading on the device, through a stand in storage
  const mem = new Map<string, string>();
  save.useStore({ getItem: k => (mem.has(k) ? mem.get(k)! : null), setItem: (k, v) => void mem.set(k, v), removeItem: k => void mem.delete(k) });
  const saved = save.saveFighter({ ...extreme, id: "" });
  ok("a created fighter saves with a new id", !!saved && /^f[a-z0-9]+$/.test(saved.id));
  const back = save.listFighters();
  ok("and comes back exactly", back.length === 1 && JSON.stringify(back[0]) === JSON.stringify(saved));
  for (let k = 0; k < 45; k++) save.saveFighter({ ...defaultCreated(), name: "Fighter " + k, made: 1000 + k });
  const kept = save.listFighters();
  ok("at most 40 fighters are kept, the newest first", kept.length === save.MAX_FIGHTERS && kept.every((f, i) => i === 0 || kept[i - 1].made >= f.made) && kept.some(f => f.name === "Fighter 44") && !kept.some(f => f.name === "Fighter 0"), kept.map(f => f.name).slice(0, 5));
  const edit = { ...save.listFighters()[3], name: "Renamed" };
  save.saveFighter(edit);
  ok("editing a fighter keeps one copy of it", save.listFighters().filter(f => f.id === edit.id).length === 1 && save.getFighter(edit.id)!.name === "Renamed");
  save.deleteFighter(edit.id);
  ok("deleting a fighter removes it", !save.getFighter(edit.id));
  save.addResult("ali", true, true);
  save.addResult("ali", false, false);
  save.addResult("ali", null, false);
  ok("records count wins, losses, draws and knockouts", JSON.stringify(save.recordOf("ali")) === JSON.stringify({ w: 1, l: 1, d: 1, ko: 1 }) && save.recordText(save.recordOf("ali")) === "1-1-1 (1 KO)");
  mem.set(save.KEYS.fighters, "{not json");
  mem.set(save.KEYS.records, JSON.stringify({ __proto__x: 1, "bad key!": { w: 3 }, ali: { w: -4, l: "x", d: 2.7, ko: 1e12 } }));
  ok("a broken fighters save reads as empty instead of crashing", save.listFighters().length === 0);
  const rec = save.readRecords();
  ok("a hand edited records save is cleaned", !rec["bad key!"] && rec.ali.w === 0 && rec.ali.l === 0 && rec.ali.d === 2 && rec.ali.ko === 99999, rec);
  mem.set(save.KEYS.settings, JSON.stringify({ gfx: 9, rounds: 7, roundSec: 5, tier: 8, volume: 4, auto: "yes" }));
  const s = save.readSettings();
  ok("broken settings fall back to the defaults", [0, 1, 2, 3].includes(s.gfx) && [3, 6, 12].includes(s.rounds) && [60, 120, 180].includes(s.roundSec) && s.tier >= 0 && s.tier <= 4 && s.volume <= 1 && typeof s.auto === "boolean", s);
  // the fight in progress
  const live = createFight([by("ali"), by("tyson")], { rounds: 12, roundSec: 180, tier: 4, human: true }, 9);
  begin(live);
  for (let k = 0; k < 600; k++) step(live, [blankInput(), aiInput(live, 1, blankInput())]);
  save.saveFight("ali", "tyson", live);
  const lf = save.loadFight();
  ok("the fight in progress saves and loads", !!lf && lf.me === "ali" && lf.them === "tyson" && lf.state.frame === live.frame && lf.state.phase === live.phase);
  mem.set(save.KEYS.fight, JSON.stringify({ me: "ali", them: "tyson", at: 1, state: "{broken" }));
  ok("a broken fight save is thrown away, never half loaded", save.loadFight() === null && !mem.has(save.KEYS.fight));
  live.phase = "over";
  save.saveFight("ali", "tyson", live);
  ok("a finished fight is not kept", !mem.has(save.KEYS.fight));
  save.useStore({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
  ok("blocked storage never throws: nothing is remembered and the game goes on", save.listFighters().length === 0 && save.saveFighter(defaultCreated()) === null && save.loadFight() === null && save.readSettings().gfx >= 0);
  save.useStore(null);
}

// ============================================================ the fight systems, one at a time
{
  const human: FightConfig = { rounds: 3, roundSec: 180, tier: 2, human: true };
  const solo = (a = "ali", b = "frazier", seed = 1) => {
    const st = createFight([by(a), by(b)], human, seed);
    begin(st);
    return st;
  };
  const place = (st: FightState, d: number) => {
    st.f[0].x = -d / 2; st.f[0].z = 0; st.f[1].x = d / 2; st.f[1].z = 0;
    for (const f of st.f) { f.vx = f.vz = 0; }
  };
  const idle: Input = blankInput();
  // range: too far misses, too close smothers
  {
    const st = solo();
    place(st, 2.2);
    const p = blankInput(); p.punch = "cross";
    const evs: string[] = [];
    step(st, [p, idle]);
    for (let k = 0; k < 40; k++) { place(st, 2.2); step(st, [idle, idle]); evs.push(...st.ev.map(e => e.type + ":" + (e.tag || ""))); }
    ok("a punch thrown from too far whiffs", evs.some(e => e.startsWith("miss")), evs);
    const st2 = solo("ali", "frazier", 2);
    st2.f[1].guard = "normal";
    let smother = 0, total = 0;
    for (let n = 0; n < 60; n++) {
      place(st2, 0.57);
      const q = blankInput(); q.punch = "jab";
      step(st2, [q, idle]);
      for (let k = 0; k < 25; k++) { place(st2, 0.57); step(st2, [idle, idle]); for (const e of st2.ev) if (e.type === "hit") { total++; if (e.tag === "smothered") smother++; } }
      st2.f[1].headHP = 100; st2.f[1].stun = 0; st2.f[1].rocked = 0;
      if (st2.phase !== "fight") break;
    }
    ok("a jab thrown chest to chest is smothered", total === 0 || smother >= Math.ceil(total * 0.4), [smother, total]);
  }
  // spam: the same punch over and over gets slower; a flowing combination gets faster
  {
    const st = solo("ali", "frazier", 3);
    place(st, 3.5);
    const startups: number[] = [];
    for (let n = 0; n < 9; n++) {
      const p = blankInput(); p.punch = "jab";
      step(st, [p, idle]);
      if (st.f[0].action?.type === "punch") startups.push(st.f[0].action.startup! + st.f[0].action.recovery!);
      while (st.f[0].action) { place(st, 3.5); step(st, [idle, idle]); }
    }
    ok("spamming one punch makes it slower and sloppier", startups.length === 9 && startups[8] > startups[0] && st.f[0].spam > 0.4, startups);
    const st2 = solo("ali", "frazier", 4);
    place(st2, 3.5);
    for (let k = 0; k < 240; k++) step(st2, [idle, idle]);
    const c1 = blankInput(); c1.punch = "cross";
    step(st2, [c1, idle]);
    const alone = st2.f[0].action!.startup!;
    while (st2.f[0].action) { place(st2, 3.5); step(st2, [idle, idle]); }
    for (let k = 0; k < 240; k++) step(st2, [idle, idle]);
    const j1 = blankInput(); j1.punch = "jab";
    step(st2, [j1, idle]);
    let flowed = 0;
    for (let k = 0; k < 40; k++) {
      place(st2, 3.5);
      const c = blankInput(); c.punch = "cross";
      step(st2, [c, idle]);
      const act = st2.f[0].action as { kind?: string; startup?: number } | null;
      if (act?.kind === "cross") { flowed = act.startup!; break; }
    }
    ok("a jab and cross flows: the cross comes out faster and the combination counts", flowed > 0 && flowed < alone && st2.f[0].combo >= 1, [alone, flowed, st2.f[0].combo]);
  }
  // guards: the high guard takes head shots and leaves the body open, the Philly shell rolls the cross
  {
    const tally = (guard: "high" | "philly" | "normal", kind: "cross" | "lhook" | "rhook" | "jab", body: boolean) => {
      let blocked = 0, landed = 0;
      for (let n = 0; n < 120; n++) {
        const st = solo("lewis", "mayweather", 100 + n);
        place(st, 1.0);
        st.f[1].guard = guard;
        st.defs[1] = { ...st.defs[1], attrs: { ...st.defs[1].attrs, defense: 40 } };
        const p = blankInput(); p.punch = kind; p.body = body;
        step(st, [p, idle]);
        for (let k = 0; k < 30; k++) { place(st, 1.0); step(st, [idle, idle]); for (const e of st.ev) { if (e.type === "block") blocked++; if (e.type === "hit") landed++; } }
      }
      return blocked / Math.max(1, blocked + landed);
    };
    const hiHead = tally("high", "cross", false), hiBody = tally("high", "cross", true), noHead = tally("normal", "cross", false);
    ok("the high guard blocks most head shots and few body shots", hiHead > 0.7 && hiBody < 0.25 && hiHead > noHead, [hiHead, hiBody, noHead]);
    const phCross = tally("philly", "cross", false), phLeadHook = tally("philly", "lhook", false);
    ok("the Philly shell takes crosses on the shoulder and is open to the lead hook", phCross > 0.6 && phLeadHook < 0.45, [phCross, phLeadHook]);
    // a timed roll against a cross: the punch rolls off and the counter opens
    let rolled = 0, perfect = 0, slowSet = 0;
    for (let n = 0; n < 30; n++) {
      const st = createFight([by("mayweather"), by("lewis")], human, 400 + n);
      begin(st);
      place(st, 1.0);
      st.f[0].guard = "philly";
      const p = blankInput(); p.punch = "cross";
      step(st, [idle, p]);
      const su = st.f[1].action!.startup!;
      for (let k = 1; k < 40; k++) {
        place(st, 1.0);
        const me = blankInput();
        if (k === su - 4) me.evade = "back";
        step(st, [me, idle]);
        for (const e of st.ev) { if (e.type === "evade" && e.tag === "roll") rolled++; if (e.type === "perfect") perfect++; }
        if (st.slow) slowSet++;
      }
    }
    ok("lean back in the Philly shell is a shoulder roll: a timed roll takes the cross", rolled >= 20, rolled);
    ok("a perfect roll opens a counter and asks the page for slow motion", perfect >= 15 && slowSet >= 15 , [perfect, slowSet]);
  }
  // slips: a slip in time beats the cross, slipping into a hook is worse than standing still
  {
    let slipped = 0, caught = 0;
    for (let n = 0; n < 30; n++) {
      const st = createFight([by("ali"), by("lewis")], human, 600 + n);
      begin(st);
      place(st, 1.0);
      const p = blankInput(); p.punch = "cross";
      step(st, [idle, p]);
      const su = st.f[1].action!.startup!;
      for (let k = 1; k < 40; k++) { place(st, 1.0); const me = blankInput(); if (k === su - 5) me.evade = "slipL"; step(st, [me, idle]); for (const e of st.ev) if (e.type === "evade") slipped++; }
      const st2 = createFight([by("ali"), by("lewis")], human, 700 + n);
      begin(st2);
      place(st2, 0.8);
      st2.f[0].guard = "normal";
      const h = blankInput(); h.punch = "lhook";
      step(st2, [idle, h]);
      const su2 = st2.f[1].action!.startup!;
      // Lewis's lead hook (left hand) lands on Ali's right: slipping right walks into it
      for (let k = 1; k < 40; k++) { place(st2, 0.8); const me = blankInput(); if (k === su2 - 5) me.evade = "slipR"; step(st2, [me, idle]); for (const e of st2.ev) if (e.type === "hit" && e.tag === "caught") caught++; }
    }
    ok("a slip in time beats the cross", slipped >= 25, slipped);
    ok("slipping into a hook gets you caught", caught >= 5, caught);
  }
  // body work slows a boxer down and takes his stamina away
  {
    const st = solo("canelo", "ali", 9);
    const before = { max: st.f[1].maxStam };
    let n = 0;
    while (n < 40 && st.phase === "fight") {
      place(st, 0.7);
      st.f[1].guard = "high";
      const p = blankInput(); p.punch = n % 2 ? "lhook" : "rhook"; p.body = true;
      step(st, [p, idle]);
      for (let k = 0; k < 30 && st.phase === "fight"; k++) { place(st, 0.7); step(st, [idle, idle]); }
      n++;
    }
    ok("body work takes his top stamina away and wears his body down", st.f[1].maxStam < before.max - 5 && st.f[1].bodyHP < 80, [st.f[1].maxStam, st.f[1].bodyHP]);
  }
  // the clinch: buys time, the referee breaks it, holding costs a warning then points
  {
    const st = solo("ali", "frazier", 11);
    const warns: string[] = [];
    let clinches = 0;
    for (let n = 0; n < 40 && clinches < 7 && st.phase === "fight"; n++) {
      place(st, 0.7);
      const c = blankInput(); c.clinch = true;
      step(st, [c, idle]);
      if (st.clinch) clinches++;
      for (const e of st.ev) if (e.type === "warn" || e.type === "deduct") warns.push(e.type);
      let k = 0;
      while ((st.clinch || st.f[0].action) && k++ < 400) step(st, [idle, idle]);
      ok("the referee breaks every clinch and they come apart", !st.clinch && k < 400, k);
      if (n > 1) break;
    }
    // straight to the holding rule
    const st2 = solo("ali", "frazier", 12);
    let got = 0;
    const seen: string[] = [];
    for (let n = 0; n < 80 && got < 7 && st2.phase === "fight"; n++) {
      place(st2, 0.7);
      const c = blankInput(); c.clinch = true;
      step(st2, [c, idle]);
      if (st2.clinch) got++;
      for (const e of st2.ev) if (e.type === "warn" || e.type === "deduct") seen.push(e.type);
      let k = 0;
      while ((st2.clinch || st2.f[0].action) && k++ < 400) step(st2, [idle, idle]);
    }
    ok("holding: a warning on the fourth clinch of a round, points from the sixth", seen[0] === "warn" && seen.filter(x => x === "deduct").length === got - 5 && st2.f[0].rs.deducted === got - 5, [got, seen]);
    // play out the round: the card shows the point
    while (st2.phase === "fight") step(st2, [idle, idle]);
    while (st2.phase === "bell") step(st2, [idle, idle]);
    const pts = st2.cards.map(c => c[0]);
    ok("the point taken away is on every judge's card", pts.every(c => c[0] + st2.rounds[0][0].deducted <= 10 && c[0] <= 10 - st2.rounds[0][0].deducted), pts);
  }
  // the computer reads a spammed punch, then times it and counters it (measured against the same computer with
  // its reading switched off)
  {
    const spamRun = (adapt: boolean) => {
      let counters = 0, thrownAll = 0, dmgIn = 0, dmgOut = 0, reads = 0;
      for (let s = 0; s < 8; s++) {
        const st = createFight([by("lewis"), by("crawford")], { rounds: 3, roundSec: 180, tier: 3, human: true }, 800 + s);
        begin(st);
        let thrown = 0;
        while (st.phase === "fight" && thrown < 70) {
          const me = blankInput();
          const d = Math.hypot(st.f[1].x - st.f[0].x, st.f[1].z - st.f[0].z);
          me.mf = d > 1.15 ? 1 : d < 0.95 ? -1 : 0;
          if (!st.f[0].action && d < 1.3) { me.punch = "jab"; thrown++; }
          const ai = aiInput(st, 1, blankInput());
          if (adapt && st.ai[1].read === "jab") reads++;
          if (!adapt) st.ai[1].read = null;
          step(st, [me, ai]);
          if (thrown <= 20) continue;
          for (const e of st.ev) {
            if (e.who === 1 && e.type === "hit") { counters++; dmgIn += e.dmg!; }
            if (e.who === 0 && e.type === "hit") dmgOut += e.dmg!;
          }
        }
        thrownAll += Math.max(0, thrown - 20);
      }
      return { perPunch: counters / Math.max(1, thrownAll), dmgIn, dmgOut, reads };
    };
    const adapts = spamRun(true), blind = spamRun(false);
    ok("the computer reads a spammed jab", adapts.reads > 0);
    ok("then times it and counters it: far more counters land on the spammer than when it does not adapt", adapts.perPunch > blind.perPunch * 1.5, [adapts, blind]);
    ok("and spamming the jab loses the exchange once it has been read", adapts.dmgIn > adapts.dmgOut && adapts.dmgIn - adapts.dmgOut > blind.dmgIn - blind.dmgOut, [adapts, blind]);
  }
  // tiers: Nightmare beats the same boxer at Tune up far more often
  {
    let hard = 0, easy = 0;
    for (let s = 0; s < 14; s++) {
      for (const tier of [0, 4] as Tier[]) {
        const st = createFight([by("delahoya"), by("delahoya")], { rounds: 3, roundSec: 60, tier, human: true }, 900 + s);
        const ins: [Input, Input] = [blankInput(), blankInput()];
        while (st.phase !== "over") {
          if (st.phase === "pre") begin(st);
          if (st.phase === "corner") nextRound(st);
          aiInput(st, 0, ins[0]);
          aiInput(st, 1, ins[1]);
          step(st, ins);
        }
        // the computer is corner 1; the stand in for the person plays at Champion
        if (st.result!.winner === 1) { if (tier === 4) hard++; else easy++; }
      }
    }
    ok("Nightmare wins far more often than Tune up with the same boxer", hard >= easy + 4, [hard, easy]);
  }
  // attributes show: a fast boxer's punches come out faster, a puncher's land harder
  {
    const stA = solo("jones", "foreman", 1), stB = solo("foreman", "jones", 1);
    const p = blankInput(); p.punch = "cross";
    step(stA, [p, idle]); step(stB, [p, idle]);
    ok("speed shows: Roy Jones's cross comes out faster than Foreman's", stA.f[0].action!.startup! < stB.f[0].action!.startup!, [stA.f[0].action!.startup, stB.f[0].action!.startup]);
    let dJ = 0, dF = 0;
    for (let n = 0; n < 60; n++) {
      for (const [a, b, add] of [["jones", "frazier", (x: number) => (dJ += x)], ["foreman", "frazier", (x: number) => (dF += x)]] as const) {
        const st = solo(a, b, 2000 + n);
        place(st, 1.0);
        st.f[1].guard = "normal";
        const q = blankInput(); q.punch = "cross";
        step(st, [q, idle]);
        for (let k = 0; k < 30; k++) { place(st, 1.0); step(st, [idle, idle]); for (const e of st.ev) if (e.type === "hit") add(e.dmg!); }
      }
    }
    ok("power shows: Foreman's crosses do more damage than Roy Jones's", dF > dJ * 1.2, [dF, dJ]);
  }
  // the corner gives back some health and stamina, more for a better chin and condition
  {
    const st = solo("marciano", "hearns", 5);
    for (const f of st.f) { f.headHP = 40; f.bodyHP = 40; f.stamina = 20; }
    st.clock = 0.02;
    while (st.phase === "fight" || st.phase === "bell") step(st, [idle, idle]);
    ok("the round ends in the corner with a recovery for both", st.phase === "corner" && !!st.recover && st.f.every(f => f.headHP > 40 && f.stamina > 20), st.f.map(f => [f.headHP, f.stamina]));
    ok("a better chin gets more back between rounds (Marciano over Hearns)", st.f[0].headHP > st.f[1].headHP, st.f.map(f => f.headHP));
    ok("health only partly comes back", st.f.every(f => f.headHP < 90), st.f.map(f => f.headHP));
  }
  // performance: a whole 12 round fight in well under two seconds
  {
    const t = Date.now();
    runFight(by("ali"), by("frazier"), 1, { rounds: 12, roundSec: 180 });
    ok("a full twelve rounds of three minutes simulates in under two seconds", Date.now() - t < 2000, Date.now() - t);
  }
}

function e_isPerfectCounter(st: FightState) {
  return st.ev.some(e => e.type === "perfect");
}

// ============================================================ wording
{
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const dir = path.join(__dirname, "..", "src", "prize");
  const files: string[] = [];
  const walk = (d: string) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else files.push(p); } };
  walk(dir);
  const dashy = files.filter(f => { const s = fs.readFileSync(f, "utf8"); return s.includes(EM) || s.includes(EN); });
  ok("no em or en dashes anywhere in PRIZE FIGHTER's code", dashy.length === 0, dashy);
  ok("the punch table is complete", KINDS.length === 6 && KINDS.every(k => PUNCH[k].startup > 0 && PUNCH[k].dmg > 0));
}

console.log(passed + " passed, " + failed + " failed (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)");
process.exit(failed ? 1 : 0);
