// Player Career: the people he meets and the friends he makes. Classmates at school and college, teammates at
// the training ground; each one has a name, a personality and things they are into. He walks up to them on the
// grounds, talks (what he says matters), swaps numbers, texts back (or forgets to), and hangs out in his free
// time. Everything lives with the rest of his people (floodlights/career/people.js): the same relationship
// numbers, the same phone, the same life events, the same morale. Nothing here is a second system.
const D = require("./data");
const S = require("./social_data");
const L = require("./life_data");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hashOf(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pickR = (r, a) => a[Math.floor(r() * a.length)];

// everyday clothes: colours that look like clothes, not kits
const TOPS = ["#f4f1ea", "#1d2230", "#9a3b2e", "#2f6d5a", "#e05a7a", "#f0c419", "#7d8fb3", "#5a4a8a", "#c8a27a", "#3a5a8c", "#d9d4cc", "#2a2a30", "#b36b4a", "#6b8f71"];
const BOTTOMS = ["#3a5a8c", "#22252b", "#1b1f2a", "#7a6a55", "#d9d4cc", "#2f3b52", "#4a3a2e"];
const SHOES = [["#f2f2f2", "#d9d9d9"], ["#111111", "#080808"], ["#3a2a1e", "#1a120c"], ["#c8a27a", "#5a3f2a"], ["#e9e1d4", "#b9b0a2"]];
const LIPS = ["#b5545c", "#a0444f", "#c2696f", "#9c5a5a", null, null];
function darken(hex, k) { const n = parseInt(hex.slice(1), 16); const f = c => Math.round(c * k).toString(16).padStart(2, "0"); return "#" + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255); }

function makeSocial(K) {
  const { C, me, msg } = K;
  const weekIndex = game => game.season * 40 + game.round;
  const india = game => (L.CITY_COUNTRY[C(game).city] || C(game).person.country) === "India";
  function P(game) {
    const pp = K.people.P0(game);
    if (!pp.friends) pp.friends = {};
    return pp;
  }

  // ---------- what someone looks like, from a seed: the same person always looks the same ----------
  function bodyOf(seed, fem, indian, adult) {
    const r = rng(seed);
    const skinF = indian ? 0.32 + r() * 0.45 : r();
    const dark = skinF > 0.68;
    const hair = fem ? (dark ? pickR(r, [19, 20, 17, 18, 21, 16]) : pickR(r, [16, 16, 17, 18, 19, 20, 21, 7, 8])) : dark ? pickR(r, [0, 2, 3, 9, 10, 11, 14]) : pickR(r, [0, 1, 1, 2, 8, 9, 12, 13, 15]);
    const hairCol = indian || skinF > 0.5 ? pickR(r, [0, 0, 1, 1, 2]) : pickR(r, [0, 1, 2, 3, 4, 5, 8, 9]);
    const look = {
      skinF, hair, hairCol, eyeCol: Math.floor(r() * 6),
      faceW: 0.25 + r() * 0.5, jaw: fem ? 0.1 + r() * 0.25 : 0.25 + r() * 0.6, chin: fem ? 0.2 + r() * 0.3 : 0.3 + r() * 0.5, cheeks: 0.35 + r() * 0.5,
      eyes: 0.3 + r() * 0.5, brows: fem ? 0.2 + r() * 0.25 : 0.4 + r() * 0.5, nose: 0.2 + r() * 0.5, mouth: 0.3 + r() * 0.5, ears: 0.3 + r() * 0.4,
      beard: !fem && adult ? pickR(r, [0, 0, 0, 1, 2, 4]) : 0, moustache: 0, muscle: fem ? 0.3 : 0.3 + r() * 0.5, shoulders: 0.3 + r() * 0.4, legs: 0.4 + r() * 0.3
    };
    if (fem) { look.fem = true; const lp = pickR(r, LIPS); if (lp) look.lips = lp; if (r() < 0.4) look.earrings = pickR(r, ["gold", "silver"]); }
    const h = fem ? Math.round(154 + r() * 20) : Math.round(adult ? 167 + r() * 20 : 158 + r() * 22);
    const w = fem ? Math.round(47 + r() * 15) : Math.round(adult ? 60 + r() * 20 : 50 + r() * 18);
    return { look, h, w };
  }
  // what they wear: a uniform at school in its colours, training kit at the club, their own clothes anywhere else
  function clothesOf(seed, fem, setting, cols) {
    const r = rng(seed ^ 0x5bd1e995);
    if (setting === "school") {
      const dark = darken(cols[0], 0.55);
      return { shirt: "#f4f4f4", trim: cols[0], shorts: dark, socks: dark, bottom: fem ? "skirt" : "trousers", plain: true, shoe: ["#141414", "#0a0a0a"], tights: fem ? "#22252b" : undefined, sleeve: r() < 0.3 };
    }
    if (setting === "training") return { shirt: cols[0], trim: cols[1], shorts: darken(cols[0], 0.45), socks: cols[0], shoe: ["#f2f2f2", "#d9d9d9"] };
    if (setting === "night") {
      const top = pickR(r, ["#1d2230", "#5a1a2e", "#2a2a30", "#1f3b5a", "#c8a27a", "#7a1f2b", "#e8e1d4"]);
      const bottom = fem ? pickR(r, ["dress", "dress", "skirt", "trousers"]) : "trousers";
      return { shirt: top, trim: top, shorts: bottom === "dress" ? top : pickR(r, ["#141414", "#1b1f2a", "#2a2a30"]), socks: "#f4f4f4", bottom, top: fem && r() < 0.5 ? "vest" : undefined, plain: true, shoe: pickR(r, [["#111111", "#080808"], ["#c8a27a", "#5a3f2a"], ["#7a1f2b", "#2a0a10"]]) };
    }
    const top = pickR(r, TOPS);
    const bottom = fem ? pickR(r, ["trousers", "trousers", "skirt", "dress"]) : "trousers";
    return { shirt: top, trim: r() < 0.5 ? top : pickR(r, TOPS), shorts: bottom === "dress" ? top : pickR(r, BOTTOMS), socks: "#f4f4f4", bottom, top: fem && r() < 0.25 ? "vest" : undefined, sleeve: r() < 0.25, plain: true, shoe: pickR(r, SHOES) };
  }
  function personality(seed) {
    const r = rng(seed ^ 0x27d4eb2f);
    const trait = pickR(r, S.TRAIT_IDS);
    const a = pickR(r, S.INTERESTS);
    let b = pickR(r, S.INTERESTS);
    if (b === a) b = S.INTERESTS[(S.INTERESTS.indexOf(a) + 3) % S.INTERESTS.length];
    return { trait, likes: [a, b] };
  }

  // ---------- the people at his school, college or club ----------
  function roster(game) {
    const c = C(game), p = me(game);
    const inst = K.campus.mine(game);
    if (!inst) return [];
    const ind = india(game);
    const out = [];
    const setting = inst.kind === "school" ? "school" : inst.kind === "college" || inst.kind === "centre" ? "college" : "training";
    const placeId = inst.kind === "school" ? "school" : inst.kind === "college" || inst.kind === "centre" ? "college" : "training";
    const club = c.stage === "pro" && p.club && game.clubs[p.club];
    if (club) {
      // the squad itself: real names, men, training kit
      for (const id of club.squad) {
        const q = game.players[id];
        if (!q || q.id === p.id) continue;
        const seed = hashOf("t:" + q.id);
        out.push(Object.assign({ id: "t:" + q.id, name: q.name, first: q.name.split(" ")[0], kind: "teammate", fem: false, from: inst.name, setting, placeId }, personality(seed), bodyOf(seed, false, ind, true), { outfit: clothesOf(seed, false, setting, inst.cols) }));
        if (out.length >= 16) break;
      }
      return out;
    }
    const n = setting === "training" ? 14 : 12;
    for (let i = 0; i < n; i++) {
      const id = "s:" + inst.key + ":" + i;
      const seed = hashOf(id);
      // a school and a college are mixed; an academy and a centre are the lads
      const fem = setting === "training" ? false : setting === "school" ? i % 5 === 1 || i % 5 === 3 : i % 2 === 1;
      const r = rng(seed);
      const first = fem ? (ind ? pickR(r, S.GIRLS_IN) : pickR(r, S.GIRLS_W)) : ind ? pickR(r, D.IN_FIRST) : pickR(r, S.BOYS_W);
      const last = ind ? pickR(r, fem ? S.LAST_IN_F : D.IN_LAST) : pickR(r, S.LAST_W);
      if (first === c.person.first) continue;
      out.push(Object.assign({ id, name: first + " " + last, first, kind: setting === "training" ? "teammate" : "classmate", fem, from: inst.name, setting, placeId }, personality(seed), bodyOf(seed, fem, ind, setting !== "school"), { outfit: clothesOf(seed, fem, setting, inst.cols) }));
    }
    return out;
  }
  // ---------- the women he can meet, college onwards and over eighteen: 240 per part of the world ----------
  const POOL = 240;
  const region = game => (india(game) ? "in" : "w");
  function eligible(game) { return C(game).stage !== "school" && me(game).age >= 18; }
  function poolAt(game, reg, i) {
    const id = "d:" + reg + ":" + i;
    const seed = hashOf(id);
    const r = rng(seed ^ 0x9e3779b9);
    // in India most are Indian names, elsewhere most are not; the first and last names step so no two match
    const local = (i % 5) !== 4;
    const ind = reg === "in" ? local : !local;
    const firsts = ind ? S.GIRLS_IN : S.GIRLS_W, lasts = ind ? S.LAST_IN_F : S.LAST_W;
    const first = firsts[(i * 7 + 3) % firsts.length], last = lasts[(i * 11 + 5) % lasts.length];
    const ageOff = Math.floor(r() * 6) - 2;
    return Object.assign({ id, name: first + " " + last, first, kind: "date", fem: true, from: "", ageOff }, personality(seed), bodyOf(seed, true, ind, true), { outfit: clothesOf(seed, true, "city", null), night: clothesOf(seed, true, "night", null) });
  }
  // someone he knows or can meet, by id
  function find(game, id) {
    const m = /^d:(in|w):(\d+)$/.exec(id);
    if (m) return Number(m[2]) < POOL ? poolAt(game, m[1], Number(m[2])) : null;
    return roster(game).find(x => x.id === id) || null;
  }
  // his record of someone: made the first time they talk, kept for ever (friends from school stay friends)
  function F(game, who) {
    const pp = P(game);
    let f = pp.friends[who.id];
    if (!f) {
      f = pp.friends[who.id] = { id: who.id, name: who.name, first: who.first, kind: who.kind, fem: !!who.fem, from: who.from, trait: who.trait, likes: who.likes, rel: 30, num: false, met: { s: game.season, w: game.round }, talks: 0, talkW: -1, hangW: -1, last: weekIndex(game) };
      if (who.kind === "date") Object.assign(f, { stage: "met", dates: 0, good: 0, age: Math.max(18, me(game).age + (who.ageOff || 0)), where: C(game).city });
    }
    return f;
  }

  // ---------- who is where this week ----------
  // his own grounds and their rooms; friends turn up more often than people he has not met
  const SLOTS = {
    school: { "": 5, corridor: 2, classroom: 6, canteen: 3 },
    college: { "": 5, corridor: 2, classroom: 6, canteen: 3 },
    training: { "": 4, changing: 5, canteen: 3, gym: 2, physio: 1 }
  };
  // where he might meet someone: the cafes, the mall, the gym, the restaurant, the club, and his college
  const VENUE_KINDS = ["cafe", "mall", "club", "restaurant", "gym"];
  function present(game) {
    const out = campusPresent(game);
    if (!eligible(game)) return out;
    const pp = P(game), p = me(game);
    // (a wife and wedding guests are added below, with the women out in the city)
    const wk = weekIndex(game), reg = region(game);
    const taken = new Set(Object.values(pp.friends).filter(f => f.kind === "date" && (f.stage !== "met" && f.stage !== "talking")).map(f => f.id));
    const used = new Set();
    const pickPool = (key, n) => {
      const list = [];
      for (let k = 0; list.length < n && k < 12; k++) {
        const i = hashOf(key + ":" + wk + ":" + k) % POOL;
        const id = "d:" + reg + ":" + i;
        if (taken.has(id) || used.has(id)) continue;
        used.add(id);
        const who = poolAt(game, reg, i);
        if (key === "club") who.outfit = who.night;
        list.push(viewOf(game, who));
      }
      return list;
    };
    const places = (K.life && K.life.world(game).places) || [];
    for (const pl of places) {
      if (!VENUE_KINDS.includes(pl.kind) || (pl.minAge && p.age < pl.minAge)) continue;
      out[pl.id] = (out[pl.id] || []).concat(pickPool(pl.id, pl.kind === "club" ? 2 : 1));
    }
    const pt = partnerOf(game);
    if (pt && pt.stage === "married") {
      const homeId = (C(game).life && C(game).life.home && C(game).life.home.id) || "";
      const home = places.find(x => x.kind === "home" && (x.homeId || x.id.replace("home:", "")) === homeId);
      const who = find(game, pt.id);
      if (home && who) out[home.id] = [Object.assign(viewOf(game, who), { role: "Your wife" })];
    }
    if (pp.wedding && (pp.wedding.status === "today" || pp.wedding.status === "on")) out.wedding = guestsOf(game, pp.wedding.size);
    if (C(game).stage === "college" && out.college) {
      out.college = out.college.concat(pickPool("college", 2));
      out["college/canteen"] = (out["college/canteen"] || []).concat(pickPool("college/canteen", 1));
    }
    return out;
  }
  function campusPresent(game) {
    const pp = P(game);
    const list = roster(game);
    if (!list.length) return {};
    const base = list[0].placeId;
    const wk = weekIndex(game);
    const order = list.slice().sort((a, b) => {
      const fa = pp.friends[a.id], fb = pp.friends[b.id];
      const ka = (fa && fa.rel >= 40 ? 0 : 1) + (hashOf(a.id + wk) % 1000) / 1000, kb = (fb && fb.rel >= 40 ? 0 : 1) + (hashOf(b.id + wk) % 1000) / 1000;
      return ka - kb;
    });
    const out = {};
    let i = 0;
    for (const [sub, n] of Object.entries(SLOTS[base] || {})) {
      const id = sub ? base + "/" + sub : base;
      out[id] = [];
      for (let k = 0; k < n; k++) {
        // the classroom and the dressing room take everyone again: they are where the whole class or squad is
        const who = sub === "classroom" || sub === "changing" ? order[k % order.length] : order[i++ % order.length];
        if (!who || out[id].some(x => x.id === who.id)) continue;
        out[id].push(viewOf(game, who));
      }
    }
    return out;
  }
  function viewOf(game, who) {
    const f = P(game).friends[who.id];
    return { id: who.id, name: who.name, first: who.first, kind: who.kind, role: roleOf(game, f || who), fem: !!who.fem, look: who.look, outfit: who.outfit, h: who.h, w: who.w, rel: f ? Math.round(f.rel) : null, num: !!(f && f.num), trait: S.TRAITS[who.trait].word, likes: who.likes.map(x => S.LIKE_WORD[x]), age: f && f.age ? f.age : Math.max(18, me(game).age + (who.ageOff || 0)) };
  }
  function roleOf(game, f) {
    if (f.kind === "date") return f.stage && f.stage !== "met" ? S.STAGE_WORD[f.stage] : f.talks ? "You have met" : "Someone new";
    const inst = K.campus.mine(game);
    const here = inst && f.from === inst.name;
    if (f.kind === "teammate") return here ? "Teammate" : "Teammate at " + f.from;
    return here ? (C(game).stage === "college" ? "Course mate" : "Classmate") : "Friend from " + f.from;
  }
  function level(rel) { return rel >= 70 ? "Close friend" : rel >= 40 ? "Friend" : "Knows you"; }

  // ---------- talking ----------
  function startTalk(game, place, id) {
    const pp = P(game);
    const here = (present(game)[place] || []).some(x => x.id === id);
    const who = here && find(game, id);
    if (!who) return { error: "They have wandered off." };
    const f = F(game, who);
    const wk = weekIndex(game);
    const r = rng(hashOf(id + ":" + wk + ":" + f.talks));
    let line, good;
    const wife = who.kind === "date" && f.stage === "married";
    if (wife) { const q = pickR(r, S.WIFE_TALK); line = q.t; good = q.good; }
    else if (who.kind === "date") { const vk = place === "college" || place.startsWith("college/") ? "college" : place.split(":")[0]; const q = pickR(r, S.MEET[vk] || S.MEET.cafe); line = f.talks ? pickR(r, S.TOPICS[who.likes[(f.talks + wk) % 2]].open) : q.t; good = f.talks ? S.TOPICS[who.likes[(f.talks + wk) % 2]].good : q.good; }
    else if (who.kind === "teammate" && r() < 0.6) { const q = pickR(r, S.SQUAD_TOPICS); line = q.t; good = q.good; }
    else { const topic = S.TOPICS[who.likes[(f.talks + wk) % 2]]; line = pickR(r, topic.open); good = topic.good; }
    const style = ["joke", "listen", "plans"][(f.talks + wk) % 3];
    const choices = [{ id: "good", label: good }, { id: style, label: pickR(r, S.SAY[style]) }, { id: "football", label: pickR(r, S.SAY.football) }];
    // the order changes, so the best answer is not always the first
    const k = Math.floor(r() * 3);
    const ordered = choices.slice(k).concat(choices.slice(0, k));
    pp.talk = { id, place, name: who.name, first: who.first, role: wife ? "Your wife" : roleOf(game, who.kind === "date" ? f : who), line, choices: ordered, said: null, result: null, follow: [] };
    return { ok: true };
  }
  function say(game, choice) {
    const pp = P(game), t = pp.talk;
    if (!t || t.said) return { error: "Nothing to answer." };
    const who = find(game, t.id);
    const f = pp.friends[t.id];
    if (!who || !f) return { error: "They have wandered off." };
    const tr = who.trait;
    let d = 0;
    if (choice === "good") d = 7;
    else if (choice === "joke") d = tr === "funny" || tr === "outgoing" ? 7 : tr === "shy" ? -2 : 3;
    else if (choice === "listen") d = ["shy", "kind", "creative", "bookish"].includes(tr) ? 7 : tr === "outgoing" ? 2 : 4;
    else if (choice === "plans") d = tr === "ambitious" || tr === "outgoing" ? 7 : tr === "shy" ? 1 : 3;
    else if (choice === "football") d = tr === "sporty" || who.likes.includes("football") ? 6 : who.kind === "teammate" ? 5 : -3;
    else return { error: "Pick one of the answers." };
    const wk = weekIndex(game);
    // the first chat of the week counts most
    if (f.talkW === wk && d > 0) d = Math.round(d / 2);
    f.rel = clamp(f.rel + d, 0, 100);
    f.talks++;
    f.talkW = wk;
    f.last = wk;
    const r = rng(hashOf(t.id + ":" + f.talks));
    const res = d >= 7 ? "great" : d >= 3 ? "good" : d >= 0 ? "meh" : "bad";
    t.said = (t.choices.find(x => x.id === choice) || {}).label || "";
    t.result = pickR(r, S.RESULT[res]).replace(/\{first\}/g, t.first);
    t.rel = Math.round(f.rel);
    t.level = level(f.rel);
    t.follow = [];
    if (f.kind === "date") {
      if (!f.num && f.rel >= 35 && !f.noW) t.follow.push({ id: "number", label: "Ask for her number" });
    } else {
      if (!f.num && f.rel >= 40) t.follow.push({ id: "number", label: "Swap numbers" });
      if (f.rel >= 40 && f.hangW !== wk) t.follow.push({ id: "hang", label: "Hang out after" });
    }
    t.follow.push({ id: "bye", label: "See you around" });
    // the chat card shows how it went
    return { ok: true };
  }
  function swap(game, id) {
    const pp = P(game);
    const f = pp.friends[id];
    if (!f) return { error: "You have not met them." };
    if (f.num) return { ok: true, text: "You already have " + f.first + "'s number." };
    if (f.kind === "date") return herNumber(game, f);
    if (f.rel < 40) return { error: f.first + " does not know you well enough yet." };
    f.num = true;
    f.rel = clamp(f.rel + 2, 0, 100);
    msg(game, "f:" + id, f.name, "Hey it's " + f.first + " 👋");
    if (pp.talk && pp.talk.id === id) pp.talk.follow = pp.talk.follow.filter(x => x.id !== "number");
    return { ok: true, text: "You swap numbers with " + f.first + "." };
  }
  function hang(game, id, ctx) {
    const c = C(game), pp = P(game);
    const f = pp.friends[id];
    if (!f) return { error: "You have not met them." };
    if (f.rel < 40) return { error: f.first + " does not know you well enough yet." };
    const wk = weekIndex(game);
    if (f.hangW === wk) return { error: "You already saw " + f.first + " this week." };
    if (!ctx.useTime(1)) return { error: "No free time left this week." };
    f.hangW = wk;
    f.last = wk;
    f.rel = clamp(f.rel + 8, 0, 100);
    c.cond.morale = clamp(c.cond.morale + 2, 5, 99);
    c.cond.fatigue = clamp(c.cond.fatigue - 2, 0, 100);
    const stage = c.stage === "school" ? "school" : c.stage === "pro" ? "pro" : "college";
    const r = rng(hashOf(id + ":" + wk));
    const text = "With " + f.first + ". " + pickR(r, S.HANGS[stage]);
    if (pp.talk && pp.talk.id === id) pp.talk.follow = pp.talk.follow.filter(x => x.id !== "hang");
    return ctx.out(text, { rel: Math.round(f.rel) });
  }
  // ---------- dating ----------
  const partnerOf = game => { const pp = P(game); return pp.partner ? pp.friends[pp.partner] || null : null; };
  const clock = h => { const hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60); return String(hh).padStart(2, "0") + ":" + String(mm === 60 ? 0 : mm).padStart(2, "0"); };
  // anyone he is with finds out about someone else, sometimes
  function caught(game, other) {
    const pt = partnerOf(game);
    if (!pt || pt.id === other.id) return "";
    const r = rng(hashOf(other.id + ":" + weekIndex(game) + ":caught"));
    if (r() > 0.4) return "";
    pt.rel = clamp(pt.rel - 18, 0, 100);
    msg(game, "f:" + pt.id, pt.name, "My friend saw you with " + other.first + ". Do not even try to explain.");
    return " " + pt.first + " found out.";
  }
  function herNumber(game, f) {
    const pp = P(game), c = C(game);
    const r = rng(hashOf(f.id + ":" + weekIndex(game) + ":num"));
    const fame = (c.rep.local + c.rep.national) / 2;
    const odds = 0.35 + (f.rel - 35) / 45 + fame / 300;
    if (pp.talk && pp.talk.id === f.id) pp.talk.follow = pp.talk.follow.filter(x => x.id !== "number");
    if (r() > odds) {
      f.noW = weekIndex(game);
      f.rel = clamp(f.rel - 2, 0, 100);
      return { ok: true, text: pickR(r, S.NUMBER.no) };
    }
    f.num = true;
    f.stage = "talking";
    f.rel = clamp(f.rel + 3, 0, 100);
    const where = pp.talk ? pp.talk.place : "";
    const nm = where.startsWith("cafe") ? " from the cafe" : where === "club" ? " from the club" : where === "mall" ? " from the mall" : where.startsWith("college") ? " from college" : "";
    msg(game, "f:" + f.id, f.name, "Hi, it's " + f.first + nm + " 🙂");
    return { ok: true, text: pickR(r, S.NUMBER.yes) + caught(game, f) };
  }
  // asking her out over text: where, what time (by the city clock), and whether he picks her up
  function askOut(game, arg, ctx) {
    const c = C(game), pp = P(game);
    const [id, venue, hs, pk, ns] = String(arg || "").split("|");
    const f = pp.friends[id];
    if (!f || f.kind !== "date" || !f.num || f.stage === "ex") return { error: "You cannot ask her out." };
    if (!eligible(game)) return { error: "Not yet." };
    if (pp.plan && pp.plan.status !== "done" && pp.plan.w === weekIndex(game)) return { error: "You already have a date planned this week." };
    const v = S.DATE_VENUES[venue];
    if (!v) return { error: "Pick where to go." };
    const hour = Number(hs), now = Number(ns);
    if (!Number.isFinite(hour) || !Number.isFinite(now) || hour < now + 0.4 || hour > now + 9 || hour > 23.6) return { error: "Pick a time later today." };
    // a walk and a drive start from her door: on foot for a walk, in the car for a drive
    const pickup = pk === "1" || venue === "walk" || venue === "drive";
    const byCar = venue === "drive" || (pk === "1" && venue !== "walk");
    const car = c.life && c.life.car;
    if (byCar && !car) return { error: "You need a car for that." };
    const places = (K.life && K.life.world(game).places) || [];
    const place = venue === "walk" || venue === "drive" ? "street" : venue === "cafe" ? (places.find(x => x.kind === "cafe") || {}).id : (places.find(x => x.id === venue) || {}).id;
    if (!place) return { error: "There is no " + venue + " in " + c.city + "." };
    if ((c.life.time || 0) < 1) return { error: "No free time left this week." };
    // a first date needs her to like you a bit; after that it is about how things are between you
    const need = f.stage === "talking" ? 45 : 22;
    let text;
    if (f.rel < need) {
      f.rel = clamp(f.rel - 1, 0, 100);
      msg(game, "f:" + f.id, f.name, f.stage === "talking" ? "Maybe another time? This week is crazy." : "I need a bit of space this week.");
      return { ok: true, text: f.first + " says not this week." };
    }
    ctx.useTime(1);
    pp.plan = { id: f.id, venue, place, hour: Math.round(hour * 4) / 4, pickup, byCar, w: weekIndex(game), status: "set", late: 0 };
    f.last = weekIndex(game);
    msg(game, "f:" + f.id, f.name, venue === "walk" ? "Come and get me at " + clock(pp.plan.hour) + ". Comfy shoes 😄" : pickup ? "Pick me up at " + clock(pp.plan.hour) + "? I will be outside 😊" : "See you at " + clock(pp.plan.hour) + " then 😊");
    text = "It's a date: " + v.label.toLowerCase() + " at " + clock(pp.plan.hour) + "." + caught(game, f);
    return { ok: true, text };
  }
  function lateBy(plan, hour) { const h = Number(hour); return Number.isFinite(h) ? Math.max(0, h - plan.hour) : 0; }
  function missed(game, f, plan) {
    plan.status = "done";
    f.rel = clamp(f.rel - 14, 0, 100);
    msg(game, "f:" + f.id, f.name, "I waited. Do not bother.");
    return { error: f.first + " gave up waiting." };
  }
  // he is outside her place in the car
  function pickUp(game, hour) {
    const pp = P(game), plan = pp.plan;
    if (!plan || plan.status !== "set" || !plan.pickup) return { error: "Nobody to pick up." };
    const f = pp.friends[plan.id];
    const late = lateBy(plan, hour);
    if (late > 2) return missed(game, f, plan);
    plan.status = "together";
    plan.late = late;
    return { ok: true, text: late > 0.5 ? f.first + " comes out. \"You are late.\"" : f.first + " comes out, smiling." };
  }
  // the date itself: a few moments, each with a choice; the place is where they are (the street for a walk or a drive)
  function startDate(game, place, hour) {
    const pp = P(game), plan = pp.plan;
    if (!plan || (plan.status !== "set" && plan.status !== "together")) return { error: "No date planned." };
    if (plan.place !== place && !(place === "street" && (plan.venue === "walk" || plan.venue === "drive"))) return { error: "Your date is somewhere else." };
    if (plan.pickup && plan.status !== "together") return { error: "Pick her up first." };
    const f = pp.friends[plan.id];
    if (!plan.pickup) { plan.late = lateBy(plan, hour); if (plan.late > 2) return missed(game, f, plan); }
    plan.status = "on";
    const venueBeat = plan.venue === "restaurant" ? "restaurant" : plan.venue === "cafe" ? "cafe" : plan.venue === "mall" ? "mall" : plan.venue === "club" ? "club" : plan.venue === "walk" ? "walk" : "drive";
    const keys = [plan.late > 0.5 ? "arriveLate" : "arrive", venueBeat, "middle", "close"];
    pp.scene = { id: f.id, name: f.name, first: f.first, venue: plan.venue, keys, step: 0, score: plan.late > 0.5 ? -2 : 0, cost: S.DATE_VENUES[plan.venue].cost, said: [], beat: null, result: null, canPropose: !!(pp.ring && f.stage === "serious") };
    beat(pp.scene);
    return { ok: true };
  }
  function beat(sc) {
    const b = S.BEATS[sc.keys[sc.step]];
    sc.beat = { t: b.t, choices: b.c.map(([id, label]) => ({ id, label })) };
    if (sc.keys[sc.step] === "close" && sc.canPropose) sc.beat.choices.push({ id: "propose", label: "Take out the ring" });
  }
  function dateSay(game, choice) {
    const c = C(game), pp = P(game), sc = pp.scene;
    if (!sc || sc.result) return { error: "Nothing to answer." };
    const b = S.BEATS[sc.keys[sc.step]];
    if (choice === "propose" && sc.canPropose && sc.keys[sc.step] === "close") return propose(game, sc);
    const ch = b.c.find(x => x[0] === choice);
    if (!ch) return { error: "Pick one." };
    const f = pp.friends[sc.id];
    const tr = f.trait, likes = f.likes || [];
    const [id, label, base] = ch;
    let d = base;
    const style = id.split(":")[0];
    if (style === "joke") d = tr === "funny" || tr === "outgoing" ? 5 : tr === "shy" ? -2 : 1;
    if (style === "compliment") d += tr === "shy" || tr === "kind" ? 1 : 0;
    if (style === "dance") d = likes.includes("dance") || tr === "outgoing" || tr === "funny" ? 6 : tr === "shy" ? -1 : 2;
    if (style === "quiet") d = ["shy", "bookish", "kind", "creative"].includes(tr) ? 6 : tr === "outgoing" ? 0 : 3;
    if (style === "football") d = tr === "sporty" || likes.includes("football") ? 5 : -2;
    if (style === "home") d = tr === "kind" || tr === "shy" ? 6 : 3;
    if (style === "music" && likes.includes("music")) d += 3;
    if (style === "honest" && likes.includes("fashion")) d += 2;
    if (style === "order" && likes.includes("food")) d += 2;
    if (style === "order" || style === "buy") sc.cost += Number(id.split(":")[1]) || 0;
    sc.score += d;
    sc.said.push(label);
    sc.step++;
    if (sc.step < sc.keys.length) { beat(sc); return { ok: true }; }
    // how it went
    const res = sc.score >= 15 ? "great" : sc.score >= 8 ? "good" : "bad";
    let note = "";
    if (sc.cost > 0) {
      if (sc.cost > c.money.cash) { note = " Your card was declined. She paid."; f.rel = clamp(f.rel - 6, 0, 100); }
      else K.money(game, -sc.cost, "A date with " + f.first);
    }
    const dRel = res === "great" ? 12 : res === "good" ? 7 : -5;
    f.rel = clamp(f.rel + dRel, 0, 100);
    f.dates = (f.dates || 0) + 1;
    if (res !== "bad") f.good = (f.good || 0) + 1;
    f.last = weekIndex(game);
    c.cond.morale = clamp(c.cond.morale + (res === "great" ? 4 : res === "good" ? 2 : -2), 5, 99);
    const r = rng(hashOf(f.id + ":" + f.dates));
    let stageNote = "";
    if (f.stage === "talking" && res !== "bad" && f.rel >= 50) {
      const old = partnerOf(game);
      if (old && old.id !== f.id) { old.stage = "ex"; old.rel = clamp(old.rel - 30, 0, 100); msg(game, "f:" + old.id, old.name, "I heard. Good luck with her."); }
      f.stage = "dating";
      f.since = weekIndex(game);
      pp.partner = f.id;
      stageNote = " You are seeing each other now.";
      if (c.rep.national > 30) K.news(game, me(game).name + " spotted on a date in " + c.city + ".", "life");
    }
    sc.result = { res, text: pickR(r, S.DATE_RESULT[res]) + note + stageNote, rel: Math.round(f.rel), stage: S.STAGE_WORD[f.stage] };
    pp.plan.status = "done";
    msg(game, "f:" + f.id, f.name, res === "great" ? "Best night in ages. Text me when you are home 😊" : res === "good" ? "Thanks for tonight 🙂" : "Thanks. Goodnight.");
    return { ok: true };
  }
  // ---------- the ring and the question ----------
  function buyRing(game, id) {
    const c = C(game), pp = P(game);
    const pt = partnerOf(game);
    const ring = S.RINGS.find(x => x.id === id);
    if (!ring) return { error: "That ring is not here." };
    if (!pt || pt.stage !== "serious") return { error: pt && pt.stage === "engaged" ? "She is already wearing yours." : "Rings are for when it is serious." };
    if (pp.ring) return { error: "You already have a ring in your pocket." };
    if (ring.price > c.money.cash) return { error: "Not enough money." };
    K.money(game, -ring.price, "An engagement ring, " + ring.brand);
    pp.ring = { id: ring.id, label: ring.label, brand: ring.brand, price: ring.price };
    return { ok: true, text: "The " + ring.brand + " " + ring.label.toLowerCase() + ". In its box, in your pocket. Now pick the moment." };
  }
  function propose(game, sc) {
    const c = C(game), pp = P(game);
    const f = pp.friends[sc.id];
    const plan = pp.plan;
    // how she feels, how long it has been serious, the ring, the place and how tonight went
    const weeks = Math.min(15, (weekIndex(game) - (f.since || weekIndex(game))) * 0.6);
    const ringK = Math.log10(Math.max(1000, pp.ring.price) / 2000) * 6;
    const spot = S.PROPOSE_AT[plan ? plan.venue : "cafe"] || 0;
    const r = rng(hashOf(f.id + ":" + weekIndex(game) + ":ring"));
    const score = f.rel + weeks + ringK + spot + sc.score - (plan && plan.late > 0.5 ? 6 : 0);
    const yes = score >= 92 + r() * 10;
    sc.said.push("Take out the ring");
    sc.step = sc.keys.length;
    if (plan) plan.status = "done";
    f.dates = (f.dates || 0) + 1;
    f.last = weekIndex(game);
    if (yes) {
      f.stage = "engaged";
      f.rel = clamp(f.rel + 10, 0, 100);
      f.ring = pp.ring;
      pp.ring = null;
      f.engagedAt = weekIndex(game);
      c.cond.morale = clamp(c.cond.morale + 8, 5, 99);
      if (c.life) c.life.followers = Math.round(c.life.followers * 1.04);
      K.news(game, me(game).name + " is engaged to " + f.name + ".", "life");
      msg(game, "mum", "Mum", "ENGAGED?! I am crying. Bring her home this weekend. I want to meet my daughter in law properly.");
      msg(game, "f:" + f.id, f.name, "I keep looking at my hand 💍 I love you");
      sc.result = { res: "great", text: pickR(r, S.PROPOSAL.yes), rel: Math.round(f.rel), stage: S.STAGE_WORD.engaged, proposal: "yes" };
    } else {
      f.rel = clamp(f.rel - 12, 0, 100);
      c.cond.morale = clamp(c.cond.morale - 5, 5, 99);
      sc.result = { res: "bad", text: pickR(r, S.PROPOSAL.no), rel: Math.round(f.rel), stage: S.STAGE_WORD[f.stage], proposal: "no" };
    }
    return { ok: true };
  }
  // ---------- the wedding ----------
  function suit(seed) {
    const r = rng(seed ^ 0x1234567);
    const col = pickR(r, ["#1d2230", "#2a2a30", "#1b2a3a", "#3a3a40"]);
    return { shirt: col, trim: "#f4f4f4", shorts: col, socks: col, bottom: "trousers", sleeve: true, plain: true, shoe: ["#111111", "#080808"] };
  }
  function guestsOf(game, size) {
    const c = C(game), pp = P(game);
    const ind = india(game);
    const skin = c.look && typeof c.look.skinF === "number" ? c.look.skinF : 0.5;
    const out = [];
    const person = (id, name, fem, seed, kin) => {
      const b = bodyOf(seed, fem, ind, true);
      if (kin) b.look.skinF = clamp(skin + ((seed % 7) - 3) * 0.02, 0, 1);
      if (kin && !fem) b.look.hairCol = 6;
      const cl = fem ? clothesOf(seed, true, "night", null) : suit(seed);
      out.push({ id, name, first: name.split(" ")[0], kind: "guest", role: "Guest", fem, look: b.look, outfit: cl, h: b.h, w: b.w, rel: null, num: false, trait: "", likes: [] });
    };
    person("g:mum", "Mum", true, hashOf(c.person.last + "mum"), true);
    person("g:dad", "Dad", false, hashOf(c.person.last + "dad"), true);
    if (pp.sib) person("g:sib", pp.sib.name, pp.sib.kind === "sister", hashOf(c.person.last + "sib"), true);
    const n = S.WEDDINGS[size].guests;
    const friends = Object.values(pp.friends).filter(f => f.kind !== "date" && f.rel >= 45).sort((a, b) => b.rel - a.rel);
    for (const f of friends) {
      if (out.length >= n) break;
      const who = find(game, f.id);
      if (!who) continue;
      out.push(Object.assign(viewOf(game, who), { kind: "guest", role: "Guest", outfit: who.fem ? who.night || clothesOf(hashOf(who.id), true, "night", null) : suit(hashOf(who.id)) }));
    }
    // a bigger wedding fills up with the squad and both families
    for (let i = 0; out.length < n; i++) {
      const fem = i % 2 === 1;
      const r = rng(hashOf(c.person.last + ":guest:" + i));
      const first = fem ? pickR(r, ind ? S.GIRLS_IN : S.GIRLS_W) : pickR(r, ind ? D.IN_FIRST : S.BOYS_W);
      person("g:" + i, first, fem, hashOf(c.person.last + ":guest:" + i), false);
    }
    return out;
  }
  function planWedding(game, size) {
    const c = C(game), pp = P(game);
    const pt = partnerOf(game);
    const w = S.WEDDINGS[size];
    if (!pt || pt.stage !== "engaged") return { error: "You need to be engaged first." };
    if (!w) return { error: "Pick how big." };
    if (pp.wedding && pp.wedding.status !== "done") return { error: "The wedding is already planned." };
    if (w.cost > c.money.cash) return { error: "Not enough money for a wedding that size." };
    pp.wedding = { size, cost: w.cost, status: "today", w: weekIndex(game), who: pt.id };
    msg(game, "f:" + pt.id, pt.name, size === "huge" ? "A wedding by the sea with everyone we know?! I cannot breathe 😭💍" : size === "big" ? "Everyone we love in one room ❤️" : "Just us and the people who matter. Perfect ❤️");
    return { ok: true, text: "The wedding is booked: " + w.label.split(":")[0].toLowerCase() + ". It is today. Go and get ready." };
  }
  function wedStart(game) {
    const pp = P(game), wd = pp.wedding;
    if (!wd || wd.status !== "today") return { error: "No wedding today." };
    wd.status = "on";
    pp.wscene = { step: 0, said: [], score: 0, beat: null, result: null, size: wd.size };
    const b = S.WED_BEATS[0];
    pp.wscene.beat = { t: b.t, choices: b.c.map(([id, label]) => ({ id, label })) };
    return { ok: true };
  }
  function wedSay(game, choice) {
    const c = C(game), pp = P(game), sc = pp.wscene, wd = pp.wedding;
    if (!sc || sc.result || !wd) return { error: "Nothing to answer." };
    const b = S.WED_BEATS[sc.step];
    const ch = b.c.find(x => x[0] === choice);
    if (!ch) return { error: "Pick one." };
    const f = pp.friends[wd.who];
    const tr = f.trait;
    sc.score += choice === "own" ? (tr === "kind" || tr === "shy" || tr === "creative" ? 6 : 4) : choice === "laugh" ? (tr === "funny" || tr === "outgoing" ? 6 : 2) : choice === "show" ? ((f.likes || []).includes("dance") ? 6 : 3) : choice === "all" ? (tr === "outgoing" ? 6 : 3) : 3;
    sc.said.push(ch[1]);
    sc.step++;
    if (sc.step < S.WED_BEATS.length) { const nb = S.WED_BEATS[sc.step]; sc.beat = { t: nb.t, choices: nb.c.map(([id, label]) => ({ id, label })) }; return { ok: true }; }
    // married
    const w = S.WEDDINGS[wd.size];
    K.money(game, -w.cost, "The wedding");
    f.stage = "married";
    f.rel = clamp(f.rel + 8 + Math.round(sc.score / 3), 0, 100);
    f.marriedAt = weekIndex(game);
    c.cond.morale = clamp(c.cond.morale + 10, 5, 99);
    c.cond.confidence = clamp(c.cond.confidence + 3, 5, 99);
    if (c.life) c.life.followers = Math.round(c.life.followers * (1 + w.buzz));
    c.rep.commercial = clamp(c.rep.commercial + (wd.size === "huge" ? 5 : wd.size === "big" ? 2 : 0), 0, 100);
    K.news(game, me(game).name + " marries " + f.name + (wd.size === "huge" ? " in a wedding by the sea. The photos are everywhere." : wd.size === "big" ? " in front of family, friends and half the squad." : " in a small ceremony with family and close friends."), "life");
    K.people.rel(game, "mum", 4); K.people.rel(game, "dad", 4);
    msg(game, "dad", "Dad", "I watched my son get married today. Look after each other.");
    msg(game, "f:" + f.id, f.name, "Hello, husband 💍❤️");
    wd.status = "done";
    sc.result = { res: "great", text: "Married. Everyone is on their feet, and " + f.first + " will not let go of your hand.", rel: Math.round(f.rel), stage: S.STAGE_WORD.married };
    return { ok: true };
  }
  // he moves for football: someone he is with has a say
  function onMove(game, fromCity) {
    const c = C(game);
    const pt = partnerOf(game);
    if (!pt || !fromCity || fromCity === c.city) return;
    const abroad = (L.CITY_COUNTRY[c.city] || "") !== (L.CITY_COUNTRY[fromCity] || "");
    if (pt.stage === "married" || pt.stage === "engaged") {
      if (!abroad || pt.rel >= 60) { pt.rel = clamp(pt.rel - (abroad ? 3 : 1), 0, 100); msg(game, "f:" + pt.id, pt.name, abroad ? "New country, new language, same us. I am already packing 🧳" : "A new city! I will find us a place with a good kitchen."); }
      else { pt.rel = clamp(pt.rel - 12, 0, 100); msg(game, "f:" + pt.id, pt.name, "You signed without even really asking me. I left my whole life for this."); }
    } else {
      pt.rel = clamp(pt.rel - 6, 0, 100);
      msg(game, "f:" + pt.id, pt.name, "So it is long distance now. We will make it work. Won't we?");
    }
  }
  function breakUp(game, id) {
    const c = C(game), pp = P(game);
    const f = pp.friends[id];
    if (!f || f.kind !== "date" || f.stage === "ex" || f.stage === "met") return { error: "Nothing to end." };
    if (f.stage === "married") return { error: "That is a much bigger conversation." };
    const was = f.stage;
    f.stage = "ex";
    f.rel = clamp(f.rel - 30, 0, 100);
    if (pp.partner === id) pp.partner = null;
    if (pp.plan && pp.plan.id === id) pp.plan = null;
    if (was !== "talking") c.cond.morale = clamp(c.cond.morale - 4, 5, 99);
    msg(game, "f:" + id, f.name, was === "talking" ? "Okay. Take care." : "I hope football is worth it.");
    if (was === "engaged" || was === "serious") K.news(game, me(game).name + " and " + f.name + " have split up.", "life");
    return { ok: true, text: "It is over with " + f.first + "." };
  }
  // a present for her: anything from the shops, bought for her instead of for him
  function gift(game, place, itemId) {
    const c = C(game), pp = P(game);
    const pt = partnerOf(game);
    if (!pt) return { error: "Nobody to buy it for." };
    const it = L.ALL_ITEMS.find(x => x.id === itemId && (x.store === place || place === "watches" || place === "mall"));
    if (!it) return { error: "That is not sold here." };
    if (it.price > c.money.cash) return { error: "Not enough money." };
    K.money(game, -it.price, "A present for " + pt.first);
    const wk = weekIndex(game);
    // a thoughtful present means more than an expensive one, and the second one in a week less
    const big = Math.log10(Math.max(10, it.price) / 50);
    let d = clamp(4 + big * 4, 3, 14);
    if ((pt.likes || []).includes("fashion") && ["top", "bottom", "shoes", "outer", "bag"].includes(it.cat)) d += 3;
    if ((it.cat === "watch" || it.cat === "jewellery") && pt.stage !== "talking") d += 2;
    if (pt.giftW === wk) d = Math.round(d / 2);
    pt.giftW = wk;
    pt.rel = clamp(pt.rel + d, 0, 100);
    pt.last = wk;
    msg(game, "f:" + pt.id, pt.name, d >= 10 ? "You did NOT have to do that 😍" : "Aww, thank you 🥰");
    return { ok: true, text: "A " + it.brand + " " + it.label.toLowerCase() + " for " + pt.first + "." };
  }

  // a text back: thread "f:<id>", the message, the reply
  function textBack(game, arg) {
    const c = C(game), pp = P(game);
    const [thread, mi, ri] = String(arg || "").split("|");
    const t = c.phone.threads[thread];
    const m = t && t.msgs[Number(mi)];
    if (!m || !m.replies || m.answered !== undefined || m.expired) return { error: "Nothing to reply to." };
    const rep = m.replies[Number(ri)];
    if (!rep) return { error: "Pick a reply." };
    m.answered = Number(ri);
    const id = thread.slice(2);
    const f = pp.friends[id];
    if (f) { f.rel = clamp(f.rel + rep.d, 0, 100); f.last = weekIndex(game); }
    t.msgs.push({ from: "You", text: rep.label, s: game.season, w: game.round, read: true, mine: true });
    if (t.msgs.length > 40) t.msgs.splice(0, t.msgs.length - 40);
    return { ok: true, text: "Sent." };
  }

  // the place's actions: talk to someone, answer, swap numbers, hang out, leave them be
  function act(game, place, action, arg, ctx) {
    const pp = P(game);
    if (action === "talk") return startTalk(game, place, String(arg || ""));
    if (action === "say") {
      const t = pp.talk;
      if (t && t.said && ["number", "hang", "bye"].includes(arg)) {
        if (arg === "number") return swap(game, t.id);
        if (arg === "hang") { const r = hang(game, t.id, ctx); if (!r.error) pp.talk = null; return r; }
        pp.talk = null;
        return { ok: true };
      }
      return say(game, String(arg || ""));
    }
    if (action === "bye") { pp.talk = null; return { ok: true }; }
    if (action === "askout") return askOut(game, arg, ctx);
    if (action === "pickup") return pickUp(game, arg);
    if (action === "date") return startDate(game, place, arg);
    if (action === "datesay") return dateSay(game, String(arg || ""));
    if (action === "dateend") { const sc = pp.scene; pp.scene = null; if (sc && !sc.result) { const f = pp.friends[sc.id]; if (f) { f.rel = clamp(f.rel - 10, 0, 100); msg(game, "f:" + f.id, f.name, "You just left?"); } if (pp.plan) pp.plan.status = "done"; } return { ok: true }; }
    if (action === "breakup") return breakUp(game, String(arg || ""));
    if (action === "ring") return buyRing(game, String(arg || ""));
    if (action === "wedding") return planWedding(game, String(arg || ""));
    if (action === "wedstart") return wedStart(game);
    if (action === "wedsay") return wedSay(game, String(arg || ""));
    if (action === "wedend") { pp.wscene = null; return { ok: true }; }
    if (action === "gift") return gift(game, place, String(arg || ""));
    if (action === "number") return swap(game, String(arg || ""));
    if (action === "hang") return hang(game, String(arg || ""), ctx);
    if (action === "text") return textBack(game, arg);
    return { error: "You cannot do that here." };
  }

  // ---------- each week: friends text, neglect shows, good friends lift him ----------
  function weekly(game) {
    const c = C(game), pp = P(game);
    pp.talk = null;
    pp.scene = null;
    const wk = weekIndex(game);
    const list = Object.values(pp.friends);
    // a date that never happened: she was stood up
    if (pp.plan && pp.plan.status !== "done" && pp.plan.w < wk) {
      const f = pp.friends[pp.plan.id];
      if (f) { f.rel = clamp(f.rel - 15, 0, 100); msg(game, "f:" + f.id, f.name, "I waited an hour. Thanks for nothing."); }
      pp.plan = null;
    } else if (pp.plan && pp.plan.status === "done") pp.plan = null;
    for (const f of list) {
      if (f.kind !== "date" || f.stage === "ex" || f.stage === "met") continue;
      const t = c.phone.threads["f:" + f.id];
      if (t) for (const m of t.msgs) if (m.replies && m.answered === undefined && !m.expired && (m.s * 40 + m.w) < wk - 1) { m.expired = true; f.rel = clamp(f.rel - 4, 0, 100); }
      const quiet = wk - f.last;
      const together = f.stage !== "talking";
      // someone you are with notices when you go quiet
      if (together && quiet >= 3) f.rel = clamp(f.rel - (f.stage === "married" ? 1 : 2), 0, 100);
      if (!together && quiet >= 4) f.rel = clamp(f.rel - 1, 0, 100);
      const r = rng(hashOf(f.id + ":" + wk + ":her"));
      const pool = together && quiet >= 3 ? S.HER_TEXTS.neglect : f.stage === "married" ? S.MARRIED_TEXTS : together ? S.HER_TEXTS.dating : S.HER_TEXTS.talking;
      if (r() < (together ? 0.55 : 0.3)) { const tx = pickR(r, pool); msg(game, "f:" + f.id, f.name, tx.t, { replies: tx.r.map(([label, d]) => ({ label, d })) }); }
      // getting serious: weeks together, good dates, and how she feels
      if (f.stage === "dating" && f.rel >= 75 && (f.good || 0) >= 4 && wk - (f.since || wk) >= 6) {
        f.stage = "serious";
        msg(game, "f:" + f.id, f.name, "My mum wants to meet you. That means it is serious now, you know 😊");
        if (c.rep.national > 40) K.news(game, me(game).name + " is in a relationship with " + f.name + ".", "life");
      }
      // she ends it
      if (together && f.stage !== "married" && f.stage !== "engaged" && f.rel < 18) {
        f.stage = "ex";
        if (pp.partner === f.id) pp.partner = null;
        c.cond.morale = clamp(c.cond.morale - 6, 5, 99);
        msg(game, "f:" + f.id, f.name, "I think we want different things. Take care of yourself.");
      }
    }
    // being with someone who is good for you steadies him; a good marriage most of all
    const pt = partnerOf(game);
    if (pt) c.cond.morale = clamp(c.cond.morale + (pt.rel - 55) * (pt.stage === "married" ? 0.03 : 0.02), 5, 99);
    // a good marriage is a settled life: his form drifts a little towards steady, up or down
    if (pt && pt.stage === "married" && pt.rel >= 65) c.cond.form = clamp(c.cond.form + (7 - c.cond.form) * 0.04, 3, 10);
    if (pp.wedding && pp.wedding.status === "done") pp.wedding = null;
    // a wedding booked and never held is moved on (the money was never spent)
    if (pp.wedding && pp.wedding.w < wk - 1) pp.wedding = null;
    for (const f of list) {
      if (f.kind === "date") continue;
      const t = c.phone.threads["f:" + f.id];
      // a text left unanswered for a week stings a little
      if (t) for (const m of t.msgs) if (m.replies && m.answered === undefined && !m.expired && (m.s * 40 + m.w) < wk - 1) { m.expired = true; f.rel = clamp(f.rel - 3, 0, 100); }
      // out of touch for months: it fades
      if (wk - f.last > 8 && f.rel > 35) f.rel -= 1;
      if (!f.num) continue;
      const r = rng(hashOf(f.id + ":" + wk + ":txt"));
      if (r() > 0.2 + f.rel / 320) continue;
      const here = roleOf(game, f).startsWith("Friend from") ? "oldfriend" : f.kind === "teammate" ? "teammate" : "classmate";
      const tx = pickR(r, S.TEXTS[here]);
      msg(game, "f:" + f.id, f.name, tx.t, { replies: tx.r.map(([label, d]) => ({ label, d })) });
    }
    // the friends he is closest to lift his mood, or their absence weighs a little
    const top = list.filter(f => f.kind !== "date").map(f => f.rel).sort((a, b) => b - a).slice(0, 3);
    if (top.length) c.cond.morale = clamp(c.cond.morale + (top.reduce((a, b) => a + b, 0) / top.length - 50) * 0.008, 5, 99);
  }
  // after a match: a close friend sometimes says they watched
  function afterMatch(game, m) {
    const pp = P(game);
    if (!m || !m.mins) return;
    const big0 = (m.g || 0) >= 1 || (m.rating || 0) >= 7.6;
    const pt = partnerOf(game);
    if (pt && rng(hashOf(pt.id + ":" + weekIndex(game) + ":pm"))() < 0.45) {
      const there = pt.stage === "married" || pt.stage === "engaged";
      msg(game, "f:" + pt.id, pt.name, there ? (big0 ? "Family section went MAD when you scored. I lost my voice 😂❤️" : "I was in the family section. You gave everything. Come home ❤️") : big0 ? "I screamed when you scored. The whole row stared at me 😂❤️" : "Proud of you whatever the score. Come home and rest ❤️");
      if (there) C(game).cond.morale = clamp(C(game).cond.morale + 1, 5, 99);
      return;
    }
    const best = Object.values(pp.friends).filter(f => f.kind !== "date" && f.num && f.rel >= 60).sort((a, b) => b.rel - a.rel)[0];
    if (!best) return;
    const r = rng(hashOf(best.id + ":" + weekIndex(game) + ":m"));
    if (r() > 0.3) return;
    const big = (m.g || 0) >= 1 || (m.rating || 0) >= 7.6;
    msg(game, "f:" + best.id, best.name, big ? "We were all watching. You were unreal 🔥" : "Watched the game. Next week is yours 💪");
  }
  // the friend a life event is about: the closest one he has
  function closest(game, min) {
    const pp = P(game);
    return Object.values(pp.friends).filter(f => f.kind !== "date" && f.rel >= (min || 55)).sort((a, b) => b.rel - a.rel)[0] || null;
  }
  // the one he is with (for the life events about her)
  function partner(game, min) { const pt = partnerOf(game); return pt && pt.rel >= (min || 0) ? pt : null; }

  function view(game) {
    const pp = P(game);
    const friends = Object.values(pp.friends).filter(f => f.kind !== "date" && (f.rel >= 35 || f.num)).sort((a, b) => b.rel - a.rel).slice(0, 12)
      .map(f => ({ id: f.id, name: f.name, role: roleOf(game, f), level: level(f.rel), rel: Math.round(f.rel), num: f.num, fem: f.fem, trait: S.TRAITS[f.trait] ? S.TRAITS[f.trait].word : "", likes: (f.likes || []).map(x => S.LIKE_WORD[x]), hung: f.hangW === weekIndex(game) }));
    return { friends, present: present(game), talk: pp.talk || null, dating: datingView(game) };
  }

  function datingView(game) {
    const pp = P(game);
    const who = f => {
      const b = find(game, f.id) || {};
      return { id: f.id, name: f.name, first: f.first, stage: f.stage, stageWord: S.STAGE_WORD[f.stage] || "", rel: Math.round(f.rel), dates: f.dates || 0, age: f.age, trait: S.TRAITS[f.trait] ? S.TRAITS[f.trait].word : "", likes: (f.likes || []).map(x => S.LIKE_WORD[x]), look: b.look, outfit: b.outfit, night: b.night, h: b.h, w: b.w, seed: hashOf(f.id) % 100000 };
    };
    const pt = partnerOf(game);
    const contacts = Object.values(pp.friends).filter(f => f.kind === "date" && f.num && f.stage !== "ex" && f.id !== pp.partner).sort((a, b) => b.rel - a.rel).slice(0, 8).map(who);
    const plan = pp.plan && pp.plan.status !== "done" ? Object.assign({}, pp.plan, { who: who(pp.friends[pp.plan.id]), label: S.DATE_VENUES[pp.plan.venue].label, at: clock(pp.plan.hour) }) : null;
    return {
      eligible: eligible(game), partner: pt ? Object.assign(who(pt), { ring: pt.ring ? pt.ring.label : null }) : null, contacts, plan, scene: pp.scene || null,
      venues: Object.entries(S.DATE_VENUES).map(([id, v]) => ({ id, label: v.label })),
      ring: pp.ring || null, rings: S.RINGS,
      weddings: Object.entries(S.WEDDINGS).map(([id, w]) => ({ id, label: w.label, cost: w.cost })),
      wedding: pp.wedding ? Object.assign({}, pp.wedding) : null, wscene: pp.wscene || null
    };
  }

  // the battery's hook (only reachable with FL_TEST_HOOKS=1): "<id>|<stage>|<rel>|<good dates>|<weeks together>"
  function testSet(game, arg) {
    const pp = P(game);
    const [id, stage, rel, good, weeks] = arg.split("|");
    const who = find(game, id);
    if (!who) return { error: "No such person." };
    const f = F(game, who);
    if (stage) f.stage = stage;
    if (rel) f.rel = Number(rel);
    if (good) f.good = Number(good);
    if (weeks) f.since = weekIndex(game) - Number(weeks);
    f.num = true;
    if (["dating", "serious", "engaged", "married"].includes(f.stage)) pp.partner = f.id;
    return { ok: true };
  }

  return { act, weekly, afterMatch, view, present, roster, closest, partner, find, F, eligible, testSet, onMove };
}

module.exports = { makeSocial };
