// Player Career: the life layer. The city he lives in, his home, his car, the shops, the gym, the restaurant,
// free time in the week, social media, sponsors, savings and the weather. Small numbers, kept on the save.
const L = require("./life_data");
const D = require("./data");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = () => Math.random();
const pick = a => a[Math.floor(Math.random() * a.length)];

// the boots each made up brand makes (the creator's boot models, by the rig's boot index)
const BOOTS_OF = { Apex: [6, 9], Korra: [7, 11], "Valoré": [8, 12], Tidal: [10, 13] };
// free time: what is left of a week after training and matches
const FREE_TIME = 3;
// the season starts in August; round 0 is the first week of August
const monthOf = round => ((7 + Math.floor(round / 4.35)) % 12) + 1;

function makeLife(K) {
  const { C, me, msg, news, money, trainOne, cityOf } = K;

  function L0(game) {
    const c = C(game);
    if (!c.life) {
      c.life = {
        home: { id: "family", city: c.person.city || c.city, mode: "family" },
        owned: [], cars: [], car: null, items: [], wearing: {},
        followers: Math.round(250 + rnd() * 250), posts: [], postedAt: -1,
        sponsors: [], sponsorOffers: [], savings: 0,
        time: FREE_TIME, weather: null, lastWeek: -1, done: []
      };
      // what he picked in the creator is his already
      for (const k of ["watch", "necklace", "earrings", "bracelet", "headband"]) if (c.look && c.look[k]) c.life.wearing[k] = c.look[k];
    }
    return c.life;
  }
  const weekIndex = game => game.season * 40 + game.round;
  const homeOf = id => L.HOMES.find(h => h.id === id) || L.HOMES[0];
  const carOf = id => L.CARS.find(x => x.id === id) || null;
  const hometown = c => c.hometown || (D.COUNTRIES[c.person.country] || {}).city || c.city;

  // ---------- the city ----------
  function styleOf(city, country) {
    if (L.CITY_STYLE[city]) return Object.assign({ key: city }, L.CITY_STYLE[city]);
    const near = L.COUNTRY_STYLE[country];
    const base = near && L.CITY_STYLE[near] ? L.CITY_STYLE[near] : L.CITY_STYLE.default;
    return Object.assign({ key: near || "default" }, base, { districts: base.districts });
  }
  function cityCountry(game) {
    const c = C(game), p = me(game);
    const cl = p.club && game.clubs[p.club];
    if (!cl) return c.person.country;
    const lg = cl.league;
    const map = { "Premier League": "England", Championship: "England", "La Liga": "Spain", "Serie A": "Italy", Bundesliga: "Germany", "Ligue 1": "France", "Primeira Liga": "Portugal", Eredivisie: "Netherlands", "Saudi Pro League": "Saudi Arabia", "Scottish Premiership": "Scotland", "Super Lig": "Turkey", MLS: "USA", [D.ISL_NAME]: "India" };
    return map[lg] || c.person.country;
  }
  // made up names for the places in this city, the same every time for the same city
  function placeNames(city) {
    let h = 0;
    for (const ch of String(city)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const at = (list, k) => list[(h + k * 7) % list.length];
    return { restaurant: at(L.PLACE_NAMES.restaurant, 1), gym: at(L.PLACE_NAMES.gym, 2), mall: at(L.PLACE_NAMES.mall, 3), shops: at(L.PLACE_NAMES.shops, 4) };
  }
  function pickWeather(game) {
    const c = C(game);
    const st = styleOf(c.city, cityCountry(game));
    const cl = L.CLIMATE[st.climate] || L.CLIMATE.temperate;
    const m = monthOf(game.round);
    let kind = cl.months[m] && rnd() < 0.7 ? cl.months[m] : pick(cl.base);
    const warm = Math.cos(((m - 7) / 12) * Math.PI * 2) * 0.5 + 0.5;
    const temp = Math.round(cl.temp[0] + (cl.temp[1] - cl.temp[0]) * (warm * 0.8 + rnd() * 0.2));
    if (kind === "snow" && temp > 4) kind = "rain";
    return { kind, temp, month: m };
  }

  // ---------- a week of life: bills, sponsors, followers, savings, the weather ----------
  function weekly(game) {
    const c = C(game), life = L0(game), p = me(game);
    const wk = weekIndex(game);
    if (life.lastWeek === wk) return;
    life.lastWeek = wk;
    life.time = FREE_TIME;
    life.done = [];
    life.weather = pickWeather(game);
    relocate(game);
    // the home and the car
    const h = homeOf(life.home.id);
    if (life.home.mode === "rent" && h.rent) money(game, -h.rent, "Rent, " + h.label.toLowerCase());
    if (life.home.mode === "own" && h.upkeep) money(game, -h.upkeep, "Upkeep, " + h.label.toLowerCase());
    const car = carOf(life.car);
    if (car) money(game, -car.upkeep, "Car costs, " + car.brand + " " + car.model);
    // food and bills grow with the lifestyle
    const bills = c.contract ? Math.round(40 + Math.min(900, c.contract.wage * 0.04) + h.tier * 25) : 0;
    if (bills) money(game, -bills, "Food and bills");
    // sponsors pay every week while the deal runs
    for (const s of life.sponsors) {
      if (s.weeksLeft <= 0) continue;
      money(game, s.weekly, "Sponsor, " + s.brand);
      const cut = K.agentCut ? K.agentCut(game) : 0;
      if (cut) money(game, -Math.round(s.weekly * cut), "Agent's cut, " + s.brand);
      s.weeksLeft--;
      if (s.weeksLeft === 0) {
        msg(game, "agent", c.agent ? "Agent" : "Brand team", s.brand + " deal has run its course. If your name keeps growing, the next one will be bigger.");
      }
    }
    life.sponsors = life.sponsors.filter(s => s.weeksLeft > 0);
    // savings earn a little; debt costs a lot
    if (life.savings > 0) {
      const i = Math.round(life.savings * 0.0006);
      if (i > 0) { life.savings += i; c.money.earned = Math.round((c.money.earned || 0) + i); }
    }
    if (c.money.cash < 0) {
      if (life.savings > 0) {
        const take = Math.min(life.savings, -c.money.cash);
        life.savings -= take;
        c.money.cash += take;
      }
      if (c.money.cash < 0 && life.home.mode === "rent" && h.tier >= 2) {
        const down = L.HOMES.slice().reverse().find(x => x.rent > 0 && x.tier < h.tier && x.rent * 3 <= Math.max(60, (c.contract ? c.contract.wage : 0)));
        if (down) { life.home = { id: down.id, city: c.city, mode: "rent" }; msg(game, "agent", "Bank", "Your account went into the red, so you moved to a " + down.label.toLowerCase() + " to cut the rent."); }
      }
    }
    // the name grows: followers follow fame, commercial pull follows followers and the flash
    const fame = c.rep.local * 0.2 + c.rep.national * 0.35 + c.rep.international * 0.6 + (c.captain ? 4 : 0);
    const target = 300 * Math.exp(fame * 0.105);
    life.followers = Math.max(50, Math.round(life.followers + (target - life.followers) * 0.05));
    const flash = (carOf(life.car) || { flash: 0 }).flash + life.items.map(id => (L.ITEMS.find(x => x.id === id) || {}).flash || 0).reduce((a, b) => a + b, 0) * 0.3 + homeOf(life.home.id).tier;
    const cTarget = clamp(Math.log10(Math.max(10, life.followers)) * 14 - 32 + flash * 0.6 + life.sponsors.length * 1.5, 0, 100);
    c.rep.commercial = clamp(c.rep.commercial + (cTarget - c.rep.commercial) * 0.06, 0, 100);
    // a nice home lifts the mood; an empty account sinks it
    c.cond.morale = clamp(c.cond.morale + h.mood * 0.12 + (c.money.cash < 0 ? -1.5 : 0), 5, 99);
    sponsorKnock(game);
  }

  // a move to a new city: a place to live is sorted, the family home stays where the family is
  function relocate(game) {
    const c = C(game), life = L0(game);
    if (life.home.city === c.city) return;
    const own = life.owned.find(o => o.city === c.city);
    if (own) { life.home = { id: own.id, city: c.city, mode: "own" }; return; }
    if (c.city === hometown(c)) { life.home = { id: "family", city: c.city, mode: "family" }; return; }
    // a student or an academy boy gets a room with the team
    if (c.stage !== "pro") { life.home = { id: "hostel", city: c.city, mode: "family" }; return; }
    const wage = c.contract ? c.contract.wage : 0;
    const fit = L.HOMES.slice().reverse().find(h => h.rent > 0 && h.tier <= 3 && h.rent * 4 <= wage) || homeOf("shared");
    life.home = { id: fit.id, city: c.city, mode: "rent" };
    msg(game, "agent", c.agent ? "Agent" : "Club liaison", "Found you a " + fit.label.toLowerCase() + " in " + c.city + ". Move in whenever you like. You can always change it from home.");
  }

  // brands knock when his name is big enough
  function sponsorKnock(game) {
    const c = C(game), life = L0(game);
    if (life.sponsorOffers.length >= 2 || rnd() > 0.12) return;
    const wk = weekIndex(game);
    const has = new Set(life.sponsors.map(s => s.id).concat(life.sponsorOffers.map(o => o.id)));
    const boots = life.sponsors.some(s => s.boots);
    const fits = L.SPONSORS.filter(s => c.rep.commercial >= s.need && !has.has(s.id) && !(s.boots && boots));
    if (!fits.length) return;
    const s = fits.sort((a, b) => b.need - a.need)[Math.floor(rnd() * Math.min(2, fits.length))];
    const ag = c.agent ? D.AGENTS.find(a => a.id === c.agent.id) : null;
    const weekly = Math.round(s.base * (0.8 + (c.rep.commercial - s.need) / 60) * (1 + (ag ? ag.sponsor * 0.02 : 0)) / 10) * 10;
    const weeks = 40 + Math.floor(rnd() * 3) * 20;
    life.sponsorOffers.push({ id: s.id, brand: s.brand, kind: s.kind, line: s.line, weekly, weeks, expires: wk + 4, boots: !!s.boots, gift: s.gift || null });
    msg(game, "agent", ag ? ag.name : "Brand team", s.brand + " (" + s.kind.toLowerCase() + ") want you. " + s.line + " Worth it, I think. It is on your phone.");
    news(game, s.brand + " want " + me(game).name + " as the face of their next campaign.", "life");
  }
  function sponsorAnswer(game, id, yes) {
    const c = C(game), life = L0(game);
    const o = life.sponsorOffers.find(x => x.id === id);
    if (!o) return { error: "That offer is gone." };
    life.sponsorOffers = life.sponsorOffers.filter(x => x.id !== id);
    if (!yes) return { ok: true };
    if (o.boots && life.sponsors.some(s => s.boots)) return { error: "You already wear someone's boots." };
    life.sponsors.push({ id: o.id, brand: o.brand, kind: o.kind, weekly: o.weekly, weeksLeft: o.weeks, boots: o.boots });
    // a boot deal means wearing their boots: the pair he has on changes to that brand's
    if (o.boots && BOOTS_OF[o.brand] && !BOOTS_OF[o.brand].includes(c.look.boot)) c.look.boot = BOOTS_OF[o.brand][0];
    if (o.gift) {
      const car = carOf(o.gift);
      if (car && !life.cars.includes(car.id)) { life.cars.push(car.id); if (!life.car || (carOf(life.car) || { tier: 0 }).tier < car.tier) life.car = car.id; }
      const item = L.ITEMS.find(x => x.id === o.gift);
      if (item && !life.items.includes(item.id)) { life.items.push(item.id); wear(game, item, true); }
    }
    c.rep.commercial = clamp(c.rep.commercial + 2, 0, 100);
    news(game, me(game).name + " signs with " + o.brand + ".", "life");
    return { ok: true };
  }

  // ---------- free time in the city ----------
  function spend(game, cost, label) {
    const c = C(game);
    if (cost > c.money.cash) return false;
    if (cost) money(game, -cost, label);
    return true;
  }
  function useTime(game, n) {
    const life = L0(game);
    if (life.time < n) return false;
    life.time -= n;
    return true;
  }
  function wear(game, item, on) {
    const c = C(game), life = L0(game);
    if (!item.look) return;
    for (const [k, v] of Object.entries(item.look)) {
      if (on) { life.wearing[k] = v; c.look[k] = v; }
      else if (life.wearing[k] === v) { delete life.wearing[k]; c.look[k] = null; }
    }
  }
  function act(game, place, action, arg) {
    const c = C(game), life = L0(game), p = me(game);
    const out = (text, extra) => { life.done.unshift({ place, action, text }); if (life.done.length > 6) life.done.length = 6; return Object.assign({ ok: true, text }, extra || {}); };
    if (c.retired) return { error: "Retired players have all the time in the world." };
    if (place === "home") {
      if (action === "rest") {
        if (!useTime(game, 1)) return { error: "No free time left this week." };
        const h = homeOf(life.home.id);
        c.cond.fatigue = clamp(c.cond.fatigue - (10 + h.tier * 1.5), 0, 100);
        c.cond.morale = clamp(c.cond.morale + 1.5, 5, 99);
        return out("Feet up, phone down. The legs feel fresher.");
      }
      if (action === "unwind") {
        if (!life.items.includes("console")) return { error: "You need something to play on first." };
        if (!useTime(game, 1)) return { error: "No free time left this week." };
        c.cond.morale = clamp(c.cond.morale + 4, 5, 99);
        c.cond.fatigue = clamp(c.cond.fatigue - 4, 0, 100);
        return out("Three hours online with the lads from the academy. You lost, a lot. Still a good night.");
      }
      if (action === "wear") {
        const item = L.ITEMS.find(x => x.id === arg);
        if (!item || !life.items.includes(item.id) || !item.look) return { error: "Nothing like that in the wardrobe." };
        const on = Object.entries(item.look).some(([k, v]) => life.wearing[k] !== v);
        wear(game, item, on);
        return out(on ? "Wearing the " + item.label + "." : "The " + item.label + " goes back in the drawer.");
      }
      if (action === "drive") {
        const car = carOf(arg);
        if (!car || !life.cars.includes(car.id)) return { error: "That car is not in your garage." };
        life.car = car.id;
        return out("The " + car.brand + " " + car.model + " is the daily now.");
      }
      if (action === "move") {
        const [id, mode] = String(arg || "").split(":");
        const h = homeOf(id);
        if (!h || h.id !== id) return { error: "No such home." };
        if (h.id === "family") {
          if (c.city !== hometown(c)) return { error: "The family home is back in " + hometown(c) + "." };
          life.home = { id: "family", city: c.city, mode: "family" };
          return out("Back home. Mum is thrilled. Your old posters are still up.");
        }
        if (p.age < 17) return { error: "Mum and Dad say: not until you are seventeen." };
        const wage = c.contract ? c.contract.wage : 0;
        if (mode === "buy") {
          if (!h.buy) return { error: "That one is only to rent." };
          if (life.owned.some(o => o.id === h.id && o.city === c.city)) { life.home = { id: h.id, city: c.city, mode: "own" }; return out("Home again."); }
          if (!spend(game, h.buy, "Bought a " + h.label.toLowerCase() + " in " + c.city)) return { error: "You cannot afford it yet." };
          life.owned.push({ id: h.id, city: c.city, price: h.buy });
          life.home = { id: h.id, city: c.city, mode: "own" };
          news(game, p.name + " buys a " + h.label.toLowerCase() + " in " + c.city + ".", "life");
          return out("The keys are yours. A " + h.label.toLowerCase() + " in " + c.city + ".");
        }
        if (!h.rent) return { error: "That one is not for rent." };
        if (h.rent * 3 > Math.max(wage, c.money.cash / 20)) return { error: "The agent will not rent it to you on your wage." };
        life.home = { id: h.id, city: c.city, mode: "rent" };
        return out("You rent a " + h.label.toLowerCase() + " in " + c.city + ". The first week is due on Monday.");
      }
      if (action === "sell") {
        const o = life.owned.find(x => x.id === arg && x.city === c.city) || life.owned.find(x => x.id === arg);
        if (!o) return { error: "You do not own that." };
        const back = Math.round(o.price * (0.85 + rnd() * 0.25));
        life.owned = life.owned.filter(x => x !== o);
        money(game, back, "Sold the " + homeOf(o.id).label.toLowerCase());
        if (life.home.id === o.id && life.home.city === o.city) { life.home = { id: "shared", city: c.city, mode: "rent" }; }
        return out("Sold for " + back + ".", { amount: back });
      }
      return { error: "You cannot do that at home." };
    }
    if (place === "gym") {
      const g = L.GYM.find(x => x.id === action);
      if (!g) return { error: "That is not on the gym menu." };
      if (c.cond.inj && g.id !== "spa") return { error: "The physio says no gym until the injury heals." };
      if (!useTime(game, 1)) return { error: "No free time left this week." };
      if (!spend(game, g.price, g.label)) { life.time++; return { error: "Not enough money." }; }
      const gains = {};
      for (const [k, v] of Object.entries(g.attrs)) gains[k] = trainOne(game, k, v);
      c.cond.fatigue = clamp(c.cond.fatigue + g.fatigue, 0, 100);
      if (g.mood) c.cond.morale = clamp(c.cond.morale + g.mood, 5, 99);
      if (g.risk && rnd() < g.risk * Math.pow(c.cond.fatigue / 60, 2)) {
        K.injure(game, 0.6);
        return out("A tweak in the last set. The physio has a look.", { gains });
      }
      return out(g.id === "spa" ? "Ice, heat, a massage. Brand new legs." : "Good session. You can feel it.", { gains });
    }
    if (place === "restaurant") {
      const m = L.MEALS.find(x => x.id === action);
      if (!m) return { error: "That is not on the menu." };
      if (!useTime(game, 1)) return { error: "No free time left this week." };
      if (!spend(game, m.price, "Dinner, " + placeNames(c.city).restaurant)) { life.time++; return { error: "Not enough money." }; }
      c.cond.fitness = clamp(c.cond.fitness + m.fitness, 30, 100);
      c.cond.fatigue = clamp(c.cond.fatigue + m.fatigue, 0, 100);
      c.cond.morale = clamp(c.cond.morale + m.morale, 5, 99);
      c.cond.form = clamp(c.cond.form + m.form, 3, 10);
      if (m.social) life.followers = Math.round(life.followers * (1 + m.social));
      return out(m.note);
    }
    if (place === "mall" || place === "shops") {
      if (action === "car") {
        const car = carOf(arg);
        if (!car) return { error: "No such car." };
        if (life.cars.includes(car.id)) return { error: "Already in your garage." };
        if (p.age < 18 && car.body !== "scooter") return { error: "You are not old enough to drive that." };
        if (!spend(game, car.price, car.brand + " " + car.model)) return { error: "You cannot afford it yet." };
        life.cars.push(car.id);
        life.car = car.id;
        c.cond.morale = clamp(c.cond.morale + 3 + car.tier, 5, 99);
        if (car.tier >= 4) news(game, p.name + " is spotted in a new " + car.brand + " " + car.model + ".", "life");
        return out("The " + car.brand + " " + car.model + " is yours.");
      }
      const item = L.ITEMS.find(x => x.id === arg && x.shop === place);
      if (action !== "buy" || !item) return { error: "They do not sell that here." };
      if (life.items.includes(item.id)) return { error: "You already have one." };
      if (!spend(game, item.price, item.label)) return { error: "Not enough money." };
      life.items.push(item.id);
      c.cond.morale = clamp(c.cond.morale + item.mood, 5, 99);
      if (item.look) wear(game, item, true);
      return out("Bought the " + item.label + ".");
    }
    if (place === "training") {
      const sid = action;
      const S = D.SESSIONS[sid];
      if (!S || sid === "rest") return { error: "That is not a session." };
      if (c.cond.inj && sid !== "recovery") return { error: "The physio says recovery work only." };
      if (!useTime(game, 1)) return { error: "No free time left this week." };
      const gains = {};
      for (const k of S.grows || []) gains[k] = trainOne(game, k, 0.6);
      c.cond.fatigue = clamp(c.cond.fatigue + (S.fatigue > 0 ? S.fatigue * 0.8 : S.fatigue), 0, 100);
      c.coachRel = clamp(c.coachRel + 0.6, 0, 100);
      c.traits.professionalism = clamp(c.traits.professionalism + 0.2, 0, 100);
      if (c.stage === "pro") c.trust = clamp(c.trust + 0.4, 0, 100);
      return out("Extra work after everyone else went home. The coaches noticed.", { gains });
    }
    if (place === "stadium") {
      if (action === "fans") {
        if (!useTime(game, 1)) return { error: "No free time left this week." };
        c.rep.local = clamp(c.rep.local + 1.5, 0, 100);
        life.followers = Math.round(life.followers * 1.01 + 20);
        c.cond.morale = clamp(c.cond.morale + 1, 5, 99);
        return out("Two hours of selfies and signatures. A kid cried when you signed his shirt.");
      }
      return { error: "Nothing to do there right now." };
    }
    return { error: "No such place." };
  }

  // ---------- social media ----------
  const COMMENTS = {
    good: ["What a player", "Best in the league, no debate", "My son wants your shirt for his birthday", "Ballon d'Or one day", "Never stop"],
    flat: ["Keep going bro", "Big game this weekend", "Need more from you", "Love from back home"],
    bad: ["Less posting, more training", "Focus on football mate", "Was that a holiday or a season", "Where was this energy on Saturday"]
  };
  function post(game, kind) {
    const c = C(game), life = L0(game), p = me(game);
    const P = L.POSTS.find(x => x.id === kind);
    if (!P) return { error: "No such post." };
    const wk = weekIndex(game);
    if (life.postedAt === wk) return { error: "One post a week is plenty. Your agent says so too." };
    const lastMatch = c.stats.log.find(m => m.mins > 0);
    if (P.needsMatch && !lastMatch) return { error: "No match to post about yet." };
    life.postedAt = wk;
    const form = c.cond.form;
    let mood = form >= 7 ? "good" : form < 6 ? "bad" : "flat";
    let mult = P.base * (1 + Math.max(0, form - 6.5) * 0.6);
    if (P.needsMatch && lastMatch) mult *= (lastMatch.rating || 6.5) >= 7.5 ? 2.2 : 0.8;
    let backlash = false;
    if (P.risk && form < 6.3 && rnd() < P.risk * 2.5) {
      backlash = true;
      mood = "bad";
      c.cond.morale = clamp(c.cond.morale - 4, 5, 99);
      if (c.stage === "pro") c.trust = clamp(c.trust - 2, 0, 100);
      news(game, "Fans hit out at " + p.name + " over a lifestyle post after a poor run.", "life");
    }
    const gain = Math.round(life.followers * mult + 10 + rnd() * 30);
    life.followers += gain;
    c.rep.commercial = clamp(c.rep.commercial + P.commercial * (backlash ? 0.3 : 1), 0, 100);
    if (P.local) c.rep.local = clamp(c.rep.local + P.local, 0, 100);
    const comments = [];
    const pool = COMMENTS[mood].slice();
    for (let i = 0; i < 3 && pool.length; i++) comments.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    const likes = Math.round(life.followers * (0.04 + rnd() * 0.05) * (mood === "good" ? 1.6 : mood === "bad" ? 0.7 : 1));
    const item = { s: game.season, w: game.round, kind, label: P.label, likes, gain, comments, backlash };
    life.posts.unshift(item);
    if (life.posts.length > 12) life.posts.length = 12;
    return { ok: true, post: item };
  }

  // ---------- the bank ----------
  function bank(game, op, amount) {
    const c = C(game), life = L0(game);
    const a = Math.round(Number(amount) || 0);
    if (a <= 0) return { error: "Pick an amount." };
    if (op === "save") {
      if (a > c.money.cash) return { error: "Not that much in the account." };
      c.money.cash -= a; life.savings += a;
      return { ok: true };
    }
    if (op === "take") {
      if (a > life.savings) return { error: "Not that much saved." };
      life.savings -= a; c.money.cash += a;
      return { ok: true };
    }
    return { error: "The bank does not do that." };
  }

  // ---------- what the screens get ----------
  function view(game) {
    const c = C(game), life = L0(game), p = me(game);
    if (!life.weather) life.weather = pickWeather(game);
    const h = homeOf(life.home.id);
    const car = carOf(life.car);
    const country = cityCountry(game);
    const wage = c.contract ? c.contract.wage : 0;
    const weeklyCost = (life.home.mode === "rent" ? h.rent : life.home.mode === "own" ? h.upkeep : 0) + (car ? car.upkeep : 0) + (c.contract ? Math.round(40 + Math.min(900, wage * 0.04) + h.tier * 25) : 0);
    return {
      city: c.city, hometown: hometown(c), style: styleOf(c.city, country), places: placeNames(c.city), weather: life.weather,
      time: life.time, freeTime: FREE_TIME, done: life.done,
      home: Object.assign({}, h, { mode: life.home.mode, city: life.home.city }),
      owned: life.owned.map(o => Object.assign({ city: o.city, price: o.price }, homeOf(o.id))),
      homes: L.HOMES.filter(x => x.id !== "hostel").map(x => ({ ...x, canRent: x.rent > 0 && x.rent * 3 <= Math.max(wage, c.money.cash / 20) && p.age >= 17, canBuy: x.buy > 0 && x.buy <= c.money.cash && p.age >= 17 })),
      car: car, cars: L.CARS.map(x => ({ ...x, owned: life.cars.includes(x.id), canBuy: !life.cars.includes(x.id) && x.price <= c.money.cash && (p.age >= 18 || x.body === "scooter") })),
      items: L.ITEMS.map(x => ({ ...x, owned: life.items.includes(x.id), wearing: !!x.look && Object.entries(x.look).every(([k, v]) => life.wearing[k] === v) })),
      meals: L.MEALS, gym: L.GYM, postKinds: L.POSTS,
      followers: life.followers, posts: life.posts.slice(0, 8), postedThisWeek: life.postedAt === weekIndex(game),
      sponsors: life.sponsors, sponsorOffers: life.sponsorOffers,
      savings: life.savings, weeklyCost
    };
  }
  // offers that sat too long go away
  function expire(game) {
    const life = L0(game);
    const wk = weekIndex(game);
    life.sponsorOffers = life.sponsorOffers.filter(o => o.expires >= wk);
  }

  return { L0, weekly, act, post, bank, sponsorAnswer, view, expire, styleOf, placeNames, FREE_TIME };
}

module.exports = { makeLife };
