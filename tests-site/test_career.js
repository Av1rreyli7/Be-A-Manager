// Player Career battery: boots the Floodlights server on its own port and save file, creates footballers
// through the API and lives their careers week by week: school to college to a first contract, pro seasons,
// money, events and family, and checks nothing gets stuck, nothing goes NaN and the world keeps working.
// Run: node tests-site/test_career.js   (CAREER_SEASONS=n for a longer run)
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const PORT = process.env.CAREER_TEST_PORT || "3486";
const BASE = "http://127.0.0.1:" + PORT;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fl-career-"));
const SAVE = path.join(tmp, "games.json");
const EM = "\u2014", EN = "\u2013";
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// life events: the week stops behind one until it is answered; the battery answers with a random choice
const EV = { asked: 0, ok: 0, teased: 0 };
async function answerEvent(r, code, name) {
  if (!r.j || !r.j.event) return false;
  const e = r.j.event;
  EV.asked++;
  const out = await api("/api/pc/event", { code, name, id: e.id, choice: e.choices[Math.floor(Math.random() * e.choices.length)].id });
  if (out.status === 200) EV.ok++;
  return true;
}
const countTeases = r => { for (const rep of (r.j && r.j.reports) || []) if (rep.tease) EV.teased++; };
async function api(p, body) {
  const r = await fetch(BASE + p, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j: j || {} };
}
function hasNaN(o, seen) {
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

// a whole live match in the 3D engine with a person at the keys who plays it properly: runs at goal and shoots,
// calls for it and makes runs, presses when they have it. Control has to stay on his footballer throughout.
async function lockMatch(start, seed) {
  const S = await import("../floodlights/match_sim3d.mjs");
  let x = seed >>> 0;
  const sim = S.createSim3D(start, { rng: () => ((x = (x * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296 });
  const m = sim.m, L = m.lock;
  let steps = 0, switched = 0, eH = 0;
  while (m.phase !== "full" && steps++ < 60 * 700) {
    const b = m.ball, inp = { mx: 0, my: 0, sprint: false, held: {}, down: {}, up: {} };
    const gx = m.teams[0].dir * 52.5;
    if (b.ctrl === L) { const dx = gx - L.x, dy = -L.y, d = Math.hypot(dx, dy); inp.mx = dx / d; inp.my = dy / d; if (d < 22) { if (eH < 0.45) { inp.held.E = true; eH += 1 / 60; } else { inp.up.E = eH; eH = 0; } } }
    else if (b.ctrl && b.ctrl.team === 0) { const dx = b.x + m.teams[0].dir * 6 - L.x, dy = -b.y * 0.3 - L.y, d = Math.hypot(dx, dy) || 1; if (d > 2) { inp.mx = dx / d; inp.my = dy / d; } if (steps % 90 === 0) inp.down.Q = true; if (steps % 400 === 200) inp.down.T = true; }
    else { const dx = b.x - L.x, dy = b.y - L.y, d = Math.hypot(dx, dy) || 1; if (d < 20) inp.held.S = true; else { inp.mx = dx / d; inp.my = dy / d; } }
    sim.step(inp);
    if (m.ctrl && m.ctrl !== L && m.phase === "play") switched++; // a red card leaves no one under control, never someone else
    m.events.length = 0;
  }
  return { m, L, switched, res: sim.result(), line: sim.lockLine() };
}
const resOf = (gf, ga) => (gf > ga ? "W" : gf < ga ? "L" : "D");
// a result line the hub can show plainly: his side's name, the score his way round, the outcome and the week
const lineOk = l => !!l && typeof l.team === "string" && l.team.length > 0 && Number.isInteger(l.gf) && Number.isInteger(l.ga) && l.res === resOf(l.gf, l.ga) && Number.isInteger(l.wk) && l.wk >= 1 && l.wk <= 38;

async function main() {
  const server = spawn("node", [path.join(root, "floodlights", "server.js")], { env: Object.assign({}, process.env, { PORT, FL_SAVE_FILE: SAVE, FL_TEST_HOOKS: "1" }), stdio: "ignore" });
  const stop = () => { try { server.kill(); } catch (e) {} };
  process.on("exit", stop);
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + "/floodlights/")).ok) break; } catch (e) {} await sleep(250); }

    // ---------- static: the new files follow the house rules ----------
    for (const f of ["floodlights/career/data.js", "floodlights/career/core.js", "floodlights/career/pro.js", "tests-site/test_career.js", "src/career/Hub.tsx", "src/career/Phone.tsx", "public/kit.css"]) {
      const t = fs.readFileSync(path.join(root, f), "utf8");
      ok(f + " has no em or en dashes", !t.includes(EM) && !t.includes(EN), null);
    }

    // ---------- creation: validation, then a real player ----------
    let r = await api("/api/pc/create", { name: "Pc", player: FORM({ first: "" }) });
    ok("a player needs a first name", r.status === 400 && /first name/.test(r.j.error || ""), r.j);
    r = await api("/api/pc/create", { name: "Pc", player: FORM({ dobY: 2000 }) });
    ok("a career starts at school age", r.status === 400 && /school age/.test(r.j.error || ""), r.j);
    r = await api("/api/pc/create", { name: "Pc", player: FORM() });
    ok("an Indian player is created", r.status === 200 && r.j.code && r.j.state && r.j.state.player.name === "Aarav Mehta", r.j);
    const code = r.j.code;
    let st = r.j.state;
    r = await api("/api/join", { code, name: "Intruder" });
    ok("Manager Career will not join a Player Career save", r.status === 400 && r.j.playerCareer === true, r.j);
    r = await api(`/api/state?code=${code}&name=Pc`);
    ok("the Manager screens do not open a Player Career save", r.status === 400 && r.j.playerCareer === true, r.status);
    ok("he starts at 15 with a modest rating and a real potential range", st.player.age === 15 && st.player.rating >= 35 && st.player.rating <= 58 && st.player.potential[0] <= st.player.potential[1], st.player);
    ok("the India path starts at school with the school choice open", st.stage === "school" && st.decisions.some(d => d.kind === "school"), st.decisions);
    ok("Mum and Dad are on the phone from day one", st.phone.threads.some(t => t.id === "mum") && st.phone.threads.some(t => t.id === "dad"), st.phone.threads.map(t => t.id));
    ok("the state has no NaN anywhere", !hasNaN(st), null);
    r = await api(`/api/pc/options?code=${code}&name=Pc&kind=school`);
    const schools = r.j.options || [];
    ok("the real Mumbai schools are on offer", ["Oberoi International School", "Dhirubhai Ambani International School", "Ascend International School", "American School of Bombay", "Ecole Mondiale World School"].every(n => schools.some(s => s.name === n)), schools.map(s => s.name));
    r = await api("/api/pc/week", { code, name: "Pc" });
    ok("the week will not move until the school is picked", r.status === 400 && /school/i.test(r.j.error || ""), r.j);
    r = await api("/api/pc/decide", { code, name: "Pc", id: "school", choice: "dais" });
    ok("he joins a school", r.status === 200 && r.j.state.school === "dais" && r.j.state.team === "Dhirubhai Ambani International School", r.j.error);

    // ---------- the world: the Indian league exists only in this save ----------
    const saveNow = async () => { await sleep(700); return JSON.parse(fs.readFileSync(SAVE, "utf8")); };
    // the save file once it has caught up (the server writes it a moment after a reply, and a big world takes a
    // while to write): read until the game passes the check, or give the last read back
    const saveWhen = async (code2, ready) => {
      let all = null;
      for (let i = 0; i < 30; i++) {
        await sleep(500);
        try { all = JSON.parse(fs.readFileSync(SAVE, "utf8")); } catch (e) { continue; }
        if (all[code2] && ready(all[code2])) break;
      }
      return all;
    };
    let g = (await saveNow())[code];
    ok("the Indian Super League runs in the Player Career world", !!(g.leagueFixtures["Indian Super League"]) && Object.values(g.clubs).filter(c => c.league === "Indian Super League").length === 12, null);
    ok("the save is a player mode game with the career block", g.mode === "player" && g.career && g.players[g.career.pid].pc === true, null);

    // ---------- training plans ----------
    r = await api("/api/pc/plan", { code, name: "Pc", slots: ["finishing", "technical"], intensity: "normal" });
    ok("a plan needs five sessions", r.status === 400, r.j);
    r = await api("/api/pc/plan", { code, name: "Pc", slots: ["finishing", "technical", "speed", "tactical", "recovery"], intensity: "normal" });
    ok("a sensible plan is saved", r.status === 200, r.j.error);

    // ---------- life off the pitch: free time, shops, the gym, food, social, sponsors, the bank ----------
    {
      r = await api("/api/pc/create", { name: "Life", player: FORM({ first: "Kabir", last: "Shah" }) });
      const lc = r.j.code;
      const LP = (p2, b) => api(p2, Object.assign({ code: lc, name: "Life" }, b || {}));
      await LP("/api/pc/decide", { id: "school", choice: "asb" });
      r = await api(`/api/pc/state?code=${lc}&name=Life`);
      let ls = r.j.state;
      ok("the life block is in the state (city, weather, places, home, free time)", ls.life && ls.life.city === "Mumbai" && ls.life.weather && ls.life.weather.kind && ls.life.places.gym && ls.life.home.id === "family" && ls.life.time === 3, ls.life && { city: ls.life.city, home: ls.life.home && ls.life.home.id, time: ls.life.time });
      ok("the calendar shows the coming weeks", Array.isArray(ls.calendar) && ls.calendar.length >= 6, ls.calendar && ls.calendar.length);
      ok("a Mumbai career gets the Mumbai look", ls.life.style.key === "Mumbai" && ls.life.style.climate === "monsoon", ls.life.style.key);
      const fat0 = ls.cond.fatigue;
      await LP("/api/pc/testset", { cash: 5000 });
      r = await LP("/api/pc/act", { place: "gym", action: "weights" });
      ok("a gym session grows strength and tires him", r.status === 200 && r.j.state.attrs.strength >= ls.attrs.strength && r.j.state.cond.fatigue > fat0 && r.j.state.life.time === 2, r.j.error);
      r = await LP("/api/pc/act", { place: "home", action: "rest" });
      ok("resting at home brings the fatigue down", r.status === 200 && r.j.state.cond.fatigue < (r.j.state.cond.fatigue + 10) && r.j.state.life.time === 1, r.j.error);
      const cash0 = r.j.state.money.cash;
      r = await LP("/api/pc/act", { place: "restaurant", action: "healthy" });
      ok("a meal out costs money and a slot of free time", r.status === 200 && r.j.state.money.cash < cash0 && r.j.state.life.time === 0, r.j.error);
      r = await LP("/api/pc/act", { place: "gym", action: "mobility" });
      ok("free time runs out for the week", r.status === 400 && /free time/i.test(r.j.error || ""), r.j);
      r = await LP("/api/pc/act", { place: "mall", action: "buy", arg: "kicks" });
      ok("shopping takes no free time", r.status === 200 && r.j.state.life.items.find(x => x.id === "kicks").owned, r.j.error);
      r = await LP("/api/pc/act", { place: "shops", action: "buy", arg: "steelwatch" });
      ok("a watch from the shops goes on his wrist in 3D", r.status === 200 && r.j.state.look.watch === "steel", r.j.error || (r.j.state && r.j.state.look.watch));
      r = await LP("/api/pc/act", { place: "home", action: "wear", arg: "steelwatch" });
      ok("the wardrobe takes it off again", r.status === 200 && !r.j.state.look.watch, r.j.error);
      r = await LP("/api/pc/act", { place: "shops", action: "car", arg: "pico" });
      ok("a fifteen year old cannot buy a car", r.status === 400 && /old enough/.test(r.j.error || ""), r.j);
      r = await LP("/api/pc/act", { place: "shops", action: "car", arg: "scoot" });
      ok("but a scooter is fine", r.status === 200 && r.j.state.life.car && r.j.state.life.car.id === "scoot", r.j.error);
      r = await LP("/api/pc/act", { place: "home", action: "move", arg: "apartment:rent" });
      ok("he cannot move out before seventeen", r.status === 400 && /seventeen/.test(r.j.error || ""), r.j);
      r = await LP("/api/pc/act", { place: "mall", action: "buy", arg: "goldwatch" });
      ok("each shop sells its own things", r.status === 400, r.j);
      const f0 = r.j.state ? r.j.state.life.followers : (await api(`/api/pc/state?code=${lc}&name=Life`)).j.state.life.followers;
      r = await LP("/api/pc/post", { kind: "training" });
      ok("a post brings followers", r.status === 200 && r.j.state.life.followers > f0 && r.j.state.life.posts.length === 1 && r.j.post.comments.length > 0, r.j.error);
      r = await LP("/api/pc/post", { kind: "fans" });
      ok("one post a week", r.status === 400, r.j);
      const c1 = r.j.state ? r.j.state.money.cash : (await api(`/api/pc/state?code=${lc}&name=Life`)).j.state.money.cash;
      r = await LP("/api/pc/bank", { op: "save", amount: 1000 });
      ok("money goes into savings", r.status === 200 && r.j.state.life.savings === 1000 && r.j.state.money.cash === c1 - 1000, r.j.error);
      r = await LP("/api/pc/bank", { op: "take", amount: 5000 });
      ok("he cannot take out more than he saved", r.status === 400, r.j);
      // a week passes: free time comes back, bills and the weather move on
      r = await LP("/api/pc/week", { weeks: 1 });
      ok("next week the free time is back", r.status === 200 && r.j.state.life.time === 3, r.j.error || r.j.state.life.time);
      // sponsors: a big name gets offers, signs one, and is paid every week
      await LP("/api/pc/testset", { commercial: 55 });
      let offer = null;
      for (let i = 0; i < 70 && !offer; i++) {
        r = await LP("/api/pc/week", { weeks: 1 });
        if (r.status !== 200) { if (await answerEvent(r, lc, "Life")) continue; if (r.j.seasonOver) await LP("/api/pc/season"); else if (r.j.decision) { const d = r.j.decision; await LP("/api/pc/decide", { id: d.id, choice: d.kind === "agent" ? "none" : d.kind === "trial" ? "decline" : d.options[0] }); } continue; }
        offer = r.j.state.life.sponsorOffers[0];
        await LP("/api/pc/testset", { commercial: 55 });
      }
      ok("brands come knocking when his name is big", !!offer, null);
      if (offer) {
        r = await LP("/api/pc/sponsor", { id: offer.id, yes: true });
        ok("he signs a sponsor deal", r.status === 200 && r.j.state.life.sponsors.some(x => x.id === offer.id), r.j.error);
        r = await LP("/api/pc/week", { weeks: 1 });
        if (r.status === 200) ok("the sponsor pays every week", r.j.state.money.log.some(x => /Sponsor/.test(x.text)), r.j.state.money.log.slice(0, 4));
      }
      ok("no NaN in the life state", !hasNaN((await api(`/api/pc/state?code=${lc}&name=Life`)).j.state), null);
    }

    // ---------- family and life events: the teaser, the popup, the choice and what it does ----------
    {
      r = await api("/api/pc/create", { name: "Fam", player: FORM({ first: "Dev", last: "Nair" }) });
      const fc = r.j.code;
      const FP = (p2, b) => api(p2, Object.assign({ code: fc, name: "Fam" }, b || {}));
      await FP("/api/pc/decide", { id: "school", choice: "asb" });
      let fs = (await api(`/api/pc/state?code=${fc}&name=Fam`)).j.state;
      ok("Mum and Dad are in his life, maybe a brother or a sister too", fs.people && fs.people.family[0].id === "mum" && fs.people.family[1].id === "dad" && fs.people.friend && fs.people.friend.name, fs.people);
      r = await FP("/api/pc/testset", { event: "exams" });
      ok("a life event can be put up (test hook)", r.status === 200 && r.j.state.people.pending && r.j.state.people.pending.id === "exams", r.j.error);
      r = await FP("/api/pc/week", { weeks: 1 });
      ok("the week waits behind the event", r.status === 400 && r.j.event && r.j.event.id === "exams" && r.j.event.choices.length >= 2, r.j);
      const mum0 = fs.people.family[0].rel, disc0 = fs.traits.discipline;
      r = await FP("/api/pc/event", { id: "exams", choice: "nope" });
      ok("only a real choice is taken", r.status === 400, r.j);
      r = await FP("/api/pc/event", { id: "exams", choice: "exams" });
      ok("sitting the exams pleases Mum and builds discipline", r.status === 200 && r.j.state.people.family[0].rel > mum0 && r.j.state.traits.discipline > disc0 && !r.j.state.people.pending, r.j.error);
      ok("the choice is remembered", r.status === 200 && r.j.state.people.log[0].id === "exams", null);
      r = await FP("/api/pc/week", { weeks: 1 });
      ok("then the week plays", r.status === 200, r.j.error);
      // the agent: look for one, sign, then let him go
      r = await FP("/api/pc/agent", { action: "find" });
      ok("he can ask around for an agent", r.status === 200 && r.j.state.decisions.some(d => d.kind === "agent"), r.j.error);
      const ad = r.j.state.decisions.find(d => d.kind === "agent");
      r = await FP("/api/pc/decide", { id: ad.id, choice: ad.options[0] });
      ok("and sign one", r.status === 200 && r.j.state.agent && r.j.state.agent.id === ad.options[0], r.j.error);
      r = await FP("/api/pc/testset", { event: "dadagent" });
      r = await FP("/api/pc/event", { id: "dadagent", choice: "dad" });
      ok("letting Dad do the deals means the agent goes, and Dad is happy", r.status === 200 && !r.j.state.agent && r.j.state.people.family[1].rel > fs.people.family[1].rel, r.j.error);
      r = await FP("/api/pc/agent", { action: "drop" });
      ok("no agent to drop now", r.status === 400, r.j);
      // a long run: events come, get teased, get answered, nothing gets stuck
      let n = 0;
      for (let i = 0; i < 40; i++) {
        r = await FP("/api/pc/week", { weeks: 4 });
        if (r.status !== 200) {
          if (await answerEvent(r, fc, "Fam")) continue;
          if (r.j.seasonOver) { const rs = await FP("/api/pc/season"); if (rs.status !== 200 && rs.j.decision) { const d = rs.j.decision; const o = d.kind === "college" ? ((await api(`/api/pc/options?code=${fc}&name=Fam&kind=college`)).j.options || []).find(x => x.accepted) : null; await FP("/api/pc/decide", { id: d.id, choice: o ? o.id : d.options[d.options.length - 1] }); } continue; }
          if (r.j.decision) { const d = r.j.decision; await FP("/api/pc/decide", { id: d.id, choice: d.kind === "agent" ? "none" : d.kind === "trial" ? "go" : d.options[0] }); continue; }
          if (process.env.CDEBUG) console.log("fam loop stopped", r.status, JSON.stringify(r.j).slice(0, 300));
          break;
        }
        countTeases(r);
        n += r.j.reports.length;
      }
      fs = (await api(`/api/pc/state?code=${fc}&name=Fam`)).j.state;
      if (process.env.CDEBUG) console.log("fam weeks", n, JSON.stringify(EV), fs.week);
      ok("events are teased at the end of a week and answered before the next", EV.teased >= 2 && EV.asked >= 2 && EV.ok === EV.asked, EV);
      ok("a year and more of family life keeps moving", n >= 40 && !hasNaN(fs), n);
    }

    // ---------- matchday: PLAY is open or closed with a plain reason, and a youth match plays live ----------
    {
      r = await api("/api/pc/create", { name: "Yth", player: FORM({ first: "Ishaan", last: "Kapoor" }) });
      const yc = r.j.code;
      const Y = (p2, b) => api(p2, Object.assign({ code: yc, name: "Yth" }, b || {}));
      const yState = async () => (await api(`/api/pc/state?code=${yc}&name=Yth`)).j.state;
      ok("the state says whether this week's match can be played live, and why not", r.j.state.play && r.j.state.play.can === false && typeof r.j.state.play.why === "string" && r.j.state.play.code === "nomatch", r.j.state.play);
      await Y("/api/pc/decide", { id: "school", choice: "asb" });
      await Y("/api/pc/testset", { boost: 14 });
      // on to a matchday where the coach starts him
      let ys = await yState(), guardY = 0;
      while (!(ys.play && ys.play.can) && guardY++ < 12) {
        if (ys.people.pending) { await Y("/api/pc/event", { id: ys.people.pending.id, choice: ys.people.pending.choices[0].id }); ys = await yState(); continue; }
        const w = await Y("/api/pc/week", { weeks: 1 });
        if (w.status !== 200 && w.j.event) await answerEvent(w, yc, "Yth");
        ys = await yState();
      }
      ok("a school player in form gets a matchday he can play live", ys.play && ys.play.can === true && ys.play.kind === "youth" && ys.next && ys.next.week === ys.round + 1, [ys.play, ys.next, ys.round]);
      // something to answer first closes PLAY with the reason, and opens it again once answered
      r = await Y("/api/pc/testset", { event: "exams" });
      ok("an event to answer closes PLAY with a plain reason", r.status === 200 && r.j.state.play.can === false && r.j.state.play.code === "event" && /answer/.test(r.j.state.play.why), r.j.state && r.j.state.play);
      r = await Y("/api/pc/matchstart");
      ok("and the kick off is refused for the same reason", r.status === 400 && !!r.j.event && r.j.code === "event", r.j);
      r = await Y("/api/pc/event", { id: "exams", choice: "exams" });
      ok("answered, PLAY opens again", r.status === 200 && r.j.state.play.can === true, r.j.state && r.j.state.play);
      const before = r.j.state;
      // the match screen before kick off: a peek shows the match and uses nothing up
      const pk1 = await Y("/api/pc/matchstart", { peek: true }), pk2 = await Y("/api/pc/matchstart", { peek: true });
      ok("the match screen can look at the youth match without using up the week's go", pk1.status === 200 && pk1.j.peek === true && pk1.j.lock && pk1.j.lock.name === "Ishaan Kapoor" && !pk1.j.homeXI && (await yState()).play.can === true, pk1.j);
      ok("the youth match looks the same every time it is asked for in a week", JSON.stringify(pk1.j) === JSON.stringify(pk2.j), [pk1.j.homeRating, pk2.j.homeRating]);
      r = await Y("/api/pc/matchstart");
      const ystart = r.j;
      ok("the kick off plays the match the screen showed", r.status === 200 && ystart.home === pk1.j.home && ystart.away === pk1.j.away && ystart.homeRating === pk1.j.homeRating && ystart.awayRating === pk1.j.awayRating && ystart.label === pk1.j.label, [ystart.homeRating, pk1.j.homeRating]);
      ok("a youth match kicks off live", r.status === 200 && ystart.kind === "youth" && ystart.homeXI && ystart.awayXI, r.j.error);
      if (r.status === 200) {
        const mine = ystart.side === "home" ? ystart.homeXI : ystart.awayXI, theirs = ystart.side === "home" ? ystart.awayXI : ystart.homeXI;
        const meRow = mine.find(x => x.pc);
        ok("both youth sides are eleven in a normal shape with one keeper each", [mine, theirs].every(xi => xi.length === 11 && xi.filter(x => x.role === "GK").length === 1 && xi.filter(x => x.pos === "DF").length === 4), null);
        ok("he is in his own side, marked for player lock, with his look, his name, his number and his position", meRow && mine.filter(x => x.pc).length === 1 && !theirs.some(x => x.pc) && meRow.n === "Ishaan Kapoor" && meRow.num === 9 && meRow.role === "ST" && meRow.look && meRow.look.skinF === 0.55 && meRow.look.watch === "steel" && ystart.lock && ystart.lock.name === "Ishaan Kapoor", meRow);
        const others = mine.concat(theirs).filter(x => !x.pc);
        ok("the made up players have Indian names, school ages and ratings around the team's level", others.every(x => /^[A-Z][A-Za-z']+ [A-Z][A-Za-z' ]+$/.test(x.n) && x.age >= 13 && x.age <= 19 && x.r >= 30 && x.r <= 90) && new Set(mine.map(x => x.n)).size === 11 && Math.abs(ystart.homeRating - ystart.awayRating) < 15, others.slice(0, 3));
        ok("the match is the school fixture the hub showed", ystart.label.startsWith(before.next.comp) && (ystart.home === before.next.opp || ystart.away === before.next.opp) && (ystart.home === before.team || ystart.away === before.team), [ystart.label, ystart.home, ystart.away, before.next]);
        r = await Y("/api/pc/matchstart");
        ok("one live go a week: a second kick off is refused, and the hub says why", r.status === 400 && r.j.code === "played" && (await yState()).play.code === "played", r.j);
        const lm = await lockMatch(ystart, 7);
        ok("the youth match finishes with control on him the whole game", lm.m.phase === "full" && lm.switched === 0 && lm.L && lm.L.name === "Ishaan Kapoor", [lm.m.phase, lm.switched]);
        const apps0 = before.stats.season.apps;
        r = await Y("/api/pc/matchresult", { hg: lm.res.home, ag: lm.res.away, line: lm.line });
        ok("the live youth result goes into the week", r.status === 200 && r.j.reports[0].match && r.j.reports[0].match.live === true, r.j.error || r.j.reports);
        if (r.status === 200) {
          const ym = r.j.reports[0].match, ys2 = r.j.state;
          const want = ystart.side === "home" ? [lm.res.home, lm.res.away] : [lm.res.away, lm.res.home];
          ok("the youth score is the live score, his side first", ym.gf === want[0] && ym.ga === want[1] && ym.team === before.team && ym.opp === before.next.opp, [ym.gf, ym.ga, want, ym.team]);
          ok("the youth result line is complete: team, score his way, outcome, week", lineOk(ym) && ym.wk === before.next.week, ym);
          ok("he started and played the whole match", ym.role === "start" && ym.mins === 90, ym);
          ok("his youth rating is the one from the pitch, and so are his goals", ym.rating === lm.line.rating && ym.g === Math.min(lm.line.g, ym.gf), [ym.rating, lm.line.rating, ym.g, lm.line.g]);
          ok("the live youth match is recorded like any other: an appearance, the season log, the average", ys2.stats.season.apps === apps0 + 1 && ys2.stats.log[0].live === true && ys2.stats.log[0].rating === lm.line.rating && ys2.stats.season.rN === apps0 + 1, [apps0, ys2.stats.season.apps, ys2.stats.log[0]]);
          ok("no live match is left hanging after a youth game", (await saveWhen(yc, g5 => g5.round === ys2.round))[yc].career.live === null, null);
        }
        r = await Y("/api/pc/matchresult", { hg: 1, ag: 0, line: lm.line });
        ok("a youth result needs a match that was kicked off", r.status === 400, r.j);
      }
      // the coach's sheet: a weak player is left on the bench or out, PLAY says so, and the sim agrees
      r = await api("/api/pc/create", { name: "Bnch", player: FORM({ first: "Rohan", last: "Das" }) });
      const bc = r.j.code;
      const Bq = (p2, b) => api(p2, Object.assign({ code: bc, name: "Bnch" }, b || {}));
      await Bq("/api/pc/decide", { id: "school", choice: "dais" });
      await Bq("/api/pc/testset", { boost: -30 });
      let seenBench = null, agree = 0, simmed = 0;
      for (let i = 0; i < 16 && simmed < 4; i++) {
        const bs = (await api(`/api/pc/state?code=${bc}&name=Bnch`)).j.state;
        if (bs.people.pending) { await Bq("/api/pc/event", { id: bs.people.pending.id, choice: bs.people.pending.choices[0].id }); continue; }
        const md = bs.next && bs.next.week === bs.round + 1;
        if (md && (bs.play.code === "bench" || bs.play.code === "out") && !seenBench) {
          const ms = await Bq("/api/pc/matchstart");
          seenBench = { play: bs.play, start: ms.status, err: ms.j.error, bench: ms.j.bench };
        }
        const w = await Bq("/api/pc/week", { weeks: 1 });
        if (w.status !== 200) { await answerEvent(w, bc, "Bnch"); continue; }
        const wm = w.j.reports[0].match;
        const expect = bs.play.can ? "start" : bs.play.code === "bench" ? "sub" : bs.play.code === "out" ? "out" : null;
        // an injury in that week's training (after the sheet was picked) takes him out: not a different sheet
        if (md && wm && expect && wm.role !== "injured") { simmed++; if (wm.role === expect) agree++; }
      }
      ok("left out or on the bench, PLAY is closed with the reason and the kick off is refused", seenBench && seenBench.play.can === false && /bench|left you out/.test(seenBench.play.why) && seenBench.start === 400 && seenBench.bench === true && seenBench.err === seenBench.play.why, seenBench);
      ok("the team sheet the hub shows is the one the sim plays", simmed >= 3 && agree === simmed, [agree, simmed]);
      // a keeper: the lock cannot take the gloves yet, so PLAY stays closed with that reason
      r = await api("/api/pc/create", { name: "Gk", player: FORM({ first: "Gurpreet", last: "Sandhu", pos: "GK", pos2: null, style: null, num: 1 }) });
      const gc = r.j.code;
      await api("/api/pc/decide", { code: gc, name: "Gk", id: "school", choice: "asb" });
      let gs = null;
      for (let i = 0; i < 4; i++) { gs = (await api(`/api/pc/state?code=${gc}&name=Gk`)).j.state; if (gs.next && gs.next.week === gs.round + 1) break; await api("/api/pc/week", { code: gc, name: "Gk", weeks: 1 }); }
      r = await api("/api/pc/matchstart", { code: gc, name: "Gk" });
      ok("a keeper's matchday keeps PLAY closed with a plain reason", gs.play.can === false && gs.play.code === "keeper" && /Keepers/.test(gs.play.why) && r.status === 400 && r.j.code === "keeper", [gs.play, r.j]);
    }

    // ---------- a school season ----------
    const startRating = st.player.rating;
    let weeks = 0, guard = 0, matches = 0, injuries = 0, sawScout = false;
    const rows = [];
    let onOffer = false;
    async function playWeeks(maxWeeks, onState) {
      while (weeks < maxWeeks && guard++ < maxWeeks * 3) {
        r = await api("/api/pc/week", { code, name: "Pc", weeks: 4 });
        if (r.status !== 200) {
          // a life event, a decision or the end of the season
          if (await answerEvent(r, code, "Pc")) continue;
          if (r.j.seasonOver) return "season";
          if (r.j.decision) {
            const d = r.j.decision;
            if (onState && await onState(d)) continue;
            return "decision";
          }
          return "error:" + r.j.error;
        }
        st = r.j.state;
        countTeases(r);
        for (const rep of r.j.reports) { weeks++; if (rep.match && rep.match.mins) { matches++; rows.push({ week: Number((rep.week.match(/week (\d+)/) || [])[1]), m: rep.match }); } }
        if (st.cond.inj) injuries++;
        if (st.scouts.length) sawScout = true;
        if (hasNaN(st)) return "nan";
        if (st.offers.length && onOffer) return "offer";
      }
      return "max";
    }
    const autoDecide = async d => {
      if (d.kind === "trial") { await api("/api/pc/decide", { code, name: "Pc", id: d.id, choice: "go" }); return true; }
      if (d.kind === "agent") { await api("/api/pc/decide", { code, name: "Pc", id: d.id, choice: d.options[1] || "none" }); return true; }
      if (d.kind === "college") {
        const o = (await api(`/api/pc/options?code=${code}&name=Pc&kind=college`)).j.options || [];
        const pickC = o.find(x => x.accepted);
        await api("/api/pc/decide", { code, name: "Pc", id: d.id, choice: pickC ? pickC.id : o[o.length - 1].id });
        return true;
      }
      return false;
    };
    const t0 = Date.now();
    let end = await playWeeks(40, autoDecide);
    const msWeek = (Date.now() - t0) / Math.max(1, weeks);
    ok("a whole school season plays through without getting stuck", end === "season" && st.round === 38, [end, st.round, weeks]);
    ok("he played school football most weeks it was on", matches >= 10, matches);
    ok("he grew over the season (training and matches)", st.player.rating > startRating, [startRating, st.player.rating]);
    ok("a week takes well under two seconds of server time", msWeek < 2000, Math.round(msWeek));
    ok("every school result has his team, the score his way round, a W, L or D and the week", rows.length >= 10 && rows.every(x => lineOk(x.m) && x.m.wk === x.week && x.m.team === "Dhirubhai Ambani International School"), rows.filter(x => !lineOk(x.m) || x.m.wk !== x.week).slice(0, 3));
    ok("the season log keeps the same result lines", st.stats.log.filter(l => l.mins).every(lineOk), st.stats.log.slice(0, 2));
    ok("season stats are counted", st.stats.season.apps >= 10 && st.stats.season.rN === st.stats.season.apps && st.stats.season.rSum / st.stats.season.rN > 4, st.stats.season);
    console.log("school season 1: rating " + startRating + " to " + st.player.rating + ", " + st.stats.season.apps + " apps, " + st.stats.season.g + " goals, average " + (st.stats.season.rSum / st.stats.season.rN).toFixed(2) + ", injuries " + injuries + ", " + Math.round(msWeek) + " ms a week, scouts " + st.scouts.map(s => s.club + " " + s.level).join(", "));

    // ---------- next seasons: school to college to a contract ----------
    let signed = false, seasons = 1;
    const MAXS = Number(process.env.CAREER_SEASONS || 6);
    while (seasons < MAXS) {
      r = await api("/api/pc/season", { code, name: "Pc" });
      if (r.status !== 200 && r.j.decision) { await autoDecide(r.j.decision); r = await api("/api/pc/season", { code, name: "Pc" }); }
      ok("season " + (seasons + 1) + " starts", r.status === 200, r.j.error);
      if (r.status !== 200) break;
      st = r.j.state; seasons++; weeks = 0; guard = 0;
      while (true) {
        onOffer = !signed;
        end = await playWeeks(40, autoDecide);
        if (st.offers.length && !signed) {
          const best = st.offers.slice().sort((a, b) => b.wage - a.wage)[0];
          await api("/api/pc/negotiate", { code, name: "Pc", offer: best.id });
          const after = (await api(`/api/pc/state?code=${code}&name=Pc`)).j.state;
          const still = after.offers.find(o => o.id === best.id) || after.offers[0];
          if (still) {
            r = await api("/api/pc/sign", { code, name: "Pc", offer: still.id });
            ok("he signs his first professional contract", r.status === 200 && r.j.state.stage === "pro" && r.j.state.player.club === still.club, r.j.error);
            signed = r.status === 200; st = r.j.state || st;
            if (signed) console.log("signed at " + st.player.age + " for " + st.player.club + " (" + st.player.league + "), " + st.contract.wage + " a week, " + st.contract.years + " years, " + st.contract.role + ", rating " + st.player.rating);
          }
          continue;
        }
        break;
      }
      if (end !== "season") { ok("season " + seasons + " reaches its end", false, [end, st.round]); break; }
      if (process.env.CDEBUG) { const th = st.phone.threads.find(t => t.id === "offers"); console.log("  offer msgs", th ? JSON.stringify(th.msgs.map(m => m.s + "/" + m.w + " " + m.text)) : "none"); }
      if (process.env.CDEBUG) console.log("  scouts", JSON.stringify(st.scouts), "trials", JSON.stringify(st.trials), "decisions", JSON.stringify(st.decisions.map(d => d.kind)));
      console.log("season " + seasons + ": stage " + st.stage + ", age " + st.player.age + ", rating " + st.player.rating + ", apps " + st.stats.season.apps + ", goals " + st.stats.season.g + ", cash " + st.money.cash + (st.player.club ? ", club " + st.player.club : ""));
    }
    ok("he became a professional within " + MAXS + " seasons", signed, st.stage);
    if (signed) {
      if (st.player.club) ok("as a pro he is a real player of his club in the shared world", (await saveNow())[code].clubs[st.player.club].squad.includes(st.player.id), null);
      else ok("a contract that ran out leaves him a free agent with clubs calling", st.freeAgent === true, st.freeAgent);
      ok("wages and bonuses are paid over his career", st.money.earned > 5000, st.money.earned);
    }
    ok("no NaN in the final state", !hasNaN(st), null);

    // ---------- the pro years: a good player's career, played on until his late twenties ----------
    {
      r = await api("/api/pc/create", { name: "Pro", player: FORM({ first: "Vikram", last: "Rao", pos: "CAM", pos2: "CM", style: "Playmaker" }) });
      const pc = r.j.code;
      await api("/api/pc/decide", { code: pc, name: "Pro", id: "school", choice: "asb" });
      await api("/api/pc/testset", { code: pc, name: "Pro", potential: 90, boost: 6 });
      const P = (p2, b) => api(p2, Object.assign({ code: pc, name: "Pro" }, b || {}));
      let s3 = null, guard3 = 0, seasons3 = 0, moves = 0, intl = 0, renew = 0, bids = 0, stuck = false;
      const proRows = [], intlRows = [];
      const seen = new Set();
      while (seasons3 < 11 && guard3++ < 900) {
        r = await P("/api/pc/week", { weeks: 8 });
        if (r.status !== 200) {
          if (await answerEvent(r, pc, "Pro")) continue;
          if (r.j.seasonOver) {
            const rs = await P("/api/pc/season");
            if (rs.status !== 200 && rs.j.decision) { const d = rs.j.decision; const o = d.kind === "college" ? ((await api(`/api/pc/options?code=${pc}&name=Pro&kind=college`)).j.options || []).find(x => x.accepted) : null; await P("/api/pc/decide", { id: d.id, choice: o ? o.id : d.options[0] }); continue; }
            seasons3++; continue;
          }
          if (r.j.decision) { const d = r.j.decision; let ch = d.options[0]; if (d.kind === "college") { const o = ((await api(`/api/pc/options?code=${pc}&name=Pro&kind=college`)).j.options || []).find(x => x.accepted); ch = o ? o.id : d.options[d.options.length - 1]; } if (d.kind === "trial") ch = "go"; await P("/api/pc/decide", { id: d.id, choice: ch }); continue; }
          stuck = r.j.error; break;
        }
        s3 = r.j.state;
        for (const rep of r.j.reports) {
          if (rep.intl && rep.intl.mins) intl++;
          if (rep.intl) intlRows.push(rep.intl);
          if (rep.match && rep.match.pro) proRows.push(Object.assign({ wkLabel: Number((rep.week.match(/week (\d+)/) || [])[1]) }, rep.match));
        }
        for (const o of s3.offers) {
          if (seen.has(o.id)) continue;
          seen.add(o.id);
          if (o.kind === "transfer") bids++;
          if (o.kind === "renewal") renew++;
        }
        // policy: take the first deal, any renewal, and a move to a stronger club when one comes
        const open = s3.offers.slice().sort((a, b) => b.wage - a.wage);
        if (open.length) {
          const pickO = open.find(o => o.kind === "renewal") || open[0];
          const rr = await P("/api/pc/sign", { offer: pickO.id });
          if (rr.status === 200 && (pickO.kind === "transfer" || pickO.kind === "free")) moves++;
        }
        for (const d of (s3.decisions || [])) if (d.kind === "agent") await P("/api/pc/decide", { id: d.id, choice: d.options[1] || "none" });
      }
      ok("a long career keeps moving season after season (no stuck states)", !stuck && seasons3 >= 10, [stuck, seasons3]);
      if (s3) {
        console.log("pro career: age " + s3.player.age + ", rating " + s3.player.rating + ", club " + s3.player.club + " (" + s3.player.league + "), apps " + s3.stats.career.apps + ", goals " + s3.stats.career.g + ", caps " + JSON.stringify(s3.national.caps) + ", bids " + bids + ", moves " + moves + ", renewals " + renew + ", cash " + s3.money.cash + ", trophies " + s3.trophies.length);
        if (process.env.CDEBUG) for (const x of s3.stats.seasons) console.log("  ", x.season, x.age, x.stage, x.club, "r" + x.rating, "apps " + x.apps, "starts " + x.starts, "g " + x.g);
        ok("a strong player grows into a top rating by his twenties", s3.player.rating >= 74, s3.player.rating);
        ok("every pro result has his club, the score his way round, a W, L or D and the week", proRows.length >= 100 && proRows.every(x => lineOk(x) && x.wk === x.wkLabel), proRows.filter(x => !lineOk(x) || x.wk !== x.wkLabel).slice(0, 3));
        ok("every international result has his country's team, the score its way round and a W, L or D", intlRows.length > 0 && intlRows.every(lineOk) && s3.national.log.every(lineOk), intlRows.filter(x => !lineOk(x)).slice(0, 3));
        ok("he plays a lot of football over the years", s3.stats.career.apps >= 100, s3.stats.career.apps);
        ok("his country calls him up at some level", Object.keys(s3.national.caps || {}).length > 0 || intl > 0, s3.national);
        ok("clubs come in for him or offer new deals", bids + renew >= 1, [bids, renew]);
        ok("money builds up over a career", s3.money.cash > 20000, s3.money.cash);
        ok("season summaries are kept", s3.stats.seasons.length >= 10, s3.stats.seasons.length);
        ok("no NaN after a long career", !hasNaN(s3), null);
        const fam = (s3.people.log || []).filter(x => x.kind === "family").reverse();
        ok("family drama never comes twice between two matches", fam.every((x, i) => i === 0 || x.fx > fam[i - 1].fx), fam.map(x => x.fx));
        ok("the people around him are in the state", s3.people && s3.people.family.length >= 2 && typeof s3.people.team === "number", s3.people && s3.people.family);
        ok("a pro away from home lives in his own place", s3.life.home.id !== "family" || s3.life.city === s3.life.hometown, s3.life.home);
        ok("the bills of a life are paid (rent or upkeep, food)", (s3.money.log || []).some(x => /Food and bills|Rent|Upkeep/.test(x.text)), s3.money.log.slice(0, 6));
        ok("followers grow with fame", s3.life.followers > 5000, s3.life.followers);
        ok("the big days are kept as moments (debut, a call up)", !!s3.moments.debut && Object.keys(s3.moments).some(k => k.startsWith("callup_")), Object.keys(s3.moments));
        ok("his national team record is in the state", s3.national && typeof s3.national.caps === "object" && Array.isArray(s3.national.log), s3.national);
        if (s3.player.club && !s3.loan && !s3.requested) {
          r = await P("/api/pc/request");
          ok("he can hand in a transfer request", r.status === 200 && (r.j.denied === true || r.j.state.requested === true), r.j.error || r.j.denied);
        }
      }
      // ---------- player lock: his league match, played live in the 3D engine, back into the career ----------
      {
        let start = null, tries = 0, why = [], before = null;
        while (!start && tries++ < 16) {
          // a manager who trusts him and a man in form: he starts
          await P("/api/pc/testset", { trust: 100, form: 9 });
          before = (await api(`/api/pc/state?code=${pc}&name=Pro`)).j.state;
          const pk = await P("/api/pc/matchstart", { peek: true });
          if (pk.status === 200) ok("the match screen can look at the pro match without using up the go", pk.j.peek === true && pk.j.lock && pk.j.lock.name === "Vikram Rao" && (await api(`/api/pc/state?code=${pc}&name=Pro`)).j.state.play.can === true, pk.j);
          r = await P("/api/pc/matchstart");
          if (r.status === 200) { start = r.j; break; }
          why.push(r.j.code + ": " + r.j.error);
          if (r.j.event) { await answerEvent(r, pc, "Pro"); continue; }
          if (r.j.seasonOver) { await P("/api/pc/season"); continue; }
          if (r.j.decision) { const d = r.j.decision; await P("/api/pc/decide", { id: d.id, choice: d.kind === "agent" ? "none" : d.options[0] }); continue; }
          const w = await P("/api/pc/week", { weeks: 1 });
          if (w.status !== 200) await answerEvent(w, pc, "Pro");
          for (const o of ((w.j.state || {}).offers || [])) await P("/api/pc/sign", { offer: o.id });
        }
        if (!start) {
          // why the manager keeps him out: his place in the squad and in his position group
          const sv = (await saveNow())[pc], me5 = sv.players[sv.career.pid], cl5 = sv.clubs[me5.club];
          why.push({ club: me5.club, inSquad: !!(cl5 && cl5.squad.includes(me5.id)), ban: me5.ban, inj: me5.inj, rating: me5.rating, group: cl5 ? cl5.squad.map(id => sv.players[id]).filter(q => q && q.pos === me5.pos).map(q => q.rating).sort((a, b) => b - a) : null });
        }
        ok("a professional can play his league match live", !!start, why.slice(-3));
        if (start) {
          ok("the hub had PLAY open for that pro match", before.play && before.play.can === true && before.play.kind === "pro", before.play);
          const mine = start.side === "home" ? start.homeXI : start.awayXI;
          const meRow = mine.find(x => x.pc);
          ok("the match teams are full and he is in his own XI, marked for player lock, with his look", start.homeXI.length === 11 && start.awayXI.length === 11 && meRow && meRow.look && meRow.look.skinF !== undefined && start.lock && start.lock.instruction, meRow);
          ok("he plays his own position in the 3D match", meRow && meRow.role === "CAM", meRow && meRow.role);
          r = await P("/api/pc/matchstart");
          ok("one live match a week", r.status === 400 && r.j.code === "played", r.j);
          const lm = await lockMatch(start, 99);
          const res = lm.res, line = lm.line;
          ok("the live match finishes with control locked on him the whole game", lm.m.phase === "full" && lm.switched === 0 && !!lm.L && lm.L.name === meRow.n, [lm.m.phase, lm.switched]);
          ok("his line from the pitch is sane", line && Number.isFinite(line.rating) && line.rating >= 3 && line.rating <= 10 && line.g >= 0 && line.passes >= 0, line);
          const appsBefore = s3.stats.career.apps;
          const gBefore = before.stats.career.g;
          r = await P("/api/pc/matchresult", { hg: res.home, ag: res.away, line });
          ok("the live result goes into the week", r.status === 200 && r.j.reports && r.j.reports[0] && r.j.reports[0].match && r.j.reports[0].match.live === true, r.j.error || (r.j.reports && r.j.reports[0]));
          if (r.status === 200) {
            const rm = r.j.reports[0].match;
            const st5 = r.j.state;
            ok("the score he played is the score the world keeps, his side first", [rm.gf, rm.ga].join("-") === (start.side === "home" ? res.home + "-" + res.away : res.away + "-" + res.home), [rm.gf, rm.ga, res]);
            ok("the live pro result line is complete: club, score his way, outcome, week", lineOk(rm) && rm.team === before.player.club && rm.wk === before.round + 1, rm);
            ok("his rating and goals are the ones from the pitch", rm.rating === line.rating && rm.g === Math.min(line.g, rm.gf) && st5.stats.career.g === gBefore + rm.g, [rm.rating, line.rating, rm.g, line.g]);
            ok("the live rating is the one saved in his record", st5.stats.log[0].live === true && st5.stats.log[0].rating === line.rating && Math.abs(st5.stats.career.rSum - before.stats.career.rSum - line.rating) < 1e-6, [st5.stats.log[0].rating, line.rating]);
            ok("a played match counts as an appearance", st5.stats.career.apps >= appsBefore + 1, [appsBefore, st5.stats.career.apps]);
            const save5 = (await saveWhen(pc, g5 => g5.round === st5.round && g5.season === st5.season))[pc];
            // the league he kicked off in (a move later that same week can put him in another one)
            const fxs = (save5.leagueFixtures[before.player.league] || [])[save5.round - 1] || [];
            const fx = fxs.find(x => x.home === start.home && x.away === start.away);
            ok("the league table uses the live score", fx && fx.hg === res.home && fx.ag === res.away && fx.played, fx);
            ok("no live match is left hanging", !save5.career.live && !(save5.plays || {}).__pc, save5.career.live);
          }
          r = await P("/api/pc/matchresult", { hg: 1, ag: 0, line });
          ok("a result needs a match that was kicked off", r.status === 400, r.j);
        }
      }

      // the end: retire at 33 and take over a club in the same world
      r = await P("/api/pc/retire");
      ok("retirement waits until 32", r.status === 400 && /32/.test(r.j.error || ""), r.j);
      await P("/api/pc/testset", { age: 33 });
      r = await P("/api/pc/retire");
      ok("he retires with a full career summary", r.status === 200 && r.j.summary && r.j.summary.matches >= 100 && r.j.state.retired, r.j.error);
      const optsM = (r.j.state && r.j.state.managerOptions) || [];
      ok("clubs offer him a manager's job", optsM.length >= 1, optsM);
      if (optsM.length) {
        r = await P("/api/pc/manage", { club: optsM[0] });
        ok("the save becomes a Manager Career save at his club", r.status === 200 && r.j.club === optsM[0], r.j);
        const ms = await api(`/api/state?code=${pc}&name=Pro`);
        ok("Manager Career opens the same world with him in charge", ms.status === 200 && ms.j.myClub && ms.j.myClub.name === optsM[0], ms.status + " " + (ms.j.error || ""));
        r = await P("/api/pc/week", {});
        ok("the player screens close once he manages", r.status === 400, r.j);
      }
    }

    // ---------- the other two roads: a club academy at home, a development centre then trials abroad ----------
    for (const [country, kind, pos] of [["England", "academy", "CB"], ["Nigeria", "centre", "RW"]]) {
      r = await api("/api/pc/create", { name: "Pc2", player: FORM({ first: "Sam", last: "Okoye", country, nat: country, pos, pos2: null, style: null, dobY: 2010 }) });
      ok(country + ": a player is created on the " + kind + " road", r.status === 200 && r.j.state.decisions.some(d => d.kind === kind), r.j.error || r.j.state && r.j.state.decisions);
      if (r.status !== 200) continue;
      const c2 = r.j.code;
      let s2 = r.j.state;
      const d = s2.decisions.find(x => x.kind === kind);
      let choice = "centre";
      if (kind === "academy") {
        const opts = (await api(`/api/pc/options?code=${c2}&name=Pc2&kind=academy`)).j.options || [];
        ok("England: three academies at home, from elite to small", opts.length === 3 && opts.every(o => o.club) && opts[0].tier === "Elite academy", opts);
        choice = opts[0] && opts[0].club;
      }
      r = await api("/api/pc/decide", { code: c2, name: "Pc2", id: d.id, choice });
      ok(country + ": the " + kind + " is joined", r.status === 200 && r.j.state.stage === kind && r.j.state.team, r.j.error);
      let played = 0, wk = 0, end2 = null;
      for (let i = 0; i < 30 && wk < 38; i++) {
        r = await api("/api/pc/week", { code: c2, name: "Pc2", weeks: 4 });
        if (r.status !== 200) {
          if (await answerEvent(r, c2, "Pc2")) continue;
          if (r.j.decision && r.j.decision.kind === "trial") { await api("/api/pc/decide", { code: c2, name: "Pc2", id: r.j.decision.id, choice: "go" }); continue; }
          end2 = r.j; break;
        }
        for (const rep of r.j.reports) { wk++; if (rep.match && rep.match.mins) played++; }
        s2 = r.j.state;
      }
      ok(country + ": youth matches are played and nothing gets stuck", played >= 6 && !hasNaN(s2), [played, wk, end2]);
    }
  } catch (e) {
    ok("career run crashed", false, e.stack || e.message);
  }
  console.log(passed + " passed, " + failed + " failed");
  stop();
  process.exit(failed ? 1 : 0);
}
main();
