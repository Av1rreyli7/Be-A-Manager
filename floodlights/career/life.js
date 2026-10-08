// Player Career: the life layer. The city he lives in (every shop, dealer, cafe, club and home as a real place),
// his home, his garage, his wardrobe, the gym, the restaurant, free time in the week, social media, sponsors,
// savings and the weather. Small numbers, kept on the save. Old saves keep working: every old id and every old
// act() call still does what it did.
const L = require("./life_data");
const D = require("./data");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = () => Math.random();
const pick = a => a[Math.floor(Math.random() * a.length)];

// the boots each brand makes, by the rig's boot index (the old made up brands stay so an old deal still works)
const BOOTS_OF = L.BOOT_BRANDS;
// free time: what is left of a week after training and matches
const FREE_TIME = 3;
// the season starts in August; round 0 is the first week of August
const monthOf = round => ((7 + Math.floor(round / 4.35)) % 12) + 1;
// what he wears in the city before he buys anything (the same as the home outfit on the client)
const BASE_OUTFIT = { shirt: "#e9e6df", trim: "#2a2d33", shorts: "#2a2d33", socks: "#2a2d33" };
// how many of the small things count in a week
const LIMIT = { cafe: 5, market: 10, fans: 3 };
// a watch that costs this much or more is a moment the first time
const BIG_WATCH = 5000;
const ITEM = Object.fromEntries(L.ALL_ITEMS.map(x => [x.id, x]));
const CAR = Object.fromEntries(L.ALL_CARS.map(x => [x.id, x]));
const SPONSOR = Object.fromEntries(L.SPONSORS.map(x => [x.id, x]));
const GROCERY = Object.fromEntries(L.GROCERIES.map(x => [x.id, x]));
const hashOf = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

function makeLife(K) {
  const { C, me, msg, news, money, trainOne } = K;

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
    if (c.life.v !== 2) upgrade(c);
    return c.life;
  }
  // an old save: the new fields, the old brand names on deals swapped for the real ones, the firsts it already had
  function upgrade(c) {
    const life = c.life;
    life.fit = life.fit || {};
    life.visited = life.visited || { city: c.city, ids: [] };
    life.carLog = life.carLog || {};
    life.moments = life.moments || [];
    life.wk = life.wk || { at: -1 };
    life.guard = life.guard || -1;
    if (life.baseBoot === undefined) life.baseBoot = c.look && Number.isFinite(c.look.boot) ? c.look.boot : 6;
    // diamonds were not a rig finish; they show as silver
    if (life.wearing.earrings === "diamond") { life.wearing.earrings = "silver"; if (c.look) c.look.earrings = "silver"; }
    for (const s of life.sponsors.concat(life.sponsorOffers)) if (SPONSOR[s.id]) s.brand = SPONSOR[s.id].brand;
    if (!life.firsts) {
      life.firsts = {};
      const items = life.items.map(id => ITEM[id]).filter(Boolean);
      if (items.some(x => x.brand === "Rolex")) life.firsts.rolex = true;
      if (items.some(x => x.cat === "watch" && x.price >= BIG_WATCH)) life.firsts.watch = true;
      if (items.some(x => x.brand === "Richard Mille")) life.firsts.rm = true;
      const cars = life.cars.map(id => CAR[id]).filter(Boolean);
      if (cars.some(x => x.body !== "scooter" && x.body !== "bike")) life.firsts.car = true;
      if (cars.some(isSupercar)) life.firsts.supercar = true;
      if (life.owned.length) life.firsts.home = true;
    }
    life.v = 2;
  }
  const isSupercar = car => car.brand === "Ferrari" || car.brand === "Lamborghini" || car.body === "hyper";
  const weekIndex = game => game.season * 40 + game.round;
  const homeOf = id => L.HOMES.find(h => h.id === id) || L.HOMES[0];
  const carOf = id => CAR[id] || null;
  const hometown = c => c.hometown || (D.COUNTRIES[c.person.country] || {}).city || c.city;
  const fameOf = c => Math.round(clamp(c.rep.commercial || 0, 0, 100));
  // this week's counters (cafe, supermarket, fans, the clinic)
  function week(game) {
    const life = L0(game), wk = weekIndex(game);
    if (!life.wk || life.wk.at !== wk) life.wk = { at: wk, cafe: 0, market: 0, fans: 0, treat: false, checkup: false };
    return life.wk;
  }

  // ---------- the city ----------
  function styleOf(city, country) {
    if (L.CITY_STYLE[city]) return Object.assign({ key: city }, L.CITY_STYLE[city]);
    const near = L.COUNTRY_STYLE[country];
    const base = near && L.CITY_STYLE[near] ? L.CITY_STYLE[near] : L.CITY_STYLE.default;
    return Object.assign({ key: near || "default" }, base, { districts: base.districts });
  }
  function cityCountry(game) {
    const c = C(game), p = me(game);
    if (L.CITY_COUNTRY[c.city]) return L.CITY_COUNTRY[c.city];
    const cl = p.club && game.clubs[p.club];
    if (!cl) return c.person.country;
    const lg = cl.league;
    const map = { "Premier League": "England", Championship: "England", "La Liga": "Spain", "Serie A": "Italy", Bundesliga: "Germany", "Ligue 1": "France", "Primeira Liga": "Portugal", Eredivisie: "Netherlands", "Saudi Pro League": "Saudi Arabia", "Scottish Premiership": "Scotland", "Super Lig": "Turkey", MLS: "USA", "Belgian Pro League": "Belgium", "Liga MX": "Mexico", Brasileirao: "Brazil", Argentina: "Argentina", [D.ISL_NAME]: "India" };
    return map[lg] || c.person.country;
  }
  function tierOf(city) {
    const info = L.CITY_INFO[city];
    if (info) return info.tier;
    return L.BIG_CITIES.includes(city) ? 2 : 1;
  }
  // the names of the old four places, now the real ones from the city's world
  function placeNames(city, country) {
    const w = buildWorld(city, country || L.CITY_COUNTRY[city] || "default", null);
    const name = id => (w.places.find(x => x.id === id) || {}).name || "";
    const info = L.CITY_INFO[city] || {}, ci = L.COUNTRY_INFO[country] || L.COUNTRY_INFO.default;
    return { restaurant: name("restaurant"), gym: name("gym"), mall: name("mall"), shops: info.row || ci.row || name("watches") };
  }

  // every place in the city he lives in, the same every time for the same city.
  // who: his club, his team, his home town and his homes (null for just the city)
  function buildWorld(city, country, who) {
    const seed = hashOf(city);
    const tier = tierOf(city);
    const info = L.CITY_INFO[city] || {};
    const ci = L.COUNTRY_INFO[country] || L.COUNTRY_INFO.default;
    const st = styleOf(city, country);
    const water = !!st.water;
    const at = (list, k) => list[(seed + k * 7) % list.length];
    const places = [];
    const add = p => { places.push(p); return p; };
    const chain = (name, vibe) => { const col = L.CHAIN_STYLE[name] || ["#2b2f36", "#ffffff"]; return vibe === "cosy" ? { floor: "#8a6a4a", wall: "#efe3cf", accent: col[0], trim: col[1], vibe } : { floor: "#f2f2f2", wall: "#ffffff", accent: col[0], trim: col[1], vibe }; };
    // homes: the family home in his home town, the team's rooms if that is where he sleeps, then one of each kind to buy or rent
    if (who && city === who.hometown) add({ id: "home:family", kind: "home", name: "The family home", where: "suburb", homeId: "family", style: L.PLACE_STYLE["home:family"], living: who.home.id === "family" && who.home.city === city });
    if (who && who.home.id === "hostel" && who.home.city === city) add({ id: "home:hostel", kind: "home", name: "Team residence", where: "outskirts", homeId: "hostel", style: L.PLACE_STYLE["home:hostel"], living: true });
    const d = st.districts || [];
    const spots = info.homes || [d[3], d[0], d[1], d[2], d[2]].map(x => x || city);
    const kinds = [["shared", "shared flat", "suburb"], ["apartment", "apartment", "centre"], ["penthouse", "penthouse", water ? "seafront" : "centre"], ["villa", "villa", "outskirts"], ["mansion", "mansion", "hill"]];
    kinds.forEach(([id, word, where], i) => {
      const h = homeOf(id);
      const owned = !!(who && who.owned.some(o => o.id === id && o.city === city));
      add({ id: "home:" + id, kind: "home", name: spots[i] + " " + word, where, homeId: id, style: L.PLACE_STYLE["home:" + id], owned, living: !!(who && who.home.id === id && who.home.city === city), price: h.buy || h.rent });
    });
    // the mall and the shops: more of them in a bigger city, the luxury houses only in the big ones
    const mallStores = [], street = [], luxury = [];
    for (const [id, s] of Object.entries(L.STORES)) {
      if (L.LUXURY.includes(id)) continue;
      if (s.tier > tier) continue;
      (s.row === "street" ? street : mallStores).push(id);
    }
    if (tier >= 3) luxury.push(...L.LUXURY);
    else if (tier === 2) { const a = seed % L.LUXURY.length; luxury.push(L.LUXURY[a], L.LUXURY[(a + 1 + (seed >>> 4) % (L.LUXURY.length - 1)) % L.LUXURY.length]); }
    const mallName = info.mall || (L.MALL_NAME[country] ? L.MALL_NAME[country](city) : city + " Central");
    const watchesIn = tier >= 3 ? "luxury" : "mall";
    const inside = mallStores.slice();
    if (watchesIn === "mall") inside.push("watches");
    add({ id: "mall", kind: "mall", name: mallName, where: "centre", style: L.PLACE_STYLE.mall, inside });
    const storePlace = (id, where) => {
      const s = L.STORES[id];
      const name = id === "store:tech" ? ci.tech : s.name;
      return add({ id, kind: "store", name, brand: id === "store:tech" ? ci.tech : s.brand, where, style: s.style });
    };
    for (const id of mallStores) storePlace(id, "mall");
    for (const id of street) storePlace(id, "street");
    for (const id of luxury) storePlace(id, "luxury");
    add({ id: "watches", kind: "watches", name: ci.watches, brand: ci.watches, where: watchesIn, style: L.PLACE_STYLE.watches });
    add({ id: "boots", kind: "store", name: ci.boots, brand: ci.boots, where: "street", style: L.PLACE_STYLE.boots });
    // food and drink
    const market = at(ci.market, 1);
    add({ id: "supermarket", kind: "supermarket", name: market, brand: market, where: "suburb", style: chain(market, "bright") });
    const locals = tier === 1 && ci.small ? [ci.small] : (info.cafes || ci.cafes);
    const cafes = [at(locals, 2)];
    if (tier >= 2) cafes.unshift("Starbucks");
    if (tier >= 3 && locals.length > 1) cafes.push(locals[(seed + 2 * 7 + 1) % locals.length]);
    for (const name of Array.from(new Set(cafes))) add({ id: "cafe:" + slug(name), kind: "cafe", name, brand: name, where: name === "Starbucks" ? "centre" : "street", style: chain(name, "cosy") });
    const rest = info.restaurant || at(water ? ["The Seafront Grill", "Harbour Table", "The Lighthouse"] : L.PLACE_NAMES.restaurant, 3);
    add({ id: "restaurant", kind: "restaurant", name: rest, where: water ? "seafront" : "centre", style: water ? L.PLACE_STYLE.restaurantSea : L.PLACE_STYLE.restaurant });
    add({ id: "club", kind: "club", name: info.club || ci.club, where: "centre", minAge: 18, style: L.PLACE_STYLE.club });
    // health and football
    add({ id: "clinic", kind: "clinic", name: ci.clinic, where: "suburb", style: L.PLACE_STYLE.clinic });
    add({ id: "gym", kind: "gym", name: info.gym || ci.gym, brand: info.gym || ci.gym, where: "street", style: L.PLACE_STYLE.gym });
    const club = who && who.club;
    add({ id: "training", kind: "training", name: club ? club + " training ground" : (who && who.team ? who.team + " training pitches" : "The training pitches"), where: "outskirts", style: L.PLACE_STYLE.training });
    add({ id: "stadium", kind: "stadium", name: club ? (L.STADIUMS[club] || club + " Stadium") : info.stadium || city + " Stadium", where: "suburb", style: L.PLACE_STYLE.stadium });
    // the car dealers: everyday cars and bikes everywhere, the prestige dealer in a big city, supercars where the money is
    add({ id: "dealer:everyday", kind: "dealer", name: ci.everyday || "Toyota and Honda", brand: "Toyota", where: "outskirts", style: L.PLACE_STYLE["dealer:everyday"] });
    add({ id: "dealer:bikes", kind: "dealer", name: ci.bikes || "Ducati and Vespa", brand: "Ducati", where: "street", style: L.PLACE_STYLE["dealer:bikes"] });
    if (tier >= 2) add({ id: "dealer:prestige", kind: "dealer", name: ci.prestige || "BMW, AMG and Porsche", brand: "BMW", where: "outskirts", style: L.PLACE_STYLE["dealer:prestige"] });
    if (tier >= 3 || (tier === 2 && !L.NO_SUPERCARS.includes(country))) add({ id: "dealer:super", kind: "dealer", name: ci.super || "Ferrari and Lamborghini", brand: "Ferrari", where: "luxury", style: L.PLACE_STYLE["dealer:super"] });
    return { seed, tier, places };
  }
  function whoOf(game) {
    const c = C(game), p = me(game), life = L0(game);
    const college = c.college ? (D.COLLEGES.find(x => x.id === c.college) || {}).name : null;
    const school = c.school ? (D.SCHOOLS.find(x => x.id === c.school) || {}).name : null;
    const team = c.stage === "pro" ? null : c.stage === "academy" && c.academy ? c.academy.club + " academy" : c.stage === "centre" && c.centre ? c.centre.name : c.stage === "college" ? college : school;
    return { hometown: hometown(c), home: life.home, owned: life.owned, club: c.stage === "pro" ? p.club : null, team };
  }
  function world(game) {
    const c = C(game);
    return buildWorld(c.city, cityCountry(game), whoOf(game));
  }
  const placeIn = (w, id) => w.places.find(x => x.id === id) || null;
  // the shops in this city that sell things (the mall's own stores, the street, the luxury row)
  function sellers(w) { return new Set(w.places.filter(x => x.kind === "store" || x.kind === "watches").map(x => x.id)); }
  const soldHere = (w, item) => sellers(w).has(item.store) && (item.minTier || 1) <= w.tier;

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

  // ---------- money out every week ----------
  function carCosts(life) {
    const daily = carOf(life.car);
    const others = life.cars.filter(id => id !== life.car).map(carOf).filter(Boolean);
    return { daily, others, stored: Math.round(others.reduce((s, x) => s + x.upkeep * 0.4, 0)) };
  }
  function billsOf(c, h) { return c.contract ? Math.round(40 + Math.min(900, c.contract.wage * 0.04) + h.tier * 25) : 0; }

  // ---------- a week of life: bills, sponsors, followers, savings, the weather ----------
  function weekly(game) {
    const c = C(game), life = L0(game);
    const wk = weekIndex(game);
    if (life.lastWeek === wk) return;
    life.lastWeek = wk;
    life.time = FREE_TIME;
    life.done = [];
    life.weather = pickWeather(game);
    relocate(game);
    // the home and the cars: the daily one in full, the rest of the garage at storage and insurance
    const h = homeOf(life.home.id);
    if (life.home.mode === "rent" && h.rent) money(game, -h.rent, "Rent, " + h.label.toLowerCase());
    if (life.home.mode === "own" && h.upkeep) money(game, -h.upkeep, "Upkeep, " + h.label.toLowerCase());
    const cc = carCosts(life);
    if (cc.daily) money(game, -cc.daily.upkeep, "Car costs, " + cc.daily.brand + " " + cc.daily.model);
    if (cc.stored) money(game, -cc.stored, "Garage, insurance on " + cc.others.length + " more " + (cc.others.length === 1 ? "vehicle" : "vehicles"));
    // food and bills grow with the lifestyle
    const bills = billsOf(c, h);
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
    const flash = (carOf(life.car) || { flash: 0 }).flash + life.items.map(id => (ITEM[id] || {}).flash || 0).reduce((a, b) => a + b, 0) * 0.3 + homeOf(life.home.id).tier;
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
    const kinds = new Set(life.sponsors.map(s => s.kind));
    const boots = life.sponsors.some(s => s.boots);
    const fits = L.SPONSORS.filter(s => c.rep.commercial >= s.need && !has.has(s.id) && !(s.boots && boots) && !kinds.has(s.kind));
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
    // a boot deal means wearing their boots: they send the top pair, and those go on
    if (o.boots) {
      const def = SPONSOR[o.id];
      const kit = def && def.kit ? ITEM[def.kit] : null;
      if (kit) {
        if (!life.items.includes(kit.id)) life.items.push(kit.id);
        life.fit.boots = kit.id;
        c.look.boot = kit.boot;
      } else if (BOOTS_OF[o.brand] && !BOOTS_OF[o.brand].includes(c.look.boot)) c.look.boot = BOOTS_OF[o.brand][0];
    }
    if (o.gift) {
      const car = carOf(o.gift);
      if (car && !life.cars.includes(car.id)) { life.cars.push(car.id); if (!life.car || (carOf(life.car) || { tier: 0 }).tier < car.tier) life.car = car.id; }
      const item = ITEM[o.gift];
      if (item && !life.items.includes(item.id)) { life.items.push(item.id); wear(game, item, true); }
    }
    c.rep.commercial = clamp(c.rep.commercial + 2, 0, 100);
    news(game, me(game).name + " signs with " + o.brand + ".", "life");
    return { ok: true };
  }
  // the boot brand he is paid to wear, if any
  function bootDeal(life) {
    const s = life.sponsors.find(x => x.boots);
    if (!s) return null;
    return (SPONSOR[s.id] || {}).brand || s.brand;
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
  // put a thing on, or take it off: accessories on the 3D body, clothes in the city, boots on his feet
  function wear(game, item, on) {
    const c = C(game), life = L0(game);
    if (item.look) {
      for (const [k, v] of Object.entries(item.look)) {
        if (on) { life.wearing[k] = v; c.look[k] = v; }
        else if (life.wearing[k] === v) { delete life.wearing[k]; c.look[k] = null; }
      }
      return;
    }
    if (item.cat === "boots") {
      if (on) { life.fit.boots = item.id; c.look.boot = item.boot; }
      else if (life.fit.boots === item.id) { life.fit.boots = null; c.look.boot = life.baseBoot; }
      return;
    }
    if (["top", "bottom", "shoes", "outer", "bag"].includes(item.cat)) {
      if (on) life.fit[item.cat] = item.id;
      else if (life.fit[item.cat] === item.id) life.fit[item.cat] = null;
    }
  }
  function wearing(c, life, item) {
    if (item.look) return Object.entries(item.look).every(([k, v]) => life.wearing[k] === v);
    if (item.cat === "boots") return life.fit.boots === item.id && c.look.boot === item.boot;
    return !!life.fit[item.cat] && life.fit[item.cat] === item.id;
  }
  function cityOutfit(life) {
    const o = Object.assign({}, BASE_OUTFIT);
    const top = ITEM[life.fit.top], bottom = ITEM[life.fit.bottom], shoes = ITEM[life.fit.shoes];
    if (top && top.outfit) { o.shirt = top.outfit.shirt || o.shirt; o.trim = top.outfit.trim || o.trim; }
    if (bottom && bottom.outfit) o.shorts = bottom.outfit.shorts || o.shorts;
    if (shoes) o.socks = shoes.colour;
    return o;
  }
  // a brand will not sell the top pieces to a nobody
  function lockOf(x, fame) {
    if (!x.need || fame >= x.need) return null;
    if (x.lockReason) return x.lockReason;
    if (x.model) return x.brand + " only sells the " + x.model + " to clients they know. Your name is not big enough yet.";
    const what = x.label.replace(x.brand + " ", "");
    if (x.brand === "Rolex") return "Rolex has a waiting list for the " + what + ". The names they know go first, and yours is not big enough yet.";
    if (x.brand === "Richard Mille") return "Richard Mille picks who gets the " + what + ". Your name is not big enough yet.";
    return x.brand + " keeps the " + what + " for clients they know. Your name is not big enough yet.";
  }
  // a first worth remembering: a moment card for the client, a news line and a message
  function moment(game, id, kind, title, text, extra) {
    const c = C(game), life = L0(game);
    if (life.firsts[id]) return;
    life.firsts[id] = true;
    life.moments.unshift(Object.assign({ id, kind, s: game.season, w: game.round, title, text, seen: false }, extra || {}));
    if (life.moments.length > 12) life.moments.length = 12;
  }
  function buyMoments(game, item) {
    const p = me(game), c = C(game);
    if (item.cat !== "watch") return;
    if (item.brand === "Rolex" && !L0(game).firsts.rolex) {
      L0(game).firsts.watch = true;
      moment(game, "rolex", "watch", "Your first Rolex", "The " + item.label + ". The man behind the counter puts it on your wrist himself. You remember the Casio you wore to school.", { item: item.id, price: item.price });
      news(game, p.name + " is pictured leaving the boutique with his first Rolex, a " + item.label.replace("Rolex ", "") + ".", "life");
      msg(game, "mum", "Mum", "A Rolex?! Your grandfather wore the same Casio for thirty years. I am proud of you. Do not lose it.");
      return;
    }
    if (item.brand === "Richard Mille" && !L0(game).firsts.rm) {
      L0(game).firsts.watch = true;
      moment(game, "rm", "watch", "A Richard Mille", "The " + item.label + ". It weighs almost nothing and costs more than the street you grew up on.", { item: item.id, price: item.price });
      news(game, p.name + " shows off a " + item.label + " at training. The dressing room goes quiet.", "life");
      msg(game, "dad", "Dad", "That watch costs more than our house. Keep your feet on the ground, son.");
      return;
    }
    if (item.price >= BIG_WATCH && !L0(game).firsts.watch) {
      moment(game, "watch", "watch", "Your first serious watch", "The " + item.label + ". Heavy, cold, ticking. The first thing you ever bought that will outlive you.", { item: item.id, price: item.price });
      msg(game, c.agent ? "agent" : "dad", c.agent ? "Agent" : "Dad", "Nice watch. Earned it. Now earn the next one.");
    }
  }
  function carMoments(game, car) {
    const p = me(game);
    if (isSupercar(car) && !L0(game).firsts.supercar) {
      L0(game).firsts.car = true;
      moment(game, "supercar", "car", "Your first " + car.brand, "The " + car.brand + " " + car.model + ". The engine wakes up the whole street. You drive it round the block three times before you go home.", { item: car.id, price: car.price });
      news(game, p.name + " turns up at training in a new " + car.brand + " " + car.model + ".", "life");
      msg(game, "dad", "Dad", "Send me a video of the engine. Then drive it slowly. Please.");
      return;
    }
    if (car.body !== "scooter" && car.body !== "bike" && !L0(game).firsts.car) {
      moment(game, "car", "car", "Your first car", "The " + car.brand + " " + car.model + ". Your own keys. The first drive is to your mum's.", { item: car.id, price: car.price });
      msg(game, "mum", "Mum", "Your own car! Drive carefully. And call me when you get home.");
    }
  }
  // buying a thing: the money, the morale, it goes on if it is something he wears
  function purchase(game, item) {
    const c = C(game), life = L0(game), p = me(game);
    if (life.items.includes(item.id)) return { error: "You already have one." };
    const lock = lockOf(item, fameOf(c));
    if (lock) return { error: lock, locked: true };
    if (!spend(game, item.price, item.label)) return { error: "Not enough money." };
    life.items.push(item.id);
    c.cond.morale = clamp(c.cond.morale + item.mood, 5, 99);
    let note = "";
    if (item.look) wear(game, item, true);
    else if (item.cat === "top" || item.cat === "bottom") wear(game, item, true);
    else if (item.cat === "boots") {
      const deal = bootDeal(life);
      if (deal && deal !== item.brand) note = " Your " + deal + " deal means " + deal + " boots on match day, so these stay in the box.";
      else wear(game, item, true);
    }
    buyMoments(game, item);
    if (item.price >= 25000) news(game, p.name + " is spotted at " + item.brand + ". The " + item.label + " leaves with him.", "life");
    return { ok: true, text: "Bought the " + item.label + "." + note };
  }
  function buyCar(game, car) {
    const c = C(game), life = L0(game), p = me(game);
    if (life.cars.includes(car.id)) return { error: "Already in your garage." };
    if (p.age < (car.minAge || 18)) return { error: "You are not old enough to drive that." + (car.minAge === 16 ? " Scooters are from sixteen." : car.minAge === 18 ? " Cars and bikes are from eighteen." : "") };
    const lock = lockOf(car, fameOf(c));
    if (lock) return { error: lock, locked: true };
    if (!spend(game, car.price, car.brand + " " + car.model)) return { error: "You cannot afford it yet." };
    life.cars.push(car.id);
    life.car = car.id;
    life.carLog[car.id] = { s: game.season, w: game.round, price: car.price };
    c.cond.morale = clamp(c.cond.morale + 3 + car.tier, 5, 99);
    if (car.tier >= 4) news(game, p.name + " is spotted in a new " + car.brand + " " + car.model + ".", "life");
    carMoments(game, car);
    return { ok: true, text: "The " + car.brand + " " + car.model + " is yours." };
  }
  // what a car fetches back: 85 percent in its first half season, down to 70
  function sellValue(game, life, car) {
    const log = life.carLog[car.id];
    if (!log) return Math.round(car.price * 0.7);
    const weeks = weekIndex(game) - (log.s * 40 + log.w);
    return Math.round(car.price * clamp(0.85 - Math.max(0, weeks - 20) / 40 * 0.05, 0.7, 0.85));
  }

  function act(game, place, action, arg) {
    const c = C(game), life = L0(game), p = me(game);
    const out = (text, extra) => { life.done.unshift({ place, action, text }); if (life.done.length > 6) life.done.length = 6; return Object.assign({ ok: true, text }, extra || {}); };
    const done = r => r.error ? r : out(r.text, r.extra);
    if (c.retired) return { error: "Retired players have all the time in the world." };
    // test hooks for the battery only, never on unless the server runs with FL_TEST_HOOKS=1
    if (place === "_test") {
      if (process.env.FL_TEST_HOOKS !== "1") return { error: "No such place." };
      if (action === "injure") { const w = Math.max(1, Math.round(Number(arg) || 3)); c.cond.inj = { name: "Hamstring strain", part: "hamstring", weeks: w, total: w, s: game.season, w: game.round }; p.inj = w; return { ok: true }; }
      if (action === "city") { c.city = String(arg || c.city); return { ok: true }; }
      if (action === "week") { life.wk = { at: -1 }; life.time = FREE_TIME; return { ok: true }; }
      return { error: "No such hook." };
    }
    const w = world(game);
    // a visit: free, no time, it goes on the fast travel list
    if (action === "visit") {
      const id = place === "home" ? (w.places.find(x => x.kind === "home" && x.living) || {}).id : place;
      const wp = id && placeIn(w, id);
      if (!wp) return { error: "No such place in " + c.city + "." };
      if (wp.minAge && p.age < wp.minAge) return { error: "The bouncer checks your ID. Over eighteens only." };
      if (!life.visited || life.visited.city !== c.city) life.visited = { city: c.city, ids: [] };
      if (!life.visited.ids.includes(wp.id)) life.visited.ids.push(wp.id);
      return { ok: true, text: wp.name };
    }
    if (place === "moments") {
      if (action !== "seen") return { error: "Nothing to do there." };
      for (const m of life.moments) if (arg === "all" || m.id === arg) m.seen = true;
      return { ok: true };
    }
    if (place === "street") {
      if (action !== "fan") return { error: "Nothing to do there." };
      return fan(game, arg === "photo" ? "photo" : "chat", out);
    }
    if (place === "garage") {
      if (action === "drive") { place = "home"; }
      else {
        if (action !== "sell") return { error: "Nothing to do in the garage." };
        const car = carOf(arg);
        if (!car || !life.cars.includes(car.id)) return { error: "That is not in your garage." };
        const back = sellValue(game, life, car);
        life.cars = life.cars.filter(id => id !== car.id);
        delete life.carLog[car.id];
        if (life.car === car.id) life.car = life.cars.map(carOf).filter(Boolean).sort((a, b) => b.price - a.price).map(x => x.id)[0] || null;
        money(game, back, "Sold the " + car.brand + " " + car.model);
        return out("Sold the " + car.brand + " " + car.model + " for " + back + ".", { amount: back });
      }
    }
    // a home in the city: buy it, rent it, move back in, or do the old home things there
    if (place.startsWith("home:")) {
      const wp = placeIn(w, place);
      if (!wp) return { error: "No such home in " + c.city + "." };
      if (action === "buy" || action === "rent") return moveHome(wp.homeId, action);
      if (action === "move" || action === "live") return moveHome(wp.homeId, wp.owned ? "buy" : wp.homeId === "family" || wp.homeId === "hostel" ? "live" : "rent");
      if (action === "sell") return act(game, "home", "sell", wp.homeId);
      if (["rest", "unwind", "wear", "drive"].includes(action)) place = "home";
      else return { error: "You cannot do that here." };
    }
    if (place === "home") {
      if (action === "rest") {
        if (!useTime(game, 1)) return { error: "No free time left this week." };
        const h = homeOf(life.home.id);
        c.cond.fatigue = clamp(c.cond.fatigue - (10 + h.tier * 1.5), 0, 100);
        c.cond.morale = clamp(c.cond.morale + 1.5, 5, 99);
        return out("Feet up, phone down. The legs feel fresher.");
      }
      if (action === "unwind") {
        const game1 = life.items.map(id => ITEM[id]).find(x => x && x.perk === "unwind");
        if (!game1) return { error: "You need something to play on first." };
        if (!useTime(game, 1)) return { error: "No free time left this week." };
        c.cond.morale = clamp(c.cond.morale + 4, 5, 99);
        c.cond.fatigue = clamp(c.cond.fatigue - 4, 0, 100);
        return out("Three hours of EA Sports FC online with the lads from the academy. You lost, a lot. Still a good night.");
      }
      if (action === "wear") {
        const item = ITEM[arg];
        if (!item || !life.items.includes(item.id) || !(item.look || ["top", "bottom", "shoes", "outer", "bag", "boots"].includes(item.cat))) return { error: "Nothing like that in the wardrobe." };
        const on = !wearing(c, life, item);
        if (on && item.cat === "boots") {
          const deal = bootDeal(life);
          if (deal && deal !== item.brand) return { error: "Your " + deal + " deal says " + deal + " boots only." };
        }
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
        return moveHome(id, mode);
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
      if (g.risk && rnd() < g.risk * guard(game) * Math.pow(c.cond.fatigue / 60, 2)) {
        K.injure(game, 0.6);
        return out("A tweak in the last set. The physio has a look.", { gains });
      }
      return out(g.id === "spa" ? "Ice, heat, a massage. Brand new legs." : "Good session. You can feel it.", { gains });
    }
    if (place === "restaurant") {
      const m = L.MEALS.find(x => x.id === (action === "order" ? arg : action));
      if (!m) return { error: "That is not on the menu." };
      if (m.sea && (placeIn(w, "restaurant") || {}).where !== "seafront") return { error: "Fish by the water needs the water. Not on the menu here." };
      if (!useTime(game, 1)) return { error: "No free time left this week." };
      if (!spend(game, m.price, "Dinner, " + (placeIn(w, "restaurant") || {}).name)) { life.time++; return { error: "Not enough money." }; }
      c.cond.fitness = clamp(c.cond.fitness + m.fitness, 30, 100);
      c.cond.fatigue = clamp(c.cond.fatigue + m.fatigue, 0, 100);
      c.cond.morale = clamp(c.cond.morale + m.morale, 5, 99);
      c.cond.form = clamp(c.cond.form + m.form, 3, 10);
      if (m.social) life.followers = Math.round(life.followers * (1 + m.social));
      return out(m.note);
    }
    if (place === "mall" || place === "shops") {
      if (action === "car") {
        // the old way to buy a car (the old seven, from the old screens)
        const car = L.CARS.find(x => x.id === arg);
        if (!car) return { error: "No such car." };
        return done(buyCar(game, car));
      }
      if (action !== "buy") return { error: "They do not sell that here." };
      const item = ITEM[arg];
      const mall = placeIn(w, "mall");
      // the old shops sell their old things; the mall also sells what its stores inside sell
      const ok = item && (item.shop === place || (place === "mall" && mall && mall.inside.includes(item.store) && soldHere(w, item)));
      if (!ok) return { error: "They do not sell that here." };
      return done(purchase(game, item));
    }
    if (place === "supermarket") {
      if (action !== "buy") return { error: "You can only buy things here." };
      const g = GROCERY[arg];
      if (!g) return { error: "They do not stock that." };
      const wk = week(game);
      if (wk.market >= LIMIT.market) return { error: "Your fridge is full for this week." };
      const shop = placeIn(w, "supermarket");
      if (!spend(game, g.price, "Shopping, " + shop.name)) return { error: "Not enough money." };
      wk.market++;
      fx(c, g.fx);
      return out(g.label + ". " + g.note);
    }
    if (place === "cafe" || place.startsWith("cafe:")) {
      const cafe = place === "cafe" ? w.places.find(x => x.kind === "cafe") : placeIn(w, place);
      if (!cafe) return { error: "No such cafe in " + c.city + "." };
      if (action !== "order") return { error: "Order something first." };
      const m = L.CAFE_MENU.find(x => x.id === arg);
      if (!m) return { error: "That is not on the menu." };
      const wk = week(game);
      if (wk.cafe >= LIMIT.cafe) return { error: "Five coffees this week is plenty. The nutritionist is watching." };
      if (!spend(game, m.price, cafe.name)) return { error: "Not enough money." };
      wk.cafe++;
      fx(c, m.fx);
      return out(m.label + " at " + cafe.name + ". " + m.note);
    }
    if (place === "club") return clubNight(game, action, arg, w, out);
    if (place === "clinic") return clinic(game, action, w, out);
    if (place.startsWith("dealer:")) {
      if (!placeIn(w, place)) return { error: "There is no such dealer in " + c.city + "." };
      if (action !== "car" && action !== "buy") return { error: "You can only buy cars here." };
      const car = carOf(arg);
      if (!car || car.dealer !== place) return { error: "They do not sell that here." };
      return done(buyCar(game, car));
    }
    if (place.startsWith("store:") || place === "watches" || place === "boots") {
      if (!placeIn(w, place)) return { error: "There is no such shop in " + c.city + "." };
      if (action !== "buy") return { error: "You can only buy things here." };
      const item = ITEM[arg];
      if (!item || item.store !== place || !soldHere(w, item)) return { error: "They do not sell that here." };
      return done(purchase(game, item));
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

    // the old move logic, now reached from home and from every home in the city
    function moveHome(id, mode) {
      const h = homeOf(id);
      if (!h || h.id !== id) return { error: "No such home." };
      if (h.id === "family") {
        if (c.city !== hometown(c)) return { error: "The family home is back in " + hometown(c) + "." };
        life.home = { id: "family", city: c.city, mode: "family" };
        return out("Back home. Mum is thrilled. Your old posters are still up.");
      }
      if (h.id === "hostel") {
        if (c.stage === "pro") return { error: "The team residence is for the youth players." };
        life.home = { id: "hostel", city: c.city, mode: "family" };
        return out("Back in your room at the residence.");
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
        const wp = placeIn(w, "home:" + h.id);
        if (!life.firsts.home) msg(game, "mum", "Mum", "Your own place! Send me photos of every room. Is there space for us to visit?");
        moment(game, "home", "home", "The keys to your own place", "The " + (wp ? wp.name : h.label.toLowerCase()) + ". Yours. Nobody can ask you to move out again.", { item: h.id, price: h.buy });
        return out("The keys are yours. A " + h.label.toLowerCase() + " in " + c.city + ".");
      }
      if (mode === "live") return { error: "Pick buy or rent." };
      if (!h.rent) return { error: "That one is not for rent." };
      if (h.rent * 3 > Math.max(wage, c.money.cash / 20)) return { error: "The agent will not rent it to you on your wage." };
      life.home = { id: h.id, city: c.city, mode: "rent" };
      return out("You rent a " + h.label.toLowerCase() + " in " + c.city + ". The first week is due on Monday.");
    }
  }
  function fx(c, f) {
    if (!f) return;
    if (f.fitness) c.cond.fitness = clamp(c.cond.fitness + f.fitness, 30, 100);
    if (f.morale) c.cond.morale = clamp(c.cond.morale + f.morale, 5, 99);
    if (f.fatigue) c.cond.fatigue = clamp(c.cond.fatigue + f.fatigue, 0, 100);
  }
  // the checkup's guard on injuries: 0.6 of the usual risk for three weeks (core.js training reads this too)
  function guard(game) {
    const c = C(game);
    if (!c || !c.life) return 1;
    return (c.life.guard || -1) >= weekIndex(game) ? 0.6 : 1;
  }

  // ---------- the nightclub ----------
  function clubNight(game, action, arg, w, out) {
    const c = C(game), life = L0(game), p = me(game);
    if (action !== "night") return { error: "Nothing to do there." };
    const club = placeIn(w, "club");
    if (!club) return { error: "No club in " + c.city + "." };
    if (p.age < 18) return { error: "The bouncer checks your ID. You have to be eighteen to get in." };
    const m = L.CLUB_MENU.find(x => x.id === (arg || "night"));
    if (!m) return { error: "That is not on offer here." };
    if (!useTime(game, 1)) return { error: "No free time left this week." };
    if (!spend(game, m.price, "Night out, " + club.name)) { life.time++; return { error: "Not enough money." }; }
    const vip = m.id === "vip";
    c.cond.morale = clamp(c.cond.morale + (vip ? 6 : 4), 5, 99);
    c.cond.fatigue = clamp(c.cond.fatigue + (vip ? 16 : 12), 0, 100);
    life.followers = Math.round(life.followers * (1 + (vip ? 0.03 : 0.012)) + 10);
    if (vip) c.rep.commercial = clamp(c.rep.commercial + 0.3, 0, 100);
    // after a poor run, a photo of him leaving at three in the morning is all the papers want
    const recent = (c.stats.log || []).filter(x => x.mins > 0 && x.rating).slice(0, 3);
    const avg = recent.length ? recent.reduce((s, x) => s + x.rating, 0) / recent.length : 6.5;
    const poor = c.cond.form < 6.3 || (recent.length >= 2 && avg < 6.3);
    if (poor && rnd() < (vip ? 0.65 : 0.45)) {
      c.cond.morale = clamp(c.cond.morale - 8, 5, 99);
      c.coachRel = clamp(c.coachRel - 3, 0, 100);
      if (c.stage === "pro") c.trust = clamp(c.trust - 2, 0, 100);
      c.rep.local = clamp(c.rep.local - 1.5, 0, 100);
      news(game, p.name + " is pictured leaving " + club.name + " at three in the morning after a poor run. The fans are not happy.", "life");
      msg(game, "agent", c.agent ? "Agent" : "Club press office", "The photos from last night are everywhere. Keep your head down this week.");
      return out("A great night, until the photographers outside. The papers have it in the morning.", { backlash: true });
    }
    return out(m.note);
  }

  // ---------- the clinic ----------
  function clinic(game, action, w, out) {
    const c = C(game), life = L0(game), p = me(game);
    const place = placeIn(w, "clinic");
    const m = L.CLINIC_MENU.find(x => x.id === action);
    if (!place || !m) return { error: "The clinic does not do that." };
    const wk = week(game);
    if (action === "treat") {
      if (!c.cond.inj) return { error: "Nothing to treat. The doctor says you are fit." };
      if (wk.treat) return { error: "The specialist saw you this week already. Come back next week." };
      if (!spend(game, m.price, "Treatment, " + place.name)) return { error: "Not enough money." };
      wk.treat = true;
      c.cond.inj.weeks = Math.max(0, c.cond.inj.weeks - 1);
      p.inj = c.cond.inj.weeks;
      if (c.cond.inj.weeks <= 0) {
        news(game, p.name + " is back in full training after treatment at " + place.name + ".", "injury");
        c.cond.inj = null; p.inj = 0; c.cond.fitness = Math.max(c.cond.fitness, 75);
        return out("The specialist signs you off. Back in full training.");
      }
      return out("Scans, a specialist and a new rehab plan. A week closer to playing again. " + c.cond.inj.weeks + " to go.");
    }
    if (c.cond.inj) return { error: "Get the injury treated first." };
    if (wk.checkup) return { error: "You had a full check up this week." };
    if (!spend(game, m.price, "Check up, " + place.name)) return { error: "Not enough money." };
    wk.checkup = true;
    life.guard = weekIndex(game) + 3;
    c.cond.fatigue = clamp(c.cond.fatigue - 3, 0, 100);
    return out("Muscle tests, bloods and a plan from the physio. Fewer knocks for the next three weeks.");
  }

  // ---------- people in the street ----------
  const FAN_LINES = {
    photo: ["A kid in your shirt asks for a photo. His dad takes six of them.", "Two students ask for a selfie and post it before you have walked away.", "A delivery rider stops in the road for a photo. The traffic waits.", "A grandmother says her grandson has your poster. You record him a video."],
    chat: ["An old man at the bus stop tells you how the team played in his day.", "A shopkeeper says his son wants to be a footballer too. You tell him to keep at it.", "A woman walking her dog asks for directions. You do not know either.", "A street sweeper asks what the manager is really like. You laugh."]
  };
  function fan(game, kind, out) {
    const c = C(game), life = L0(game);
    const wk = week(game);
    if (wk.fans >= LIMIT.fans) return { error: "That is enough of the street for one week." };
    if (kind === "photo" && fameOf(c) < 8 && c.rep.local < 20) return { error: "Nobody recognises you yet. Give it time." };
    wk.fans++;
    if (kind === "photo") {
      c.rep.local = clamp(c.rep.local + 0.4, 0, 100);
      life.followers = Math.round(life.followers * 1.002 + 3);
    } else {
      c.rep.local = clamp(c.rep.local + 0.15, 0, 100);
      life.followers += 1;
    }
    c.cond.morale = clamp(c.cond.morale + 0.5, 5, 99);
    return out(pick(FAN_LINES[kind]));
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
    const fame = fameOf(c);
    const cash = c.money.cash;
    const w = buildWorld(c.city, country, whoOf(game));
    const cc = carCosts(life);
    const weeklyCost = (life.home.mode === "rent" ? h.rent : life.home.mode === "own" ? h.upkeep : 0) + (car ? car.upkeep : 0) + cc.stored + billsOf(c, h);
    const name = id => (placeIn(w, id) || {}).name || "";
    const info = L.CITY_INFO[c.city] || {}, ci = L.COUNTRY_INFO[country] || L.COUNTRY_INFO.default;
    const places = { restaurant: name("restaurant"), gym: name("gym"), mall: name("mall"), shops: info.row || ci.row || name("watches") };
    const sellHere = sellers(w);
    const dealers = new Set(w.places.filter(x => x.kind === "dealer").map(x => x.id));
    const itemView = x => {
      const owned = life.items.includes(x.id);
      const here = sellHere.has(x.store) && (x.minTier || 1) <= w.tier;
      const lock = lockOf(x, fame);
      const o = { id: x.id, store: x.store, brand: x.brand, cat: x.cat, label: x.label, price: x.price, mood: x.mood, flash: x.flash, colour: x.colour, owned, wearing: owned && wearing(c, life, x), canBuy: here && !owned && !lock && x.price <= cash };
      if (x.look) o.look = x.look;
      if (x.outfit) o.outfit = x.outfit;
      if (x.boot !== undefined) o.boot = x.boot;
      if (x.perk) o.perk = x.perk;
      if (x.need) o.need = x.need;
      if (lock) o.lockReason = lock;
      return o;
    };
    const carView = x => {
      const owned = life.cars.includes(x.id);
      const young = p.age < (x.minAge || 18);
      const lock = young ? "You are not old enough to drive that." : lockOf(x, fame);
      const o = { id: x.id, dealer: x.dealer, brand: x.brand, model: x.model, price: x.price, upkeep: x.upkeep, flash: x.flash, colour: x.colour, body: x.body, feel: x.feel, tier: x.tier, minAge: x.minAge || 18, owned, daily: life.car === x.id, canBuy: dealers.has(x.dealer) && !owned && !lock && x.price <= cash };
      if (x.need) o.need = x.need;
      if (lock) o.lockReason = lock;
      if (owned) o.sellFor = sellValue(game, life, x);
      return o;
    };
    const visited = life.visited && life.visited.city === c.city ? life.visited.ids.filter(id => placeIn(w, id)) : [];
    return {
      city: c.city, hometown: hometown(c), style: styleOf(c.city, country), places, weather: life.weather,
      time: life.time, freeTime: FREE_TIME, done: life.done,
      home: Object.assign({}, h, { mode: life.home.mode, city: life.home.city }),
      owned: life.owned.map(o => Object.assign({ city: o.city, price: o.price }, homeOf(o.id))),
      homes: L.HOMES.filter(x => x.id !== "hostel").map(x => ({ ...x, canRent: x.rent > 0 && x.rent * 3 <= Math.max(wage, cash / 20) && p.age >= 17, canBuy: x.buy > 0 && x.buy <= cash && p.age >= 17 })),
      car: car, cars: L.CARS.map(x => ({ ...x, owned: life.cars.includes(x.id), canBuy: !life.cars.includes(x.id) && x.price <= cash && p.age >= (x.minAge || 18) && !lockOf(x, fame) })),
      items: L.ITEMS.map(x => ({ ...x, owned: life.items.includes(x.id), wearing: life.items.includes(x.id) && wearing(c, life, x) })),
      meals: L.MEALS, gym: L.GYM, postKinds: L.POSTS,
      followers: life.followers, posts: life.posts.slice(0, 8), postedThisWeek: life.postedAt === weekIndex(game),
      sponsors: life.sponsors, sponsorOffers: life.sponsorOffers,
      savings: life.savings, weeklyCost,
      // the city rebuild: the places, everything in them, what he owns, what he wears, how big his name is
      world: w,
      catalog: {
        items: L.ALL_ITEMS.filter(x => (sellHere.has(x.store) && (x.minTier || 1) <= w.tier) || life.items.includes(x.id)).map(itemView),
        cars: L.ALL_CARS.filter(x => dealers.has(x.dealer) || life.cars.includes(x.id)).map(carView),
        groceries: L.GROCERIES.map(g => ({ id: g.id, label: g.label, price: g.price, aisle: g.aisle, colour: g.colour, note: g.note })),
        menus: {
          cafe: L.CAFE_MENU.map(m => ({ id: m.id, label: m.label, price: m.price, note: m.note, time: 0 })),
          restaurant: L.MEALS.filter(m => !m.sea || (placeIn(w, "restaurant") || {}).where === "seafront").map(m => ({ id: m.id, label: m.label, price: m.price, note: m.note, time: m.time || 1 })),
          club: L.CLUB_MENU.map(m => ({ id: m.id, label: m.label, price: m.price, note: m.note, time: m.time })),
          clinic: L.CLINIC_MENU.map(m => ({ id: m.id, label: m.label, price: m.price, note: m.note, time: m.time }))
        }
      },
      visited, garage: life.cars.slice(), cityOutfit: cityOutfit(life), fame,
      moments: life.moments.slice(0, 8),
      week: (() => { const wk = life.wk && life.wk.at === weekIndex(game) ? life.wk : { cafe: 0, market: 0, fans: 0, treat: false, checkup: false }; return { cafe: wk.cafe, market: wk.market, fans: wk.fans, treat: !!wk.treat, checkup: !!wk.checkup, limits: LIMIT, guarded: guard(game) < 1 }; })()
    };
  }
  // offers that sat too long go away
  function expire(game) {
    const life = L0(game);
    const wk = weekIndex(game);
    life.sponsorOffers = life.sponsorOffers.filter(o => o.expires >= wk);
  }

  return { L0, weekly, act, post, bank, sponsorAnswer, view, expire, styleOf, placeNames, world, guard, FREE_TIME };
}

module.exports = { makeLife };
