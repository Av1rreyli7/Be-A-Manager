// Player Career: the schools, colleges and clubs as real places. Every one has its own grounds, worked out from
// its name (a seed) and its standing (school facilities and fees, college reputation and facilities, a club's
// strength): a school campus with classrooms, a corridor, a canteen and a plain pitch; a bigger, nicer college
// with a small stand; a club's training ground with pitches, a main building (gym, changing rooms, physio and
// recovery, canteen) and a car park; and, separately, its stadium. A city shows his own and a few more of its
// own institutions; every other one still has a ground for matches, so an away game is at the other side's.
// The daily life at his own grounds (classes, the canteen, the physio, the club gym, the dressing room) comes
// through act() here and uses the same free time, condition and relationship numbers as everything else.
const D = require("./data");
const L = require("./life_data");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hashOf = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
const r1 = v => Math.round(v * 10) / 10;

// how many more of a city's own schools, colleges and clubs show on its map besides his
const CAP = { school: 4, college: 2, club: 2 };
// where the university sides come from
const COLLEGE_RIVAL_CITY = {
  "Delhi University Sports XI": "Delhi", "Calcutta University": "Kolkata", "Goa University": "Goa", "University of Kerala": "Kochi",
  "Punjab University": "Chandigarh", "Manipur University": "Imphal", "Mizoram University": "Aizawl", "Christ University": "Bengaluru",
  "Jamia Millia Islamia": "Delhi", "Kalinga Institute": "Bhubaneswar", "Savitribai Phule Pune University": "Pune"
};
// the real names of the big clubs' training grounds
const GROUNDS = {
  "Man United": "Carrington", "Man City": "City Football Academy", Arsenal: "London Colney", Chelsea: "Cobham", Liverpool: "AXA Training Centre",
  Tottenham: "Hotspur Way", Everton: "Finch Farm", Newcastle: "Darsley Park", "Aston Villa": "Bodymoor Heath", "West Ham": "Rush Green",
  "Real Madrid": "Valdebebas", Barcelona: "Ciutat Esportiva Joan Gamper", "Atletico Madrid": "Majadahonda", Juventus: "Continassa",
  "AC Milan": "Milanello", "Inter Milan": "Appiano Gentile", "Bayern Munich": "Saebener Strasse", "Borussia Dortmund": "Hohenbuschei",
  "Paris Saint-Germain": "Campus PSG", Benfica: "Seixal", Porto: "Olival", "Sporting CP": "Alcochete", Ajax: "De Toekomst"
};
// school colours: a calm pair each, picked by the name
const SCHOOL_COLS = [["#1e3a8a", "#f2c94c"], ["#7a1f2b", "#f4f1ea"], ["#14532d", "#f4f1ea"], ["#1d4ed8", "#ffffff"], ["#111827", "#dc2626"], ["#5b21b6", "#f4f1ea"], ["#0f766e", "#fde68a"], ["#9a3412", "#f4f1ea"], ["#334155", "#38bdf8"], ["#be123c", "#fef3c7"],
  ["#0c4a6e", "#e0f2fe"], ["#3f6212", "#fef9c3"], ["#78350f", "#fde68a"], ["#831843", "#fce7f3"], ["#1f2937", "#facc15"], ["#065f46", "#d1fae5"], ["#4c1d95", "#fbbf24"], ["#7f1d1d", "#e5e7eb"], ["#155e75", "#ffffff"], ["#365314", "#ffffff"]];

function makeCampus(K, deps) {
  const { C, me, msg, money } = K;
  const kitOf = (deps && deps.kitOf) || (() => null);

  // ---------- an institution: name, kind, city, standing 1 to 10, a seed, colours, its ground's name ----------
  function school(name) {
    const s = D.SCHOOLS.find(x => x.id === name || x.name === name);
    const h = hashOf("school:" + name);
    const standing = s ? clamp(Math.round(s.facilities * 0.55 + s.lifestyle * 0.25 + Math.min(10, s.tuition / 1300) * 0.2), 2, 10) : 4 + (h % 5);
    const nm = s ? s.name : name;
    return { key: "school:" + (s ? s.id : slug(nm)), kind: "school", name: nm, city: "Mumbai", standing, seed: hashOf(nm), cols: SCHOOL_COLS[hashOf(nm) % SCHOOL_COLS.length], ground: nm, id: s ? s.id : null };
  }
  function college(name) {
    const s = D.COLLEGES.find(x => x.id === name || x.name === name);
    const nm = s ? s.name : name;
    const h = hashOf("college:" + nm);
    const standing = s ? clamp(Math.round(s.facilities * 0.55 + s.reputation * 0.45), 3, 10) : 4 + (h % 4);
    return { key: "college:" + (s ? s.id : slug(nm)), kind: "college", name: nm, city: s ? s.city : COLLEGE_RIVAL_CITY[nm] || "Delhi", standing, seed: hashOf(nm), cols: SCHOOL_COLS[(hashOf(nm) >>> 3) % SCHOOL_COLS.length], ground: nm, id: s ? s.id : null };
  }
  function club(game, name) {
    const lvl = game && game.clubs[name] ? K.clubLevel(game, name) : 62;
    const standing = clamp(Math.round(3 + (lvl - 58) / 4), 2, 10);
    const kit = kitOf(name) || ["#c8102e", "#ffffff"];
    const city = game ? K.cityOf(game, name) : null;
    return { key: "club:" + slug(name), kind: "club", name, city, standing, seed: hashOf(name), cols: [kit[0], kit[1]], ground: GROUNDS[name] || name + " Training Ground", stadium: L.STADIUMS[name] || name + " Stadium" };
  }
  function centre(game) {
    const c = C(game);
    const nm = c.centre ? c.centre.name : "National Football Centre";
    return { key: "centre:" + slug(nm), kind: "centre", name: nm, city: c.city, standing: 6, seed: hashOf(nm), cols: SCHOOL_COLS[hashOf(nm) % SCHOOL_COLS.length], ground: nm };
  }
  // the institution behind a youth side's name (a rival school, a university, an academy's U18 side)
  function instByTeam(game, team) {
    const c = C(game);
    if (!team) return null;
    if (c.stage === "school" || D.SCHOOLS.some(x => x.name === team) || D.SCHOOL_RIVALS.includes(team)) return school(team);
    if (c.stage === "college" || D.COLLEGES.some(x => x.name === team) || D.COLLEGE_RIVALS.includes(team)) return college(team);
    if (/ U18$/.test(team)) return Object.assign(club(game, team.replace(/ U18$/, "")), { academy: true });
    if (c.stage === "centre") return Object.assign(centre(game), team === (c.centre && c.centre.name) ? {} : { key: "centre:" + slug(team), name: team, ground: team, seed: hashOf(team), standing: 5 });
    return club(game, team);
  }
  // his own: the school, college, academy or centre he is at, and his club once he is a pro
  function mine(game) {
    const c = C(game), p = me(game);
    if (c.stage === "school" && c.school) return school(c.school);
    if (c.stage === "college" && c.college) return college(c.college);
    if (c.stage === "academy" && c.academy) return Object.assign(club(game, c.academy.club), { academy: true });
    if (c.stage === "centre") return centre(game);
    if (c.stage === "pro" && p.club) return club(game, p.club);
    return null;
  }

  // ---------- the grounds a city shows: his own first, then a few more of the city's own ----------
  function forCity(game, city) {
    const own = mine(game);
    const out = [];
    const seen = new Set();
    const add = (inst, mineFlag) => {
      if (!inst || seen.has(inst.key)) return;
      seen.add(inst.key);
      out.push(Object.assign({}, inst, { mine: !!mineFlag }));
    };
    if (own && (own.city === city || own.kind === "club" || own.kind === "centre")) add(own, true);
    const pick = (list, n, by) => list.filter(x => !seen.has(x.key)).sort((a, b) => b.standing - a.standing || hashOf(city + a.key) - hashOf(city + b.key)).slice(0, n).forEach(x => add(x, false));
    if (city === "Mumbai") pick(D.SCHOOLS.map(s => school(s.id)).concat(D.SCHOOL_RIVALS.map(school)), CAP.school);
    pick(D.COLLEGES.filter(x => x.city === city).map(x => college(x.id)).concat(D.COLLEGE_RIVALS.filter(n => COLLEGE_RIVAL_CITY[n] === city).map(college)), CAP.college);
    if (game) pick(Object.keys(game.clubs).filter(n => K.cityOf(game, n) === city).map(n => club(game, n)), CAP.club);
    return out;
  }
  // as places on the map: a campus for a school, college or centre; a training ground and a stadium for a club
  function places(game, city) {
    const list = forCity(game, city);
    const ps = [];
    const st = inst => ({ key: inst.key, kind: inst.kind, standing: inst.standing, seed: inst.seed, cols: inst.cols, mine: inst.mine, academy: !!inst.academy, ground: inst.ground, team: inst.name });
    for (const inst of list) {
      if (inst.kind === "school") ps.push({ id: inst.mine ? "school" : "school:" + slug(inst.name), kind: "school", name: inst.name, where: "suburb", inst: st(inst) });
      else if (inst.kind === "college" || inst.kind === "centre") ps.push({ id: inst.mine ? "college" : "college:" + slug(inst.name), kind: "college", name: inst.name, where: "suburb", inst: st(inst) });
      else if (inst.kind === "club") {
        // his own club keeps the old ids, so old saves and old screens still find them
        ps.push({ id: inst.mine ? "training" : "training:" + slug(inst.name), kind: "training", name: inst.ground, where: "outskirts", inst: st(inst) });
        ps.push({ id: inst.mine ? "stadium" : "stadium:" + slug(inst.name), kind: "stadium", name: inst.stadium, where: "suburb", inst: st(inst) });
      }
    }
    return ps;
  }

  // ---------- the venue of a match: whose ground, what kind, how big ----------
  function venueFor(game, home, away, opts) {
    const c = C(game);
    opts = opts || {};
    if (opts.pro || c.stage === "pro") {
      const inst = club(game, home);
      const crowd = clamp(0.35 + inst.standing * 0.065, 0.4, 1);
      return { kind: "pro", name: inst.stadium, host: home, standing: inst.standing, seed: inst.seed, cols: inst.cols, crowd, daylight: false };
    }
    const inst = instByTeam(game, home);
    if (!inst) return { kind: "pro", name: home + " ground", host: home, standing: 5, seed: hashOf(home), cols: SCHOOL_COLS[0], crowd: 0.3, daylight: false };
    const kind = inst.kind === "club" ? "academy" : inst.kind === "centre" ? "college" : inst.kind;
    // a school game draws a handful along the touchline, a college game half fills its little stand
    const crowd = kind === "school" ? clamp(0.25 + inst.standing * 0.04, 0.2, 0.7) : kind === "college" ? clamp(0.3 + inst.standing * 0.04, 0.3, 0.75) : clamp(0.2 + inst.standing * 0.03, 0.2, 0.5);
    return { kind, name: inst.ground + (kind === "academy" ? ", academy pitch" : ""), host: home, standing: inst.standing, seed: inst.seed, cols: inst.cols, crowd: r1(crowd), daylight: true };
  }

  // ---------- life at his own grounds ----------
  // place: "school" or "college" (his own campus), "training" (his club's or academy's training ground)
  function act(game, place, action, ctx) {
    const c = C(game), p = me(game);
    const { useTime, out, life } = ctx;
    const own = mine(game);
    if (!own) return { error: "You are not at a school, a college or a club right now." };
    const ownKind = own.kind === "club" ? "training" : own.kind === "school" ? "school" : "college";
    if (place !== ownKind) return { error: "That is not your " + (place === "training" ? "training ground" : place) + "." };
    const wk = ctx.week;
    if (place === "school" || place === "college") {
      if (action === "class") {
        if ((wk.classes || 0) >= 2) return { error: "You have been to every class this week. Even the teachers are surprised." };
        if (!useTime(1)) return { error: "No free time left this week." };
        wk.classes = (wk.classes || 0) + 1;
        c.traits.discipline = clamp(c.traits.discipline + 1.2, 0, 100);
        c.traits.professionalism = clamp(c.traits.professionalism + 0.4, 0, 100);
        if (K.people) { K.people.rel(game, "mum", 2); K.people.rel(game, "dad", 1); }
        c.cond.fatigue = clamp(c.cond.fatigue - 2, 0, 100);
        return out(place === "school" ? "Maths, a history test and a long biology lesson. Mum will be pleased." : "A lecture on sports science and a seminar on nutrition. Useful, mostly.");
      }
      if (action === "canteen") {
        if (wk.canteen) return { error: "You already ate here this week." };
        wk.canteen = true;
        money(game, -(place === "school" ? 3 : 5), "Canteen, " + own.name);
        c.cond.morale = clamp(c.cond.morale + 1, 5, 99);
        if (K.people) K.people.rel(game, "team", 1);
        return out("Lunch with the others. Someone knocked a tray over and the whole room cheered.");
      }
      // extra work on the school or college pitch: the training sessions
      const S = D.SESSIONS[action];
      if (S && action !== "rest") return session(game, action, ctx, "On the " + (place === "school" ? "school" : "college") + " pitch until the light went.");
      return { error: "Nothing to do there." };
    }
    // the training ground
    if (action === "physio") {
      if (wk.physio) return { error: "The physio already saw you this week." };
      if (!useTime(1)) return { error: "No free time left this week." };
      wk.physio = true;
      c.cond.fatigue = clamp(c.cond.fatigue - 16, 0, 100);
      let text = "An hour on the table, then the ice bath. The legs feel new.";
      if (c.cond.inj && c.cond.inj.weeks > 1 && Math.random() < 0.35) { c.cond.inj.weeks--; p.inj = c.cond.inj.weeks; text = "Extra rehab with the physio. You are a week ahead of schedule."; }
      return out(text);
    }
    if (action === "gym" || action.startsWith("gym:")) {
      if (c.cond.inj) return { error: "The physio says no weights while you are injured." };
      if (wk.clubGym) return { error: "You already did your gym work this week." };
      if (!useTime(1)) return { error: "No free time left this week." };
      wk.clubGym = true;
      const gains = {};
      for (const k of ["strength", "stamina", "acceleration"]) gains[k] = K.trainOne(game, k, 0.45);
      c.cond.fatigue = clamp(c.cond.fatigue + 6, 0, 100);
      c.traits.professionalism = clamp(c.traits.professionalism + 0.3, 0, 100);
      return out("Weights and sprints with the fitness coach. He wrote your numbers on the board.", { gains });
    }
    if (action === "canteen") {
      if (wk.canteen) return { error: "You already ate here this week." };
      wk.canteen = true;
      c.cond.morale = clamp(c.cond.morale + 1, 5, 99);
      if (K.people) { K.people.rel(game, "team", 2); K.people.rel(game, "best", 1); }
      return out("Lunch with the squad. The chef made your favourite and the kit man told the same joke again.");
    }
    if (action === "changing") {
      if (wk.changing) return { error: "You already spent time in the dressing room this week." };
      wk.changing = true;
      if (K.people) { K.people.rel(game, "team", 1.5); K.people.rel(game, "best", 2); }
      c.cond.morale = clamp(c.cond.morale + 0.5, 5, 99);
      return out("Music on, boots off, everyone talking at once. This is the bit you miss in the summer.");
    }
    const S = D.SESSIONS[action];
    if (S && action !== "rest") return session(game, action, ctx, "Extra work after everyone else went home. The coaches noticed.");
    return { error: "Nothing to do there." };
  }
  function session(game, sid, ctx, text) {
    const c = C(game);
    const S = D.SESSIONS[sid];
    if (c.cond.inj && sid !== "recovery") return { error: "The physio says recovery work only." };
    if (!ctx.useTime(1)) return { error: "No free time left this week." };
    const gains = {};
    for (const k of S.grows || []) gains[k] = K.trainOne(game, k, 0.6);
    c.cond.fatigue = clamp(c.cond.fatigue + (S.fatigue > 0 ? S.fatigue * 0.8 : S.fatigue), 0, 100);
    c.coachRel = clamp(c.coachRel + 0.6, 0, 100);
    c.traits.professionalism = clamp(c.traits.professionalism + 0.2, 0, 100);
    if (c.stage === "pro") c.trust = clamp(c.trust + 0.4, 0, 100);
    return ctx.out(text, { gains });
  }

  return { school, college, club, centre, instByTeam, mine, forCity, places, venueFor, act, slug, GROUNDS };
}

module.exports = { makeCampus, COLLEGE_RIVAL_CITY };
