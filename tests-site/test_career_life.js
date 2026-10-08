// Player Career life battery: the city rebuild with real brands. Boots the Floodlights server on its own port and
// save file, creates footballers through the API and checks the places in each city (big and small, by the sea or
// not, a new city after a move), every life action (visit, buy, wear, cars and their age rules, the garage, homes
// through their places, the supermarket, cafes, the restaurant, the club, the clinic, fans in the street), the fame
// gates and price pacing, old saves and old ids, and that nothing is NaN.
// Run: node tests-site/test_career_life.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const PORT = process.env.CAREER_LIFE_PORT || "3488";
const BASE = "http://127.0.0.1:" + PORT;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fl-career-life-"));
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

// a career to play with: create, pick the school, and a small set of helpers bound to it
async function career(name, over) {
  const r = await api("/api/pc/create", { name, player: FORM(over) });
  const code = r.j.code;
  const P = (p2, b) => api(p2, Object.assign({ code, name }, b || {}));
  if (r.j.state && r.j.state.decisions.some(d => d.kind === "school")) await P("/api/pc/decide", { id: "school", choice: "asb" });
  const state = async () => (await api(`/api/pc/state?code=${code}&name=${name}`)).j.state;
  const act = (place, action, arg) => P("/api/pc/act", arg === undefined ? { place, action } : { place, action, arg });
  const set = b => P("/api/pc/testset", b);
  // one week on, answering whatever stops it
  async function week() {
    for (let i = 0; i < 6; i++) {
      const w = await P("/api/pc/week", { weeks: 1 });
      if (w.status === 200) return w;
      if (w.j.event) { await P("/api/pc/event", { id: w.j.event.id, choice: w.j.event.choices[0].id }); continue; }
      if (w.j.seasonOver) { await P("/api/pc/season"); continue; }
      if (w.j.decision) { const d = w.j.decision; await P("/api/pc/decide", { id: d.id, choice: d.kind === "agent" ? "none" : d.kind === "trial" ? "decline" : d.options[0] }); continue; }
      return w;
    }
    return null;
  }
  return { code, r, P, state, act, set, week };
}
const place = (st, id) => st.life.world.places.find(p => p.id === id);
const item = (st, id) => st.life.catalog.items.find(x => x.id === id);
const car = (st, id) => st.life.catalog.cars.find(x => x.id === id);

async function main() {
  // ---------- static: the house rules and the catalog itself ----------
  for (const f of ["floodlights/career/life_data.js", "floodlights/career/life.js", "floodlights/career/people.js", "floodlights/career/data.js", "floodlights/career/social.js", "floodlights/career/social_data.js", "floodlights/career/campus.js", "tests-site/test_career_life.js"]) {
    const t = fs.readFileSync(path.join(root, f), "utf8");
    ok(f + " has no em or en dashes", !t.includes(EM) && !t.includes(EN), null);
  }
  const L = require(path.join(root, "floodlights/career/life_data.js"));
  const rig = fs.readFileSync(path.join(root, "floodlights/m3d/view/rig.mjs"), "utf8");
  const ACC = Object.keys(JSON.parse(rig.match(/export const ACC_COL = (\{[^}]*\})/)[1].replace(/(\w+):/g, "\"$1\":")));
  const BOOTS_N = (rig.match(/export const BOOTS = (\[[\s\S]*?\]\]);/)[1].match(/\[\"#/g) || []).length;
  const OLD_ITEMS = ["hoodie", "kicks", "phones", "console", "phone", "steelwatch", "chain", "jacket", "studs", "goldwatch", "suit", "goldchain"];
  const OLD_CARS = ["scoot", "pico", "aero", "gt", "corsa", "regent", "hypra"];
  const OLD_SPONSORS = ["greenleaf", "fizzline", "stride", "lumen", "crestbank", "pixelforge", "aurion", "celestor", "apex", "korra", "valore"];
  ok("every old item id is still in the catalog", OLD_ITEMS.every(id => L.ALL_ITEMS.some(x => x.id === id)) && OLD_ITEMS.every(id => L.ITEMS.some(x => x.id === id)), null);
  ok("every old car id is still for sale", OLD_CARS.every(id => L.ALL_CARS.some(x => x.id === id)) && OLD_CARS.every(id => L.CARS.some(x => x.id === id)), null);
  ok("every old home id is still there", ["family", "hostel", "shared", "apartment", "penthouse", "villa", "mansion"].every(id => L.HOMES.some(h => h.id === id)), null);
  ok("every old sponsor id is still there", OLD_SPONSORS.every(id => L.SPONSORS.some(s => s.id === id)), null);
  ok("ids are unique", new Set(L.ALL_ITEMS.map(x => x.id)).size === L.ALL_ITEMS.length && new Set(L.ALL_CARS.map(x => x.id)).size === L.ALL_CARS.length, null);
  ok("no made up brands left in the shops or on the deals", !L.ALL_ITEMS.concat(L.ALL_CARS, L.SPONSORS).some(x => /Northline|Kurobe|Lumen|Pixelforge|Arden|Solenne|Halcyon|Orr|Celestor|Nimbus|Veltra|Kestrel|Aurion|Strada|Monarch|Vanta|Greenleaf|Fizzline|Stride|Crestbank|Apex|Korra|Valor/.test(x.brand || "")), null);
  const stores = ["store:essentials", "store:ralph", "store:givenchy", "store:ami", "store:stussy", "store:nike", "store:adidas", "store:zara", "store:gucci", "store:dior", "store:lv"];
  ok("all eleven clothing brands have a store with its own look", stores.every(s => L.STORES[s] && L.STORES[s].style && /^#/.test(L.STORES[s].style.floor) && L.STORES[s].style.vibe), stores.filter(s => !L.STORES[s]));
  ok("each clothing store sells five to nine real pieces", stores.every(s => { const n = L.ALL_ITEMS.filter(x => x.store === s).length; return n >= 5 && n <= 9; }), stores.map(s => s + " " + L.ALL_ITEMS.filter(x => x.store === s).length));
  ok("each clothing store has a top and a bottom", stores.every(s => L.ALL_ITEMS.some(x => x.store === s && x.cat === "top" && x.outfit && x.outfit.shirt && x.outfit.trim) && L.ALL_ITEMS.some(x => x.store === s && x.cat === "bottom" && x.outfit && x.outfit.shorts)), null);
  ok("every watch and piece of jewellery wears a real rig finish", L.ALL_ITEMS.filter(x => x.look).every(x => Object.values(x.look).every(v => ACC.includes(v))), L.ALL_ITEMS.filter(x => x.look && !Object.values(x.look).every(v => ACC.includes(v))).map(x => x.id));
  ok("every boot is a real rig boot", BOOTS_N >= 14 && L.ALL_ITEMS.filter(x => x.cat === "boots").every(x => Number.isInteger(x.boot) && x.boot >= 0 && x.boot < BOOTS_N), BOOTS_N);
  const watches = L.ALL_ITEMS.filter(x => x.store === "watches");
  const brandsW = new Set(watches.map(x => x.brand));
  ok("the watch boutique has Casio and Guess up to Rolex, AP and Richard Mille", ["Casio", "Guess", "Tissot", "TAG Heuer", "Omega", "Rolex", "Audemars Piguet", "Richard Mille"].every(b => brandsW.has(b)), [...brandsW]);
  ok("the models are the real ones", ["Submariner", "Datejust", "Daytona", "Day-Date", "GMT-Master", "Royal Oak", "Offshore", "RM 011", "RM 035", "RM 67", "RM 27", "G-Shock", "Speedmaster", "Seamaster", "PRX"].every(m => L.ALL_ITEMS.some(x => x.label.includes(m))), null);
  ok("a Casio costs under 200", watches.filter(x => x.brand === "Casio").every(x => x.price < 200), null);
  ok("every Richard Mille costs over 100,000 and one costs over half a million", watches.filter(x => x.brand === "Richard Mille").every(x => x.price > 100000) && watches.some(x => x.brand === "Richard Mille" && x.price > 500000), null);
  ok("a Rolex costs thousands, not hundreds", watches.filter(x => x.brand === "Rolex").every(x => x.price >= 8000 && x.price <= 60000), null);
  const boots = L.ALL_ITEMS.filter(x => x.cat === "boots");
  ok("boots run from about 30 to 280", Math.min(...boots.map(x => x.price)) >= 30 && Math.min(...boots.map(x => x.price)) <= 50 && Math.max(...boots.map(x => x.price)) <= 280 && Math.max(...boots.map(x => x.price)) >= 250, null);
  ok("Nike, Adidas and Puma boots, the real lines", ["Mercurial", "Phantom", "Predator", "F50", "Copa", "Future", "Ultra", "King"].every(m => boots.some(x => x.label.includes(m))) && ["Club", "Academy", "Pro", "Elite"].every(t => boots.some(x => x.label.includes(t))), null);
  const cars = L.ALL_CARS;
  ok("the dealers sell the real cars", ["Toyota", "Honda", "BMW", "Mercedes-AMG", "Brabus", "Porsche", "Range Rover", "Ferrari", "Lamborghini", "Kawasaki", "Ducati", "Vespa"].every(b => cars.some(x => x.brand === b)), null);
  ok("the models are the real ones", ["Yaris", "Corolla", "Civic", "Type R", "RAV4", "Land Cruiser", "M3", "M4", "M5", "C 63", "E 63", "G 63", "911 Carrera", "GT3 RS", "Turbo S", "Taycan", "Cayenne", "Roma", "296", "SF90", "Purosangue", "Huracan", "Revuelto", "Urus", "Panigale", "S 1000 RR", "Ninja", "Activa"].every(m => cars.some(x => x.model.includes(m))), null);
  ok("every vehicle has a real feel", cars.every(x => x.feel && x.feel.top > 0 && x.feel.top < 110 && x.feel.accel > 0 && x.feel.grip >= 0.6 && x.feel.grip <= 1.2 && x.feel.mass > 0), cars.filter(x => !x.feel).map(x => x.id));
  ok("the feel really differs from car to car", new Set(cars.map(x => x.feel.top + "/" + x.feel.accel + "/" + x.feel.grip)).size >= cars.length - 2 && cars.find(x => x.id === "sf90").feel.top > cars.find(x => x.id === "pico").feel.top * 1.5, null);
  ok("upkeep is weekly and grows with the car", cars.every(x => x.upkeep > 0 && x.upkeep < x.price / 50) && cars.find(x => x.id === "hypra").upkeep > cars.find(x => x.id === "aero").upkeep * 20, null);
  ok("a Ferrari and a Richard Mille need a superstar's name", cars.filter(x => x.brand === "Ferrari").every(x => x.need >= 50) && cars.find(x => x.id === "sf90").need >= 70 && watches.filter(x => x.brand === "Richard Mille").every(x => x.need >= 70), null);
  ok("the entry pieces are open from day one", L.ALL_ITEMS.filter(x => x.price < 500).every(x => !x.need) && cars.filter(x => x.price < 60000).every(x => !x.need), null);
  // the money curve: a youth wage of about 420, an 80 rated Premier League regular about 27k, a 93 about 190k
  const youth = 420, regular = 27000, star = 190000;
  const cheapTop = Math.min(...L.ALL_ITEMS.filter(x => x.cat === "top").map(x => x.price));
  ok("the basics are affordable on a youth wage", cheapTop <= youth * 0.1 && boots.some(x => x.price <= youth * 0.15) && watches.some(x => x.price <= youth * 0.1), cheapTop);
  const datejust = watches.find(x => x.id === "rolex_datejust");
  ok("a first Rolex is a big contract's buy, not a youth player's", datejust.price > youth * 15 && datejust.price < regular && datejust.need > 0 && datejust.need <= 25, datejust);
  ok("a Ferrari and a Richard Mille are many weeks even for a regular", cars.find(x => x.id === "sf90").price > regular * 10 && watches.find(x => x.id === "rm_67").price > regular * 5 && watches.find(x => x.id === "rm_67").price < star * 2, null);
  ok("sponsors are real brands, the boot deals Nike, Adidas and Puma", L.SPONSORS.filter(s => s.boots).map(s => s.brand).sort().join() === "Adidas,Nike,Puma" && L.SPONSORS.some(s => s.brand === "Gatorade") && L.SPONSORS.some(s => s.brand === "Rolex"), L.SPONSORS.map(s => s.brand));
  ok("old boot brands still map to boots next to the new ones", ["Apex", "Korra", "Valoré", "Nike", "Adidas", "Puma"].every(b => Array.isArray(L.BOOT_BRANDS[b]) && L.BOOT_BRANDS[b].length), null);
  ok("the supermarket has every aisle", L.AISLES.every(a => L.GROCERIES.some(g => g.aisle === a)), null);
  ok("the old meals are still on the menu", ["healthy", "treat", "fine"].every(id => L.MEALS.some(m => m.id === id)), null);

  // ---------- old saves: a save from before the rebuild, through the life module itself ----------
  {
    const { makeLife } = require(path.join(root, "floodlights/career/life.js"));
    const paid = [], msgs = [];
    const K = { C: g => g.career, me: g => g.players[1], msg: (g, t, f, x) => msgs.push(x), news() {}, money: (g, amt, text) => { g.career.money.cash += amt; paid.push(text); }, trainOne: () => 0, injure() {} };
    const LIFE = makeLife(K);
    const game = {
      season: 2, round: 5, clubs: {}, players: { 1: { name: "Old Save", age: 22, club: null } },
      career: {
        city: "Mumbai", hometown: "Mumbai", stage: "pro", person: { country: "India" }, look: { boot: 6, earrings: "diamond", watch: "gold" },
        rep: { commercial: 30, local: 20, national: 20, international: 0 }, money: { cash: 1000, log: [] }, cond: { fatigue: 20, fitness: 90, morale: 60, form: 6.5 },
        stats: { log: [] }, contract: { wage: 1000 }, traits: {},
        life: {
          home: { id: "family", city: "Mumbai", mode: "family" }, owned: [], cars: ["gt", "scoot"], car: "gt", items: ["studs", "goldwatch", "hoodie"], wearing: { earrings: "diamond", watch: "gold" },
          followers: 5000, posts: [], postedAt: -1, savings: 0, time: 3, weather: null, lastWeek: -1, done: [],
          sponsors: [{ id: "apex", brand: "Apex", kind: "Boots", weekly: 180, weeksLeft: 10, boots: true }],
          sponsorOffers: [{ id: "celestor", brand: "Celestor", kind: "Watches", line: "", weekly: 9000, weeks: 40, expires: 999, boots: false, gift: "goldwatch" }]
        }
      }
    };
    const v = LIFE.view(game);
    ok("an old save opens with the new fields", v.world && v.catalog && Array.isArray(v.garage) && v.cityOutfit && Number.isFinite(v.fame) && !hasNaN(v), null);
    ok("old items show as the real products", v.items.find(x => x.id === "goldwatch").label.includes("Rolex Day-Date") && v.items.find(x => x.id === "steelwatch").label.includes("TAG Heuer Carrera") && v.items.find(x => x.id === "console").label === "PlayStation 5", null);
    ok("old cars show as the real ones", v.car.brand === "BMW" && v.car.model === "M4 Competition" && v.cars.find(x => x.id === "corsa").model === "911 Turbo S" && v.cars.find(x => x.id === "hypra").brand === "Ferrari", v.car);
    ok("the old deal shows the real brand", v.sponsors[0].brand === "Puma" && v.sponsorOffers[0].brand === "Rolex", v.sponsors);
    ok("the old gold watch is still on his wrist", v.items.find(x => x.id === "goldwatch").wearing === true, null);
    ok("diamond studs became a real finish", game.career.look.earrings === "silver" && v.items.find(x => x.id === "studs").wearing === true, game.career.look.earrings);
    ok("an old save owning a Rolex has had its first already", game.career.life.firsts.rolex === true && game.career.life.firsts.car === true, game.career.life.firsts);
    LIFE.weekly(game);
    ok("the old deal still pays every week", paid.some(t => t === "Sponsor, Puma"), paid);
    ok("the garage costs a little for the car in storage", paid.some(t => /^Garage/.test(t)) && paid.some(t => /Car costs, BMW M4/.test(t)), paid);
    // an old offer with an old brand still puts the boots on
    game.career.life.sponsors = [];
    game.career.life.sponsorOffers = [{ id: "valore", brand: "Valoré", kind: "Boots", line: "", weekly: 7400, weeks: 40, expires: 999, boots: true, gift: null }];
    const out = LIFE.sponsorAnswer(game, "valore", true);
    ok("an old boot offer signs and puts that brand's boots on him", out.ok && game.career.look.boot === L.ALL_ITEMS.find(x => x.id === "nike_superfly_elite").boot && game.career.life.items.includes("nike_superfly_elite"), [out, game.career.look.boot]);
    game.career.life.sponsors = [{ id: "korra", brand: "Korra", kind: "Boots", weekly: 1100, weeksLeft: 5, boots: true }];
    game.career.life.v = 1;
    LIFE.view(game);
    ok("an old saved deal under the old name is renamed and still pays", game.career.life.sponsors[0].brand === "Adidas", game.career.life.sponsors[0]);
  }

  const server = spawn("node", [path.join(root, "floodlights", "server.js")], { env: Object.assign({}, process.env, { PORT, FL_SAVE_FILE: SAVE, FL_TEST_HOOKS: "1" }), stdio: "ignore" });
  const stop = () => { try { server.kill(); } catch (e) {} };
  process.on("exit", stop);
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + "/floodlights/")).ok) break; } catch (e) {} await sleep(250); }

    // ---------- a big city by the sea: Mumbai ----------
    const A = await career("Bom");
    let st = await A.state();
    const lw = st.life.world;
    ok("the life state has the world, the catalog and the rest", lw && Array.isArray(lw.places) && st.life.catalog && Array.isArray(st.life.visited) && Array.isArray(st.life.garage) && st.life.cityOutfit && Number.isFinite(st.life.fame), Object.keys(st.life));
    ok("Mumbai is a big city", lw.tier === 3 && Number.isFinite(lw.seed), lw.tier);
    ok("the mall is Phoenix Palladium with stores inside", place(st, "mall").name === "Phoenix Palladium" && place(st, "mall").inside.includes("store:nike") && place(st, "mall").inside.every(id => place(st, id) && place(st, id).where === "mall"), place(st, "mall"));
    ok("the luxury row has Gucci, Dior and Louis Vuitton", ["store:gucci", "store:dior", "store:lv", "store:givenchy", "store:cartier"].every(id => place(st, id) && place(st, id).where === "luxury"), null);
    ok("an Indian supermarket", /Reliance Smart|DMart/.test(place(st, "supermarket").name), place(st, "supermarket").name);
    const cafes = lw.places.filter(p => p.kind === "cafe").map(p => p.name);
    ok("Starbucks and an Indian coffee chain", cafes.includes("Starbucks") && cafes.some(n => /Blue Tokai|Third Wave/.test(n)), cafes);
    ok("the restaurant sits on the seafront", place(st, "restaurant").where === "seafront", place(st, "restaurant"));
    ok("the nightclub is eighteen and over", place(st, "club").minAge === 18, place(st, "club"));
    const stad = lw.places.find(p => p.kind === "stadium");
    ok("a clinic, a gym, a training ground and a stadium (the city club's, a schoolboy plays on his school pitch)", ["clinic", "gym"].every(id => place(st, id)) && lw.places.some(p => p.kind === "training") && stad && stad.name === "Mumbai Football Arena", stad);
    ok("all four dealers in a big city", ["dealer:everyday", "dealer:prestige", "dealer:super", "dealer:bikes"].every(id => place(st, id)), null);
    ok("his family home is in his home town, and every home to buy is a place", place(st, "home:family") && place(st, "home:family").living === true && ["shared", "apartment", "penthouse", "villa", "mansion"].every(h => place(st, "home:" + h) && place(st, "home:" + h).homeId === h), lw.places.filter(p => p.kind === "home").map(p => p.id));
    ok("Mumbai homes are real neighbourhoods", place(st, "home:mansion").name.includes("Malabar Hill") && place(st, "home:penthouse").name.includes("Worli"), place(st, "home:mansion").name);
    ok("every place has an id, a kind, a name, a where and a style in hex", lw.places.every(p => p.id && p.kind && p.name && p.where && p.style && /^#[0-9a-f]{6}$/i.test(p.style.floor) && /^#[0-9a-f]{6}$/i.test(p.style.accent) && p.style.vibe), lw.places.filter(p => !p.style).map(p => p.id));
    ok("place ids are unique", new Set(lw.places.map(p => p.id)).size === lw.places.length, null);
    ok("the catalog has the Richard Millies and the Ferraris in a capital", item(st, "rm_67") && car(st, "sf90") && car(st, "hypra"), null);
    ok("the catalog has groceries and every menu", st.life.catalog.groceries.length >= 18 && ["cafe", "restaurant", "club", "clinic"].every(k => st.life.catalog.menus[k].length), null);
    ok("he starts in his home clothes with nothing in the garage", st.life.cityOutfit.shirt === "#e9e6df" && st.life.garage.length === 0, st.life.cityOutfit);
    const again = await A.state();
    ok("the same city always gives the same places", JSON.stringify(again.life.world) === JSON.stringify(lw), null);
    ok("the old place names are the real ones now", st.life.places.mall === "Phoenix Palladium" && st.life.places.gym && st.life.places.restaurant && st.life.places.shops, st.life.places);

    // visits
    let r = await A.act("mall", "visit");
    ok("a visit is free and goes on the list", r.status === 200 && r.j.state.life.visited.includes("mall") && r.j.state.life.time === 3, r.j.error);
    r = await A.act("store:nowhere", "visit");
    ok("a place that is not in the city cannot be visited", r.status === 400, r.j);
    r = await A.act("club", "visit");
    ok("the bouncer stops a fifteen year old", r.status === 400 && /eighteen/i.test(r.j.error || ""), r.j);

    // clothes: buy a top and a bottom, they go on at once; the wardrobe takes them off
    await A.set({ cash: 3000 });
    r = await A.act("store:nike", "buy", "nike_tech_hoodie");
    ok("a Nike Tech Fleece from the Nike store", r.status === 200 && item(r.j.state, "nike_tech_hoodie").owned, r.j.error);
    ok("a top goes on in the city at once", r.status === 200 && r.j.state.life.cityOutfit.shirt === "#4a4e55" && item(r.j.state, "nike_tech_hoodie").wearing, r.j.state && r.j.state.life.cityOutfit);
    r = await A.act("store:adidas", "buy", "adidas_sst");
    ok("a pair of track pants changes his shorts", r.status === 200 && r.j.state.life.cityOutfit.shorts === "#111111", r.j.error);
    r = await A.act("home", "wear", "nike_tech_hoodie");
    ok("the wardrobe takes the top off", r.status === 200 && r.j.state.life.cityOutfit.shirt === "#e9e6df" && !item(r.j.state, "nike_tech_hoodie").wearing, r.j.error);
    r = await A.act("home", "wear", "nike_tech_hoodie");
    ok("and puts it back on", r.status === 200 && r.j.state.life.cityOutfit.shirt === "#4a4e55", r.j.error);
    r = await A.act("store:adidas", "buy", "nike_af1");
    ok("Adidas do not sell Nike", r.status === 400 && /do not sell/.test(r.j.error || ""), r.j);
    r = await A.act("store:nike", "buy", "nike_tech_hoodie");
    ok("one of each is enough", r.status === 400, r.j);
    r = await A.act("store:nike", "buy", "nike_af1");
    r = await A.act("home", "wear", "nike_af1");
    ok("trainers live in the wardrobe and go on from there", r.status === 200 && item(r.j.state, "nike_af1").wearing && r.j.state.life.cityOutfit.socks === "#f4f4f4", r.j.error);
    r = await A.act("mall", "buy", "zara_tee");
    ok("the mall sells what its stores sell", r.status === 200 && item(r.j.state, "zara_tee").owned, r.j.error);

    // the old shops and old ids keep working
    r = await A.act("mall", "buy", "hoodie");
    ok("the old mall still sells the old hoodie, now a Nike one", r.status === 200 && r.j.state.life.items.find(x => x.id === "hoodie").owned && /Nike/.test(r.j.state.life.items.find(x => x.id === "hoodie").label), r.j.error);
    r = await A.act("shops", "buy", "chain");
    ok("the old shops still sell the old chain, now Tiffany", r.status === 200 && r.j.state.look.necklace === "silver" && /Tiffany/.test(item(r.j.state, "chain").label), r.j.error);

    // the watch boutique and the fame gates
    await A.set({ cash: 2000000, commercial: 0 });
    r = await A.act("watches", "buy", "casio_f91w");
    ok("a Casio for twenty quid, on his wrist in 3D", r.status === 200 && r.j.state.look.watch === "black", r.j.error);
    st = r.j.state;
    ok("the Submariner shows why it is locked", item(st, "rolex_sub").lockReason && !item(st, "rolex_sub").canBuy && item(st, "rolex_sub").need > 0, item(st, "rolex_sub"));
    r = await A.act("watches", "buy", "rolex_sub");
    ok("an unknown cannot buy a Rolex even with the money", r.status === 400 && /name/i.test(r.j.error || ""), r.j);
    await A.set({ commercial: 30 });
    r = await A.act("watches", "buy", "rolex_sub");
    ok("with a name, the first Rolex", r.status === 200 && r.j.state.look.watch === "steel", r.j.error);
    st = r.j.state;
    const mo = st.life.moments.find(m => m.id === "rolex");
    ok("the first Rolex is a moment", mo && mo.seen === false && mo.kind === "watch" && /Rolex/.test(mo.title) && mo.item === "rolex_sub", st.life.moments);
    ok("the first Rolex makes the news and Mum's phone", st.news.some(n => /first Rolex/.test(n.text)) && st.phone.threads.some(t => t.id === "mum" && t.msgs.some(m => /Rolex/.test(m.text))), null);
    r = await A.act("watches", "buy", "rolex_datejust");
    ok("a second Rolex is not a first", r.status === 200 && r.j.state.life.moments.filter(m => m.id === "rolex").length === 1, r.j.error);
    r = await A.act("moments", "seen", "rolex");
    ok("a moment can be marked seen", r.status === 200 && r.j.state.life.moments.find(m => m.id === "rolex").seen === true, r.j.error);
    r = await A.act("watches", "buy", "rm_67");
    ok("a Richard Mille stays out of reach until he is a star", r.status === 400 && /Richard Mille|name/.test(r.j.error || ""), r.j);
    await A.set({ commercial: 85 });
    r = await A.act("watches", "buy", "rm_67");
    ok("a star buys his Richard Mille", r.status === 200 && r.j.state.life.moments.some(m => m.id === "rm"), r.j.error);
    r = await A.act("home", "wear", "casio_f91w");
    ok("the wardrobe swaps the watch", r.status === 200 && r.j.state.look.watch === "black", r.j.error);

    // boots
    r = await A.act("boots", "buy", "nike_superfly_elite");
    ok("Mercurial Superfly Elites go on his feet", r.status === 200 && r.j.state.look.boot === 13 && item(r.j.state, "nike_superfly_elite").wearing, r.j.error);
    r = await A.act("boots", "buy", "puma_ultra_play");
    ok("a cheap pair of Pumas goes on too", r.status === 200 && r.j.state.look.boot === 10, r.j.error);
    r = await A.act("store:gucci", "buy", "gucci_tee");
    ok("a Gucci tee from the Gucci boutique", r.status === 200 && item(r.j.state, "gucci_tee").wearing, r.j.error);

    // cars: age rules, the dealers, the fame gate, the garage
    await A.set({ commercial: 0 });
    r = await A.act("dealer:everyday", "car", "pico");
    ok("a fifteen year old cannot buy a car", r.status === 400 && /old enough/.test(r.j.error || ""), r.j);
    r = await A.act("dealer:bikes", "car", "activa");
    ok("nor a motor scooter", r.status === 400 && /sixteen/.test(r.j.error || ""), r.j);
    r = await A.act("dealer:bikes", "car", "scoot");
    ok("an electric kick scooter is fine at fifteen", r.status === 200 && r.j.state.life.garage.includes("scoot"), r.j.error);
    await A.set({ age: 16 });
    r = await A.act("dealer:bikes", "car", "activa");
    ok("a Honda Activa at sixteen", r.status === 200 && r.j.state.life.car.id === "activa", r.j.error);
    await A.set({ age: 17 });
    r = await A.act("dealer:bikes", "car", "panigale");
    ok("a superbike waits for eighteen", r.status === 400 && /old enough/.test(r.j.error || ""), r.j);
    await A.set({ age: 18 });
    r = await A.act("dealer:everyday", "car", "pico");
    ok("a Toyota Yaris at eighteen, the first car", r.status === 200 && r.j.state.life.moments.some(m => m.id === "car"), r.j.error);
    r = await A.act("dealer:everyday", "car", "gt");
    ok("the Toyota dealer does not sell BMWs", r.status === 400, r.j);
    r = await A.act("dealer:super", "car", "sf90");
    ok("Ferrari will not sell the SF90 to an unknown, even with the money", r.status === 400 && /Ferrari only sells the SF90 to clients they know/.test(r.j.error || ""), r.j);
    st = r.j.state || (await A.state());
    ok("the catalog says why", /Ferrari/.test(car(st, "sf90").lockReason || "") && car(st, "sf90").canBuy === false && car(st, "pico").owned, car(st, "sf90"));
    ok("cars carry their feel", car(st, "sf90").feel.top > car(st, "pico").feel.top && car(st, "sf90").feel.grip > car(st, "landcruiser").feel.grip, null);
    await A.set({ commercial: 85 });
    r = await A.act("dealer:super", "car", "sf90");
    ok("a star drives home in an SF90", r.status === 200 && r.j.state.life.car.id === "sf90" && r.j.state.life.moments.some(m => m.id === "supercar") && r.j.state.news.some(n => /SF90/.test(n.text)), r.j.error);
    r = await A.act("dealer:prestige", "car", "m3");
    st = r.j.state;
    const m3 = car(st, "m3");
    const cash0 = st.money.cash;
    r = await A.act("garage", "sell", "m3");
    const back = r.j.state ? r.j.state.money.cash - cash0 : 0;
    ok("the garage sells a car back at 70 to 85 percent", r.status === 200 && !r.j.state.life.garage.includes("m3") && back >= m3.price * 0.7 && back <= m3.price * 0.85, [back, m3.price]);
    r = await A.act("garage", "sell", "m3");
    ok("you cannot sell what is not in the garage", r.status === 400, r.j);
    r = await A.act("home", "drive", "pico");
    ok("the daily car can be changed", r.status === 200 && r.j.state.life.car.id === "pico" && car(r.j.state, "pico").daily, r.j.error);
    r = await A.act("garage", "drive", "sf90");
    ok("or from the garage", r.status === 200 && r.j.state.life.car.id === "sf90", r.j.error);
    ok("the weekly cost counts the garage", r.j.state.life.weeklyCost >= car(r.j.state, "sf90").upkeep, r.j.state.life.weeklyCost);

    // homes through their places
    r = await A.act("home:apartment", "buy");
    st = r.j.state;
    ok("an apartment bought through its place", r.status === 200 && st.life.home.id === "apartment" && st.life.home.mode === "own" && place(st, "home:apartment").owned && place(st, "home:apartment").living, r.j.error);
    ok("the first home is a moment", st.life.moments.some(m => m.id === "home"), null);
    r = await A.act("home:shared", "rent");
    ok("a shared flat rented through its place", r.status === 200 && r.j.state.life.home.id === "shared" && r.j.state.life.home.mode === "rent", r.j.error);
    r = await A.act("home:apartment", "move");
    ok("moving back into the owned apartment", r.status === 200 && r.j.state.life.home.id === "apartment" && r.j.state.life.home.mode === "own", r.j.error);
    r = await A.act("home:villa", "visit");
    ok("a home can be visited before buying", r.status === 200 && r.j.state.life.visited.includes("home:villa"), r.j.error);
    r = await A.act("home:castle", "buy");
    ok("no such home", r.status === 400, r.j);
    r = await A.act("home", "move", "family:live");
    ok("the old move action still works", r.status === 200 && r.j.state.life.home.id === "family", r.j.error);

    // the supermarket, the cafe, the restaurant
    await A.set({ cash: 5000 });
    st = await A.state();
    r = await A.act("supermarket", "buy", "g_chicken");
    ok("chicken from the supermarket costs money and helps", r.status === 200 && r.j.state.money.cash === st.money.cash - 6 && r.j.state.cond.fitness >= st.cond.fitness, r.j.error);
    for (let i = 0; i < 9; i++) await A.act("supermarket", "buy", "g_bananas");
    r = await A.act("supermarket", "buy", "g_bananas");
    ok("the fridge fills up for the week", r.status === 400 && /fridge/.test(r.j.error || ""), r.j);
    r = await A.act("supermarket", "buy", "g_caviar");
    ok("they do not stock everything", r.status === 400, r.j);
    r = await A.act("cafe:starbucks", "order", "c_flatwhite");
    ok("a flat white at Starbucks, no free time", r.status === 200 && r.j.state.life.time === st.life.time, r.j.error);
    r = await A.act("cafe:costa", "order", "c_flatwhite");
    ok("a cafe that is not in the city", r.status === 400, r.j);
    for (let i = 0; i < 4; i++) await A.act("cafe:starbucks", "order", "c_espresso");
    r = await A.act("cafe:starbucks", "order", "c_espresso");
    ok("five coffees a week is the limit", r.status === 400, r.j);
    r = await A.act("restaurant", "order", "seafood");
    ok("sea bass at the seafront restaurant takes a free evening", r.status === 200 && r.j.state.life.time === st.life.time - 1, r.j.error);
    r = await A.act("restaurant", "healthy");
    ok("the old restaurant call still works", r.status === 200, r.j.error);

    // the nightclub
    r = await A.act("club", "night");
    ok("a night out at eighteen", r.status === 200 && r.j.state.life.time === 0, r.j.error);
    r = await A.act("club", "night");
    ok("a night out needs a free night", r.status === 400 && /free time/.test(r.j.error || ""), r.j);

    // the clinic: an injury, a week off it, once a week
    await A.act("_test", "week");
    r = await A.act("clinic", "treat");
    ok("nothing to treat when fit", r.status === 400, r.j);
    await A.act("_test", "injure", "3");
    st = await A.state();
    r = await A.act("clinic", "treat");
    ok("the clinic cuts a week off the injury", r.status === 200 && r.j.state.cond.inj && r.j.state.cond.inj.weeks === 2 && r.j.state.money.cash < st.money.cash, r.j.error || (r.j.state && r.j.state.cond.inj));
    r = await A.act("clinic", "treat");
    ok("once a week", r.status === 400, r.j);
    r = await A.act("clinic", "checkup");
    ok("no check up while injured", r.status === 400, r.j);
    await A.act("_test", "week");
    await A.act("_test", "injure", "1");
    r = await A.act("clinic", "treat");
    ok("the last week off means back in training", r.status === 200 && !r.j.state.cond.inj, r.j.error);
    r = await A.act("clinic", "checkup");
    ok("a check up guards against knocks", r.status === 200 && r.j.state.life.week.guarded === true, r.j.error);

    // fans in the street
    await A.act("_test", "week");
    await A.set({ commercial: 0 });
    const B = await career("Nobody", { first: "Kiran" });
    r = await B.act("street", "fan", "photo");
    ok("nobody wants a photo with an unknown", r.status === 400 && /recognises/.test(r.j.error || ""), r.j);
    r = await B.act("street", "fan", "chat");
    ok("but anyone can chat", r.status === 200, r.j.error);
    await B.act("street", "fan", "chat"); await B.act("street", "fan", "chat");
    r = await B.act("street", "fan", "chat");
    ok("the street is rate limited each week", r.status === 400, r.j);
    await B.set({ commercial: 20 });
    await B.act("_test", "week");
    st = await B.state();
    r = await B.act("street", "fan", "photo");
    ok("once known, a fan asks for a photo", r.status === 200 && r.j.state.life.followers > st.life.followers, r.j.error);

    // ---------- a move: the whole city changes ----------
    r = await A.act("_test", "city", "London");
    st = r.j.state;
    ok("London has its own places", place(st, "mall").name === "Westfield London" && /Tesco|Sainsbury/.test(place(st, "supermarket").name) && st.life.world.places.some(p => p.name === "Costa Coffee" || p.name === "Pret A Manger" || p.name === "Gail's"), [place(st, "mall").name, place(st, "supermarket").name]);
    ok("a new city has a new seed and no family home", st.life.world.seed !== lw.seed && !place(st, "home:family") && place(st, "home:mansion").name.includes("Bishops"), null);
    ok("the list of visited places starts again", st.life.visited.length === 0, st.life.visited);
    ok("his garage and wardrobe come with him", st.life.garage.includes("sf90") && item(st, "gucci_tee").owned, null);
    r = await A.act("cafe:starbucks", "order", "c_flatwhite");
    ok("the Mumbai Starbucks is now a London one", r.status === 200 && /Starbucks/.test(r.j.text || ""), r.j.error);
    r = await A.act("_test", "city", "Madrid");
    st = r.j.state;
    ok("Madrid is inland: no seafront", place(st, "restaurant").where !== "seafront" && /Carrefour|Mercadona/.test(place(st, "supermarket").name), place(st, "restaurant"));
    ok("and no sea bass by the water on the menu", !st.life.catalog.menus.restaurant.some(m => m.id === "seafood"), null);
    r = await A.act("restaurant", "order", "seafood");
    ok("so it cannot be ordered there", r.status === 400, r.j);
    r = await A.act("_test", "city", "Shillong");
    st = r.j.state;
    const big = (await api(`/api/pc/state?code=${B.code}&name=Nobody`)).j.state;
    ok("Shillong is a small city with fewer places", st.life.world.tier === 1 && st.life.world.places.length < big.life.world.places.length, [st.life.world.tier, st.life.world.places.length, big.life.world.places.length]);
    ok("no luxury row, no supercars, no Richard Mille in a small city", !place(st, "store:gucci") && !place(st, "dealer:super") && !place(st, "dealer:prestige") && !st.life.catalog.items.some(x => x.id === "rm_011") && !st.life.catalog.cars.some(x => x.id === "roma"), null);
    ok("a small city still has the basics", ["mall", "supermarket", "restaurant", "club", "clinic", "gym", "training", "stadium", "watches", "boots", "store:nike", "dealer:everyday", "dealer:bikes"].every(id => place(st, id)) && st.life.world.places.some(p => p.name === "Cafe Coffee Day"), st.life.world.places.map(p => p.id));
    r = await A.act("store:gucci", "buy", "gucci_polo");
    ok("a shop that is not in this city sells nothing", r.status === 400, r.j);
    r = await A.act("dealer:super", "car", "roma");
    ok("a dealer that is not in this city sells nothing", r.status === 400, r.j);
    ok("what he owns still shows in a small city", item(st, "rm_67") && item(st, "rm_67").owned && car(st, "sf90") && car(st, "sf90").owned, null);
    // every shop has a door the city can show: a mall holds at most its seven units, the rest stand on the street
    const shopDoors = [];
    for (const city of ["Manchester", "London", "Madrid", "Mumbai", "Glasgow", "Lisbon", "Milan", "Riyadh", "Kolkata", "Shillong"]) {
      const w = (await A.act("_test", "city", city)).j.state.life.world, mall = w.places.find(p => p.id === "mall");
      const inMall = w.places.filter(p => p.where === "mall" && p.kind !== "mall").map(p => p.id);
      shopDoors.push({ city, tier: w.tier, n: mall.inside.length, same: inMall.length === mall.inside.length && inMall.every(id => mall.inside.includes(id)), watches: (w.places.find(p => p.id === "watches") || {}).where });
    }
    ok("every shop has a door: a mall holds at most its seven units, the rest (the watch boutique too) stand on the street", shopDoors.every(x => x.n <= 7 && x.same && x.watches), shopDoors);
    st = (await A.act("_test", "city", "Shillong")).j.state;
    // a week in the new city: he gets a place to live there
    const wk = await A.week();
    st = wk && wk.j.state;
    ok("a week in a new city finds him somewhere to live", st && st.life.home.city === "Shillong" && st.life.world.places.some(p => p.kind === "home" && p.living), st && st.life.home);

    // ---------- an English academy boy: Manchester ----------
    const E = await career("Mcr", { first: "Jack", last: "Hughes", country: "England", nat: "England", lang: "English", dobY: 2011 });
    st = await E.state();
    ok("an English career starts in Manchester", st.life.city === "Manchester" && place(st, "mall").name === "Trafford Centre" && place(st, "home:mansion").name.includes("Alderley Edge"), [st.life.city, place(st, "mall") && place(st, "mall").name]);
    ok("an English supermarket and coffee", /Tesco|Sainsbury/.test(place(st, "supermarket").name) && st.life.world.places.some(p => p.name === "Starbucks"), place(st, "supermarket").name);

    // ---------- the schools, colleges and clubs as places with their own grounds (campus.js) ----------
    const G = await career("Grounds");
    st = await G.state();
    const ownP = st.life.world.places.find(p => p.inst && p.inst.mine);
    ok("his own school is a place on the map, in its own colours", ownP && ownP.id === "school" && ownP.kind === "school" && ownP.name === "American School of Bombay" && ownP.inst.cols.length === 2 && /^#/.test(ownP.style.accent), ownP);
    const otherSchools = st.life.world.places.filter(p => p.kind === "school" && !p.inst.mine);
    ok("more of the city's schools have grounds too (a few, not all)", otherSchools.length >= 2 && otherSchools.length <= 4 && otherSchools.every(p => p.id.startsWith("school:")), otherSchools.map(p => p.id));
    ok("no made up training pitches when he has a school pitch", !st.life.world.places.some(p => p.id === "training" && !p.inst), null);
    ok("the city's club has its training ground and its stadium", st.life.world.places.some(p => p.kind === "training" && p.inst && !p.inst.mine) && st.life.world.places.some(p => p.kind === "stadium" && p.inst), null);
    const t0 = st.life.time;
    r = await G.act("school", "class");
    ok("a class at school uses free time", r.status === 200 && r.j.state.life.time === t0 - 1, r.j.error);
    await G.act("school", "class");
    r = await G.act("school", "class");
    ok("two classes a week at most", r.status === 400, r.j);
    r = await G.act("school", "canteen");
    ok("lunch in the school canteen", r.status === 200, r.j.error);
    r = await G.act("school", "canteen");
    ok("the canteen once a week", r.status === 400, r.j);
    r = await G.act("training", "physio");
    ok("no physio room at a school", r.status === 400, r.j);
    r = await G.act(otherSchools[0].id, "class");
    ok("classes only at his own school", r.status === 400, r.j);
    // a live school match: at his school when at home, at the other school when away
    let venue = null, fxHome = null;
    for (let i = 0; i < 14 && !venue; i++) {
      const s3 = await G.state();
      if (s3.play && s3.play.can) {
        const pk = await G.P("/api/pc/matchstart", { peek: true });
        if (pk.status === 200) { venue = pk.j.venue || (pk.j.setup && pk.j.setup.venue); fxHome = pk.j.home || (pk.j.setup && pk.j.setup.home); }
        break;
      }
      await G.week();
    }
    ok("a school match is at the home side's school, a field in daylight", venue && venue.kind === "school" && venue.host === fxHome && venue.daylight === true && venue.crowd > 0 && venue.crowd < 1, [venue, fxHome]);
    // the rules on their own: standing, venues by kind, home and away
    {
      const { makeCampus } = require("../floodlights/career/campus");
      const game = { clubs: { "Man City": {}, "Man United": {}, Brighton: {} } };
      const cc = { stage: "college", college: "wifc", person: {}, city: "Pune" };
      const K = { C: () => cc, me: () => ({ club: null }), clubLevel: (g, n) => ({ "Man City": 86, "Man United": 80, Brighton: 74 })[n] || 62, cityOf: (g, n) => (n === "Brighton" ? "Brighton" : "Manchester"), trainOne: () => 0, msg() {}, money() {} };
      const CM = makeCampus(K, { kitOf: n => (n === "Man City" ? ["#6cabdd", "#1c2c5b"] : null) });
      ok("a school's standing follows its facilities and fees", CM.school("dais").standing > CM.school("local").standing + 3, [CM.school("dais").standing, CM.school("local").standing]);
      ok("a college's standing follows its reputation and facilities", CM.college("ncfe").standing >= CM.college("mccs").standing + 2, [CM.college("ncfe").standing, CM.college("mccs").standing]);
      ok("a bigger club has the bigger ground, the real names for the big ones", CM.club(game, "Man City").standing > CM.club(game, "Brighton").standing && CM.club(game, "Man City").ground === "City Football Academy" && CM.club(game, "Man United").ground === "Carrington" && CM.club(game, "Man City").cols[0] === "#6cabdd", [CM.club(game, "Man City"), CM.club(game, "Brighton").standing]);
      const v1 = CM.venueFor(game, "Western India Football College", "Goa University");
      ok("a college home game is at his college, in daylight", v1.kind === "college" && v1.name === "Western India Football College" && v1.daylight, v1);
      const v2 = CM.venueFor(game, "Christ University", "Western India Football College");
      ok("an away college game is at the other side's ground", v2.kind === "college" && v2.host === "Christ University" && v2.seed !== v1.seed, v2);
      cc.stage = "academy"; cc.academy = { club: "Man City" };
      const v3 = CM.venueFor(game, "Brighton U18", "Man City U18");
      ok("an academy game is at the home club's training ground", v3.kind === "academy" && /academy pitch/.test(v3.name) && v3.host === "Brighton U18", v3);
      cc.stage = "pro";
      const v4 = CM.venueFor(game, "Man United", "Man City", { pro: true });
      ok("a pro game is at the home club's stadium under the lights, with a big crowd", v4.kind === "pro" && v4.name === "Old Trafford" && !v4.daylight && v4.crowd > 0.8, v4);
      cc.stage = "school"; cc.school = "asb"; cc.city = "Mumbai";
      const ms = CM.places(game, "Mumbai");
      ok("Mumbai shows his school and four more", ms.filter(p => p.kind === "school").length === 5 && ms.find(p => p.id === "school").inst.mine, ms.map(p => p.id));
      cc.stage = "academy";
      const mc = CM.places(game, "Manchester");
      ok("Manchester: his academy's training ground and its stadium keep the old ids, the other club has both too", mc.some(p => p.id === "training" && p.inst.academy) && mc.some(p => p.id === "stadium" && p.name === "Etihad Stadium") && mc.some(p => p.id === "training:manunited" && p.name === "Carrington") && mc.some(p => p.id === "stadium:manunited"), mc.map(p => p.id + " " + p.name));
    }

    // ---------- friends (social.js): classmates on the grounds, talking, numbers, texts, hang outs, events ----------
    {
      const Fr = await career("Pals");
      let s = await Fr.state();
      const here = s.social.present.school || [];
      ok("classmates on his school grounds this week, real people with names and looks", here.length >= 3 && here.every(p => p.name && p.look && p.outfit && p.h > 140 && p.role === "Classmate"), here.map(p => p.name));
      ok("the class sits in the classroom and the canteen has people too", (s.social.present["school/classroom"] || []).length >= 4 && (s.social.present["school/canteen"] || []).length >= 2, Object.keys(s.social.present));
      const all = here.concat(s.social.present["school/classroom"] || []);
      ok("a school is mixed, everyone in its uniform", all.some(p => p.fem) && all.some(p => !p.fem) && all.every(p => p.outfit.shirt === "#f4f4f4"), all.map(p => [p.fem, p.outfit.shirt]));
      const who = here[0], w2 = here[1];
      r = await Fr.act("school", "talk", who.id);
      const talk = r.j.state && r.j.state.social.talk;
      ok("walking up to someone starts a chat: their line and three things to say", r.status === 200 && talk && talk.line && talk.choices.length === 3 && talk.id === who.id, r.j.error || talk);
      r = await Fr.act("school", "say", "good");
      const t2 = r.j.state.social.talk;
      ok("listening to what they are into goes well", r.status === 200 && t2.said && t2.result && t2.rel > 30, t2);
      ok("a chat takes no free time", r.j.state.life.time === s.life.time, [r.j.state.life.time, s.life.time]);
      r = await Fr.act("school", "talk", "s:nobody:1");
      ok("you cannot talk to someone who is not there", r.status === 400, r.j);
      await Fr.act("school", "talk", w2.id);
      await Fr.act("school", "say", "football");
      r = await Fr.act("school", "number", w2.id);
      ok("no swapping numbers with someone you just met", r.status === 400, r.j);
      for (let i = 0; i < 4; i++) { await Fr.act("school", "talk", who.id); await Fr.act("school", "say", "good"); }
      s = await Fr.state();
      const f = s.social.friends.find(x => x.id === who.id);
      ok("talking again builds a friendship (the first chat of the week counts most)", f && f.rel >= 40 && f.rel < 70 && f.level === "Friend", f);
      ok("friends are in the People panel with a role and a level", f && f.role === "Classmate" && f.trait && f.likes.length === 2, f);
      r = await Fr.act("school", "say", "number");
      ok("then you swap numbers and their chat appears on the phone", r.status === 200 && r.j.state.phone.threads.some(t => t.id === "f:" + who.id), r.j.error);
      const tBefore = r.j.state.life.time;
      r = await Fr.act("school", "hang", who.id);
      ok("hanging out takes a free evening and brings you closer", r.status === 200 && r.j.state.life.time === tBefore - 1 && /^With /.test(r.j.text || "") && r.j.state.social.friends.find(x => x.id === who.id).rel > f.rel, r.j.error || r.j.text);
      r = await Fr.act("school", "hang", who.id);
      ok("one hang out with the same friend a week", r.status === 400, r.j);
      let txt = null;
      for (let i = 0; i < 10 && !txt; i++) {
        await Fr.week();
        s = await Fr.state();
        const th = s.phone.threads.find(t => t.id === "f:" + who.id);
        const m = th ? th.msgs.findIndex(x => x.replies && x.answered === undefined && !x.expired) : -1;
        if (m >= 0) txt = { m };
      }
      ok("a friend with your number texts you, with replies to pick from", !!txt, null);
      if (txt) {
        r = await Fr.act("phone", "text", "f:" + who.id + "|" + txt.m + "|0");
        const th2 = r.j.state && r.j.state.phone.threads.find(t => t.id === "f:" + who.id);
        ok("answering puts your reply in the chat", r.status === 200 && th2.msgs[th2.msgs.length - 1].mine && th2.msgs[txt.m].answered === 0, r.j.error);
        r = await Fr.act("phone", "text", "f:" + who.id + "|" + txt.m + "|1");
        ok("a text is answered once", r.status === 400, r.j);
      }
      // the life events know his closest friend
      s = await Fr.state();
      const close = s.social.friends[0];
      if (close.rel < 55) { for (let i = 0; i < 3; i++) { const p0 = (await Fr.state()).social.present; const at = Object.keys(p0).find(k => p0[k].some(x => x.id === close.id)); if (at) { await Fr.act(at, "talk", close.id); await Fr.act(at, "say", "good"); } await Fr.week(); } }
      s = await Fr.state();
      r = await Fr.set({ event: "friendparty" });
      s = await Fr.state();
      const pend = s.people.pending;
      const top = s.social.friends[0];
      ok("a life event about his closest friend names them", r.status === 200 && pend && pend.id === "friendparty" && pend.title.includes(top.name.split(" ")[0]), [r.j.error, pend && pend.title, top]);
      if (pend && pend.id === "friendparty") {
        r = await Fr.P("/api/pc/event", { id: "friendparty", choice: "all" });
        ok("going to the party brings that friend closer, the same relationship numbers", r.status === 200 && r.j.state.social.friends.find(x => x.id === top.id).rel > top.rel, r.j.error);
      }
      ok("friends and chats have no NaN", !hasNaN(s.social), null);
      // an academy boy's people are his teammates, in the club's training kit
      const dE = (await E.state()).decisions.find(d => d.kind === "academy");
      if (dE) await E.P("/api/pc/decide", { id: dE.id, choice: dE.options[0] });
      const se = await E.state();
      const lads = se.social.present.training || [];
      ok("at the academy the people are teammates in training kit", lads.length >= 3 && lads.every(p => p.kind === "teammate" && !p.fem && p.role === "Teammate" && p.outfit.shirt === lads[0].outfit.shirt), lads.map(p => [p.name, p.role, p.outfit.shirt]));
      ok("the dressing room has the lads in it", (se.social.present["training/changing"] || []).length >= 4, Object.keys(se.social.present));
    }

    // ---------- dating (social.js): college onwards and eighteen, meeting, her number, dates, stages ----------
    {
      let s = await (async () => { const x = await career("Pals2"); return { x, st: await x.state() }; })();
      ok("no dating at school or under eighteen", s.st.social.dating.eligible === false && !Object.values(s.st.social.present).some(l => l.some(p => p.kind === "date")), s.st.social.dating.eligible);
      // the pool on its own: 240 different women in each part of the world
      {
        const { makeSocial } = require("../floodlights/career/social");
        for (const reg of ["in", "w"]) {
          const SO = makeSocial({ C: () => ({ city: reg === "in" ? "Mumbai" : "Manchester", person: { country: reg === "in" ? "India" : "England" }, stage: "college" }), me: () => ({ age: 19 }), msg() {} });
          const ppl = Array.from({ length: 240 }, (_, i) => SO.find({}, "d:" + reg + ":" + i));
          ok("240 distinct women to meet (" + reg + "): names, looks and personalities all different", new Set(ppl.map(p => p.name)).size === 240 && ppl.every(p => p.fem && p.look.fem && p.look.hair >= 0 && p.trait && p.likes.length === 2) && new Set(ppl.map(p => JSON.stringify(p.look))).size === 240 && new Set(ppl.map(p => p.trait)).size >= 7, ppl.slice(0, 3).map(p => p.name));
          ok("varied looks: long and short hair, skirts, dresses and trousers (" + reg + ")", new Set(ppl.map(p => p.look.hair)).size >= 6 && new Set(ppl.map(p => p.outfit.bottom)).size >= 3, null);
        }
      }
      const dE = (await E.state()).decisions.find(d => d.kind === "academy");
      if (dE) await E.P("/api/pc/decide", { id: dE.id, choice: dE.options[0] });
      await E.set({ age: 19, cash: 80000 });
      let st = await E.state();
      const dz = st.social.dating;
      const venues = Object.entries(st.social.present).filter(([k, l]) => l.some(p => p.kind === "date"));
      ok("from eighteen, away from school: women to meet at the cafes, the mall, the gym, the restaurant and the club", dz.eligible && venues.length >= 4 && venues.every(([k, l]) => /^(cafe:|mall|club|restaurant|gym)/.test(k)) && venues.every(([k, l]) => l.filter(p => p.kind === "date").every(p => p.fem && p.age >= 18)), venues.map(([k]) => k));
      // meet someone and get her number (it can take a few tries)
      let her = null, at = null;
      for (const [place, l] of venues) {
        for (const p of l.filter(x => x.kind === "date")) {
          r = await E.act(place, "talk", p.id);
          if (r.status !== 200) continue;
          await E.act(place, "say", "good");
          for (let i = 0; i < 2; i++) { await E.act(place, "talk", p.id); await E.act(place, "say", "good"); }
          const t = (await E.state()).social.talk;
          if (t && t.follow.some(x => x.id === "number")) {
            r = await E.act(place, "say", "number");
            await E.act(place, "bye");
            st = await E.state();
            if (st.social.dating.contacts.some(x => x.id === p.id)) { her = p; at = place; break; }
          } else await E.act(place, "bye");
        }
        if (her) break;
      }
      ok("chatting her up well and asking: her number, her chat on the phone", !!her && st.phone.threads.some(t => t.id === "f:" + her.id), at);
      if (her) {
        // a few more chats so she says yes to a first date
        for (let i = 0; i < 3; i++) { const p0 = (await E.state()).social.present; const pl = Object.keys(p0).find(k => p0[k].some(x => x.id === her.id)); if (pl) { await E.act(pl, "talk", her.id); await E.act(pl, "say", "good"); await E.act(pl, "bye"); } }
        await E.act("_test", "social", her.id + "|talking|60");
        await E.act("_test", "week");
        r = await E.act("phone", "askout", her.id + "|restaurant|25|0|18");
        ok("a date has to be later today on the city clock", r.status === 400, r.j);
        const t0 = (await E.state()).life.time;
        r = await E.act("phone", "askout", her.id + "|restaurant|20|0|18");
        const plan = r.j.state && r.j.state.social.dating.plan;
        ok("asking her out over text: a place and a time, her yes on the phone, a free evening booked", r.status === 200 && plan && plan.place === "restaurant" && plan.hour === 20 && plan.status === "set" && r.j.state.life.time === t0 - 1, r.j.error || plan);
        r = await E.act("phone", "askout", her.id + "|cafe|21|0|18");
        ok("one date a week", r.status === 400, r.j);
        r = await E.act("mall", "date", "20");
        ok("the date is where you said", r.status === 400, r.j);
        const cash0 = (await E.state()).money.cash;
        r = await E.act("restaurant", "date", "20.2");
        let sc = r.j.state && r.j.state.social.dating.scene;
        ok("at the restaurant the date starts: her line and three things to say", r.status === 200 && sc && sc.beat && sc.beat.choices.length === 3 && sc.keys.length === 4, r.j.error || sc);
        for (const pick of ["compliment", "order:150", "ask", "again"]) { r = await E.act("restaurant", "datesay", pick); }
        sc = r.j.state.social.dating.scene;
        ok("a good date: it went well, dinner was paid, and now you are seeing each other", sc.result && sc.result.res !== "bad" && r.j.state.money.cash < cash0 && r.j.state.social.dating.partner && r.j.state.social.dating.partner.id === her.id && r.j.state.social.dating.partner.stage === "dating", [sc.result, r.j.state.social.dating.partner]);
        await E.act("restaurant", "dateend");
        // a present from the shops for her
        st = await E.state();
        const item = st.life.catalog.items.find(x => !x.owned && x.price < 2000 && x.store && x.store.startsWith("store:"));
        const rel0 = st.social.dating.partner.rel, c0 = st.money.cash;
        r = await E.act(item.store, "gift", item.id);
        ok("a present for her: paid for, not in your wardrobe, and she loves it", r.status === 200 && r.j.state.money.cash === c0 - item.price && !r.j.state.life.catalog.items.find(x => x.id === item.id).owned && r.j.state.social.dating.partner.rel > rel0, r.j.error);
        // a life event about her
        r = await E.set({ event: "moretime" });
        st = await E.state();
        const pend = st.people.pending;
        ok("life events about her: she wants more of your time", r.status === 200 && pend && pend.title.includes(her.first), [r.j.error, pend && pend.title]);
        if (pend) { const rb = st.social.dating.partner.rel; r = await E.P("/api/pc/event", { id: "moretime", choice: "no" }); ok("telling her football always comes first hurts", r.status === 200 && r.j.state.social.dating.partner.rel < rb, r.j.error); }
        // stood up: a date that never happens
        await E.act("_test", "week");
        st = await E.state();
        r = await E.act("phone", "askout", her.id + "|cafe|21|0|18");
        const relB = (await E.state()).social.dating.partner.rel;
        await E.week();
        st = await E.state();
        ok("forgetting a date: she waited, she is hurt, and she says so", st.social.dating.plan === null && st.social.dating.partner.rel < relB - 8 && st.phone.threads.find(t => t.id === "f:" + her.id).msgs.some(m => /waited/.test(m.text)), [relB, st.social.dating.partner && st.social.dating.partner.rel]);
        // ending it
        r = await E.act("phone", "breakup", her.id);
        ok("ending it: she is an ex and nobody is your partner", r.status === 200 && r.j.state.social.dating.partner === null && !r.j.state.social.dating.contacts.some(x => x.id === her.id), r.j.error);
        ok("dating has no NaN", !hasNaN(r.j.state.social), null);
      }
      // ---------- the ring, the question, the wedding, married life ----------
      {
        st = await E.state();
        const two = Object.values(st.social.present).flat().find(p => p.kind === "date" && (!her || p.id !== her.id));
        r = await E.act("watches", "ring", "halo");
        ok("no ring while nobody is serious", r.status === 400, r.j);
        await E.act("_test", "social", two.id + "|serious|90|5|8");
        await E.act("_test", "week");
        await E.set({ cash: 900000 });
        r = await E.act("watches", "ring", "solitaire");
        ok("the ring from the boutique, once it is serious", r.status === 200 && r.j.state.social.dating.ring && r.j.state.social.dating.ring.id === "solitaire" && r.j.state.money.cash === 900000 - 6500, r.j.error);
        r = await E.act("watches", "ring", "graff");
        ok("one ring in the pocket at a time", r.status === 400, r.j);
        r = await E.act("phone", "askout", two.id + "|restaurant|20|0|18");
        r = await E.act("restaurant", "date", "20");
        for (const pick of ["compliment", "order:150", "ask"]) r = await E.act("restaurant", "datesay", pick);
        const close = r.j.state.social.dating.scene.beat;
        ok("at the end of a date with a ring in your pocket: take it out", close && close.choices.some(c => c.id === "propose"), close);
        r = await E.act("restaurant", "datesay", "propose");
        const res = r.j.state.social.dating.scene.result;
        ok("she says yes: engaged, in the news, the ring on her hand", res && res.proposal === "yes" && r.j.state.social.dating.partner.stage === "engaged" && !r.j.state.social.dating.ring && r.j.state.news.some(n => /engaged/.test(n.text)), res);
        await E.act("restaurant", "dateend");
        st = await E.state();
        r = await E.act("phone", "wedding", "huge");
        ok("a wedding costs real money: too big for the bank says no", st.money.cash < 400000 ? r.status === 400 : r.status === 200, [st.money.cash, r.j.error]);
        if (r.status === 400) r = await E.act("phone", "wedding", "big");
        const fol0 = (await E.state()).life.followers, cashW = (await E.state()).money.cash;
        ok("the wedding is booked for today, with guests: family first", r.status === 200 && r.j.state.social.dating.wedding.status === "today" && (r.j.state.social.present.wedding || []).length >= 10 && r.j.state.social.present.wedding[0].name === "Mum", r.j.error);
        r = await E.act("wedding", "wedstart");
        for (const pick of ["watch", "own", "slow"]) r = await E.act("wedding", "wedsay", pick);
        st = r.j.state;
        ok("married: paid for, in the news, more followers, a happier man", st.social.dating.partner.stage === "married" && st.money.cash < cashW && st.news.some(n => /marries/.test(n.text)) && st.life.followers > fol0 && st.social.dating.wscene.result, [st.social.dating.partner.stage, st.money.cash, cashW]);
        await E.act("wedding", "wedend");
        st = await E.state();
        const homeP = Object.entries(st.social.present).find(([k, v]) => k.startsWith("home:") && v.some(p => p.id === two.id));
        ok("his wife lives at home with him: she is there when he walks in", !!homeP && homeP[1][0].role === "Your wife", Object.keys(st.social.present));
        r = await E.act(homeP ? homeP[0] : "home", "talk", two.id);
        ok("and they talk at home", r.status === 200 && r.j.state.social.talk && r.j.state.social.talk.line, r.j.error);
        await E.act(homeP ? homeP[0] : "home", "bye");
        r = await E.set({ event: "wifemum" });
        st = await E.state();
        ok("married life in the drama: Mum and his wife disagree", r.status === 200 && st.people.pending && st.people.pending.id === "wifemum" && st.people.pending.title.includes(two.first), [r.j.error, st.people.pending && st.people.pending.title]);
        if (st.people.pending) {
          const rb = st.social.dating.partner.rel, mb = st.people.family.find(f => f.id === "mum").rel;
          r = await E.P("/api/pc/event", { id: "wifemum", choice: "wife" });
          ok("backing his wife: she is closer (or as close as can be), Mum is not pleased", r.status === 200 && (r.j.state.social.dating.partner.rel > rb || rb === 100) && r.j.state.people.family.find(f => f.id === "mum").rel < mb, [rb, r.j.error]);
        }
        r = await E.act("phone", "breakup", two.id);
        ok("a marriage is not ended with a text", r.status === 400, r.j);
        for (let i = 0; i < 3; i++) await E.week();
        st = await E.state();
        ok("weeks of married life: still married, texts from her, no NaN", st.social.dating.partner && st.social.dating.partner.stage === "married" && st.phone.threads.find(t => t.id === "f:" + two.id).msgs.length >= 3 && !hasNaN(st.social), null);
      }
    }

    // ---------- nothing is NaN, no dashes in the text ----------
    for (const [n, x] of [["Mumbai", A], ["Nobody", B], ["Manchester", E]]) {
      const s = await x.state();
      ok(n + " career has no NaN", !hasNaN(s), null);
      const t = JSON.stringify(s.life);
      ok(n + " life text has no em or en dashes", !t.includes(EM) && !t.includes(EN), null);
    }
    // a season of weeks with a rich life: bills, garage, sponsors and all, nothing breaks
    await A.set({ cash: 50000 });
    let weeks = 0;
    for (let i = 0; i < 12; i++) { const w = await A.week(); if (w && w.status === 200) weeks++; }
    st = await A.state();
    ok("weeks go by with a full garage and wardrobe", weeks >= 10 && !hasNaN(st) && st.money.log.some(x => /Garage|Car costs/.test(x.text)), weeks);
  } finally {
    stop();
  }
  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.log("FAIL: battery crashed", e.stack); console.log(passed + " passed, " + (failed + 1) + " failed"); process.exit(1); });
