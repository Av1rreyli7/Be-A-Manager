// Player Career: the career itself. One created footballer living inside an ordinary Floodlights world.
// The world (clubs, players, fixtures, the weekly sim, transfers, ageing) is the server's own code, handed in
// as deps and run unchanged. This file only adds the person: who he is, how he trains and grows, his youth
// football, scouts, trials, contracts, selection and match ratings, money and the messages on his phone.
const D = require("./data");
const { makePro } = require("./pro");
const { makeLife } = require("./life");
const { makePeople } = require("./people");
const { makeCampus } = require("./campus");
const { makeSocial } = require("./social");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = () => Math.random();
const pick = a => a[Math.floor(Math.random() * a.length)];
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const round1 = v => Math.round(v * 10) / 10;

function makeCore(deps) {
  const { marketValue, log, playMatchweek, endOfSeason, bestXI, makeFixtures, makeAllCups, leagueClubs, ensureRoles, tableFor, LEAGUES, poisson } = deps;

  // ---------- small helpers ----------
  const C = game => game.career;
  const me = game => game.players[game.career.pid];
  const seasonYear = game => 2025 + (game.season || 1); // season 1 is 2026-27
  function weekLabel(game) { const y = seasonYear(game); return "Season " + y + "-" + String(y + 1).slice(2) + ", week " + (game.round + 1); }
  function money(game, amt, text) {
    const c = C(game);
    c.money.cash = Math.round(c.money.cash + amt);
    if (amt > 0) c.money.earned = Math.round((c.money.earned || 0) + amt);
    c.money.log.unshift({ s: game.season, w: game.round, amt: Math.round(amt), text });
    if (c.money.log.length > 60) c.money.log.length = 60;
  }
  function msg(game, thread, from, text, extra) {
    const c = C(game);
    const t = c.phone.threads[thread] = c.phone.threads[thread] || { id: thread, name: from, msgs: [] };
    t.msgs.push(Object.assign({ from, text, s: game.season, w: game.round, read: false }, extra || {}));
    if (t.msgs.length > 40) t.msgs.splice(0, t.msgs.length - 40);
    t.last = c.phone.seq = (c.phone.seq || 0) + 1;
  }
  // the team group chat after a game: a teammate says something about it
  function teamChat(game, m) {
    const c = C(game), p = me(game);
    if (!m || !m.mins || rnd() > 0.45) return;
    const club = p.club && game.clubs[p.club];
    const mates = club ? club.squad.filter(id => id !== p.id).map(id => game.players[id]).filter(Boolean).map(q => q.name.split(" ")[0]) : D.IN_FIRST;
    const who = mates[Math.floor(rnd() * mates.length)] || "Coach";
    const won = m.gf > m.ga, lost = m.gf < m.ga;
    const lines = (m.g || 0) >= 2 ? ["Who keeps giving him the ball 😂 unreal", "Two goals. You are buying dinner"] : m.g ? ["Lovely finish today", "That goal though 🔥", "Told you that run would come off"] : (m.rating || 0) >= 7.6 ? ["You ran the show today", "Player of the match, easy"] : won ? ["Three points, back to work Monday", "Good win lads 💪"] : lost ? ["Heads up. We go again", "Not our day. No excuses at training"] : ["A point is a point", "We should have won that"];
    c.phone.threads.team = c.phone.threads.team || { id: "team", name: "Team chat", msgs: [] };
    msg(game, "team", who, lines[Math.floor(rnd() * lines.length)]);
  }
  function news(game, text, kind) {
    const c = C(game);
    c.news.unshift({ s: game.season, w: game.round, text, kind: kind || "news" });
    if (c.news.length > 50) c.news.length = 50;
  }

  // ---------- attributes and the overall rating ----------
  function ovrFor(attrs, pos) {
    const w = D.POS_WEIGHTS[pos] || D.POS_WEIGHTS.CM;
    let s = 0;
    for (const k in w) s += (attrs[k] || 0) * w[k];
    return Math.round(s);
  }
  function refreshRating(game) {
    const c = C(game), p = me(game);
    const r = ovrFor(c.attrs, c.person.pos);
    p.rating = clamp(r, 30, 99);
    p.pot = Math.max(p.rating, c.potential);
    p.value = marketValue(p.rating, p.age, p.pos);
    c.history = c.history || [];
    return p.rating;
  }
  // the hidden ceiling for one attribute: the potential, higher for what his position uses
  function ceilingOf(c, k) {
    const w = (D.POS_WEIGHTS[c.person.pos] || {})[k] || 0;
    const keeper = D.ATTRS.keeping.includes(k);
    if (keeper && c.person.pos !== "GK") return 40;
    if (!keeper && c.person.pos === "GK" && !["reactions", "composure", "jumping", "strength", "concentration", "leadership", "decisions", "passing", "positioning"].includes(k)) return 55;
    return clamp(c.potential + 2 + w * 60 + (c.talent[k] || 0), 30, 99);
  }

  // ---------- creating the player ----------
  // the creator's look, in the body builder's own terms (m3d/view/rig.mjs): sliders 0 to 1, a few picks by index,
  // accessories by finish name. Anything missing or out of range falls back to a plain default.
  const LOOK_SLIDERS = { skinF: 0.5, faceW: 0.5, jaw: 0.5, chin: 0.5, cheeks: 0.5, eyes: 0.5, brows: 0.5, nose: 0.5, mouth: 0.5, ears: 0.5, hairline: 0.5, muscle: 0.5, shoulders: 0.5, legs: 0.5 };
  const LOOK_PICKS = { hair: [1, 15], hairCol: [0, 12], eyeCol: [0, 5], beard: [0, 5], moustache: [0, 1], boot: [6, 13] };
  const ACC_KEYS = ["watch", "necklace", "earrings", "bracelet", "headband", "gloves", "compression"];
  const FINISHES = ["gold", "silver", "black", "rose", "white", "steel", "volt", "red", "blue", "navy", "orange", "pink", "green"];
  function cleanLook(look) {
    const L = look || {}, out = {};
    for (const [k, d] of Object.entries(LOOK_SLIDERS)) { const v = Number(L[k]); out[k] = Number.isFinite(v) ? clamp(v, 0, 1) : d; }
    for (const [k, [d, max]] of Object.entries(LOOK_PICKS)) { const v = Math.floor(Number(L[k])); out[k] = Number.isFinite(v) ? clamp(v, 0, max) : d; }
    for (const k of ACC_KEYS) out[k] = FINISHES.includes(L[k]) ? L[k] : null;
    return out;
  }
  function validate(form) {
    const f = form || {};
    const s = (v, n) => String(v || "").replace(/[\u2013\u2014]/g, "-").trim().slice(0, n);
    const person = {
      first: s(f.first, 24), last: s(f.last, 24), nick: s(f.nick, 20),
      dob: { y: Math.floor(Number(f.dobY)) || 2011, m: clamp(Math.floor(Number(f.dobM)) || 1, 1, 12), d: clamp(Math.floor(Number(f.dobD)) || 1, 1, 31) },
      country: D.COUNTRIES[f.country] ? f.country : "India",
      nat: s(f.nat, 24), nat2: s(f.nat2, 24), lang: s(f.lang, 24),
      foot: f.foot === "Left" || f.foot === "Both" ? f.foot : "Right",
      height: clamp(Math.round(Number(f.height) || 176), 155, 205),
      weight: clamp(Math.round(Number(f.weight) || 68), 45, 110),
      pos: D.POSITIONS.includes(f.pos) ? f.pos : "ST",
      pos2: D.POSITIONS.includes(f.pos2) ? f.pos2 : null,
      num: clamp(Math.floor(Number(f.num)) || 9, 1, 99),
      style: D.STYLES[f.style] ? f.style : null
    };
    if (!person.first) return { error: "Give your player a first name." };
    if (!person.last) return { error: "Give your player a last name." };
    if (!person.nat) person.nat = person.country;
    if (person.pos2 === person.pos) person.pos2 = null;
    const age = 2026 - person.dob.y - (person.dob.m > 10 ? 1 : 0);
    if (age < 14 || age > 17) return { error: "Careers start at school age: pick a birth year that makes you 14 to 17 in October 2026." };
    person.startAge = age;
    if (!person.style || !D.STYLES[person.style].pos.includes(person.pos)) person.style = Object.keys(D.STYLES).find(k => D.STYLES[k].pos.includes(person.pos)) || null;
    return { person };
  }
  // starting attributes: a young player, mostly 35 to 55, shaped by position, style, body and foot
  function startAttrs(person) {
    const a = {};
    const w = D.POS_WEIGHTS[person.pos] || {};
    const base = 41 + (person.startAge - 15) * 2.5;
    for (const k of D.ATTR_LIST) {
      const keeper = D.ATTRS.keeping.includes(k);
      let v = base + (w[k] || 0) * 55 + gauss() * 3.2;
      if (keeper && person.pos !== "GK") v = 12 + rnd() * 10;
      if (!keeper && person.pos === "GK" && !["reactions", "composure", "jumping", "strength", "kicking", "concentration", "decisions"].includes(k)) v -= 10;
      a[k] = v;
    }
    const tilt = person.style ? D.STYLES[person.style].tilt : {};
    for (const k in tilt) a[k] += tilt[k];
    // the body matters: tall players head and jump, light ones turn and run
    const tall = (person.height - 178) / 10, heavy = (person.weight - 70) / 10;
    a.heading += tall * 3; a.jumping += tall * 2.5; a.strength += heavy * 3 + tall; a.agility -= tall * 2 + heavy; a.balance -= tall * 1.5; a.pace -= heavy * 2; a.acceleration -= heavy * 2 + tall;
    if (person.foot === "Both") { a.control += 1.5; a.firstTouch += 1.5; }
    for (const k of D.ATTR_LIST) a[k] = Math.round(clamp(a[k], 5, 70) * 10) / 10;
    return a;
  }
  function newCareerBlock(person, look) {
    const potential = Math.round(clamp(81 + gauss() * 5, 70, 93));
    const talent = {};
    for (const k of D.ATTR_LIST) talent[k] = Math.round(gauss() * 4);
    const country = D.COUNTRIES[person.country];
    return {
      v: 1, pid: null, person, look, potential, talent,
      attrs: startAttrs(person),
      stage: country.path === "school" ? "school" : country.path === "academy" ? "academy" : "centre",
      path: country.path, stageSeasons: 0,
      school: null, college: null, academy: null, centre: null,
      training: { slots: defaultPlan(person.pos), intensity: "normal", lastGains: {}, weeks: 0 },
      cond: { fatigue: 15, fitness: 90, morale: 70, confidence: 55, form: 6.5, inj: null },
      traits: { lifestyle: 50, professionalism: 55, discipline: 55, leadership: 35, popularity: 10, confidence: 50, mentality: 55 },
      rep: { local: 3, national: 0, international: 0, club: 0, commercial: 0 },
      scouts: {}, trials: [], offers: [], decisions: [],
      contract: null, agent: null, agentOffers: [],
      trust: 50, coachRel: 55,
      money: { cash: 400, log: [] },
      stats: { season: blankStats(), career: blankStats(), seasons: [], log: [] },
      national: { level: null, caps: {}, goals: {}, callups: [] },
      phone: { threads: {}, seq: 0 },
      news: [], moments: {}, seen: {}, firsts: {},
      created: Date.now()
    };
  }
  function blankStats() { return { apps: 0, starts: 0, mins: 0, g: 0, a: 0, cs: 0, rSum: 0, rN: 0, best: 0, motm: 0 }; }
  function defaultPlan(pos) {
    if (pos === "GK") return ["keeping", "keeping", "tactical", "strength", "recovery"];
    const grp = D.POS_GROUP[pos];
    if (grp === "DF") return ["defending", "technical", "tactical", "strength", "recovery"];
    if (grp === "MF") return ["passing", "technical", "tactical", "stamina", "recovery"];
    return ["finishing", "technical", "speed", "tactical", "recovery"];
  }

  // a new Player Career game: the same world a manager gets, plus the Indian league and India's teams
  function setupWorld(game) {
    game.mode = "player";
    game.started = true;
    addIndianLeague(game);
    ensureRoles(game);
  }
  function addIndianLeague(game) {
    if (game.leagueFixtures[D.ISL_NAME]) return;
    const names = [];
    for (const [name, city, band, budget] of D.ISL) {
      if (game.clubs[name]) continue;
      game.clubs[name] = { name, league: D.ISL_NAME, budget, baseBudget: budget, squad: [], tactic: "balanced", city, isl: true };
      names.push(name);
      const shape = ["GK", "GK", "GK", "DF", "DF", "DF", "DF", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "MF", "MF", "FW", "FW", "FW", "FW", "FW", "MF", "DF"];
      shape.forEach((pos, i) => {
        const foreign = i === 4 || i === 12 || i === 19 || i === 20 || (i === 13 && band >= 66);
        const name2 = foreign ? pick(D.FOREIGN_FIRST) + " " + pick(D.FOREIGN_LAST) : pick(D.IN_FIRST) + " " + pick(D.IN_LAST);
        const starter = i === 0 || (i >= 3 && i <= 6) || (i >= 11 && i <= 13) || (i >= 18 && i <= 20);
        const rating = Math.round(clamp(band + (foreign ? 4 : 0) + (starter ? 1 : -5) + gauss() * 3, 48, 80));
        const age = foreign ? 27 + Math.floor(rnd() * 7) : 19 + Math.floor(rnd() * 13);
        const id = game.playerSeq++;
        game.players[id] = { id, name: name2, pos, age, rating, value: marketValue(rating, age, pos), club: name, league: D.ISL_NAME, nation: foreign ? "" : "India", wage: 0.1, contractYears: 2, squadRole: starter ? "First team" : "Rotation" };
        game.clubs[name].squad.push(id);
      });
    }
    game.leagueFixtures[D.ISL_NAME] = makeFixtures(leagueClubs(game, D.ISL_NAME));
    // India's national teams come from the Indian players in the league
    game.nations = game.nations || {};
    const indians = Object.values(game.players).filter(p => p.league === D.ISL_NAME && p.nation === "India").sort((a, b) => b.rating - a.rating);
    if (!game.nations.India) game.nations.India = { name: "India", playerIds: indians.slice(0, 23).map(p => p.id), manager: null, pcOnly: true };
  }

  function createPlayer(game, form) {
    const v = validate(form);
    if (v.error) return v;
    const person = v.person;
    const look = cleanLook(form && form.look);
    const c = game.career = newCareerBlock(person, look);
    const id = game.playerSeq++;
    const p = game.players[id] = {
      id, pc: true, name: person.first + " " + person.last, pos: D.POS_GROUP[person.pos], role: D.POS_ROLE[person.pos],
      age: person.startAge, rating: 40, value: 1, club: "", league: "", nation: person.nat, num: person.num
    };
    c.pid = id;
    refreshRating(game);
    // the first week of the new life
    const country = D.COUNTRIES[person.country];
    c.city = country.city;
    c.hometown = country.city;
    if (c.path === "school") c.decisions.push({ id: "school", kind: "school", title: "Pick your school", options: D.SCHOOLS.map(s => s.id) });
    else if (c.path === "academy") c.decisions.push({ id: "academy", kind: "academy", title: "Pick your academy", options: academyChoices(game, person.country).map(a => a.club) });
    else c.decisions.push({ id: "centre", kind: "centre", title: "Join the national development centre", options: ["centre"] });
    msg(game, "mum", "Mum", "Big day tomorrow! Eat properly tonight. We are so proud of you. ❤️");
    msg(game, "dad", "Dad", "Football is a long road. Work hard, listen to your coaches and enjoy it.");
    news(game, person.first + " " + person.last + ", " + person.startAge + ", from " + c.city + ", starts the road to professional football.", "life");
    return { ok: true, pid: id };
  }

  // ---------- academy choices for the academy path: a big, a middle and a small club at home ----------
  function academyChoices(game, country) {
    const league = D.COUNTRIES[country].league;
    const clubs = leagueClubs(game, league).map(n => game.clubs[n]).sort((a, b) => (b.baseBudget || b.budget) - (a.baseBudget || a.budget));
    if (!clubs.length) return [];
    const picks = [clubs[0], clubs[Math.floor(clubs.length / 2)], clubs[clubs.length - 1]];
    return picks.map((cl, i) => ({ club: cl.name, tier: ["Elite academy", "Solid academy", "Small academy"][i], coaching: [9, 7, 6][i], facilities: [10, 7, 5][i], exposure: [9, 7, 5][i], competition: [9, 7, 5][i], firstTeamPath: [4, 6, 9][i] }));
  }

  // ---------- decisions the person has to make before the week can move on ----------
  function decide(game, id, choice) {
    const c = C(game);
    const d = c.decisions.find(x => x.id === id);
    if (!d) return { error: "That choice is not open any more." };
    const p = me(game);
    if (d.kind === "school") {
      const s = D.SCHOOLS.find(x => x.id === choice);
      if (!s) return { error: "Pick one of the schools." };
      c.school = s.id; c.stage = "school"; c.stageSeasons = 0;
      news(game, p.name + " joins " + s.name + ".", "life");
      msg(game, "coach", "Coach", "Welcome to " + s.name + ". Training is Monday, Wednesday and Friday. Do not be late.");
    } else if (d.kind === "college") {
      const opts = collegeOptions(game);
      const o = opts.find(x => x.id === choice);
      if (!o) return { error: "Pick one of the colleges." };
      if (!o.accepted) return { error: o.name + " did not offer you a place." };
      c.college = o.id; c.stage = "college"; c.stageSeasons = 0;
      news(game, p.name + " signs up at " + o.name + " in " + o.city + ".", "life");
      msg(game, "coach", "Coach", "Welcome to " + o.name + ". Pre season starts now, fitness first.");
      c.city = o.city;
    } else if (d.kind === "academy") {
      const opts = academyChoices(game, c.person.country);
      const o = opts.find(x => x.club === choice);
      if (!o) return { error: "Pick one of the academies." };
      c.academy = o; c.stage = "academy"; c.stageSeasons = 0;
      c.city = cityOf(game, o.club);
      news(game, p.name + " joins the " + o.club + " academy.", "life");
      msg(game, "coach", "Academy coach", "Welcome to the " + o.club + " academy. You are here to become a professional, act like one.");
    } else if (d.kind === "centre") {
      c.centre = { name: c.person.country + " National Development Centre", coaching: 7, facilities: 6, exposure: 6, competition: 7 };
      c.stage = "centre"; c.stageSeasons = 0;
      news(game, p.name + " joins the " + c.centre.name + ".", "life");
    } else if (d.kind === "agent") {
      const a = D.AGENTS.find(x => x.id === choice);
      if (!a && choice !== "none") return { error: "Pick an agent or none." };
      // looking around while he has an agent: "none" keeps the one he has
      if (a || !/_f$/.test(d.id)) c.agent = a ? { id: a.id, since: game.season } : null;
      if (a) {
        msg(game, "agent", a.name, "Great to have you with " + a.agency + ". Leave the business side to me, you focus on football.");
        PEOPLE.P0(game).agent = 55;
      }
    } else if (d.kind === "trial") {
      const t = c.trials.find(x => x.id === d.trial);
      if (t) t.status = choice === "go" ? "booked" : "declined";
    }
    c.decisions = c.decisions.filter(x => x !== d);
    return { ok: true };
  }
  function cityOf(game, clubName) {
    const cl = game.clubs[clubName];
    if (cl && cl.city) return cl.city;
    const g = deps.geo ? deps.geo(clubName) : null;
    return g && g.city ? g.city : (cl ? cl.name : "Mumbai");
  }

  // ---------- colleges: who takes you depends on your level and how much they have seen of you ----------
  function collegeOptions(game) {
    const c = C(game), p = me(game);
    const seen = Object.values(c.scouts).reduce((s, x) => s + x.level, 0) / 30;
    return D.COLLEGES.map(col => {
      const bar = 36 + col.reputation * 2.6;
      const score = p.rating + Math.min(8, seen) + (c.stats.season.rN ? (c.stats.season.rSum / c.stats.season.rN - 6.4) * 4 : 0);
      return Object.assign({}, col, { accepted: score >= bar, bar: Math.round(bar) });
    });
  }

  // ---------- training: five sessions, an intensity, real gains and real costs ----------
  function setPlan(game, slots, intensity) {
    const c = C(game);
    if (!Array.isArray(slots) || slots.length !== D.SLOTS || !slots.every(s => D.SESSIONS[s])) return { error: "A week has " + D.SLOTS + " sessions." };
    if (!D.INTENSITY[intensity]) return { error: "Pick light, normal or hard." };
    c.training.slots = slots.slice(); c.training.intensity = intensity;
    return { ok: true };
  }
  // one extra piece of work on one attribute (the gym, extra sessions): the same rules as the weekly plan
  function trainOne(game, k, scale) {
    const c = C(game), p = me(game);
    if (c.attrs[k] === undefined) return 0;
    const q = coachQuality(game);
    const prof = 0.75 + c.traits.professionalism / 200;
    const tired = c.cond.fatigue > 70 ? 0.55 : c.cond.fatigue > 55 ? 0.8 : 1;
    const room = clamp(1 - Math.pow(c.attrs[k] / ceilingOf(c, k), 3), 0, 1);
    const g = ageCurve(p.age) * (scale || 1) * (0.65 + q.coach * 0.05) * (0.85 + q.fac * 0.025) * prof * tired * room * (0.7 + rnd() * 0.6);
    c.attrs[k] = Math.min(99, c.attrs[k] + g);
    c.training.lastGains[k] = (c.training.lastGains[k] || 0) + g;
    return g;
  }
  function ageCurve(age) { return age <= 16 ? 0.24 : age <= 18 ? 0.21 : age <= 20 ? 0.16 : age <= 22 ? 0.11 : age <= 24 ? 0.07 : age <= 27 ? 0.04 : age <= 30 ? 0.018 : 0.006; }
  function coachQuality(game) {
    const c = C(game);
    if (c.stage === "school") { const s = D.SCHOOLS.find(x => x.id === c.school) || {}; return { coach: s.coaching || 5, fac: s.training || 5, physio: s.facilities || 5 }; }
    if (c.stage === "college") { const s = D.COLLEGES.find(x => x.id === c.college) || {}; return { coach: s.coaching || 6, fac: s.fitness || 6, physio: s.facilities || 6 }; }
    if (c.stage === "academy" && c.academy) return { coach: c.academy.coaching, fac: c.academy.facilities, physio: c.academy.facilities };
    if (c.stage === "centre" && c.centre) return { coach: c.centre.coaching, fac: c.centre.facilities, physio: c.centre.facilities };
    const cl = me(game).club ? game.clubs[me(game).club] : null;
    const tier = cl ? clamp(((cl.baseBudget || cl.budget || 10) / 20), 0, 1) : 0.3;
    return { coach: 6 + tier * 4, fac: 6 + tier * 4, physio: 6 + tier * 4 };
  }
  function train(game) {
    const c = C(game), p = me(game);
    const out = { gains: {}, fatigue: 0, injured: null, cost: 0 };
    if (c.cond.inj) {
      // rehab: recovery sessions bring the return closer, the physio and discipline help
      const q = coachQuality(game);
      const rehab = c.training.slots.filter(s => s === "recovery").length;
      if (rnd() < 0.08 * rehab + q.physio * 0.01 + c.traits.discipline * 0.001) c.cond.inj.weeks = Math.max(0, c.cond.inj.weeks - 1);
      c.cond.fatigue = Math.max(0, c.cond.fatigue - 20);
      return out;
    }
    const I = D.INTENSITY[c.training.intensity] || D.INTENSITY.normal;
    const q = coachQuality(game);
    const prof = 0.75 + c.traits.professionalism / 200;
    const tired = c.cond.fatigue > 70 ? 0.55 : c.cond.fatigue > 55 ? 0.8 : 1;
    let risk = 0;
    for (const sid of c.training.slots) {
      const S = D.SESSIONS[sid];
      let grows = S.grows;
      if (sid === "individual") grows = weakestRelevant(c, 3);
      if (S.cost) { money(game, -S.cost, S.label); out.cost += S.cost; }
      const sessFatigue = S.fatigue > 0 ? S.fatigue * I.fatigue : S.fatigue;
      out.fatigue += sessFatigue;
      risk += Math.max(-1, S.risk) * (S.risk > 0 ? I.risk : 1);
      for (const k of grows || []) {
        const ceil = ceilingOf(c, k);
        const room = clamp(1 - Math.pow(c.attrs[k] / ceil, 3), 0, 1);
        const g = ageCurve(p.age) * I.gain * (0.65 + q.coach * 0.05) * (0.85 + q.fac * 0.025) * prof * tired * room * (sid === "individual" ? 1.6 : 1) * (0.7 + rnd() * 0.6);
        c.attrs[k] = Math.min(99, c.attrs[k] + g);
        out.gains[k] = (out.gains[k] || 0) + g;
      }
    }
    // the week's load: training plus a natural recovery, fitter players bounce back quicker
    const recover = 22 + c.attrs.stamina * 0.12 + q.physio * 0.6;
    c.cond.fatigue = clamp(c.cond.fatigue + out.fatigue - recover, 0, 100);
    // injury: mostly from hard work while tired, a little from bad luck
    // a check up at the clinic (life.js) lowers the risk for a few weeks
    const chance = (0.004 + Math.max(0, risk) * 0.0035 * Math.pow(c.cond.fatigue / 60, 2) * (1.25 - c.traits.discipline / 200) * (1.15 - q.physio * 0.03)) * LIFE.guard(game);
    if (rnd() < chance) out.injured = injure(game, c.training.intensity === "hard" ? 1.3 : 1);
    // the coach notices who works
    const work = c.training.slots.filter(s => !["rest", "recovery"].includes(s)).length;
    c.coachRel = clamp(c.coachRel + (work >= 4 ? 0.5 : work <= 2 ? -0.8 : 0) + (c.training.intensity === "hard" ? 0.3 : 0), 0, 100);
    c.traits.professionalism = clamp(c.traits.professionalism + (work >= 4 ? 0.12 : -0.1), 0, 100);
    c.training.lastGains = out.gains;
    c.training.weeks++;
    return out;
  }
  function weakestRelevant(c, n) {
    const w = D.POS_WEIGHTS[c.person.pos] || {};
    return Object.keys(w).sort((a, b) => (c.attrs[a] - w[a] * 40) - (c.attrs[b] - w[b] * 40)).slice(0, n);
  }
  function injure(game, sev) {
    const c = C(game), p = me(game);
    const roll = rnd() * sev;
    const pool = roll > 1.05 ? D.INJURIES.filter(x => x.weeks[0] >= 4) : D.INJURIES.filter(x => x.weeks[0] < 4);
    const I = pick(pool);
    const weeks = I.weeks[0] + Math.floor(rnd() * (I.weeks[1] - I.weeks[0] + 1));
    c.cond.inj = { name: I.name, part: I.part, weeks, total: weeks, s: game.season, w: game.round };
    p.inj = weeks;
    news(game, p.name + " is out for about " + weeks + " week" + (weeks > 1 ? "s" : "") + " with a " + I.name.toLowerCase() + ".", "injury");
    msg(game, "mum", "Mum", "Are you okay?? Call me after the physio. Rest properly this time.");
    return c.cond.inj;
  }

  // ---------- youth football: school, college, academy and centre leagues ----------
  function youthSetting(game) {
    const c = C(game);
    if (c.stage === "school") { const s = D.SCHOOLS.find(x => x.id === c.school); return s ? { team: s.name, comp: s.competition, exposure: s.exposure, comps: D.YOUTH_COMPS.school, rivals: D.SCHOOL_RIVALS } : null; }
    if (c.stage === "college") { const s = D.COLLEGES.find(x => x.id === c.college); return s ? { team: s.name, comp: s.competition, exposure: s.exposure, comps: D.YOUTH_COMPS.college, rivals: D.COLLEGE_RIVALS } : null; }
    if (c.stage === "academy" && c.academy) return { team: c.academy.club + " U18", comp: c.academy.competition, exposure: c.academy.exposure, comps: [{ name: "U18 Premier League", weeks: "league" }, { name: "Youth Cup", weeks: [14, 18, 24, 30], national: true }], rivals: leagueClubs(game, D.COUNTRIES[c.person.country].league).filter(n => n !== c.academy.club).map(n => n + " U18") };
    if (c.stage === "centre" && c.centre) return { team: c.centre.name, comp: c.centre.competition, exposure: c.centre.exposure, comps: [{ name: "National Youth League", weeks: "league" }, { name: "International Youth Showcase", weeks: [20, 21], national: true }], rivals: ["Northern Academy", "Capital Football School", "Lagoon Stars", "City Rovers Youth", "Harbour Boys", "Valley FC Youth", "United Youth", "Golden Eagles Academy"] };
    return null;
  }
  // one roll a week that stays the same however often it is asked for: the hub, a live match and the sim of the
  // week all see the same opponent and the same team sheet
  function weekRoll(game, salt) {
    const s = String(C(game).created || 0) + ":" + game.season + ":" + game.round + ":" + salt;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  function youthFixture(game) {
    const set = youthSetting(game);
    if (!set) return null;
    const w = game.round + 1;
    for (const comp of set.comps) if (Array.isArray(comp.weeks) && comp.weeks.includes(w)) return { comp: comp.name, national: !!comp.national, opp: set.rivals[Math.floor(weekRoll(game, "opp") * set.rivals.length)], set };
    const league = set.comps.find(x => x.weeks === "league");
    if (league && w % 2 === 0 && w <= 36) return { comp: league.name, national: false, opp: set.rivals[(w / 2) % set.rivals.length], set };
    return null;
  }
  // the coach's team sheet this week: start, the bench or left out. A strong team means a real fight for a place.
  function youthRole(game) {
    const c = C(game), p = me(game);
    const set = youthSetting(game);
    if (!set || c.cond.inj) return "out";
    const bar = 34 + set.comp * 2.2 - (c.coachRel - 55) * 0.08;
    const startP = clamp(0.5 + (p.rating - bar) / 7, 0.05, 0.98);
    return weekRoll(game, "start") < startP ? "start" : weekRoll(game, "bench") < 0.6 ? "sub" : "out";
  }
  const resOf = (gf, ga) => (gf > ga ? "W" : gf < ga ? "L" : "D");
  function youthMatch(game, fx, role0) {
    const c = C(game), p = me(game);
    const set = fx.set;
    const teamStr = 36 + set.comp * 2.4;
    const oppStr = teamStr + gauss() * 4 + (fx.national ? 4 : 0);
    // selection: picked before the week's training, the same sheet the hub showed
    const role = role0 || youthRole(game);
    const mins = role === "start" ? (rnd() < 0.85 ? 90 : 60 + Math.floor(rnd() * 25)) : role === "sub" ? 10 + Math.floor(rnd() * 30) : 0;
    const share = mins / 90;
    const lift = (p.rating - teamStr) * 0.09 * share;
    const lf = 1.35 * Math.exp(((teamStr + lift) - oppStr) / 12), la = 1.25 * Math.exp((oppStr - (teamStr + lift * 0.5)) / 12);
    const gf = poisson(Math.min(lf, 4.5)), ga = poisson(Math.min(la, 4.5));
    const out = { comp: fx.comp, opp: fx.opp, team: set.team, gf, ga, res: resOf(gf, ga), wk: game.round + 1, role, mins, national: fx.national };
    if (mins > 0) Object.assign(out, playerLine(game, gf, ga, share, teamStr));
    recordMatch(game, out);
    teamChat(game, out);
    PEOPLE.afterMatch(game, out);
    SOCIAL.afterMatch(game, out);
    // exposure: scouts are at the big games and the good schools
    if (mins > 0) scoutWatch(game, out, set.exposure * (fx.national ? 2 : 1));
    c.cond.fatigue = clamp(c.cond.fatigue + mins * 0.16, 0, 100);
    return out;
  }
  // his goals, assists and rating in a match his side won gf to ga
  function playerLine(game, gf, ga, share, teamStr) {
    const c = C(game), p = me(game);
    const grp = D.POS_GROUP[c.person.pos];
    const scoreW = { FW: 0.34, MF: 0.17, DF: 0.06, GK: 0 }[grp];
    const assistW = { FW: 0.2, MF: 0.28, DF: 0.08, GK: 0.01 }[grp];
    const edge = clamp(Math.pow(Math.max(30, p.rating) / Math.max(30, teamStr), 2), 0.5, 2.2);
    let g = 0, a = 0;
    for (let i = 0; i < gf; i++) { if (rnd() < scoreW * edge * share) g++; else if (rnd() < assistW * edge * share) a++; }
    const res = gf > ga ? 0.4 : gf === ga ? 0.05 : -0.35;
    const cs = ga === 0 && (grp === "DF" || grp === "GK") && share > 0.6;
    let r = 6.1 + g * 0.85 + a * 0.5 + res + (cs ? 0.45 : 0) + (p.rating - teamStr) * 0.035 + gauss() * 0.45 - (grp !== "FW" ? ga * 0.12 : 0);
    if (grp === "GK") r += (2 - ga) * 0.25;
    r = share < 0.5 ? 6.2 + (r - 6.2) * 0.45 : r;
    r = round1(clamp(r, 3.5, 10));
    return { g, a, cs, rating: r };
  }
  function recordMatch(game, m) {
    const c = C(game);
    m.s = game.season; m.w = game.round;
    // won, lost or drawn, his side's way round, so every result row can say it plainly
    if (!m.res && Number.isFinite(m.gf) && Number.isFinite(m.ga)) m.res = resOf(m.gf, m.ga);
    c.stats.log.unshift(m);
    if (c.stats.log.length > 20) c.stats.log.length = 20;
    if (!m.mins) return;
    for (const st of [c.stats.season, c.stats.career]) {
      st.apps++; if (m.role === "start") st.starts++;
      st.mins += m.mins; st.g += m.g || 0; st.a += m.a || 0; if (m.cs) st.cs++;
      st.rSum += m.rating; st.rN++; st.best = Math.max(st.best, m.rating);
    }
    // form is the recent ratings, confidence follows it, morale likes minutes and wins
    c.cond.form = round1(c.cond.form * 0.6 + m.rating * 0.4);
    c.cond.confidence = clamp(c.cond.confidence + (m.rating - 6.6) * 4, 5, 99);
    c.traits.confidence = clamp(c.traits.confidence + (m.rating - 6.6) * 1.2, 5, 99);
    c.cond.morale = clamp(c.cond.morale + (m.gf > m.ga ? 2 : m.gf < m.ga ? -2 : 0) + (m.role === "start" ? 1 : 0), 5, 99);
    // minutes teach too: a little growth where the match tested him
    const p = me(game);
    const w = D.POS_WEIGHTS[c.person.pos] || {};
    for (const k in w) {
      const ceil = ceilingOf(c, k);
      const room = clamp(1 - Math.pow(c.attrs[k] / ceil, 3), 0, 1);
      c.attrs[k] = Math.min(99, c.attrs[k] + ageCurve(p.age) * w[k] * 3 * (m.mins / 90) * (0.6 + (m.rating - 5) * 0.18) * room);
    }
    if (m.rating >= 8 && !c.firsts.bigGame) { c.firsts.bigGame = { s: game.season, w: game.round }; }
  }

  // ---------- scouts: interest grows with good games where they are watching ----------
  // who sends scouts: mostly clubs at home, and a quarter of the time a club abroad once he is good
  function scoutPool(game) {
    const c = C(game), p = me(game);
    const home = D.COUNTRIES[c.person.country].league;
    if (p.rating >= 60 && rnd() < 0.25) {
      let abroad = [];
      for (const l of ["Belgian Pro League", "Eredivisie", "Primeira Liga", "Scottish Premiership", "MLS", "Super Lig"].filter(l => l !== home)) abroad = abroad.concat(leagueClubs(game, l).slice(0, 4));
      return abroad;
    }
    return leagueClubs(game, home);
  }
  function clubLevel(game, name) {
    const cl = game.clubs[name];
    if (!cl || !cl.squad.length) return 60;
    const r = cl.squad.map(id => game.players[id]).filter(Boolean).map(q => q.rating).sort((a, b) => b - a).slice(0, 14);
    return r.reduce((s, x) => s + x, 0) / r.length;
  }
  function scoutWatch(game, m, exposure) {
    const c = C(game), p = me(game);
    const home = D.COUNTRIES[c.person.country].league;
    const ag = c.agent ? D.AGENTS.find(a => a.id === c.agent.id) : null;
    const watching = Math.max(1, Math.round(exposure * 0.28));
    for (let i = 0; i < watching; i++) {
      const club = pick(scoutPool(game));
      if (!club || club === p.club) continue;
      const level = clubLevel(game, club);
      // what a club needs from a youngster of his age: well below the first team when he is young
      const youthBar = level - 14 - Math.max(0, 19 - p.age) * 1.5;
      const fit = (p.rating - youthBar) / 5;
      // clubs abroad mostly see him at the big tournaments, or when an agent with the contacts sends tapes
      const foreign = (game.clubs[club] || {}).league !== home;
      const reach = foreign ? (m.national ? 0.6 : 0.2) * (1 + (ag ? ag.europe : 0) / 10) : 1;
      const gain = ((m.rating - 6.2) * 4 + fit * 3) * (0.4 + exposure / 20) * reach;
      if (gain <= 0) continue;
      const s = c.scouts[club] = c.scouts[club] || { club, level: 0, since: game.season * 100 + game.round, seen: 0 };
      s.level = clamp(s.level + gain, 0, 100); s.seen++; s.last = game.season * 100 + game.round;
      if (s.level >= 35 && !s.told) {
        s.told = true;
        news(game, club + " scouts are watching " + p.name + ".", "scout");
        msg(game, "coach", "Coach", "There was a scout from " + club + " in the stands today. Keep doing what you are doing.");
      }
    }
  }
  function scoutDecay(game) {
    const c = C(game);
    for (const s of Object.values(c.scouts)) s.level = Math.max(0, s.level - 0.25);
  }

  // ---------- trials and offers ----------
  function trialChecks(game) {
    const c = C(game), p = me(game);
    if (c.stage === "pro" || p.age < 16) return;
    for (const s of Object.values(c.scouts)) {
      if (s.level < 60 || s.trialAsked || c.trials.length >= 6) continue;
      if (c.trials.some(t => t.club === s.club)) continue;
      s.trialAsked = true;
      const t = { id: "t" + (c.trials.length + 1) + "_" + game.season + "_" + game.round, club: s.club, week: Math.min(37, game.round + 2 + Math.floor(rnd() * 3)), season: game.season, status: "invited" };
      c.trials.push(t);
      c.decisions.push({ id: "trial_" + t.id, kind: "trial", trial: t.id, title: s.club + " invite you to a trial", options: ["go", "decline"] });
      msg(game, "scout_" + s.club, s.club + " scouting", "We have watched you a few times. We would like you at a trial in week " + (t.week + 1) + ". Bring boots, we will do the rest.");
    }
  }
  function runTrials(game) {
    const c = C(game), p = me(game);
    for (const t of c.trials) {
      if (t.status !== "booked" || t.season !== game.season || t.week !== game.round) continue;
      const level = clubLevel(game, t.club);
      const bar = level - 10 - Math.max(0, 19 - p.age) * 1.5;
      const fresh = c.cond.fatigue > 65 ? -3 : 0;
      const score = p.rating + gauss() * 3 + fresh + (c.traits.confidence - 50) * 0.04 + (c.cond.inj ? -20 : 0);
      t.score = round1(score); t.bar = round1(bar);
      t.status = score >= bar ? "passed" : "failed";
      if (t.status === "passed") {
        news(game, p.name + " impresses on trial at " + t.club + ".", "scout");
        // a pro contract waits until he is 17; until then the club makes him a promise
        if (p.age >= 17) makeOffer(game, t.club, "trial");
        else {
          const sc = c.scouts[t.club]; if (sc) sc.promise = true;
          msg(game, "scout_" + t.club, t.club + " scouting", "You were excellent. We want you as soon as you turn 17. Keep going and stay fit.");
        }
      } else {
        msg(game, "scout_" + t.club, t.club + " scouting", "Thanks for coming. Not this time, but we will keep watching. Keep working.");
      }
    }
  }
  // a fair weekly wage in pounds for a rating in a league: the Indian league pays a fraction of Europe, the
  // top leagues climb steeply for stars, and a first deal for a teenager comes in lower
  function weeklyWage(league, rating, age) {
    const isl = league === D.ISL_NAME;
    const mult = isl ? 0 : ((LEAGUES[league] || {}).budgetMult || 1.2);
    let w = isl ? 600 * Math.exp(0.1 * (rating - 65)) : 6000 * Math.exp(0.15 * (rating - 70)) * Math.pow(mult / 3, 1.2);
    if (age <= 19) w *= isl ? 0.7 : 0.6;
    return Math.max(isl ? 150 : 400, w);
  }
  const weekIndex = game => game.season * 40 + game.round;
  function makeOffer(game, club, why) {
    const c = C(game), p = me(game);
    if (c.offers.some(o => o.club === club && o.status === "open")) return null;
    const cl = game.clubs[club];
    const level = clubLevel(game, club);
    const isl = cl && cl.league === D.ISL_NAME;
    const gap = p.rating - (level - 6);
    const role = gap >= 2 ? "First team" : gap >= -5 ? "Rotation" : "Prospect";
    const roleF = { Prospect: 0.8, Rotation: 1, "First team": 1.3 }[role];
    const wage = Math.round(weeklyWage(cl ? cl.league : "", p.rating, p.age) * roleF / 10) * 10;
    const years = role === "Prospect" ? 3 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 3);
    const grp = D.POS_GROUP[c.person.pos];
    const o = {
      id: "o" + game.season + "_" + game.round + "_" + Object.keys(c.offers).length, club, league: cl ? cl.league : "", status: "open", why,
      wage, years, role, signing: Math.round(wage * (2 + rnd() * 4) / 10) * 10,
      bonus: { app: Math.round(wage * 0.15 / 10) * 10, goal: Math.round(wage * (grp === "FW" ? 0.5 : 0.35) / 10) * 10, assist: Math.round(wage * 0.25 / 10) * 10, cs: grp === "DF" || grp === "GK" ? Math.round(wage * 0.4 / 10) * 10 : 0 },
      release: isl || (cl && /La Liga/.test(cl.league)) ? Math.round(Math.max(0.5, marketValue(Math.max(63, p.rating + 6), p.age, p.pos)) * 10) / 10 : null,
      expires: weekIndex(game) + 4, negotiated: 0, first: !c.contract
    };
    c.offers.push(o);
    msg(game, "offers", "Contract offers", club + " have offered you a " + years + " year deal as a " + role.toLowerCase() + " player.", { offer: o.id });
    return o;
  }
  // the agent pushes for more: better agents get more, push too hard and the club walks away
  function negotiate(game, offerId) {
    const c = C(game);
    const o = c.offers.find(x => x.id === offerId && x.status === "open");
    if (!o) return { error: "That offer is not open." };
    if (o.negotiated >= 2) return { error: "The club says this is their final offer." };
    const a = c.agent ? D.AGENTS.find(x => x.id === c.agent.id) : null;
    const skill = a ? a.negotiate : 3;
    o.negotiated++;
    const walk = 0.04 + o.negotiated * 0.06 - skill * 0.008;
    if (rnd() < walk) { o.status = "withdrawn"; msg(game, "offers", "Contract offers", o.club + " were not happy with the counter and pulled the offer."); return { ok: true, withdrawn: true }; }
    const up = 1 + (0.05 + skill * 0.018) * (0.7 + rnd() * 0.6);
    o.wage = Math.round(o.wage * up / 10) * 10;
    o.signing = Math.round(o.signing * (1 + (up - 1) * 1.5) / 10) * 10;
    for (const k of Object.keys(o.bonus)) o.bonus[k] = Math.round(o.bonus[k] * up / 10) * 10;
    msg(game, "agent", a ? a.name : "You", "Got " + o.club + " up to " + o.wage + " a week. " + (o.negotiated >= 2 ? "That is as far as they go." : "I can push once more if you want."));
    return { ok: true, offer: o };
  }
  function sign(game, offerId) {
    const c = C(game), p = me(game);
    const o = c.offers.find(x => x.id === offerId && x.status === "open");
    if (!o) return { error: "That offer is not open." };
    if (o.kind && o.kind !== "first") {
      const r = PRO.signOffer(game, o);
      if (r.error) return r;
      o.status = "signed";
      for (const x of c.offers) if (x !== o && x.status === "open") x.status = "declined";
      c.freeAgent = false;
      return { ok: true, club: o.club };
    }
    const cl = game.clubs[o.club];
    if (!cl) return { error: "That club does not exist any more." };
    // leaving a club: off its squad first
    if (p.club && game.clubs[p.club]) {
      const old = game.clubs[p.club];
      old.squad = old.squad.filter(id => id !== p.id);
      if (old.lineup && old.lineup.xi) old.lineup = null;
    }
    const first = !c.contract;
    o.status = "signed";
    for (const x of c.offers) if (x !== o && x.status === "open") x.status = "declined";
    cl.squad.push(p.id);
    p.club = o.club; p.league = cl.league;
    p.wage = Math.max(0.1, round1(o.wage * 52 / 1e6));
    p.contractYears = o.years; p.squadRole = o.role;
    c.contract = { club: o.club, wage: o.wage, years: o.years, role: o.role, bonus: o.bonus, release: o.release, since: { s: game.season, w: game.round }, until: game.season + o.years };
    c.stage = "pro";
    c.trust = o.role === "First team" ? 58 : o.role === "Rotation" ? 50 : 42;
    c.city = cityOf(game, o.club);
    if (o.signing) money(game, o.signing, "Signing bonus, " + o.club);
    c.rep.club = 10;
    c.rep.national = Math.max(c.rep.national, cl.league === D.ISL_NAME ? 12 : 18);
    if (first) {
      c.moments.firstContract = { s: game.season, w: game.round, club: o.club, wage: o.wage, years: o.years, role: o.role, seen: false };
      news(game, p.name + " signs his first professional contract with " + o.club + ".", "transfer");
      msg(game, "dad", "Dad", "A professional footballer. My son. I do not have words. Call me tonight.");
      msg(game, "mum", "Mum", "I cried in the kitchen 😭 Proud of you. Remember where you came from.");
    } else news(game, p.name + " joins " + o.club + ".", "transfer");
    msg(game, "club", o.club, "Welcome to " + o.club + ". Report to the training ground on Monday at nine.");
    return { ok: true, club: o.club };
  }
  function offerExpiry(game) {
    const c = C(game);
    for (const o of c.offers) if (o.status === "open" && weekIndex(game) > o.expires) { o.status = "expired"; msg(game, "offers", "Contract offers", o.club + "'s offer ran out."); }
  }
  // agents come calling once scouts do
  function agentApproach(game) {
    const c = C(game);
    if (c.agent || c.agentOffers.length || c.decisions.some(d => d.kind === "agent")) return;
    const best = Math.max(0, ...Object.values(c.scouts).map(s => s.level));
    if (best < 30) return;
    const pool = D.AGENTS.filter(a => a.id !== "sh" || me(game).rating >= 64);
    const three = pool.sort(() => rnd() - 0.5).slice(0, 3);
    c.agentOffers = three.map(a => a.id);
    c.decisions.push({ id: "agent_" + game.season + "_" + game.round, kind: "agent", title: "Agents want to represent you", options: three.map(a => a.id).concat(["none"]), optional: true });
    for (const a of three) msg(game, "agent_" + a.id, a.name, "Hello! I am " + a.name + " from " + a.agency + ". I have been following your games. Let us talk.");
  }

  // ---------- the pro: picked or not, and how he played ----------
  // the manager's call this week, worked out without touching the team sheet: injured, start or the bench
  function proPick(game) {
    const c = C(game), p = me(game);
    const club = game.clubs[p.club];
    if (c.cond.inj || p.inj > 0) return { sel: "injured", group: [] };
    // the manager trusts some players more than others: form, trust and fitness move the line
    const group = club.squad.map(id => game.players[id]).filter(q => q && q.pos === p.pos && !(q.inj > 0) && !(q.ban > 0));
    group.sort((a, b) => b.rating - a.rating);
    const needed = { GK: 1, DF: 4, MF: 3, FW: 3 }[p.pos];
    const rank = group.findIndex(q => q.id === p.id);
    const cut = group[Math.min(group.length - 1, needed)] ? group[Math.min(group.length - 1, needed)].rating : 0;
    const edge = p.rating - cut + (c.trust - 50) * 0.12 + (c.cond.form - 6.5) * 1.5 - (c.cond.fatigue > 75 ? 3 : 0);
    return { sel: rank >= 0 && (rank < needed ? edge > -4 : edge > 1.5) ? "start" : "bench", group };
  }
  function pickForWeek(game) {
    const c = C(game), p = me(game);
    if (c.stage !== "pro" || !p.club) return null;
    const club = game.clubs[p.club];
    if (!club) return null;
    club.lineup = null;
    const pk = proPick(game);
    if (pk.sel === "injured") return "injured";
    const group = pk.group, start = pk.sel === "start";
    const xi = bestXI(game, p.club);
    const inXI = xi.some(q => q.id === p.id);
    let ids = xi.map(q => q.id);
    if (start && !inXI) {
      const same = xi.filter(q => q.pos === p.pos && q.id !== p.id).sort((a, b) => a.rating - b.rating)[0] || xi.filter(q => q.pos !== "GK").sort((a, b) => a.rating - b.rating)[0];
      ids = ids.map(id => id === same.id ? p.id : id);
    } else if (!start && inXI) {
      const outside = group.filter(q => !ids.includes(q.id) && q.id !== p.id)[0] || club.squad.map(id => game.players[id]).filter(q => q && q.pos !== "GK" && !ids.includes(q.id) && !(q.inj > 0) && !(q.ban > 0)).sort((a, b) => b.rating - a.rating)[0];
      if (outside) ids = ids.map(id => id === p.id ? outside.id : id);
    }
    club.lineup = { xi: ids, pc: true };
    return start ? "start" : "bench";
  }
  // ---------- player lock: this week's league match, played live ----------
  // what the manager asks of him, by where he plays
  function instructionFor(c) {
    const pos = c.person.pos, g = D.POS_GROUP[pos];
    // who gives it: the manager at a club, the coach at school, college or an academy
    const by = c.stage === "pro" ? "Manager" : "Coach";
    if (pos === "LW" || pos === "RW") return { kind: "runs", n: 4, by, text: "Get in behind their full back. Four runs at least." };
    if (g === "FW") return { kind: "shots", n: 3, by, text: "Live in their box. Get three shots away." };
    if (g === "MF") return { kind: "passes", n: 15, by, text: "Keep the ball moving. Fifteen good passes." };
    return { kind: "tackles", n: 3, by, text: "Win your battles. Three tackles won." };
  }
  // the pro's league fixture this week, while it is still to be played
  function proFixtureNow(game) {
    const p = me(game);
    const round = ((game.leagueFixtures || {})[p.league] || [])[game.round] || [];
    const m = round.find(x => x.home === p.club || x.away === p.club);
    return m && (m.hg === null || m.hg === undefined) ? m : null;
  }
  // can he play this week's match himself (player lock), and if not, why not, in plain words. It changes
  // nothing, so the hub asks it every time it draws the week; a kick off asks it again before anything moves.
  function liveStatus(game) {
    const c = C(game), p = me(game);
    const kind = c.stage === "pro" ? "pro" : "youth";
    const no = (code, why, extra) => Object.assign({ can: false, code, kind, why }, extra || {});
    if (c.retired) return no("retired", "This career is over.");
    if (game.round >= (game.totalRounds || 38)) return no("season", "The season is over.");
    if (kind === "pro" ? !(p.club && game.clubs[p.club] && proFixtureNow(game)) : !youthFixture(game)) return no("nomatch", "No match for you this week.");
    // a keeper is the one place the lock cannot go yet: the 3D keeper is the engine's own (saves, dives, kicks)
    if (c.person.pos === "GK") return no("keeper", "Keepers cannot be played live yet. Sim the match: your rating still comes from how you play.");
    if (c.cond.inj || p.inj > 0) return no("injured", "You are injured this week.");
    const d = blockers(game)[0];
    if (d) return no("decision", "Make your choice first: " + d.title + ".", { decision: d });
    const ev = PEOPLE.blocker(game);
    if (ev) return no("event", "Something needs your answer first: " + ev.title + ".", { event: ev });
    if (c.live && c.live.s === game.season && c.live.round === game.round) return no("played", "You already kicked off this week's match. Sim it now and the sim decides it.");
    const sel = kind === "pro" ? proPick(game).sel : youthRole(game);
    if (sel === "injured") return no("injured", "You are injured this week.");
    if (sel === "bench") return no("bench", "The manager has you on the bench this week. Sim the match, and be ready if he calls.", { bench: true });
    if (sel === "sub") return no("bench", "The coach has you on the bench this week. Sim the match, and be ready if he calls.", { bench: true });
    if (sel === "out") return no("out", "The coach has left you out this week. Train well and win your place back.", { bench: true });
    return { can: true, code: "ok", kind, why: "" };
  }
  function liveCheck(game) {
    const c = C(game), p = me(game);
    const st = liveStatus(game);
    if (!st.can) {
      const e = { error: st.why, code: st.code };
      if (st.decision) e.decision = st.decision;
      if (st.event) e.event = st.event;
      if (st.code === "season") e.seasonOver = true;
      if (st.bench) e.bench = true;
      return e;
    }
    if (st.kind === "youth") return youthLiveStart(game);
    const m = proFixtureNow(game);
    const pick = pickForWeek(game);
    if (pick !== "start") {
      game.clubs[p.club].lineup = null;
      return { error: pick === "injured" ? "You are injured this week." : "The manager has you on the bench this week. Sim the match, and be ready if he calls.", code: pick === "injured" ? "injured" : "bench", bench: true };
    }
    c.live = { kind: "pro", s: game.season, round: game.round, home: m.home, away: m.away, status: "started", instruction: instructionFor(c), xi: game.clubs[p.club].lineup.xi.slice() };
    return { ok: true, kind: "pro", home: m.home, away: m.away, side: m.home === p.club ? "home" : "away", club: p.club, opp: m.home === p.club ? m.away : m.home, instruction: c.live.instruction };
  }

  // ---------- player lock in the youth years: the school, college, academy or centre match, played live ----------
  // both sides are made up for the day: names that fit the country, ages that fit the level, a normal 4-3-3,
  // ratings around the team strength the youth sim uses. His own row carries pc and his look, as in the pros.
  const YOUTH_NAMES = {
    en: [["Jack", "Harry", "Oliver", "Charlie", "George", "Alfie", "Leo", "Freddie", "Archie", "Theo", "Mason", "Ethan", "Noah", "Lewis", "Callum", "Kyle", "Ryan", "Jamie", "Liam", "Connor"], ["Smith", "Jones", "Taylor", "Brown", "Wilson", "Evans", "Walker", "Wright", "Hughes", "Clarke", "Hall", "Turner", "Cooper", "Ward", "Morris", "Bennett", "Shaw", "Murray", "Reid", "Campbell"]],
    es: [["Pablo", "Alejandro", "Hugo", "Mateo", "Diego", "Javier", "Sergio", "Marcos", "Adrian", "Daniel", "Lucas", "Iker", "Alvaro", "Nicolas", "Santiago", "Thiago", "Bruno", "Gonzalo", "Joaquin", "Tomas"], ["Garcia", "Martinez", "Lopez", "Sanchez", "Perez", "Gomez", "Fernandez", "Ruiz", "Diaz", "Moreno", "Romero", "Torres", "Navarro", "Castro", "Ortiz", "Rubio", "Molina", "Herrera", "Suarez", "Vega"]],
    pt: [["Joao", "Pedro", "Tiago", "Rafael", "Gabriel", "Lucas", "Mateus", "Diogo", "Rodrigo", "Vitor", "Bruno", "Gustavo", "Andre", "Thiago", "Caio", "Felipe", "Leonardo", "Miguel", "Henrique", "Davi"], ["Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Ferreira", "Almeida", "Carvalho", "Gomes", "Martins", "Rocha", "Ribeiro", "Alves", "Lima", "Barbosa", "Cardoso", "Mendes", "Nunes", "Teixeira"]],
    it: [["Lorenzo", "Matteo", "Leonardo", "Francesco", "Alessandro", "Andrea", "Gabriele", "Riccardo", "Tommaso", "Edoardo", "Davide", "Federico", "Marco", "Luca", "Simone", "Giovanni", "Pietro", "Filippo", "Nicolo", "Samuele"], ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa", "Giordano", "Mancini", "Rizzo", "Lombardi", "Moretti"]],
    de: [["Lukas", "Leon", "Finn", "Jonas", "Paul", "Felix", "Elias", "Noah", "Ben", "Luis", "Maximilian", "Jan", "Tim", "Niklas", "Moritz", "Julian", "Tobias", "David", "Florian", "Kai"], ["Muller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Zimmermann", "Braun", "Kruger", "Hartmann"]],
    fr: [["Lucas", "Hugo", "Louis", "Theo", "Nathan", "Enzo", "Mathis", "Jules", "Tom", "Raphael", "Arthur", "Noah", "Leo", "Adam", "Ethan", "Maxime", "Bastien", "Yanis", "Kylian", "Ibrahim"], ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Fournier", "David", "Bertrand", "Roux", "Vincent", "Girard"]],
    nl: [["Daan", "Sem", "Lucas", "Milan", "Levi", "Luuk", "Bram", "Thijs", "Jesse", "Ruben", "Stijn", "Jens", "Niels", "Tim", "Sven", "Bas", "Joris", "Teun", "Rick", "Wout"], ["de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "de Groot", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer", "de Wit"]],
    tr: [["Emir", "Yusuf", "Mehmet", "Ahmet", "Mustafa", "Ali", "Omer", "Burak", "Emre", "Kerem", "Arda", "Efe", "Can", "Baris", "Hakan", "Cenk", "Kaan", "Oguz", "Serkan", "Umut"], ["Yilmaz", "Kaya", "Demir", "Sahin", "Celik", "Yildiz", "Yildirim", "Ozturk", "Aydin", "Ozdemir", "Arslan", "Dogan", "Kilic", "Aslan", "Cetin", "Kara", "Koc", "Kurt", "Ozkan", "Simsek"]],
    ar: [["Mohammed", "Abdullah", "Fahad", "Faisal", "Khalid", "Saud", "Nasser", "Salem", "Omar", "Yasser", "Hamza", "Youssef", "Ayoub", "Achraf", "Hakim", "Sofiane", "Bilal", "Anas", "Karim", "Ilyas"], ["Al Dosari", "Al Shehri", "Al Ghamdi", "Al Qahtani", "Al Harbi", "Al Otaibi", "Al Zahrani", "Al Malki", "Bennani", "El Idrissi", "Alaoui", "Tazi", "Benali", "Amrani", "Saidi", "Haddad", "Mansour", "Nasri", "Belkadi", "Ziani"]],
    wa: [["Chukwuemeka", "Tunde", "Emeka", "Samuel", "Victor", "Ahmed", "Kelechi", "Ademola", "Olamide", "Chidi", "Kwame", "Kofi", "Yaw", "Kwabena", "Ibrahim", "Musa", "Daniel", "Joseph", "Emmanuel", "Godfrey"], ["Okafor", "Adeyemi", "Okonkwo", "Balogun", "Eze", "Nwosu", "Abubakar", "Ogunleye", "Obi", "Mensah", "Asante", "Boateng", "Owusu", "Appiah", "Osei", "Agyeman", "Danjuma", "Lawal", "Bello", "Iheanacho"]],
    jp: [["Haruto", "Sota", "Yuto", "Ren", "Riku", "Kaito", "Daiki", "Takumi", "Kenta", "Shota", "Ritsu", "Hiroki", "Yuma", "Kota", "Sho", "Taiga", "Kaoru", "Takefusa", "Ao", "Wataru"], ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Yamada", "Sasaki", "Matsumoto", "Inoue", "Kimura", "Hayashi", "Shimizu", "Mori", "Endo"]],
    kr: [["Min-jun", "Seo-jun", "Do-yun", "Ji-ho", "Joon-young", "Hyun-woo", "Sung-min", "Jae-won", "Dong-hyun", "Woo-jin", "Tae-yang", "Kang-in", "Heung-min", "Gue-sung", "Jin-su", "Seung-ho", "Young-woo", "Min-jae", "Chan-woo", "Hee-chan"], ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim", "Han", "Oh", "Seo", "Shin", "Kwon", "Hwang", "Ahn", "Song", "Hong", "Jeon"]]
  };
  const NAME_GROUP = { England: "en", Scotland: "en", USA: "en", Canada: "en", Australia: "en", Spain: "es", Mexico: "es", Argentina: "es", Uruguay: "es", Colombia: "es", Portugal: "pt", Brazil: "pt", Italy: "it", Germany: "de", France: "fr", Belgium: "nl", Netherlands: "nl", Turkey: "tr", "Saudi Arabia": "ar", Morocco: "ar", Nigeria: "wa", Ghana: "wa", Japan: "jp", "South Korea": "kr" };
  const SHAPE = [["GK", "GK", 1], ["DF", "LB", 3], ["DF", "CB", 5], ["DF", "CB", 4], ["DF", "RB", 2], ["MF", "CDM", 6], ["MF", "CM", 8], ["MF", "CAM", 10], ["FW", "LW", 11], ["FW", "ST", 9], ["FW", "RW", 7]];
  // one youth side: eleven rows the 3D match reads; withMe puts him in the slot of his own position
  // the made up sides are the same however often they are asked for in a week (the match screen shows them
  // before kick off, the kick off then plays them): every roll comes from a generator seeded by the week
  function weekRng(game, salt) {
    let a = Math.floor(weekRoll(game, salt) * 4294967296) >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function youthXI(game, str, withMe, R) {
    const c = C(game), p = me(game);
    const grp = NAME_GROUP[c.person.country];
    const [firsts, lasts] = grp ? YOUTH_NAMES[grp] : [D.IN_FIRST, D.IN_LAST];
    const used = new Set([p.name]);
    const lo = c.stage === "college" ? Math.max(17, p.age - 1) : Math.max(13, p.age - 1), hi = c.stage === "college" ? p.age + 2 : Math.min(19, p.age + 1);
    const gaussR = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    // first names and surnames are dealt from a shuffled pile, so a side rarely has two of the same
    const deal = a => { const d = a.map(x => [R(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]); let i = 0; return () => d[i++ % d.length]; };
    const nextFirst = deal(firsts), nextLast = deal(lasts);
    const rows = SHAPE.map(([pos, role, num]) => {
      let n = "";
      for (let k = 0; k < 20 && (!n || used.has(n)); k++) n = nextFirst() + " " + nextLast();
      used.add(n);
      const r = Math.round(clamp(str + gaussR() * 3, 30, 90));
      return { n, pos, role, r, base: r, num, age: lo + Math.floor(R() * (hi - lo + 1)) };
    });
    if (withMe) {
      const role = D.POS_ROLE[c.person.pos] || "CM";
      const i = Math.max(0, rows.findIndex(x => x.role === role));
      const look = Object.assign({}, c.look, { h: (c.person.height || 178) / 100, mass: c.person.weight || 72 });
      rows[i] = { n: p.name, pos: D.POS_GROUP[c.person.pos], role, r: p.rating, base: p.rating, num: c.person.num || rows[i].num, age: p.age, pc: true, look };
      // his shirt number is his: nobody else wears it
      for (const x of rows) if (x !== rows[i] && x.num === rows[i].num) x.num = 0;
    }
    return rows;
  }
  // this week's youth match for the 3D engine: both sides, the ratings, his lock. Nothing is changed here.
  function youthSetup(game) {
    const c = C(game), p = me(game);
    const fx = youthFixture(game), set = fx.set;
    const R = weekRng(game, "xi");
    const teamStr = 36 + set.comp * 2.4;
    const z = Math.sqrt(-2 * Math.log(Math.max(1e-9, R()))) * Math.cos(2 * Math.PI * R());
    const oppStr = teamStr + z * 4 + (fx.national ? 4 : 0);
    const homeSide = weekRoll(game, "home") < 0.5;
    const mine = youthXI(game, teamStr, true, R), theirs = youthXI(game, oppStr, false, R);
    const home = homeSide ? set.team : fx.opp, away = homeSide ? fx.opp : set.team;
    const avg = xi => Math.round(xi.reduce((s2, x) => s2 + x.r, 0) / xi.length * 10) / 10;
    const ins = instructionFor(c);
    const meRow = mine.find(x => x.pc);
    return {
      fx, oppStr, side: homeSide ? "home" : "away",
      setup: {
        kind: "youth", label: fx.comp + ", week " + (game.round + 1), home, away, side: homeSide ? "home" : "away",
        // where it is played: his own ground at home, the other side's away (campus.js)
        venue: K.campus ? K.campus.venueFor(game, home, away) : null,
        homeRating: avg(homeSide ? mine : theirs), awayRating: avg(homeSide ? theirs : mine),
        homeXI: homeSide ? mine : theirs, awayXI: homeSide ? theirs : mine, instruction: ins,
        lock: { name: p.name, num: meRow.num, pos: c.person.pos, instruction: ins.text, by: ins.by }
      }
    };
  }
  function youthLiveStart(game) {
    const c = C(game);
    const Y = youthSetup(game), S = Y.setup, fx = Y.fx;
    c.live = { kind: "youth", s: game.season, round: game.round, home: S.home, away: S.away, side: Y.side, team: fx.set.team, comp: fx.comp, opp: fx.opp, national: !!fx.national, oppStr: round1(Y.oppStr), status: "started", instruction: S.instruction };
    return { ok: true, kind: "youth", home: S.home, away: S.away, side: Y.side, club: fx.set.team, opp: fx.opp, instruction: S.instruction, setup: S };
  }
  // the match screen before kick off: who plays whom, the strengths and his lock, without using up the week's
  // one go. Only the kick off (liveCheck) starts the match for real.
  function livePeek(game) {
    const c = C(game), p = me(game);
    const st = liveStatus(game);
    if (!st.can) return liveCheck(game);
    if (st.kind === "youth") { const Y = youthSetup(game); return { ok: true, kind: "youth", peek: true, setup: Object.assign({}, Y.setup, { homeXI: undefined, awayXI: undefined }) }; }
    const m = proFixtureNow(game);
    return { ok: true, kind: "pro", peek: true, home: m.home, away: m.away, side: m.home === p.club ? "home" : "away", club: p.club, opp: m.home === p.club ? m.away : m.home, instruction: instructionFor(c) };
  }
  // the youth match he played: the live score and his line from the pitch, recorded the way the sim records one
  function youthLiveMatch(game, fx, L) {
    const c = C(game);
    const gf = L.side === "away" ? L.ag : L.hg, ga = L.side === "away" ? L.hg : L.ag;
    const grp = D.POS_GROUP[c.person.pos];
    const out = { comp: L.comp || fx.comp, opp: L.opp || fx.opp, team: L.team || fx.set.team, gf, ga, res: resOf(gf, ga), wk: game.round + 1, role: "start", mins: 90, national: !!L.national, home: L.side !== "away", live: true, g: L.line.g, a: L.line.a, cs: ga === 0 && (grp === "DF" || grp === "GK"), rating: L.line.rating };
    recordMatch(game, out);
    teamChat(game, out);
    PEOPLE.afterMatch(game, out);
    SOCIAL.afterMatch(game, out);
    scoutWatch(game, out, fx.set.exposure * (out.national ? 2 : 1));
    c.cond.fatigue = clamp(c.cond.fatigue + out.mins * 0.16, 0, 100);
    // the coach asked for something: doing it wins him over
    if (L.line.instruction === true) { c.coachRel = clamp(c.coachRel + 3, 0, 100); msg(game, "coach", "Coach", "That is exactly what I asked for. Keep doing it."); }
    else if (L.line.instruction === false) c.coachRel = clamp(c.coachRel - 1, 0, 100);
    return out;
  }
  // the score and his line from the live match; the week is then played around it
  function liveResult(game, hg, ag, line) {
    const c = C(game);
    const L = c.live;
    if (!L || L.status !== "started" || L.s !== game.season || L.round !== game.round) return { error: "Kick off the match first." };
    const youth = L.kind === "youth";
    if (youth ? c.stage === "pro" : c.stage !== "pro") return { error: "Your football changed since kick off. Sim the week instead." };
    const ok = n => Number.isInteger(n) && n >= 0 && n <= 12;
    if (!ok(hg) || !ok(ag)) return { error: "That score does not look right." };
    const num = (v, lo, hi) => (Number.isFinite(Number(v)) ? clamp(Number(v), lo, hi) : lo);
    line = line || {};
    // the rating is the one the match worked out from what he did; a missing one is an ordinary 6
    const rating = typeof line.rating === "number" && Number.isFinite(line.rating) ? clamp(line.rating, 3, 10) : 6;
    L.line = { mins: 90, g: Math.round(num(line.g, 0, 12)), a: Math.round(num(line.a, 0, 12)), rating: round1(rating), shots: Math.round(num(line.shots, 0, 60)), passes: Math.round(num(line.passes, 0, 200)), passOk: Math.round(num(line.passOk, 0, 200)), won: Math.round(num(line.won, 0, 80)), instruction: line.instruction === true ? true : line.instruction === false ? false : null };
    const mine = youth ? (L.side === "away" ? ag : hg) : L.home === me(game).club ? hg : ag;
    L.line.g = Math.min(L.line.g, mine);
    L.line.a = Math.min(L.line.a, Math.max(0, mine - L.line.g));
    L.hg = hg; L.ag = ag; L.status = "done";
    if (!youth) {
      game.plays = game.plays || {};
      game.plays.__pc = { user: "player", season: game.season, round: game.round, kind: "league", home: L.home, away: L.away, status: "done", hg, ag, t: Date.now() };
    }
    const out = advanceWeek(game);
    if (out.error) { L.status = "started"; if (game.plays) delete game.plays.__pc; return out; }
    return out;
  }
  function proMatchResult(game, pick0, before) {
    const c = C(game), p = me(game);
    if (c.stage !== "pro" || !p.club) return null;
    const fixtures = (game.leagueFixtures || {})[p.league] || [];
    const round = fixtures[game.round - 1] || [];
    const m = round.find(x => x.home === p.club || x.away === p.club);
    const club = game.clubs[p.club];
    if (club && club.lineup && club.lineup.pc) club.lineup = null;
    if (!m || m.hg === null || m.hg === undefined) return null;
    const home = m.home === p.club;
    const gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg;
    const ap = p.ap || [0, 0, 0], bap = before.ap || [0, 0, 0];
    const mins = Math.max(0, (ap[2] || 0) - (bap[2] || 0));
    const started = (ap[0] || 0) > (bap[0] || 0);
    const role = mins === 0 ? (pick0 === "injured" ? "injured" : "unused") : started ? "start" : "sub";
    const st = (game.stats || {})[p.id] || { g: 0, a: 0 };
    const out = { comp: p.league, opp: home ? m.away : m.home, team: p.club, home, gf, ga, res: resOf(gf, ga), wk: game.round, role, mins, pro: true };
    const live = c.live && c.live.status === "done" && (c.live.kind || "pro") === "pro" && c.live.s === game.season && c.live.round === game.round - 1 ? c.live : null;
    if (live) {
      // he played it himself: his minutes, goals, assists and rating are the ones from the pitch, and the
      // world's scoring records are put in line with them
      const simG = Math.max(0, st.g - (before.g || 0)), simA = Math.max(0, st.a - (before.a || 0));
      if (game.stats && game.stats[p.id]) { game.stats[p.id].g = Math.max(0, game.stats[p.id].g + live.line.g - simG); game.stats[p.id].a = Math.max(0, game.stats[p.id].a + live.line.a - simA); }
      const line = playerLine(game, gf, ga, 1, clubLevel(game, p.club));
      Object.assign(out, line, { role: "start", mins: 90, g: live.line.g, a: live.line.a, rating: live.line.rating, live: true });
      bonuses(game, out);
      if (live.line.instruction === true) { c.trust = clamp(c.trust + 3, 0, 100); msg(game, "club", p.club + " manager", "That is exactly what I asked for. Keep doing it."); }
      else if (live.line.instruction === false) c.trust = clamp(c.trust - 1, 0, 100);
    } else if (mins > 0) {
      const line = playerLine(game, gf, ga, mins / 90, clubLevel(game, p.club));
      // the world sim decided who scored; his own goals and assists come from it
      line.g = Math.max(0, st.g - (before.g || 0)); line.a = Math.max(0, st.a - (before.a || 0));
      line.rating = round1(clamp(line.rating + line.g * 0.35 + line.a * 0.2, 3.5, 10));
      Object.assign(out, line);
      bonuses(game, out);
    }
    recordMatch(game, out);
    teamChat(game, out);
    PEOPLE.afterMatch(game, out);
    SOCIAL.afterMatch(game, out);
    // trust: good games earn the manager's faith, bad ones and sulking on the bench cost it
    if (out.mins > 0) c.trust = clamp(c.trust + (out.rating - 6.6) * 3, 0, 100);
    else if (role === "unused") c.trust = clamp(c.trust - 0.3, 0, 100);
    if (out.mins > 0) {
      c.cond.fatigue = clamp(c.cond.fatigue + out.mins * 0.17, 0, 100);
      c.rep.club = clamp(c.rep.club + (out.rating - 6.4) * 1.5 + 0.3, 0, 100);
      c.rep.national = clamp(c.rep.national + (out.rating - 6.5) * 0.6 + (out.g || 0) * 0.5, 0, 100);
      const lg = LEAGUES[p.league] || {};
      if (lg.euro || lg.playable) c.rep.international = clamp(c.rep.international + (out.rating - 6.8) * 0.4 + (out.g || 0) * 0.3, 0, 100);
      if (!c.firsts.debut) { c.firsts.debut = { s: game.season, w: game.round, club: p.club, opp: out.opp }; c.moments.debut = { s: game.season, w: game.round, club: p.club, opp: out.opp, seen: false }; news(game, p.name + " makes his senior debut for " + p.club + " against " + out.opp + ".", "match"); }
      if ((out.g || 0) > 0 && !c.firsts.goal) { c.firsts.goal = { s: game.season, w: game.round, opp: out.opp }; c.moments.firstGoal = { s: game.season, w: game.round, club: p.club, opp: out.opp, seen: false }; news(game, "FIRST GOAL: " + p.name + " scores his first professional goal, against " + out.opp + ".", "match"); }
    }
    scoutWatch(game, Object.assign({}, out, { rating: out.rating || 6 }), 4 + c.rep.national / 15);
    return out;
  }
  function bonuses(game, m) {
    const c = C(game);
    if (!c.contract) return;
    const b = c.contract.bonus;
    let total = b.app + (m.g || 0) * b.goal + (m.a || 0) * b.assist + (m.cs ? b.cs : 0);
    if (total > 0) money(game, total, "Match bonuses, " + m.opp);
  }
  function payWages(game) {
    const c = C(game);
    if (c.contract) {
      money(game, c.contract.wage, "Wages, " + c.contract.club);
      const cut = agentCut(game);
      if (cut) money(game, -Math.round(c.contract.wage * cut), "Agent's cut");
    }
    else if (c.stage !== "pro") money(game, 25, "Pocket money from home");
    // the home, the car, food and bills are paid in the life layer (life.js)
  }

  // changing agents: let the current one go, or ask around for a new one
  function agentAction(game, action) {
    const c = C(game);
    if (action === "drop") {
      if (!c.agent) return { error: "You do not have an agent." };
      const a = D.AGENTS.find(x => x.id === c.agent.id);
      msg(game, "agent", a ? a.name : "Agent", "Understood. Good luck with everything.");
      news(game, me(game).name + " parts ways with his agent" + (a ? ", " + a.name : "") + ".", "life");
      c.agent = null;
      PEOPLE.P0(game).agent = 50;
      return { ok: true };
    }
    if (action === "find") {
      if (c.decisions.some(d => d.kind === "agent")) return { error: "The agents are already waiting for your answer." };
      const pool = D.AGENTS.filter(a => !c.agent || a.id !== c.agent.id).sort(() => rnd() - 0.5).slice(0, 3);
      c.agentOffers = pool.map(a => a.id);
      c.decisions.push({ id: "agent_" + game.season + "_" + game.round + "_f", kind: "agent", title: "Agents want to represent you", options: pool.map(a => a.id).concat(["none"]), optional: true });
      return { ok: true };
    }
    return { error: "Not something an agent does." };
  }
  // the agent's share of what he earns (a smaller cut can be agreed later)
  function agentCut(game) {
    const c = C(game);
    if (!c.agent) return 0;
    const a = D.AGENTS.find(x => x.id === c.agent.id);
    return c.agent.cut !== undefined ? c.agent.cut : a ? a.fee : 0;
  }
  // ---------- the week ----------
  function blockers(game) {
    const c = C(game);
    return c.decisions.filter(d => !d.optional);
  }
  function advanceWeek(game, opts) {
    const c = C(game), p = me(game);
    if (!c) return { error: "No career here." };
    if (c.retired) return { error: "This career is over." };
    if (blockers(game).length) return { error: "Make your choice first: " + blockers(game)[0].title + ".", decision: blockers(game)[0] };
    if (game.round >= (game.totalRounds || 38)) return { error: "The season is over. Start the next one.", seasonOver: true };
    const pendingEvent = PEOPLE.blocker(game);
    if (pendingEvent) return { error: "Something needs your answer first: " + pendingEvent.title + ".", event: pendingEvent };
    const report = { week: weekLabel(game), training: null, match: null, events: [] };
    const before = { ap: (p.ap || [0, 0, 0]).slice(), g: ((game.stats || {})[p.id] || {}).g || 0, a: ((game.stats || {})[p.id] || {}).a || 0 };
    // the youth coach picks his team before the week's training (the same sheet the hub showed)
    const sel0 = c.stage !== "pro" ? youthRole(game) : null;
    // 1. training
    report.training = train(game);
    // 2. his football this week
    let pick0 = null;
    // a match he played live keeps the team he started in; a live match he left is simmed like any other
    const liveDone = c.live && c.live.status === "done" && c.live.s === game.season && c.live.round === game.round;
    if (c.live && !liveDone) { c.live = null; if (game.plays) delete game.plays.__pc; }
    const liveKind = liveDone ? (c.live.kind || "pro") : null;
    if (c.stage === "pro") pick0 = liveKind === "pro" ? "start" : pickForWeek(game);
    const youth = c.stage !== "pro" ? youthFixture(game) : null;
    if (youth && liveKind === "youth") report.match = youthLiveMatch(game, youth, c.live);
    else if (youth && !c.cond.inj) report.match = youthMatch(game, youth, sel0);
    else if (youth && c.cond.inj) report.match = { comp: youth.comp, opp: youth.opp, team: youth.set.team, wk: game.round + 1, role: "injured", mins: 0 };
    runTrials(game);
    // 3. the world plays its week (the same code Manager Career runs)
    playMatchweek(game);
    if (c.stage === "pro") report.match = proMatchResult(game, pick0, before) || report.match;
    if (c.live) { c.live = null; if (game.plays) delete game.plays.__pc; }
    // the international window: a call up and a match for the country, at any age
    const intl = PRO.intlWindow(game);
    if (intl) report.intl = intl;
    if (c.stage === "pro") { PRO.transferWeek(game); PRO.loanCheck(game); if (game.round === 20) PRO.captaincyCheck(game); }
    // a free agent keeps hearing from clubs in the windows
    if (c.freeAgent && rnd() < 0.3) PRO.freeAgentOffers(game);
    // 4. life: money, condition, injuries heal, reputation settles
    payWages(game);
    LIFE.weekly(game);
    PEOPLE.weekly(game);
    SOCIAL.weekly(game);
    if (c.cond.inj) {
      c.cond.inj.weeks--;
      p.inj = Math.max(0, c.cond.inj.weeks);
      if (c.cond.inj.weeks <= 0) { news(game, p.name + " is back in full training.", "injury"); c.cond.inj = null; p.inj = 0; c.cond.fitness = 75; }
    }
    c.cond.fitness = clamp(c.cond.fitness + (c.cond.inj ? -2 : 3) - Math.max(0, c.cond.fatigue - 60) * 0.1, 30, 100);
    c.cond.morale = clamp(c.cond.morale + (c.cond.inj ? -1 : 0.2) + (c.cond.fatigue > 80 ? -1 : 0), 5, 99);
    scoutDecay(game);
    trialChecks(game);
    agentApproach(game);
    offerExpiry(game);
    LIFE.expire(game);
    if (c.stage !== "pro" && p.age >= 17) youthOffers(game);
    refreshRating(game);
    report.rating = p.rating;
    // the end of the week: next week's event (if any) is decided now and only teased
    PEOPLE.afterWeek(game, report);
    if (game.round >= (game.totalRounds || 38)) report.seasonOver = true;
    return { ok: true, report };
  }
  // late in the youth years, clubs that have watched long enough just make an offer
  function youthOffers(game) {
    const c = C(game);
    for (const s of Object.values(c.scouts)) {
      if (s.offered || !(s.promise || s.level >= 80)) continue;
      s.offered = true;
      makeOffer(game, s.club, "scouted");
    }
  }

  // ---------- the summer: the world rolls over, the career moves on a stage ----------
  function nextSeason(game) {
    const c = C(game), p = me(game);
    if (game.round < (game.totalRounds || 38)) return { error: "The season is not over yet." };
    if (blockers(game).length) return { error: "Make your choice first: " + blockers(game)[0].title + ".", decision: blockers(game)[0] };
    const summary = Object.assign({ season: game.season, club: p.club || (youthSetting(game) || {}).team || "", stage: c.stage, rating: p.rating, age: p.age }, c.stats.season);
    c.stats.seasons.push(summary);
    PRO.beforeRollover(game);
    endOfSeason(game);
    c.stats.season = blankStats();
    c.stageSeasons++;
    // the world aged him and nudged his rating by its own rule; his rating is his attributes, so put it back
    ageDecline(game);
    refreshRating(game);
    for (const s of Object.values(c.scouts)) { s.trialAsked = false; s.offered = s.offered && c.stage !== "pro" ? s.offered : false; }
    c.trials = c.trials.filter(t => t.status === "booked" && t.season === game.season);
    // contract years run down; the last year means talks (P2 renewals)
    if (c.contract) {
      c.contract.years = Math.max(0, c.contract.years - 1);
      p.contractYears = c.contract.years;
    }
    // stage moves: school to college, the end of the youth years
    if (c.stage === "school" && (c.stageSeasons >= 2 || p.age >= 17)) c.decisions.push({ id: "college_" + game.season, kind: "college", title: "Pick your football college", options: D.COLLEGES.map(x => x.id) });
    if ((c.stage === "college" || c.stage === "academy" || c.stage === "centre") && p.age >= 20 && c.stage !== "pro") lastChance(game);
    PRO.afterRollover(game);
    news(game, "Season " + seasonYear(game) + "-" + String(seasonYear(game) + 1).slice(2) + " begins.", "life");
    return { ok: true, summary };
  }
  // after 28 the body starts to slow: pace and power fade, the head keeps learning
  function ageDecline(game) {
    const c = C(game), p = me(game);
    if (p.age < 29) return;
    const k = (p.age - 28) * 0.7 * (1.2 - c.traits.professionalism / 250);
    for (const a of ["pace", "acceleration", "agility", "stamina", "jumping", "balance"]) c.attrs[a] = Math.max(20, c.attrs[a] - k * (0.6 + rnd() * 0.8));
    for (const a of ["composure", "decisions", "vision", "positioning", "leadership"]) c.attrs[a] = Math.min(99, c.attrs[a] + 0.4);
  }
  // nobody picked him up: a small club still gives him a chance
  function lastChance(game) {
    const c = C(game);
    if (c.offers.some(o => o.status === "open")) return;
    const home = D.COUNTRIES[c.person.country].league;
    const clubs = leagueClubs(game, home).sort((a, b) => clubLevel(game, a) - clubLevel(game, b));
    const club = clubs[Math.floor(rnd() * Math.min(4, clubs.length))];
    if (club) { makeOffer(game, club, "second chance"); msg(game, "dad", "Dad", "Not every road is straight. " + club + " want you. Go and prove them right."); }
  }

  // ---------- what the screens get ----------
  function view(game) {
    const c = C(game), p = me(game);
    if (!c) return null;
    const S = c.stats.season;
    const club = p.club ? game.clubs[p.club] : null;
    const youth = c.stage !== "pro" ? youthSetting(game) : null;
    const nextFx = c.stage !== "pro" ? youthFixtureAhead(game) : proFixtureAhead(game);
    return {
      mode: "player", week: weekLabel(game), season: game.season, round: game.round, total: game.totalRounds || 38, seasonOver: game.round >= (game.totalRounds || 38),
      person: c.person, look: c.look, stage: c.stage, path: c.path,
      player: { id: p.id, name: p.name, age: p.age, pos: c.person.pos, pos2: c.person.pos2, rating: p.rating, potential: potentialRange(game), value: p.value, club: p.club, league: p.league, role: c.contract ? c.contract.role : null, num: p.num },
      attrs: Object.fromEntries(Object.entries(c.attrs).map(([k, v]) => [k, Math.round(v)])), lastGains: c.training.lastGains,
      training: { slots: c.training.slots, intensity: c.training.intensity, sessions: D.SESSIONS, intensities: Object.keys(D.INTENSITY) },
      cond: c.cond, traits: c.traits, rep: c.rep, trust: Math.round(c.trust), coachRel: Math.round(c.coachRel),
      team: club ? club.name : youth ? youth.team : null, school: c.school, college: c.college, academy: c.academy, centre: c.centre,
      next: nextFx, play: liveView(game), decisions: c.decisions, trials: c.trials, offers: c.offers.filter(o => o.status === "open"),
      scouts: Object.values(c.scouts).filter(s => s.level >= 15).sort((a, b) => b.level - a.level).slice(0, 8).map(s => ({ club: s.club, level: Math.round(s.level) })),
      contract: c.contract, agent: c.agent ? D.AGENTS.find(a => a.id === c.agent.id) : null,
      money: { cash: c.money.cash, earned: c.money.earned || 0, log: c.money.log.slice(0, 12) },
      stats: { season: S, career: c.stats.career, seasons: c.stats.seasons, log: c.stats.log.slice(0, 10) },
      phone: { threads: Object.values(c.phone.threads).sort((a, b) => (b.last || 0) - (a.last || 0)), unread: Object.values(c.phone.threads).reduce((s, t) => s + t.msgs.filter(m => !m.read).length, 0) },
      news: c.news.slice(0, 20), moments: c.moments, city: c.city, life: LIFE.view(game), calendar: calendar(game), people: PEOPLE.view(game), social: SOCIAL.view(game),
      kit: p.club && deps.kitOf ? deps.kitOf(p.club) : null, natKit: deps.kitOf ? deps.kitOf(c.person.nat) : null,
      lastKit: c.retired && c.retired.lastClub && deps.kitOf ? deps.kitOf(c.retired.lastClub) : null,
      national: { level: c.national.level, caps: c.national.caps, goals: c.national.goals, log: (c.national.log || []).slice(0, 6), strength: Math.round(PRO.nationStrength(game)) },
      captain: c.captain === p.club && !!p.club, loan: c.loan || null, requested: !!c.requested, freeAgent: !!c.freeAgent,
      trophies: c.trophies || [], awards: c.awards || [], transfers: c.transfers || [],
      canRetire: p.age >= 32 && !c.retired, retired: c.retired || null, managerOptions: c.retired && game.mode === "player" ? PRO.managerOptions(game) : [],
      currency: D.COUNTRIES[c.person.country] ? (club && club.league !== D.ISL_NAME ? currencyOfLeague(club.league) : D.COUNTRIES[c.person.country].currency) : "GBP"
    };
  }
  // this week's match for the hub: can he play it live, and the reason in plain words when he cannot
  function liveView(game) {
    const s = liveStatus(game);
    return { can: s.can, code: s.code, kind: s.kind, why: s.why };
  }
  // the next weeks: his matches and the international windows
  function calendar(game) {
    const c = C(game), p = me(game);
    const out = [];
    const save = game.round;
    const total = game.totalRounds || 38;
    for (let r = game.round; r < Math.min(total, game.round + 8); r++) {
      let fx = null;
      if (c.stage === "pro") {
        const round = ((game.leagueFixtures || {})[p.league] || [])[r];
        const m = round && round.find(x => x.home === p.club || x.away === p.club);
        if (m) fx = { comp: p.league, opp: m.home === p.club ? m.away : m.home, home: m.home === p.club };
      } else {
        game.round = r;
        const y = youthFixture(game);
        game.round = save;
        if (y) fx = { comp: y.comp, opp: y.opp, national: !!y.national };
      }
      out.push({ week: r + 1, match: fx, intl: PRO.INTL_ROUNDS.includes(r) });
    }
    game.round = save;
    return out;
  }
  function currencyOfLeague(league) {
    const map = { "Premier League": "GBP", "Championship": "GBP", "Scottish Premiership": "GBP", "MLS": "USD", "Saudi Pro League": "SAR", "Liga MX": "MXN", "Brasileirao": "BRL", "Argentina": "ARS", "Super Lig": "TRY", [D.ISL_NAME]: "INR" };
    return map[league] || "EUR";
  }
  // coaches can only guess the ceiling, and they guess better as he gets older
  function potentialRange(game) {
    const c = C(game), p = me(game);
    const spread = Math.max(2, 12 - (p.age - 15) * 1.6);
    const mid = c.potential + (c.talentSeed || 0);
    return [Math.max(p.rating, Math.round(mid - spread / 2)), Math.min(99, Math.round(mid + spread / 2))];
  }
  function youthFixtureAhead(game) {
    const save = game.round;
    for (let r = game.round; r < Math.min(38, game.round + 6); r++) {
      game.round = r;
      const fx = youthFixture(game);
      if (fx) { game.round = save; return { week: r + 1, comp: fx.comp, opp: fx.opp, national: fx.national }; }
    }
    game.round = save;
    return null;
  }
  function proFixtureAhead(game) {
    const p = me(game);
    const fixtures = (game.leagueFixtures || {})[p.league] || [];
    const round = fixtures[game.round];
    if (!round) return null;
    const m = round.find(x => x.home === p.club || x.away === p.club);
    return m ? { week: game.round + 1, comp: p.league, opp: m.home === p.club ? m.away : m.home, home: m.home === p.club } : null;
  }
  function readThread(game, id) {
    const t = C(game).phone.threads[id];
    if (!t) return { error: "No such chat." };
    for (const m of t.msgs) m.read = true;
    return { ok: true };
  }

  const K = { C, me, msg, news, money, clubLevel, weeklyWage, recordMatch, playerLine, cityOf, trainOne, injure: (game, sev) => injure(game, sev), requestTransfer: game => PRO.requestTransfer(game), agentCut: game => agentCut(game) };
  const PRO = makePro(K, deps);
  const LIFE = makeLife(K);
  const PEOPLE = makePeople(K, deps);
  const CAMPUS = makeCampus(K, deps);
  const SOCIAL = makeSocial(K);
  K.people = PEOPLE;
  K.campus = CAMPUS;
  K.social = SOCIAL;
  K.life = LIFE;
  return { CAMPUS, SOCIAL, setupWorld, createPlayer, decide, setPlan, advanceWeek, nextSeason, negotiate, sign, view, readThread, collegeOptions, academyChoices, ovrFor, refreshRating, clubLevel, makeOffer, weeklyWage, D, PRO, LIFE, PEOPLE, agentCut, agentAction, liveCheck, liveResult, liveStatus, livePeek };
}

module.exports = { makeCore };
