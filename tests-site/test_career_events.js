// Player Career events and the simmed season. Checks the thousand newer life events (events_more.js) for their
// shape, their words and their effects, reads every one of them for made up careers at each stage and for a real
// career in a real city, then sims seasons through the API: the calm answers, where a sim stops, money that fits
// his life, and a save from before this update brought back after a restart.
// Run: node tests-site/test_career_events.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const PORT = process.env.CAREER_EVENTS_PORT || "3493";
const BASE = "http://127.0.0.1:" + PORT;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fl-career-events-"));
const SAVE = path.join(tmp, "games.json");
const EM = String.fromCharCode(8212), EN = String.fromCharCode(8211);
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 400)); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(p, body) {
  const r = await fetch(BASE + p, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j: j || {} };
}
function hasNaN(o) {
  if (typeof o === "number") return !Number.isFinite(o);
  if (!o || typeof o !== "object") return false;
  for (const v of Object.values(o)) if (hasNaN(v)) return true;
  return false;
}
const FORM = (over) => Object.assign({
  first: "Aarav", last: "Mehta", nick: "AM", dobY: 2011, dobM: 3, dobD: 14, country: "India", nat: "India", lang: "Hindi",
  foot: "Right", height: 177, weight: 66, pos: "ST", pos2: "CAM", num: 9, style: "Poacher",
  look: { skinF: 0.55, hair: 3, hairCol: 0, beard: 0, muscle: 0.5, eyeCol: 2, watch: "steel", boot: 6 }
}, over || {});

// the words of an event: real sentences, nothing left blank, no dashes
function badWords(s) {
  if (typeof s !== "string" || !s.trim()) return "empty";
  if (/undefined|null|NaN|\[object|[{}]/.test(s)) return "a blank";
  if (s.includes(EM) || s.includes(EN)) return "a dash";
  if (/ {2}|\s[.,!?]|(?<!\.)\.\.(?!\.)/.test(s)) return "a stray space or stop";
  return "";
}
// sim the season the way the page does: slice after slice until it stops, the replies put together
async function simAll(P, slice) {
  let all = null, slices = 0;
  for (let i = 0; i < 300; i++) {
    const r = await P("/api/pc/simseason", slice ? { slice } : {});
    if (r.status !== 200) return all ? { status: r.status, j: Object.assign({ partial: all }, r.j) } : r;
    slices++;
    all = all ? Object.assign(all, { reports: all.reports.concat(r.j.reports), auto: all.auto.concat(r.j.auto), state: r.j.state, more: r.j.more, stopped: r.j.stopped }) : Object.assign({}, r.j);
    if (!r.j.more) break;
  }
  all.slices = slices;
  return { status: 200, j: all };
}
const FX = new Set(["rel", "morale", "conf", "form", "fatigue", "cash", "local", "national", "commercial", "followers", "prof", "disc", "lead", "time", "injuryRisk", "act", "table", "spend", "earn"]);
const RELS = new Set(["mum", "dad", "sib", "friend", "best", "team", "coach", "agent", "fr", "pt"]);
const KINDS = new Set(["life", "family", "friend", "partner", "team", "media", "agent"]);

async function main() {
  // ---------- static: the house rules ----------
  for (const f of ["floodlights/career/events_more.js", "floodlights/career/people.js", "src/career/Hub.tsx", "src/career/api.ts", "tests-site/test_career_events.js"]) {
    const t = fs.readFileSync(path.join(root, f), "utf8");
    ok(f + " has no em or en dashes", !t.includes(EM) && !t.includes(EN), null);
  }

  // ---------- the events themselves, read straight from the module ----------
  const D = require(path.join(root, "floodlights/career/data.js"));
  const { makePeople } = require(path.join(root, "floodlights/career/people.js"));
  const moneyLog = [];
  const K = {
    C: g => g.career, me: g => g.p, msg() {}, news() {},
    money: (g, amt, text) => { g.career.money.cash = Math.round(g.career.money.cash + amt); moneyLog.push({ amt: Math.round(amt), text }); },
    injure: () => ({ weeks: 1 }), requestTransfer: () => ({}),
    social: { partner: () => ({ id: "d:in:1", first: "Maya", rel: 60, stage: "serious" }), closest: () => ({ id: "f:1", first: "Kabir", rel: 70 }) },
    life: null,
  };
  const P = makePeople(K, {});
  const EV = P.EVENTS, MORE = EV.filter(e => e.more);
  ok("a thousand newer events or more", MORE.length >= 1000, MORE.length);
  ok("every event has its own id", new Set(EV.map(e => e.id)).size === EV.length, EV.length);
  ok("the newer ones come in families of a few each", new Set(MORE.map(e => e.fam)).size >= 120 && MORE.every(e => e.id.startsWith("x_" + e.fam + "_")), new Set(MORE.map(e => e.fam)).size);
  const shape = EV.filter(e => !KINDS.has(e.kind) || !(e.weight > 0) || typeof e.when !== "function" || !Array.isArray(e.choices) || e.choices.length < 2 || e.choices.length > 4 || new Set(e.choices.map(c => c.id)).size !== e.choices.length || e.choices.some(c => !c.label || badWords(c.label)));
  ok("every event has a kind, a weight, a test and two to four real choices", !shape.length, shape.slice(0, 3).map(e => e.id));
  const fx = EV.filter(e => e.choices.some(c => Object.keys(c.fx).some(k => !FX.has(k)) || Object.keys(c.fx.rel || {}).some(k => !RELS.has(k)) || [c.fx.spend, c.fx.earn].some(v => v !== undefined && ![1, 2, 3].includes(v))));
  ok("every effect is one the game knows", !fx.length, fx.slice(0, 3).map(e => e.id));
  const pt = MORE.filter(e => e.choices.some(c => c.fx.rel && (c.fx.rel.pt !== undefined || c.fx.rel.fr !== undefined)) && !e.who);
  ok("only an event about someone moves how that someone feels", !pt.length, pt.slice(0, 3).map(e => e.id));
  const calm = EV.filter(e => !e.calm || !e.choices.some(c => c.id === e.calm));
  ok("every event names its calm answer", !calm.length, calm.slice(0, 3).map(e => e.id));
  const wild = EV.filter(e => { const c = e.choices.find(x => x.id === e.calm); return c && (c.fx.act || c.fx.table || c.fx.injuryRisk > 0 || c.fx.cash < -3000); });
  ok("a calm answer is never a career move, a gamble or a risk to his body", !wild.length, wild.slice(0, 3).map(e => e.id));
  ok("the hand written ones keep their calm answers (a lads' night is dinner, not a night out)", P.calmOf(EV.find(e => e.id === "ladsnight")) === "dinner" && P.calmOf(EV.find(e => e.id === "late")) === "ten" && P.calmOf(EV.find(e => e.id === "abroad")) !== "mum", null);
  const wMore = MORE.reduce((s, e) => s + e.weight, 0), wBase = EV.filter(e => !e.more).reduce((s, e) => s + e.weight, 0);
  ok("the newer events turn up about as often as the old ones together, each one rarely", wMore > wBase * 0.8 && wMore < wBase * 2.5 && MORE.every(e => e.weight <= 0.2), [wMore, wBase]);

  // made up careers at every stage: every event reads cleanly for each of them
  const fake = (stage, age, extra) => {
    const c = Object.assign({
      person: { first: "Aarav", country: "India" }, city: "Mumbai", stage, rep: { local: 40, national: 20, commercial: 30 }, money: { cash: 50000, log: [] },
      cond: { morale: 60, confidence: 60, form: 6, fatigue: 20, inj: stage === "pro" ? { weeks: 2 } : null }, traits: { professionalism: 50, discipline: 50, leadership: 50 },
      attrs: { leadership: 50 }, life: { car: "civic", followers: 20000, time: 6 }, offers: [], trust: 50, coachRel: 50, stats: { log: [] },
    }, extra || {});
    const g = { career: c, p: { age, club: stage === "pro" ? "Mumbai City FC" : null, rating: 60 }, season: 1, round: 3 };
    const pp = P.P0(g);
    pp.best = { name: "Rohan Das", club: "x", rel: 60 };
    if (!pp.sib) pp.sib = { name: "Meera", kind: "sister", older: false, rel: 60 };
    return g;
  };
  const careers = {
    school: fake("school", 15, { school: D.SCHOOLS[0].id }),
    college: fake("college", 17, { college: D.COLLEGES[0].id }),
    academy: fake("academy", 16, { academy: { club: "Arsenal" }, person: { first: "Sam", country: "England" }, city: "London" }),
    centre: fake("centre", 16, { centre: { name: "Lagos Football Centre" }, person: { first: "Tobi", country: "Nigeria" }, city: "Lagos" }),
    pro: fake("pro", 24),
  };
  // and one with no brother or sister, no close friend and no partner: what can come up still reads
  const lone = fake("school", 15, { school: D.SCHOOLS[0].id });
  P.P0(lone).sib = null;
  {
    const social = K.social;
    K.social = { partner: () => null, closest: () => null };
    const bad = [];
    for (const e of EV) {
      const who = e.who ? e.who(lone) : null;
      if (e.who && !who) continue;
      if (e.id === "sibmoney" || !e.when(lone, lone.career, lone.p)) continue;
      try { for (const part of ["tease", "title", "text"]) { const v = typeof e[part] === "function" ? e[part](lone, lone.career, who) : e[part]; if (badWords(v)) { bad.push([e.id, part, v]); break; } } }
      catch (err) { bad.push([e.id, "threw", String(err.message)]); }
    }
    K.social = social;
    ok("every event that can come up reads cleanly for a boy with no brother, sister, friend or partner", !bad.length, bad.slice(0, 3));
  }
  for (const [stage, g] of Object.entries(careers)) {
    const bad = [];
    let can = 0;
    for (const e of EV) {
      const who = e.who ? e.who(g) : null;
      try {
        for (const part of ["tease", "title", "text"]) {
          const v = typeof e[part] === "function" ? e[part](g, g.career, who) : e[part];
          const why = badWords(v);
          if (why) { bad.push([e.id, part, why, v]); break; }
        }
        if (e.when(g, g.career, g.p)) can++;
      } catch (err) { bad.push([e.id, "threw", String(err.message)]); }
    }
    ok("every event reads cleanly for a " + stage + " career", !bad.length, bad.slice(0, 3));
    ok("a " + stage + " career has hundreds of events that can come up", can >= 300, can);
  }
  const school = careers.school, pro = careers.pro;
  const canAt = (g, id) => { const e = EV.find(x => x.id === id); return e.when(g, g.career, g.p); };
  ok("school life only at school, away days only for a pro", canAt(school, "x_schoollife_play") && !canAt(pro, "x_schoollife_play") && canAt(pro, "x_away_bus") && !canAt(school, "x_away_bus"), null);

  // spend and earn: sums that fit his life
  {
    const g = fake("school", 15, { school: D.SCHOOLS[0].id, money: { cash: 1000, log: [] } });
    P.force(g, "x_house_boiler");
    let r = P.answer(g, "x_house_boiler", "fix");
    ok("a schoolboy pays a small sum for a small thing", r.ok && g.career.money.cash === 990 && moneyLog[moneyLog.length - 1].text === "Trouble at home", [g.career.money.cash, moneyLog.slice(-1)]);
    g.career.money.cash = 0;
    P.force(g, "x_house_leak");
    P.answer(g, "x_house_leak", "fix");
    ok("and never goes below nothing for it", g.career.money.cash === 0, g.career.money.cash);
    const rich = fake("pro", 26, { money: { cash: 1000000, log: [] }, contract: { wage: 40000, club: "Mumbai City FC" } });
    P.force(rich, "x_deals_boots");
    P.answer(rich, "x_deals_boots", "yes");
    ok("a star's brand deal is a star's sum", rich.career.money.cash === 1000000 + 24000, rich.career.money.cash - 1000000);
    rich.career.money.cash = 1000000;
    P.force(rich, "x_rich2_watch");
    P.answer(rich, "x_rich2_watch", "buy");
    ok("and a big spend is a big sum", rich.career.money.cash === 1000000 - 72000, 1000000 - rich.career.money.cash);
  }
  // the calm answer for a simmed week
  {
    const g = fake("school", 15, { school: D.SCHOOLS[0].id });
    P.force(g, "late");
    const a = P.autoAnswer(g);
    ok("a waiting event gets its calm answer", a && a.id === "late" && a.choice === "Log off at ten." && !P.P0(g).pending && P.P0(g).log[0].id === "late", a);
    P.P0(g).pending = { id: "an_old_event", kind: "life", title: "Gone", tease: "", text: "", choices: [{ id: "a", label: "A." }] };
    ok("an event that is no longer in the game is let go, not stuck", P.autoAnswer(g) === null && !P.P0(g).pending, P.P0(g).pending);
  }
  // no two from one family close together
  {
    const g = fake("school", 15, { school: D.SCHOOLS[0].id });
    const pp = P.P0(g);
    pp.log = [{ id: "x_wallet_bus" }];
    const seen = new Set();
    for (let i = 0; i < 400; i++) { pp.pending = null; pp.lastEvent = -9; g.round = 5; P.afterWeek(g, {}); if (pp.pending) seen.add(pp.pending.id); }
    ok("a lost wallet is not followed by another lost wallet", ![...seen].some(id => id.startsWith("x_wallet_")) && seen.size > 30, seen.size);
    ok("and the newer events do come up", [...seen].filter(id => id.startsWith("x_")).length > 20, [...seen].slice(0, 5));
  }

  // ---------- through the server ----------
  const server = spawn("node", [path.join(root, "floodlights", "server.js")], { env: Object.assign({}, process.env, { PORT, FL_SAVE_FILE: SAVE, FL_TEST_HOOKS: "1" }), stdio: "ignore" });
  let srv = server;
  const stop = () => { try { srv.kill(); } catch (e) {} };
  process.on("exit", () => { stop(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} });
  const up = async () => { for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + "/floodlights/")).ok) return true; } catch (e) {} await sleep(250); } return false; };
  try {
    ok("the server starts", await up(), null);
    let r = await api("/api/pc/create", { name: "Ev", player: FORM() });
    const code = r.j.code;
    const Q = (p2, b) => api(p2, Object.assign({ code, name: "Ev" }, b || {}));
    r = await Q("/api/pc/simseason");
    ok("the season waits for the school to be picked", r.status === 400 && r.j.decision && r.j.decision.kind === "school", r.j);
    await Q("/api/pc/decide", { id: "school", choice: "asb" });

    // every event read for a real career in a real city
    r = await Q("/api/pc/testset", { preview: true });
    const prev = r.j.events || [];
    ok("every event can be read for him", prev.length === EV.length, prev.length);
    const bad = prev.filter(e => e && e.who !== false && (e.can || !e.error) && ["tease", "title", "text"].some(k => badWords(e[k])));
    ok("and every one that can come up for him reads cleanly", !bad.length, bad.slice(0, 2));
    const st0 = (await api(`/api/pc/state?code=${code}&name=Ev`)).j.state;
    const cafes = st0.life.world.places.filter(p => p.kind === "cafe").map(p => p.name);
    const own = prev.find(e => e && e.id === "x_locals_owner");
    ok("they name his own city and his own cafe", own && cafes.some(n => own.text.includes(n)) && own.text.includes("Mumbai"), [own && own.text, cafes]);
    const calmOf = new Map(prev.filter(e => e && e.choices).map(e => [e.id, (e.choices.find(c => c.id === e.calm) || {}).label]));
    // a boy with no brother or sister (about one career in three): every event he can get still reads
    for (let i = 0; i < 16; i++) {
      const lr = await api("/api/pc/create", { name: "Lone" + i, player: FORM({ first: "Kiran", last: "Shah" }) });
      if (lr.status !== 200 || lr.j.state.people.family.length !== 2) continue;
      const lp = await api("/api/pc/testset", { code: lr.j.code, name: "Lone" + i, preview: true });
      const lbad = (lp.j.events || []).filter(e => e && e.who !== false && (e.can || !e.error) && ["tease", "title", "text"].some(k => badWords(e[k])));
      ok("with no brother or sister every event that can come up reads cleanly", lp.status === 200 && (lp.j.events || []).length === EV.length && !lbad.length, [lp.status, lbad.slice(0, 2)]);
      break;
    }

    // a waiting event is answered the calm way when the season is simmed
    r = await Q("/api/pc/testset", { event: "late" });
    r = await simAll(Q);
    ok("sim the season plays on", r.status === 200 && r.j.reports.length >= 1 && ["season", "decision", "offer"].includes(r.j.stopped), r.j.error || r.j.stopped);
    ok("the event that was waiting got the calm answer", r.status === 200 && r.j.auto[0] && r.j.auto[0].id === "late" && r.j.auto[0].choice === "Log off at ten.", r.j.auto && r.j.auto[0]);
    // the hub shows his 12 latest answers: a season busy enough can push this one out of sight
    ok("and he remembers it", r.status === 200 && (r.j.auto.length > 12 || r.j.state.people.log.some(x => x.id === "late" && x.choice === "Log off at ten.")), r.j.auto && r.j.auto.length);

    // seasons simmed one after another: it stops only for him, and life keeps happening on the way
    const stops = {}, autos = [];
    let seasons = 0, guard = 0, stuck = "", weeks = 0, st = null;
    while (seasons < 3 && guard++ < 80) {
      r = await simAll(Q);
      if (r.status !== 200) {
        if (r.j.seasonOver) { const n = await Q("/api/pc/season"); if (n.status === 200) seasons++; else if (n.j.decision) { const d = n.j.decision; await Q("/api/pc/decide", { id: d.id, choice: d.options[0] }); } continue; }
        if (r.j.decision) { const d = r.j.decision; await Q("/api/pc/decide", { id: d.id, choice: d.kind === "agent" ? "none" : d.kind === "trial" ? "decline" : d.options[0] }); continue; }
        stuck = r.j.error || String(r.status); break;
      }
      st = r.j.state;
      stops[r.j.stopped] = (stops[r.j.stopped] || 0) + 1;
      weeks += r.j.reports.length;
      autos.push(...r.j.auto);
      if (r.j.stopped === "season") ok("a sim that ran to the end leaves the season over", st.seasonOver === true, st.round);
      if (r.j.stopped === "decision") ok("a sim that stopped for a choice leaves that choice waiting", st.decisions.some(d => !d.optional), st.decisions);
      if (r.j.stopped === "decision") { const d = st.decisions.find(x => !x.optional); await Q("/api/pc/decide", { id: d.id, choice: d.kind === "agent" ? "none" : d.kind === "trial" ? "decline" : d.options[0] }); }
    }
    ok("three seasons are simmed with nothing stuck", seasons >= 3 && !stuck, [seasons, stuck, stops]);
    ok("many weeks went by", weeks >= 60, weeks);
    ok("events came up and were answered on the way, newer ones among them", autos.length >= 5 && autos.some(a => a.id.startsWith("x_")), autos.length);
    ok("every one of them got its calm answer", autos.every(a => calmOf.get(a.id) === a.choice), autos.filter(a => calmOf.get(a.id) !== a.choice).slice(0, 2));
    ok("nothing in the state is NaN", st && !hasNaN(st), null);
    // at the end of a season it asks for the next one
    for (let i = 0; i < 60; i++) {
      r = await simAll(Q);
      if (r.status === 200 && r.j.stopped === "season") break;
      if (r.status !== 200 && r.j.seasonOver) break;
      if (r.status === 200 && r.j.stopped === "decision") { const d = r.j.state.decisions.find(x => !x.optional); await Q("/api/pc/decide", { id: d.id, choice: d.kind === "agent" ? "none" : d.kind === "trial" ? "decline" : d.options[0] }); }
      else if (r.status !== 200 && r.j.decision) { const d = r.j.decision; await Q("/api/pc/decide", { id: d.id, choice: d.kind === "agent" ? "none" : d.kind === "trial" ? "decline" : d.options[0] }); }
    }
    r = await Q("/api/pc/simseason");
    ok("with the season over it says to start the next one", r.status === 400 && r.j.seasonOver === true, r.j);

    // ---------- a season in short slices: the server answers others between them ----------
    {
      const sr = await api("/api/pc/create", { name: "Slc", player: FORM({ first: "Dev", last: "Rao" }) });
      const S = (p2, b) => api(p2, Object.assign({ code: sr.j.code, name: "Slc" }, b || {}));
      await S("/api/pc/decide", { id: "school", choice: "asb" });
      r = await S("/api/pc/simseason", { slice: 20 });
      ok("a short slice plays a few weeks and asks for more", r.status === 200 && r.j.more === true && r.j.stopped === "" && r.j.reports.length >= 1 && r.j.reports.length <= 6 && r.j.state.round === r.j.reports.length, [r.j.more, r.j.stopped, r.j.reports && r.j.reports.length, r.j.state && r.j.state.round]);
      const first = r.j.reports.length;
      let worst = 0, pings = 0, run = true;
      const pinger = (async () => { while (run) { const t = Date.now(); try { await fetch(BASE + "/api/pc/meta"); pings++; } catch (e) {} worst = Math.max(worst, Date.now() - t); await sleep(20); } })();
      const tSim = Date.now();
      r = await simAll(S, 20);
      const simMs = Date.now() - tSim;
      run = false; await pinger;
      ok("slice after slice it reaches the end of the season", r.status === 200 && r.j.stopped === "season" && r.j.state.seasonOver && first + r.j.reports.length === r.j.state.total, [r.j.stopped, first, r.j.reports && r.j.reports.length, r.j.slices]);
      ok("in many short slices", r.status === 200 && r.j.slices >= 8, r.j.slices);
      // one long block would keep every other request waiting about as long as the whole sim; slices never do
      ok("and the server answers others between them", pings >= 5 && worst < simMs / 3, [pings, worst, simMs]);
      ok("the weeks are each played once, in order", r.status === 200 && r.j.reports.every((w, i) => Number(w.week.match(/week (\d+)$/)[1]) === first + i + 1), r.j.reports && r.j.reports.slice(0, 3).map(w => w.week));
      ok("every event answered on the way says the week it was answered in", r.status === 200 && r.j.auto.every(a => Number.isInteger(a.w) && a.w >= first && a.w < r.j.state.total), r.j.auto && r.j.auto.slice(0, 2));
    }

    // ---------- an offer on the table is never let run out unseen ----------
    {
      const fr = await api("/api/pc/create", { name: "Off", player: FORM({ first: "Arjun", last: "Bose" }) });
      const F = (p2, b) => api(p2, Object.assign({ code: fr.j.code, name: "Off" }, b || {}));
      await F("/api/pc/decide", { id: "school", choice: "asb" });
      let x = await F("/api/pc/testset", { offer: "FC Goa" });
      ok("an offer is on the table (test hook)", x.status === 200 && x.j.state.offers.some(o => o.status === "open" && o.club === "FC Goa"), x.j.error);
      x = await simAll(F);
      ok("the sim stops in the offer's last week, the offer still open", x.status === 200 && x.j.stopped === "deadline" && x.j.reports.length === 4 && x.j.state.offers.some(o => o.status === "open" && o.club === "FC Goa"), [x.j.stopped, x.j.reports && x.j.reports.length]);
      x = await simAll(F);
      ok("sim again and the offer is let go", x.status === 200 && x.j.stopped !== "deadline" && x.j.reports.length > 1 && !x.j.state.offers.some(o => o.club === "FC Goa" && o.status === "open"), [x.j.stopped, x.j.state && x.j.state.offers.map(o => o.club + " " + o.status)]);
    }

    // ---------- a save from before this update ----------
    const r2 = await api("/api/pc/create", { name: "Old", player: FORM({ first: "Ishan", last: "Roy" }) });
    const oc = r2.j.code;
    const O = (p2, b) => api(p2, Object.assign({ code: oc, name: "Old" }, b || {}));
    await O("/api/pc/decide", { id: "school", choice: "asb" });
    await O("/api/pc/week", { weeks: 1 });
    await sleep(1500);
    stop();
    await sleep(800);
    // what an older save holds: only the hand written events in its log, one of them still waiting, no new money lines
    const all = JSON.parse(fs.readFileSync(SAVE, "utf8"));
    const games = all.games || all;
    const og = games[oc];
    ok("the older save is on disk", !!(og && og.career), Object.keys(all).slice(0, 4));
    if (og && og.career) {
      const pp = og.career.people;
      pp.log = [{ id: "exams", kind: "family", s: 1, w: 0, title: "Exams or a photo shoot?", choice: "Sit the exams.", note: "" }];
      pp.pending = { id: "friend", kind: "friend", s: 1, w: 1, fx: 0, tease: "An old friend is in town.", title: "An old friend is in town", text: "He wants a night out.", choices: [{ id: "out", label: "Like the old days." }, { id: "dinner", label: "One good dinner, then bed." }, { id: "busy", label: "Too busy this time." }] };
      fs.writeFileSync(SAVE, JSON.stringify(all));
    }
    srv = spawn("node", [path.join(root, "floodlights", "server.js")], { env: Object.assign({}, process.env, { PORT, FL_SAVE_FILE: SAVE, FL_TEST_HOOKS: "1" }), stdio: "ignore" });
    ok("the server starts again on the older save", await up(), null);
    r = await simAll(O);
    ok("the older career sims its season", r.status === 200 && r.j.reports.length >= 1, r.j.error);
    ok("the event it had waiting got the calm answer", r.status === 200 && r.j.auto[0] && r.j.auto[0].id === "friend" && r.j.auto[0].choice === "One good dinner, then bed.", r.j.auto && r.j.auto[0]);
    r = await O("/api/pc/testset", { event: "x_wallet_bus" });
    ok("and the newer events are there for it", r.status === 200 && r.j.state.people.pending && r.j.state.people.pending.id === "x_wallet_bus" && !badWords(r.j.state.people.pending.text), r.j.error);
    r = await O("/api/pc/event", { id: "x_wallet_bus", choice: r.j.state.people.pending.choices[0].id });
    ok("answered like any other", r.status === 200 && !r.j.state.people.pending && r.j.state.people.log[0].id === "x_wallet_bus", r.j.error);
  } catch (e) {
    ok("events run crashed", false, e.stack || e.message);
  } finally {
    stop();
  }
  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}
main();
