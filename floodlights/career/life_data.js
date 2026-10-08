// Player Career: the life off the pitch. Homes, cars, shops, food, the gym, sponsors and the city itself.
// Real brands and real products (this is a personal project). Prices are in pounds at about UK retail; the
// screens convert them to the player's own money. Every id a save can hold is kept for good: an old id only
// changes what it shows (the made up brands became real ones), never what it is.

// ---------- homes: from the family flat to a mansion on the hill ----------
// rent is a week; buy is the full price (bought homes cost only upkeep). mood lifts morale a little every week.
const HOMES = [
  { id: "family", tier: 0, label: "The family home", rent: 0, buy: 0, upkeep: 0, mood: 1, rooms: 2, note: "Mum's cooking, your old bedroom, no rent." },
  { id: "hostel", tier: 0, label: "Hostel room", rent: 0, buy: 0, upkeep: 0, mood: 0, rooms: 1, note: "A bed, a desk, a window, and the team down the corridor." },
  { id: "shared", tier: 1, label: "Shared flat", rent: 70, buy: 0, upkeep: 0, mood: 0, rooms: 2, note: "Two bedrooms, one bathroom, a flatmate who never washes up." },
  { id: "apartment", tier: 2, label: "City apartment", rent: 260, buy: 260000, upkeep: 30, mood: 2, rooms: 3, note: "Your own place. A balcony and a view of the lights." },
  { id: "penthouse", tier: 3, label: "Penthouse", rent: 1400, buy: 1800000, upkeep: 160, mood: 4, rooms: 4, note: "Top floor, glass on every side, a lift that opens into the living room." },
  { id: "villa", tier: 4, label: "Gated villa", rent: 4200, buy: 5200000, upkeep: 480, mood: 5, rooms: 5, note: "A garden, a pool, a gate, and quiet." },
  { id: "mansion", tier: 5, label: "Hilltop mansion", rent: 11000, buy: 16000000, upkeep: 1300, mood: 6, rooms: 7, note: "A cinema room, a garage for ten cars, a gym of your own." }
];

// ---------- vehicles ----------
// The first seven ids are the old ones (a save can hold them). dealer: the place that sells it.
// minAge: an electric kick scooter at any age, a motor scooter at 16, a car or a superbike at 18.
// feel: top speed in metres a second, acceleration in metres a second squared (0 to 100 km/h averaged),
// grip 0.6 to 1.2, mass in kg. upkeep: a week of insurance, fuel, tyres and servicing for a young footballer.
// need: how big his name has to be (commercial reputation, 0 to 100) before the maker will sell him one.
const CARS = [
  { id: "scoot", tier: 0, brand: "Xiaomi", model: "Electric Scooter 4 Pro", price: 600, upkeep: 3, flash: 0, colour: "#2b2f36", body: "scooter", dealer: "dealer:bikes", minAge: 14, feel: { top: 7, accel: 1.8, grip: 0.62, mass: 17 } },
  { id: "pico", tier: 1, brand: "Toyota", model: "Yaris Hybrid", price: 22500, upkeep: 35, flash: 1, colour: "#e8e4dc", body: "hatch", dealer: "dealer:everyday", minAge: 18, feel: { top: 49, accel: 2.9, grip: 0.8, mass: 1100 } },
  { id: "aero", tier: 2, brand: "Toyota", model: "Corolla Hybrid", price: 31500, upkeep: 45, flash: 1, colour: "#1d2a44", body: "saloon", dealer: "dealer:everyday", minAge: 18, feel: { top: 50, accel: 3.0, grip: 0.82, mass: 1400 } },
  { id: "gt", tier: 3, brand: "BMW", model: "M4 Competition", price: 86000, upkeep: 150, flash: 4, colour: "#0d0f12", body: "coupe", dealer: "dealer:prestige", minAge: 18, feel: { top: 81, accel: 7.1, grip: 1.0, mass: 1725 } },
  { id: "corsa", tier: 4, brand: "Porsche", model: "911 Turbo S", price: 196000, upkeep: 300, flash: 7, colour: "#c8102e", body: "sports", dealer: "dealer:prestige", minAge: 18, feel: { top: 89, accel: 11.1, grip: 1.12, mass: 1640 } },
  { id: "regent", tier: 4, brand: "Mercedes-AMG", model: "G 63", price: 186000, upkeep: 300, flash: 6, colour: "#20262b", body: "suv", dealer: "dealer:prestige", minAge: 18, need: 22, feel: { top: 61, accel: 6.2, grip: 0.78, mass: 2560 } },
  { id: "hypra", tier: 5, brand: "Ferrari", model: "F80", price: 3000000, upkeep: 2600, flash: 12, colour: "#b80d1e", body: "hyper", dealer: "dealer:super", minAge: 18, need: 88, feel: { top: 97, accel: 12.9, grip: 1.2, mass: 1525 },
    lockReason: "Ferrari offers the F80 to a few hundred clients in the world, by invitation. You are not on the list yet." }
];
const MORE_CARS = [
  // the everyday dealer: Toyota and Honda
  { id: "aygo", brand: "Toyota", model: "Aygo X", price: 16500, upkeep: 30, flash: 0, colour: "#c8102e", body: "hatch", dealer: "dealer:everyday", feel: { top: 44, accel: 1.9, grip: 0.78, mass: 940 } },
  { id: "civic", brand: "Honda", model: "Civic e:HEV", price: 33500, upkeep: 45, flash: 1, colour: "#9aa3ad", body: "hatch", dealer: "dealer:everyday", feel: { top: 50, accel: 3.6, grip: 0.85, mass: 1450 } },
  { id: "typer", brand: "Honda", model: "Civic Type R", price: 50000, upkeep: 90, flash: 2, colour: "#f2f2f2", body: "hatch", dealer: "dealer:everyday", feel: { top: 76, accel: 5.1, grip: 1.0, mass: 1430 } },
  { id: "rav4", brand: "Toyota", model: "RAV4 Hybrid", price: 37000, upkeep: 55, flash: 1, colour: "#3f5a46", body: "suv", dealer: "dealer:everyday", feel: { top: 50, accel: 3.4, grip: 0.8, mass: 1700 } },
  { id: "landcruiser", brand: "Toyota", model: "Land Cruiser", price: 70000, upkeep: 110, flash: 3, colour: "#d8d2c4", body: "suv", dealer: "dealer:everyday", feel: { top: 49, accel: 2.5, grip: 0.72, mass: 2400 } },
  // the prestige dealer: BMW M, Mercedes-AMG, Brabus, Porsche, Range Rover
  { id: "m3", brand: "BMW", model: "M3 Competition", price: 83000, upkeep: 140, flash: 3, colour: "#2a5bd7", body: "saloon", dealer: "dealer:prestige", feel: { top: 69, accel: 7.1, grip: 0.98, mass: 1730 } },
  { id: "m5", brand: "BMW", model: "M5", price: 110000, upkeep: 190, flash: 4, colour: "#3a3f47", body: "saloon", dealer: "dealer:prestige", feel: { top: 85, accel: 7.9, grip: 0.97, mass: 2435 } },
  { id: "c63", brand: "Mercedes-AMG", model: "C 63 S E Performance", price: 100000, upkeep: 170, flash: 4, colour: "#c8ccd2", body: "saloon", dealer: "dealer:prestige", feel: { top: 78, accel: 8.2, grip: 0.97, mass: 2111 } },
  { id: "e63", brand: "Mercedes-AMG", model: "E 63 S", price: 112000, upkeep: 180, flash: 4, colour: "#141414", body: "saloon", dealer: "dealer:prestige", feel: { top: 83, accel: 8.2, grip: 0.96, mass: 2000 } },
  { id: "brabus", brand: "Brabus", model: "800 (G 63)", price: 295000, upkeep: 450, flash: 7, colour: "#1a1c1e", body: "suv", dealer: "dealer:prestige", need: 35, feel: { top: 67, accel: 6.8, grip: 0.8, mass: 2600 },
    lockReason: "Brabus builds these to order for names they know. Yours is not big enough yet." },
  { id: "p911", brand: "Porsche", model: "911 Carrera", price: 100000, upkeep: 160, flash: 5, colour: "#f2c12e", body: "sports", dealer: "dealer:prestige", feel: { top: 82, accel: 6.8, grip: 1.05, mass: 1520 } },
  { id: "gt3rs", brand: "Porsche", model: "911 GT3 RS", price: 190000, upkeep: 280, flash: 7, colour: "#2fbf71", body: "sports", dealer: "dealer:prestige", need: 40, feel: { top: 82, accel: 8.7, grip: 1.2, mass: 1450 },
    lockReason: "Porsche only offers the GT3 RS to drivers they know. Your name is not big enough yet." },
  { id: "taycan", brand: "Porsche", model: "Taycan 4S", price: 97000, upkeep: 120, flash: 4, colour: "#d8d2c4", body: "saloon", dealer: "dealer:prestige", feel: { top: 69, accel: 7.5, grip: 1.0, mass: 2200 } },
  { id: "cayenne", brand: "Porsche", model: "Cayenne S", price: 95000, upkeep: 150, flash: 4, colour: "#1c2a4a", body: "suv", dealer: "dealer:prestige", feel: { top: 76, accel: 5.9, grip: 0.9, mass: 2100 } },
  { id: "rrsport", brand: "Range Rover", model: "Sport", price: 90000, upkeep: 140, flash: 4, colour: "#2b2f36", body: "suv", dealer: "dealer:prestige", feel: { top: 67, accel: 5.1, grip: 0.84, mass: 2400 } },
  { id: "rrsv", brand: "Range Rover", model: "SV", price: 240000, upkeep: 360, flash: 6, colour: "#e9e6df", body: "suv", dealer: "dealer:prestige", need: 30, feel: { top: 72, accel: 6.2, grip: 0.82, mass: 2600 },
    lockReason: "The SV is built to order for clients Land Rover knows. Your name is not big enough yet." },
  // the supercar showroom: Ferrari and Lamborghini
  { id: "roma", brand: "Ferrari", model: "Roma", price: 185000, upkeep: 380, flash: 7, colour: "#b80d1e", body: "coupe", dealer: "dealer:super", need: 50, feel: { top: 89, accel: 8.2, grip: 1.02, mass: 1570 } },
  { id: "f296", brand: "Ferrari", model: "296 GTB", price: 245000, upkeep: 450, flash: 8, colour: "#ffd23f", body: "sports", dealer: "dealer:super", need: 58, feel: { top: 92, accel: 9.6, grip: 1.1, mass: 1470 } },
  { id: "purosangue", brand: "Ferrari", model: "Purosangue", price: 320000, upkeep: 550, flash: 9, colour: "#1c2a4a", body: "suv", dealer: "dealer:super", need: 68, feel: { top: 86, accel: 8.4, grip: 0.95, mass: 2030 } },
  { id: "sf90", brand: "Ferrari", model: "SF90 Stradale", price: 390000, upkeep: 650, flash: 10, colour: "#b80d1e", body: "sports", dealer: "dealer:super", need: 75, feel: { top: 94, accel: 11.1, grip: 1.15, mass: 1570 },
    lockReason: "Ferrari only sells the SF90 to clients they know. Your name is not big enough yet." },
  { id: "huracan", brand: "Lamborghini", model: "Huracan Tecnica", price: 215000, upkeep: 420, flash: 8, colour: "#7ad03a", body: "sports", dealer: "dealer:super", need: 38, feel: { top: 90, accel: 8.7, grip: 1.1, mass: 1380 } },
  { id: "urus", brand: "Lamborghini", model: "Urus SE", price: 200000, upkeep: 380, flash: 7, colour: "#ff7a2a", body: "suv", dealer: "dealer:super", need: 30, feel: { top: 85, accel: 8.2, grip: 0.92, mass: 2150 } },
  { id: "revuelto", brand: "Lamborghini", model: "Revuelto", price: 500000, upkeep: 800, flash: 11, colour: "#7d3cff", body: "hyper", dealer: "dealer:super", need: 75, feel: { top: 97, accel: 11.1, grip: 1.15, mass: 1772 },
    lockReason: "Lamborghini keeps the Revuelto for clients they know. Your name is not big enough yet." },
  // the bike dealer: scooters at 16, superbikes at 18
  { id: "activa", brand: "Honda", model: "Activa 125", price: 950, upkeep: 6, flash: 0, colour: "#3f8fd8", body: "scooter", dealer: "dealer:bikes", minAge: 16, feel: { top: 24, accel: 3.0, grip: 0.7, mass: 110 } },
  { id: "vespa", brand: "Vespa", model: "Primavera 125", price: 4800, upkeep: 12, flash: 1, colour: "#9ad1c7", body: "scooter", dealer: "dealer:bikes", minAge: 16, feel: { top: 26, accel: 3.2, grip: 0.72, mass: 130 } },
  { id: "ninja", brand: "Kawasaki", model: "Ninja 650", price: 8000, upkeep: 25, flash: 2, colour: "#4bbf2a", body: "bike", dealer: "dealer:bikes", feel: { top: 58, accel: 6.9, grip: 0.85, mass: 193 } },
  { id: "s1000rr", brand: "BMW", model: "S 1000 RR", price: 19500, upkeep: 45, flash: 3, colour: "#f2f2f2", body: "bike", dealer: "dealer:bikes", feel: { top: 84, accel: 9.0, grip: 0.95, mass: 197 } },
  { id: "panigale", brand: "Ducati", model: "Panigale V4 S", price: 33000, upkeep: 60, flash: 4, colour: "#cc0000", body: "bike", dealer: "dealer:bikes", feel: { top: 85, accel: 9.6, grip: 0.98, mass: 195 } }
];
// a car's tier from its price, for the cars that came after the old seven
const tierOfPrice = p => p < 2000 ? 0 : p < 30000 ? 1 : p < 60000 ? 2 : p < 150000 ? 3 : p < 1000000 ? 4 : 5;
for (const c of MORE_CARS) { c.tier = tierOfPrice(c.price); if (!c.minAge) c.minAge = 18; }
const ALL_CARS = CARS.concat(MORE_CARS);

// ---------- things to buy: clothes, shoes, bags, watches, jewellery, boots and tech ----------
// The first twelve are the old ids (shop "mall" or "shops" is the old place that sold them; store is the shop in
// the city now). cat: top and bottom change what he wears in the city (outfit), shoes, outer and bag live in the
// wardrobe, watch and jewellery go on the 3D body (look, a rig finish), boots put a rig boot on him (boot).
// minTier: the smallest city that stocks it (1 small, 2 big, 3 a capital). need: commercial reputation to buy it.
const ITEMS = [
  { id: "hoodie", shop: "mall", store: "store:nike", brand: "Nike", cat: "top", label: "Nike Club Fleece hoodie", price: 55, mood: 1, flash: 0, colour: "#2b2f36", outfit: { shirt: "#2b2f36", trim: "#f2f2f2" } },
  { id: "kicks", shop: "mall", store: "store:nike", brand: "Nike", cat: "shoes", label: "Air Jordan 1 Retro High OG", price: 170, mood: 2, flash: 1, colour: "#c8102e" },
  { id: "phones", shop: "mall", store: "store:tech", brand: "Sony", cat: "tech", label: "Sony WH-1000XM5 headphones", price: 299, mood: 2, flash: 0, perk: "focus", colour: "#1c1f24" },
  { id: "console", shop: "mall", store: "store:tech", brand: "PlayStation", cat: "tech", label: "PlayStation 5", price: 480, mood: 4, flash: 0, perk: "unwind", colour: "#f2f2f2" },
  { id: "phone", shop: "mall", store: "store:tech", brand: "Apple", cat: "tech", label: "Apple iPhone 17 Pro", price: 1099, mood: 2, flash: 1, perk: "social", colour: "#c8ccd2" },
  { id: "steelwatch", shop: "shops", store: "watches", brand: "TAG Heuer", cat: "watch", label: "TAG Heuer Carrera Date", price: 3050, mood: 2, flash: 2, look: { watch: "steel" }, colour: "#9aa3ad" },
  { id: "chain", shop: "shops", store: "store:tiffany", brand: "Tiffany & Co", cat: "jewellery", label: "Tiffany HardWear silver link necklace", price: 1500, mood: 2, flash: 3, look: { necklace: "silver" }, colour: "#c8ccd2" },
  { id: "jacket", shop: "shops", store: "store:givenchy", brand: "Givenchy", cat: "outer", label: "Givenchy leather bomber jacket", price: 4590, mood: 3, flash: 3, colour: "#111111", need: 10 },
  { id: "studs", shop: "shops", store: "store:tiffany", brand: "Tiffany & Co", cat: "jewellery", label: "Tiffany diamond stud earrings", price: 9500, mood: 3, flash: 4, look: { earrings: "silver" }, colour: "#e9eef2" },
  { id: "goldwatch", shop: "shops", store: "watches", brand: "Rolex", cat: "watch", label: "Rolex Day-Date 40, yellow gold", price: 38000, mood: 4, flash: 6, look: { watch: "gold" }, colour: "#d4af37", need: 35 },
  { id: "suit", shop: "shops", store: "store:dior", brand: "Dior", cat: "outer", label: "Dior tailored wool suit", price: 4400, mood: 3, flash: 5, colour: "#2b2b2f", need: 10 },
  { id: "goldchain", shop: "shops", store: "store:tiffany", brand: "Tiffany & Co", cat: "jewellery", label: "Tiffany HardWear gold link necklace", price: 18500, mood: 3, flash: 6, look: { necklace: "gold" }, colour: "#d4af37", need: 20 }
];
// a short way to write the rest: [id, cat, label, price, mood, flash, colour, extra]
const T = (shirt, trim) => ({ outfit: { shirt, trim } });
const B = shorts => ({ outfit: { shorts } });
function stock(store, brand, rows) {
  return rows.map(([id, cat, label, price, mood, flash, colour, extra]) => Object.assign({ id, store, brand, cat, label, price, mood, flash, colour }, extra || {}));
}
const MORE_ITEMS = [].concat(
  // the affordable end
  stock("store:nike", "Nike", [
    ["nike_club_tee", "top", "Nike Sportswear Club tee", 25, 1, 0, "#f4f4f4", T("#f4f4f4", "#111111")],
    ["nike_tech_hoodie", "top", "Nike Tech Fleece hoodie", 110, 1, 0, "#4a4e55", T("#4a4e55", "#111111")],
    ["nike_tech_joggers", "bottom", "Nike Tech Fleece joggers", 100, 1, 0, "#4a4e55", B("#4a4e55")],
    ["nike_shorts", "bottom", "Nike Dri-FIT Challenger shorts", 35, 1, 0, "#111111", B("#111111")],
    ["nike_af1", "shoes", "Nike Air Force 1 '07", 115, 1, 0, "#f4f4f4"],
    ["nike_dunk", "shoes", "Nike Dunk Low Retro", 110, 1, 0, "#1c1c1c"],
    ["nike_windrunner", "outer", "Nike Windrunner jacket", 95, 1, 0, "#1c2a4a"]
  ]),
  stock("store:adidas", "Adidas", [
    ["adidas_trefoil", "top", "Adidas Adicolor Trefoil tee", 28, 1, 0, "#ffffff", T("#ffffff", "#111111")],
    ["adidas_firebird", "top", "Adidas Firebird track top", 70, 1, 0, "#111111", T("#111111", "#ffffff")],
    ["adidas_sst", "bottom", "Adidas Adicolor SST track pants", 60, 1, 0, "#111111", B("#111111")],
    ["adidas_shorts", "bottom", "Adidas Adicolor 3 Stripes shorts", 30, 1, 0, "#1c2a4a", B("#1c2a4a")],
    ["adidas_samba", "shoes", "Adidas Samba OG", 90, 1, 0, "#f4f4f4"],
    ["adidas_gazelle", "shoes", "Adidas Gazelle Indoor", 100, 1, 0, "#2a5bd7"]
  ]),
  stock("store:zara", "Zara", [
    ["zara_tee", "top", "Zara heavyweight boxy fit tee", 16, 1, 0, "#f2efe9", T("#f2efe9", "#d9d4cc")],
    ["zara_polo", "top", "Zara textured knit polo", 30, 1, 0, "#c9b79c", T("#c9b79c", "#8a7a62")],
    ["zara_shirt", "top", "Zara linen blend shirt", 36, 1, 0, "#dfe7ef", T("#dfe7ef", "#ffffff")],
    ["zara_trousers", "bottom", "Zara relaxed fit trousers", 36, 1, 0, "#2b2b2b", B("#2b2b2b")],
    ["zara_jeans", "bottom", "Zara baggy fit jeans", 30, 1, 0, "#3d5a80", B("#3d5a80")],
    ["zara_bomber", "outer", "Zara faux suede bomber jacket", 56, 1, 0, "#8a6a4a"],
    ["zara_loafers", "shoes", "Zara leather penny loafers", 60, 1, 0, "#3b2616"]
  ]),
  // the middle
  stock("store:essentials", "Fear of God Essentials", [
    ["ess_hoodie", "top", "Fear of God Essentials hoodie", 90, 2, 1, "#cbbfae", T("#cbbfae", "#a89c8b")],
    ["ess_tee", "top", "Fear of God Essentials logo tee", 45, 1, 0, "#e3dccf", T("#e3dccf", "#b9ad9b")],
    ["ess_crew", "top", "Fear of God Essentials crewneck", 85, 2, 1, "#2e2b28", T("#2e2b28", "#4a4540")],
    ["ess_sweatpants", "bottom", "Fear of God Essentials sweatpants", 85, 1, 1, "#cbbfae", B("#cbbfae")],
    ["ess_shorts", "bottom", "Fear of God Essentials fleece shorts", 65, 1, 0, "#8f8576", B("#8f8576")],
    ["ess_jacket", "outer", "Fear of God Essentials nylon jacket", 150, 2, 1, "#a89c8b"]
  ]),
  stock("store:ralph", "Ralph Lauren", [
    ["rl_polo", "top", "Ralph Lauren Custom Fit polo", 115, 2, 1, "#1c2a4a", T("#1c2a4a", "#c8102e")],
    ["rl_oxford", "top", "Ralph Lauren Oxford shirt", 125, 2, 1, "#a9c3e0", T("#a9c3e0", "#ffffff")],
    ["rl_cable", "top", "Ralph Lauren cable knit jumper", 249, 2, 1, "#e9dfc8", T("#e9dfc8", "#c8b48f")],
    ["rl_bear", "top", "Ralph Lauren Polo Bear jumper", 299, 2, 1, "#1c2a4a", T("#1c2a4a", "#e9dfc8")],
    ["rl_chinos", "bottom", "Ralph Lauren stretch slim fit chinos", 139, 1, 1, "#c8b48f", B("#c8b48f")],
    ["rl_shorts", "bottom", "Ralph Lauren Prepster shorts", 99, 1, 0, "#1c2a4a", B("#1c2a4a")],
    ["rl_jacket", "outer", "Ralph Lauren Bi-Swing jacket", 349, 2, 1, "#2f4a3a"]
  ]),
  stock("store:ami", "AMI Paris", [
    ["ami_tee", "top", "AMI de Coeur tee", 120, 2, 1, "#ffffff", T("#ffffff", "#d0263b")],
    ["ami_jumper", "top", "AMI de Coeur jumper", 340, 2, 2, "#1c2a4a", T("#1c2a4a", "#d0263b")],
    ["ami_sweat", "top", "AMI de Coeur sweatshirt", 290, 2, 1, "#9a9ea3", T("#9a9ea3", "#d0263b")],
    ["ami_cardigan", "top", "AMI de Coeur cardigan", 420, 2, 2, "#2b2b2b", T("#2b2b2b", "#d0263b")],
    ["ami_trousers", "bottom", "AMI carrot fit trousers", 350, 1, 1, "#3a3530", B("#3a3530")],
    ["ami_overshirt", "outer", "AMI wool overshirt", 550, 2, 2, "#5a4632"]
  ]),
  stock("store:stussy", "Stussy", [
    ["stussy_8ball", "top", "Stussy 8 Ball tee", 50, 1, 1, "#111111", T("#111111", "#ffffff")],
    ["stussy_basic", "top", "Stussy Basic Stock tee", 45, 1, 0, "#ffffff", T("#ffffff", "#111111")],
    ["stussy_hoodie", "top", "Stussy Basic Stock hoodie", 130, 2, 1, "#5a6b4e", T("#5a6b4e", "#111111")],
    ["stussy_water", "bottom", "Stussy Big Basic water shorts", 85, 1, 0, "#2a5bd7", B("#2a5bd7")],
    ["stussy_cargo", "bottom", "Stussy ripstop cargo pants", 140, 1, 1, "#5a5a46", B("#5a5a46")],
    ["stussy_jacket", "outer", "Stussy work jacket", 220, 2, 1, "#8a6a4a"]
  ]),
  // the luxury end
  stock("store:givenchy", "Givenchy", [
    ["giv_tee", "top", "Givenchy slim fit logo tee", 450, 2, 2, "#ffffff", T("#ffffff", "#111111")],
    ["giv_hoodie", "top", "Givenchy 4G hoodie", 990, 3, 3, "#111111", T("#111111", "#ffffff")],
    ["giv_joggers", "bottom", "Givenchy 4G jogging trousers", 890, 2, 2, "#111111", B("#111111")],
    ["giv_tk360", "shoes", "Givenchy TK-360 trainers", 695, 2, 2, "#111111"],
    ["giv_bag", "bag", "Givenchy 4G crossbody bag", 850, 2, 2, "#111111"]
  ]),
  stock("store:gucci", "Gucci", [
    ["gucci_tee", "top", "Gucci interlocking G tee", 590, 2, 2, "#f1e9da", T("#f1e9da", "#1c3b2a")],
    ["gucci_polo", "top", "Gucci Web stripe polo", 750, 2, 3, "#1c2a4a", T("#1c2a4a", "#b5121b")],
    ["gucci_trousers", "bottom", "Gucci GG jacquard trousers", 1300, 2, 3, "#5a4632", B("#5a4632")],
    ["gucci_jacket", "outer", "Gucci GG canvas jacket", 2600, 3, 4, "#8a7357", { need: 10 }],
    ["gucci_ace", "shoes", "Gucci Ace trainers", 650, 2, 2, "#f4f4f4"],
    ["gucci_loafers", "shoes", "Gucci Horsebit loafers", 790, 2, 2, "#3b2616"],
    ["gucci_bag", "bag", "Gucci Ophidia GG messenger bag", 1490, 2, 3, "#8a7357"]
  ]),
  stock("store:dior", "Dior", [
    ["dior_tee", "top", "Christian Dior Couture tee", 790, 2, 2, "#ffffff", T("#ffffff", "#8e8a85")],
    ["dior_jumper", "top", "Dior Oblique jumper", 1700, 3, 4, "#c4c1bb", T("#c4c1bb", "#2b2b2b")],
    ["dior_trousers", "bottom", "Dior tailored wool trousers", 1100, 2, 3, "#3a3a3d", B("#3a3a3d")],
    ["dior_b23", "shoes", "Dior B23 high top trainers", 990, 2, 3, "#c4c1bb"],
    ["dior_b30", "shoes", "Dior B30 trainers", 950, 2, 3, "#e9e7e3"],
    ["dior_saddle", "bag", "Dior Saddle bag", 2700, 3, 4, "#c4c1bb", { need: 10 }]
  ]),
  stock("store:lv", "Louis Vuitton", [
    ["lv_tee", "top", "Louis Vuitton signature tee", 720, 2, 2, "#ffffff", T("#ffffff", "#5b3a23")],
    ["lv_jumper", "top", "Louis Vuitton monogram jacquard jumper", 1750, 3, 4, "#5b3a23", T("#5b3a23", "#c9a45c")],
    ["lv_jeans", "bottom", "Louis Vuitton monogram denim trousers", 1150, 2, 3, "#3d5a80", B("#3d5a80")],
    ["lv_trainer", "shoes", "LV Trainer sneakers", 1090, 2, 3, "#f4f4f4"],
    ["lv_keepall", "bag", "Louis Vuitton Keepall 50", 2100, 3, 4, "#6b4a2b"],
    ["lv_christopher", "bag", "Louis Vuitton Christopher backpack", 3250, 3, 5, "#3b2616", { need: 12 }],
    ["lv_blouson", "outer", "Louis Vuitton monogram leather blouson", 5900, 4, 6, "#5b3a23", { need: 20 }]
  ]),
  // tech: the electronics shop in the mall
  stock("store:tech", "", [
    ["airpods", "tech", "Apple AirPods Pro 3", 219, 1, 0, "#f4f4f4", { brand: "Apple" }],
    ["switch2", "tech", "Nintendo Switch 2", 396, 3, 0, "#e01f3d", { brand: "Nintendo", perk: "unwind" }],
    ["ps5pro", "tech", "PlayStation 5 Pro", 700, 4, 0, "#f2f2f2", { brand: "PlayStation", perk: "unwind" }],
    ["galaxy", "tech", "Samsung Galaxy S25 Ultra", 1249, 2, 1, "#1c1f24", { brand: "Samsung", perk: "social" }],
    ["macbook", "tech", "Apple MacBook Pro 14", 1599, 2, 1, "#9aa3ad", { brand: "Apple" }],
    ["oled", "tech", "LG OLED evo C5 65 inch TV", 2100, 3, 0, "#111111", { brand: "LG" }]
  ]),
  // jewellery
  stock("store:tiffany", "Tiffany & Co", [
    ["tif_bracelet", "jewellery", "Tiffany 1837 Makers chain bracelet", 400, 1, 1, "#c8ccd2", { look: { bracelet: "silver" } }],
    ["tif_lock", "jewellery", "Tiffany Lock bangle, rose gold", 5900, 2, 3, "#d8a38f", { look: { bracelet: "rose" } }]
  ]),
  stock("store:cartier", "Cartier", [
    ["cartier_love", "jewellery", "Cartier Love bracelet, yellow gold", 7050, 3, 4, "#d4af37", { look: { bracelet: "gold" }, need: 10 }],
    ["cartier_clou", "jewellery", "Cartier Juste un Clou bracelet, rose gold", 8400, 3, 4, "#d8a38f", { look: { bracelet: "rose" }, need: 12 }],
    ["cartier_santos", "watch", "Cartier Santos de Cartier", 7650, 3, 4, "#9aa3ad", { look: { watch: "steel" }, need: 10 }],
    ["cartier_pave", "jewellery", "Cartier Love bracelet, paved diamonds", 68000, 4, 8, "#e9eef2", { look: { bracelet: "silver" }, need: 50 }]
  ]),
  // the watch boutique: Casio and Guess at the door, Rolex behind the glass, Richard Mille by appointment
  stock("watches", "", [
    ["casio_f91w", "watch", "Casio F-91W", 20, 0, 0, "#141414", { brand: "Casio", look: { watch: "black" } }],
    ["casio_vintage", "watch", "Casio Vintage A168, gold tone", 60, 1, 0, "#d4af37", { brand: "Casio", look: { watch: "gold" } }],
    ["casio_gshock", "watch", "Casio G-Shock GA-2100", 99, 1, 0, "#141414", { brand: "Casio", look: { watch: "black" } }],
    ["guess_chrono", "watch", "Guess Momentum chronograph", 169, 1, 0, "#9aa3ad", { brand: "Guess", look: { watch: "steel" } }],
    ["tissot_prx", "watch", "Tissot PRX Powermatic 80", 675, 1, 1, "#c8ccd2", { brand: "Tissot", look: { watch: "silver" } }],
    ["tag_f1", "watch", "TAG Heuer Formula 1", 1650, 2, 1, "#141414", { brand: "TAG Heuer", look: { watch: "black" } }],
    ["omega_seamaster", "watch", "Omega Seamaster Diver 300M", 5900, 3, 3, "#c8ccd2", { brand: "Omega", look: { watch: "silver" } }],
    ["tag_monaco", "watch", "TAG Heuer Monaco", 7150, 3, 3, "#2a5bd7", { brand: "TAG Heuer", look: { watch: "blue" } }],
    ["omega_speedy", "watch", "Omega Speedmaster Moonwatch Professional", 7400, 3, 3, "#141414", { brand: "Omega", look: { watch: "black" } }],
    ["rolex_datejust", "watch", "Rolex Datejust 41", 9150, 4, 4, "#c8ccd2", { brand: "Rolex", look: { watch: "silver" }, need: 15 }],
    ["rolex_sub", "watch", "Rolex Submariner Date", 10850, 4, 5, "#9aa3ad", { brand: "Rolex", look: { watch: "steel" }, need: 22 }],
    ["rolex_gmt", "watch", "Rolex GMT-Master II Pepsi", 11650, 4, 5, "#9aa3ad", { brand: "Rolex", look: { watch: "steel" }, need: 28 }],
    ["rolex_daytona", "watch", "Rolex Cosmograph Daytona", 14600, 4, 6, "#c8ccd2", { brand: "Rolex", look: { watch: "silver" }, need: 40,
      lockReason: "Every Daytona has a waiting list of famous names. Yours is not big enough to jump it yet." }],
    ["rolex_daytona_rose", "watch", "Rolex Daytona, Everose gold", 44500, 4, 7, "#d8a38f", { brand: "Rolex", look: { watch: "rose" }, need: 45 }],
    ["ap_ro", "watch", "Audemars Piguet Royal Oak 41, steel", 29900, 5, 7, "#9aa3ad", { brand: "Audemars Piguet", look: { watch: "steel" }, need: 40, minTier: 2 }],
    ["ap_offshore", "watch", "Audemars Piguet Royal Oak Offshore chronograph", 36500, 5, 7, "#141414", { brand: "Audemars Piguet", look: { watch: "black" }, need: 38, minTier: 2 }],
    ["ap_ro_gold", "watch", "Audemars Piguet Royal Oak 41, rose gold", 68000, 5, 8, "#d8a38f", { brand: "Audemars Piguet", look: { watch: "rose" }, need: 50, minTier: 2 }],
    ["rm_67", "watch", "Richard Mille RM 67-01 Extra Flat", 155000, 6, 10, "#c8ccd2", { brand: "Richard Mille", look: { watch: "silver" }, need: 70, minTier: 2 }],
    ["rm_035", "watch", "Richard Mille RM 035 Americas", 165000, 6, 10, "#141414", { brand: "Richard Mille", look: { watch: "black" }, need: 72, minTier: 2 }],
    ["rm_011", "watch", "Richard Mille RM 011 Felipe Massa", 185000, 6, 11, "#ff7a2a", { brand: "Richard Mille", look: { watch: "orange" }, need: 75, minTier: 2 }],
    ["rm_27", "watch", "Richard Mille RM 27-04 Rafael Nadal", 960000, 7, 14, "#f2f2f2", { brand: "Richard Mille", look: { watch: "white" }, need: 85, minTier: 2,
      lockReason: "Richard Mille made fifty of these and picks every owner. Only the biggest names in sport get the call." }]
  ]),
  // football boots: Club and Play at the bottom, Elite and Ultimate at the top. boot: the rig's boot colourway
  stock("boots", "", [
    ["nike_vapor_club", "boots", "Nike Mercurial Vapor 16 Club", 45, 1, 0, "#d6f53a", { brand: "Nike", boot: 3 }],
    ["nike_phantom_academy", "boots", "Nike Phantom 6 Academy", 90, 1, 0, "#1f5cff", { brand: "Nike", boot: 4 }],
    ["nike_superfly_academy", "boots", "Nike Mercurial Superfly 10 Academy", 95, 1, 0, "#d0e85c", { brand: "Nike", boot: 6 }],
    ["nike_vapor_pro", "boots", "Nike Mercurial Vapor 16 Pro", 150, 2, 1, "#7d3cff", { brand: "Nike", boot: 9 }],
    ["nike_phantom_elite", "boots", "Nike Phantom 6 Elite", 260, 2, 1, "#1f5cff", { brand: "Nike", boot: 4 }],
    ["nike_superfly_elite", "boots", "Nike Mercurial Superfly 10 Elite", 275, 2, 2, "#ffd23f", { brand: "Nike", boot: 13 }],
    ["adidas_pred_club", "boots", "Adidas Predator Club", 45, 1, 0, "#111111", { brand: "Adidas", boot: 0 }],
    ["adidas_pred_league", "boots", "Adidas Predator League", 90, 1, 0, "#e01f3d", { brand: "Adidas", boot: 5 }],
    ["adidas_f50_league", "boots", "Adidas F50 League", 90, 1, 0, "#f4f4f4", { brand: "Adidas", boot: 1 }],
    ["adidas_copa_elite", "boots", "Adidas Copa Pure 2 Elite", 220, 2, 1, "#111111", { brand: "Adidas", boot: 0 }],
    ["adidas_f50_elite", "boots", "Adidas F50 Elite", 240, 2, 1, "#c0c4cc", { brand: "Adidas", boot: 12 }],
    ["adidas_pred_elite", "boots", "Adidas Predator Elite", 250, 2, 2, "#f2f2f2", { brand: "Adidas", boot: 8 }],
    ["puma_ultra_play", "boots", "Puma Ultra 5 Play", 35, 1, 0, "#00b39b", { brand: "Puma", boot: 10 }],
    ["puma_future_play", "boots", "Puma Future 8 Play", 45, 1, 0, "#ff5a1f", { brand: "Puma", boot: 2 }],
    ["puma_future_match", "boots", "Puma Future 8 Match", 100, 1, 0, "#ff2e7a", { brand: "Puma", boot: 11 }],
    ["puma_king_pro", "boots", "Puma King Pro", 130, 2, 1, "#0b0b0c", { brand: "Puma", boot: 7 }],
    ["puma_ultra_ultimate", "boots", "Puma Ultra 5 Ultimate", 220, 2, 1, "#00b39b", { brand: "Puma", boot: 10 }],
    ["puma_future_ultimate", "boots", "Puma Future 8 Ultimate", 230, 2, 2, "#ff2e7a", { brand: "Puma", boot: 11 }]
  ])
);
const ALL_ITEMS = ITEMS.concat(MORE_ITEMS);
// the rig boot colourways each boot brand makes (the old made up brands stay so old deals keep working)
const BOOT_BRANDS = { Nike: [6, 9, 13, 3, 4], Adidas: [8, 12, 5, 1, 0], Puma: [11, 7, 10, 2], Apex: [6, 9], Korra: [7, 11], "Valoré": [8, 12], Tidal: [10, 13] };

// ---------- the supermarket: aisles, small effects ----------
// fx: fitness, morale, fatigue (a few a week count; the fridge only holds so much)
const GROCERIES = [
  { id: "g_bananas", aisle: "Fruit and veg", label: "Bananas, a bunch", price: 1, colour: "#f4d03f", fx: { fitness: 0.3 }, note: "Quick energy before training." },
  { id: "g_berries", aisle: "Fruit and veg", label: "Blueberries", price: 3, colour: "#3b4cca", fx: { fitness: 0.3, fatigue: -1 }, note: "Good for recovery, the nutritionist says." },
  { id: "g_spinach", aisle: "Fruit and veg", label: "Baby spinach", price: 2, colour: "#2e7d32", fx: { fitness: 0.4 }, note: "Iron. Popeye knew." },
  { id: "g_avocado", aisle: "Fruit and veg", label: "Avocados, two", price: 2, colour: "#4a7c2c", fx: { fitness: 0.2, morale: 0.3 }, note: "Toast tomorrow morning." },
  { id: "g_chicken", aisle: "Protein", label: "Chicken breasts", price: 6, colour: "#f2c6b4", fx: { fitness: 0.6 }, note: "Lean protein for the week." },
  { id: "g_salmon", aisle: "Protein", label: "Salmon fillets", price: 7, colour: "#fa8072", fx: { fitness: 0.5, fatigue: -1 }, note: "Omega 3 for the joints." },
  { id: "g_eggs", aisle: "Protein", label: "Free range eggs, twelve", price: 4, colour: "#f5e6c8", fx: { fitness: 0.4 }, note: "Breakfast sorted." },
  { id: "g_whey", aisle: "Protein", label: "Myprotein Impact Whey", price: 30, colour: "#1c2a4a", fx: { fitness: 1 }, note: "A shake after every session." },
  { id: "g_water", aisle: "Drinks", label: "Evian water, six pack", price: 4, colour: "#e8f4fb", fx: { fatigue: -1 }, note: "Hydration is half the job." },
  { id: "g_gatorade", aisle: "Drinks", label: "Gatorade", price: 2, colour: "#ff7a2a", fx: { fatigue: -1.5 }, note: "Salts back in after a hard session." },
  { id: "g_redbull", aisle: "Drinks", label: "Red Bull", price: 2, colour: "#1c2a4a", fx: { fatigue: -2, fitness: -0.2 }, note: "Wings. And a heartbeat you can hear." },
  { id: "g_coconut", aisle: "Drinks", label: "Coconut water", price: 3, colour: "#f2efe9", fx: { fatigue: -1 }, note: "Nature's sports drink." },
  { id: "g_cola", aisle: "Drinks", label: "Coca-Cola", price: 2, colour: "#c8102e", fx: { morale: 0.5, fitness: -0.2 }, note: "Just the one." },
  { id: "g_pringles", aisle: "Snacks", label: "Pringles", price: 3, colour: "#d0263b", fx: { morale: 0.6, fitness: -0.3 }, note: "Once you pop." },
  { id: "g_dairymilk", aisle: "Snacks", label: "Cadbury Dairy Milk", price: 2, colour: "#4b1d6b", fx: { morale: 0.8, fitness: -0.3 }, note: "A square or two. Or the whole bar." },
  { id: "g_bar", aisle: "Snacks", label: "Grenade protein bar", price: 3, colour: "#2b2b2b", fx: { fitness: 0.2, morale: 0.3 }, note: "Tastes like a treat, counts as protein." },
  { id: "g_nuts", aisle: "Snacks", label: "Mixed nuts", price: 4, colour: "#a0522d", fx: { fitness: 0.2 }, note: "Good fats." },
  { id: "g_sourdough", aisle: "Bakery", label: "Sourdough loaf", price: 4, colour: "#c8a26b", fx: { morale: 0.3 }, note: "Still warm." },
  { id: "g_croissants", aisle: "Bakery", label: "Butter croissants, four", price: 3, colour: "#e0a95a", fx: { morale: 0.5, fitness: -0.1 }, note: "Sunday morning in a bag." },
  { id: "g_bagels", aisle: "Bakery", label: "Bagels", price: 2, colour: "#d9b77e", fx: { fitness: 0.1 }, note: "Carbs before match day." },
  { id: "g_pizza", aisle: "Frozen", label: "Dr. Oetker Ristorante pizza", price: 3, colour: "#c0392b", fx: { morale: 0.8, fitness: -0.4 }, note: "Twelve minutes in the oven." },
  { id: "g_icecream", aisle: "Frozen", label: "Ben & Jerry's Cookie Dough", price: 5, colour: "#f5e6c8", fx: { morale: 1, fitness: -0.4 }, note: "The whole tub. No witnesses." },
  { id: "g_veg", aisle: "Frozen", label: "Frozen peas and greens", price: 2, colour: "#3fa34d", fx: { fitness: 0.3 }, note: "The freezer's healthiest corner." }
];
const AISLES = ["Fruit and veg", "Protein", "Drinks", "Snacks", "Bakery", "Frozen"];

// ---------- food and drink ----------
// the restaurant: the old three ids stay, each meal takes a free evening (time 1)
const MEALS = [
  { id: "healthy", label: "A clean meal, chicken, rice, greens", price: 18, fitness: 2, fatigue: -3, morale: 0, form: 0.05, time: 1, note: "Fuel. The nutritionist would approve." },
  { id: "treat", label: "Burger, fries and a shake", price: 22, fitness: -2, fatigue: 0, morale: 3, form: -0.05, time: 1, note: "Worth it. Probably." },
  { id: "fine", label: "Tasting menu at the fancy place", price: 260, fitness: 0, fatigue: -2, morale: 5, form: 0, social: 0.004, time: 1, note: "Eight courses, tiny plates, a photo for the feed." },
  { id: "seafood", label: "Grilled sea bass by the water", price: 65, fitness: 1, fatigue: -2, morale: 3, form: 0.03, time: 1, sea: true, note: "The sun goes down over the water. Nobody asks for a photo." },
  { id: "steak", label: "Ribeye steak, greens and chips", price: 75, fitness: 1, fatigue: -1, morale: 3, form: 0, time: 1, note: "Medium rare. The chef came out to shake your hand." },
  { id: "omakase", label: "Omakase at the sushi counter", price: 180, fitness: 1, fatigue: -2, morale: 4, form: 0.02, social: 0.003, time: 1, note: "Fifteen pieces, one at a time, from the chef's own hands." }
];
// the cafe: no free time, a few a week count
const CAFE_MENU = [
  { id: "c_espresso", label: "Double espresso", price: 3, fx: { fatigue: -1 }, note: "Awake." },
  { id: "c_flatwhite", label: "Flat white", price: 4, fx: { fatigue: -1, morale: 0.3 }, note: "Smooth. You sit by the window for a bit." },
  { id: "c_iced", label: "Iced latte", price: 5, fx: { morale: 0.5 }, note: "Cold, sweet, gone in four minutes." },
  { id: "c_matcha", label: "Iced matcha latte", price: 5, fx: { fatigue: -1, morale: 0.3 }, note: "Green and calm." },
  { id: "c_croissant", label: "Almond croissant", price: 4, fx: { morale: 0.6, fitness: -0.1 }, note: "Flaky, everywhere." },
  { id: "c_avotoast", label: "Avocado toast with poached eggs", price: 11, fx: { fitness: 0.3, morale: 0.3 }, note: "A proper breakfast." },
  { id: "c_smoothie", label: "Protein smoothie", price: 7, fx: { fitness: 0.4 }, note: "Banana, oats, whey. Training fuel." }
];
// the nightclub: 18 and over, takes a free night
const CLUB_MENU = [
  { id: "night", label: "A night out with the lads", price: 80, time: 1, note: "Music, dancing, home by two. Mostly." },
  { id: "vip", label: "VIP table and bottle service", price: 3000, time: 1, note: "Sparklers, a table by the DJ and phones pointed your way all night." }
];
// the clinic: treat cuts a week off an injury (once a week), checkup lowers the injury risk for three weeks
const CLINIC_MENU = [
  { id: "treat", label: "Specialist treatment for the injury", price: 450, time: 0, note: "Scans, a specialist and a rehab plan. A week off the recovery, once a week." },
  { id: "checkup", label: "Full screening and check up", price: 180, time: 0, note: "Muscle tests, bloods and a physio plan. Fewer knocks for three weeks." }
];

// ---------- the gym ----------
const GYM = [
  { id: "weights", label: "Strength session", price: 0, attrs: { strength: 0.35, jumping: 0.12 }, fatigue: 8, risk: 0.006 },
  { id: "engine", label: "Engine work on the bike", price: 0, attrs: { stamina: 0.35, acceleration: 0.08 }, fatigue: 9, risk: 0.005 },
  { id: "mobility", label: "Mobility and core", price: 0, attrs: { agility: 0.18, balance: 0.2 }, fatigue: 3, risk: 0 },
  { id: "spa", label: "Ice bath, sauna and a massage", price: 70, attrs: {}, fatigue: -14, risk: 0, mood: 2 }
];

// ---------- sponsors: real brands come knocking as his name grows ----------
// The ids are the old ones (a save can hold them); only the brand changed. need: commercial reputation needed;
// base: pounds a week at that level; time: free time slots a deal takes in a week. boots: a boot deal (he wears
// their boots); kit: the boots they send him on signing; gift: a car or an item that comes with the deal.
const SPONSORS = [
  { id: "greenleaf", brand: "Nando's", kind: "Food", need: 8, base: 30, time: 0, line: "Peri peri chicken, a local advert and free lunch for a year." },
  { id: "fizzline", brand: "Gatorade", kind: "Sports drink", need: 15, base: 90, time: 0, line: "Your face on the bottle in your city." },
  { id: "stride", brand: "Under Armour", kind: "Sportswear", need: 25, base: 260, time: 0, line: "Training kit and one shoot a season." },
  { id: "redbull", brand: "Red Bull", kind: "Energy drink", need: 30, base: 450, time: 0, line: "Cans in the dressing room and a stunt video for the feed." },
  { id: "lumen", brand: "Samsung", kind: "Tech", need: 35, base: 700, time: 0, line: "The new Galaxy in your hand in every advert." },
  { id: "crestbank", brand: "Barclays", kind: "Bank", need: 45, base: 1600, time: 0, line: "A national campaign. Smile, you are trustworthy now." },
  { id: "tagheuer", brand: "TAG Heuer", kind: "Watches", need: 48, base: 2200, time: 0, line: "Ambassador. A Carrera on your wrist at every press conference.", gift: "steelwatch" },
  { id: "pixelforge", brand: "EA Sports FC", kind: "Gaming", need: 52, base: 2800, time: 0, line: "Your face on the cover of EA Sports FC." },
  { id: "aurion", brand: "BMW", kind: "Cars", need: 62, base: 5200, time: 0, line: "A free M4 and a television advert.", gift: "gt" },
  { id: "celestor", brand: "Rolex", kind: "Watches", need: 72, base: 9800, time: 0, line: "Rolex testimonee. A gold Day-Date on your wrist in every photo.", gift: "goldwatch" },
  { id: "apex", brand: "Puma", kind: "Boots", need: 20, base: 180, time: 0, boots: true, kit: "puma_future_ultimate", line: "Puma boots, made for you, and your name on the tongue." },
  { id: "korra", brand: "Adidas", kind: "Boots", need: 40, base: 1100, time: 0, boots: true, kit: "adidas_pred_elite", line: "A signature Predator colourway in the shops." },
  { id: "valore", brand: "Nike", kind: "Boots", need: 66, base: 7400, time: 0, boots: true, kit: "nike_superfly_elite", line: "A signature Mercurial line, worldwide." }
];

// ---------- social media ----------
const POSTS = [
  { id: "training", label: "A training clip", base: 0.004, commercial: 0.2, risk: 0 },
  { id: "match", label: "Match day photo", base: 0.006, commercial: 0.3, risk: 0, needsMatch: true },
  { id: "lifestyle", label: "Lifestyle shot (the car, the watch, the holiday)", base: 0.008, commercial: 0.6, risk: 0.25 },
  { id: "charity", label: "Visit a school back home", base: 0.005, commercial: 0.4, risk: 0, local: 1.5 },
  { id: "fans", label: "Thank the fans", base: 0.005, commercial: 0.2, risk: 0, local: 0.6 }
];

// ---------- the shops as places: each brand's own look ----------
// style: floor, wall, accent, trim (hex) and a vibe word the interiors build from.
// row: where it sits (inside the mall, the luxury row, or on the street); tier: the smallest city that has one.
const STORES = {
  "store:nike": { brand: "Nike", name: "Nike", row: "mall", tier: 1, style: { floor: "#1a1a1a", wall: "#0d0d0d", accent: "#d0e85c", trim: "#ffffff", vibe: "sport" } },
  "store:adidas": { brand: "Adidas", name: "Adidas", row: "mall", tier: 1, style: { floor: "#f2f2f2", wall: "#111111", accent: "#ffffff", trim: "#111111", vibe: "stripes" } },
  "store:tech": { brand: "", name: "", row: "mall", tier: 1, style: { floor: "#f5f5f7", wall: "#ffffff", accent: "#0071e3", trim: "#1d1d1f", vibe: "bright" } },
  "store:zara": { brand: "Zara", name: "Zara", row: "mall", tier: 2, style: { floor: "#f4f2ee", wall: "#ffffff", accent: "#111111", trim: "#d9d4cc", vibe: "minimal" } },
  "store:essentials": { brand: "Fear of God Essentials", name: "Essentials", row: "mall", tier: 2, style: { floor: "#d8cfc1", wall: "#e9e3d8", accent: "#8a7f72", trim: "#c4b8a6", vibe: "minimal" } },
  "store:ralph": { brand: "Ralph Lauren", name: "Ralph Lauren", row: "mall", tier: 2, style: { floor: "#5a3d2b", wall: "#1f3a2c", accent: "#c9a45c", trim: "#f2ead8", vibe: "preppy" } },
  "store:stussy": { brand: "Stussy", name: "Stussy", row: "street", tier: 2, style: { floor: "#3a3a3a", wall: "#e8e4dc", accent: "#111111", trim: "#e01f3d", vibe: "streetwear" } },
  "store:tiffany": { brand: "Tiffany & Co", name: "Tiffany & Co", row: "mall", tier: 2, style: { floor: "#f7f7f5", wall: "#ffffff", accent: "#81d8d0", trim: "#c8ccd2", vibe: "elegant" } },
  "store:ami": { brand: "AMI Paris", name: "AMI Paris", row: "luxury", tier: 3, style: { floor: "#ece7df", wall: "#f7f5f1", accent: "#d0263b", trim: "#1b1b1b", vibe: "parisian" } },
  "store:givenchy": { brand: "Givenchy", name: "Givenchy", row: "luxury", tier: 3, style: { floor: "#ffffff", wall: "#111111", accent: "#ffffff", trim: "#111111", vibe: "stark" } },
  "store:gucci": { brand: "Gucci", name: "Gucci", row: "luxury", tier: 3, style: { floor: "#1c3b2a", wall: "#f1e9da", accent: "#b5121b", trim: "#c9a45c", vibe: "luxury" } },
  "store:dior": { brand: "Dior", name: "Dior", row: "luxury", tier: 3, style: { floor: "#e9e7e3", wall: "#d6d3ce", accent: "#ffffff", trim: "#8e8a85", vibe: "couture" } },
  "store:lv": { brand: "Louis Vuitton", name: "Louis Vuitton", row: "luxury", tier: 3, style: { floor: "#5b3a23", wall: "#3b2616", accent: "#c9a45c", trim: "#e9dcc0", vibe: "monogram" } },
  "store:cartier": { brand: "Cartier", name: "Cartier", row: "luxury", tier: 3, style: { floor: "#f2e9df", wall: "#8b1c24", accent: "#d4af37", trim: "#f2e9df", vibe: "luxury" } }
};
// the luxury houses a big (tier 2) city may have two of; a capital has them all
const LUXURY = ["store:gucci", "store:lv", "store:dior", "store:givenchy", "store:cartier", "store:ami"];

// the other places: their look
const PLACE_STYLE = {
  mall: { floor: "#e9e6e1", wall: "#f7f7f5", accent: "#d4af37", trim: "#2b2b2b", vibe: "bright" },
  watches: { floor: "#1a1712", wall: "#2a241b", accent: "#d4af37", trim: "#0f5132", vibe: "luxury" },
  boots: { floor: "#1e1e1e", wall: "#f2f2f2", accent: "#d0e85c", trim: "#ff5a1f", vibe: "sport" },
  restaurantSea: { floor: "#e8dcc6", wall: "#f5efe4", accent: "#1f6f8b", trim: "#c9a45c", vibe: "seaside" },
  restaurant: { floor: "#3b2616", wall: "#1f1a17", accent: "#d4af37", trim: "#efe3cf", vibe: "luxury" },
  club: { floor: "#0b0b10", wall: "#16121f", accent: "#ff2e7a", trim: "#7d3cff", vibe: "neon" },
  clinic: { floor: "#eef2f4", wall: "#ffffff", accent: "#2a9d8f", trim: "#c8d3da", vibe: "clinical" },
  gym: { floor: "#1e1e1e", wall: "#2b2b2b", accent: "#ff5a1f", trim: "#c8ccd2", vibe: "industrial" },
  training: { floor: "#2f6b34", wall: "#dfe5df", accent: "#d0e85c", trim: "#ffffff", vibe: "sport" },
  stadium: { floor: "#2f6b34", wall: "#3b4048", accent: "#d0e85c", trim: "#ffffff", vibe: "stadium" },
  "dealer:everyday": { floor: "#eceff1", wall: "#ffffff", accent: "#eb0a1e", trim: "#2b2b2b", vibe: "bright" },
  "dealer:prestige": { floor: "#1c1f24", wall: "#2b2f36", accent: "#1c69d4", trim: "#c8ccd2", vibe: "showroom" },
  "dealer:super": { floor: "#111111", wall: "#1a1a1a", accent: "#d40000", trim: "#ffd23f", vibe: "luxury" },
  "dealer:bikes": { floor: "#2b2b2b", wall: "#3a3a3a", accent: "#cc0000", trim: "#f2f2f2", vibe: "industrial" },
  "home:family": { floor: "#8a6a4a", wall: "#efe3cf", accent: "#e07a5f", trim: "#5a4632", vibe: "homely" },
  "home:hostel": { floor: "#9a9a9a", wall: "#e3e3e3", accent: "#2a5bd7", trim: "#5a5a5a", vibe: "plain" },
  "home:shared": { floor: "#a68a64", wall: "#e8e1d4", accent: "#5a7d9a", trim: "#6b5a45", vibe: "cosy" },
  "home:apartment": { floor: "#c8b49a", wall: "#f2efe9", accent: "#2a5bd7", trim: "#3b4048", vibe: "modern" },
  "home:penthouse": { floor: "#e9e6e1", wall: "#ffffff", accent: "#d4af37", trim: "#1c1f24", vibe: "glass" },
  "home:villa": { floor: "#d9c7a4", wall: "#f5efe4", accent: "#2fbf71", trim: "#8a6a4a", vibe: "warm" },
  "home:mansion": { floor: "#efe9df", wall: "#f8f5ef", accent: "#d4af37", trim: "#3b2616", vibe: "grand" }
};
// supermarket and cafe chains: their colours
const CHAIN_STYLE = {
  "Tesco Extra": ["#00539f", "#ee1c2e"], "Sainsbury's": ["#f06c00", "#7f0442"], Asda: ["#78be20", "#ffffff"], Carrefour: ["#004e9f", "#e30613"],
  Mercadona: ["#008c45", "#f5a800"], Edeka: ["#ffd400", "#1d4596"], Rewe: ["#cc071e", "#ffffff"], Esselunga: ["#e2001a", "#003d7c"],
  Coop: ["#e2001a", "#ffffff"], Continente: ["#e3001b", "#ffffff"], "Pingo Doce": ["#5aa02c", "#ffffff"], "Albert Heijn": ["#00a0e2", "#ffffff"],
  Delhaize: ["#e2001a", "#ffffff"], Colruyt: ["#f39200", "#ffffff"], Migros: ["#ff6600", "#ffffff"], "Lulu Hypermarket": ["#00a651", "#ed1c24"],
  "Tamimi Markets": ["#d71920", "#ffffff"], Danube: ["#0067b1", "#ffffff"], "Whole Foods Market": ["#00674b", "#ffffff"], Target: ["#cc0000", "#ffffff"],
  Soriana: ["#e30613", "#ffffff"], Walmart: ["#0071ce", "#ffc220"], "Pao de Acucar": ["#00843d", "#ffffff"], Coto: ["#e30613", "#ffffff"],
  "Reliance Smart": ["#d71920", "#0d47a1"], DMart: ["#00843d", "#ffcd00"], Sklavenitis: ["#0057a8", "#ffffff"], Billa: ["#ffe300", "#d50a1c"],
  Spar: ["#e30613", "#00843d"], Netto: ["#ffe300", "#111111"], Konzum: ["#e30613", "#ffffff"],
  Starbucks: ["#00704a", "#ffffff"], "Costa Coffee": ["#6d1f37", "#ffffff"], "Pret A Manger": ["#862633", "#ffffff"], "Gail's": ["#2b2b2b", "#e9dfc8"],
  "Blue Tokai": ["#1b3a6b", "#ffffff"], "Third Wave Coffee": ["#111111", "#ffffff"], "Cafe Coffee Day": ["#b5121b", "#ffffff"], Faborit: ["#ff7a00", "#ffffff"],
  Santagloria: ["#2b2b2b", "#c9a45c"], "Cafe Kitsune": ["#e9e3d8", "#1b1b1b"], Paul: ["#111111", "#d4af37"], "Einstein Kaffee": ["#7b1e1e", "#ffffff"],
  Tchibo: ["#1d2d5c", "#ffffff"], "Caffe Vergnano": ["#8b1c24", "#ffffff"], "Pasticceria Marchesi": ["#9ad1c7", "#ffffff"],
  "Fabrica Coffee Roasters": ["#111111", "#ffffff"], "Padaria Portuguesa": ["#c8102e", "#ffffff"], "Coffee Company": ["#2b2b2b", "#d4af37"],
  "Le Pain Quotidien": ["#5a4632", "#efe3cf"], "Kahve Dunyasi": ["#4a2c1a", "#d4af37"], Barns: ["#5a3d2b", "#ffffff"], "Half Million": ["#111111", "#ffd23f"],
  "Blue Bottle Coffee": ["#ffffff", "#2a5bd7"], "Dunkin'": ["#ff671f", "#da1884"], Havanna: ["#1c2a4a", "#d4af37"], "Cafe de Paris": ["#c9a45c", "#ffffff"]
};

// ---------- what exists where: by country, then by city ----------
// market: supermarket chains; cafes: local coffee (Starbucks joins in the bigger cities); small: the cafe of a small city
const COUNTRY_INFO = {
  England: { market: ["Tesco Extra", "Sainsbury's"], cafes: ["Costa Coffee", "Pret A Manger", "Gail's"], gym: "PureGym", clinic: "Fortius Clinic", boots: "Pro:Direct Soccer", tech: "Currys", watches: "Watches of Switzerland", club: "Pryzm", everyday: "Toyota and Honda", prestige: "Sytner", super: "H.R. Owen", bikes: "Ducati and Vespa", row: "The Arcade" },
  Scotland: { market: ["Tesco Extra", "Asda"], cafes: ["Costa Coffee"], gym: "PureGym", clinic: "Spire Healthcare", boots: "Pro:Direct Soccer", tech: "Currys", watches: "Goldsmiths", club: "Pryzm", everyday: "Toyota and Honda", prestige: "Sytner", super: "H.R. Owen", bikes: "Ducati and Vespa" },
  Wales: { market: ["Tesco Extra"], cafes: ["Costa Coffee"], gym: "PureGym", clinic: "Spire Healthcare", boots: "Pro:Direct Soccer", tech: "Currys", watches: "Goldsmiths", club: "Pryzm" },
  Spain: { market: ["Carrefour", "Mercadona"], cafes: ["Faborit", "Santagloria"], gym: "Holmes Place", clinic: "Clinica CEMTRO", boots: "Futbol Emotion", tech: "MediaMarkt", watches: "Rabat", club: "Pacha" },
  France: { market: ["Carrefour"], cafes: ["Cafe Kitsune", "Paul"], gym: "Basic-Fit", clinic: "Clinique du Sport", boots: "Footkorner", tech: "Fnac", watches: "Bucherer", club: "Raspoutine" },
  Monaco: { market: ["Carrefour"], cafes: ["Cafe de Paris"], gym: "Monte-Carlo Fitness", clinic: "Centre Hospitalier Princesse Grace", boots: "Footkorner", tech: "Fnac", watches: "Bucherer", club: "Jimmy'z" },
  Germany: { market: ["Edeka", "Rewe"], cafes: ["Einstein Kaffee", "Tchibo"], gym: "McFit", clinic: "Praxis Muller-Wohlfahrt", boots: "11teamsports", tech: "MediaMarkt", watches: "Wempe", club: "P1" },
  Italy: { market: ["Esselunga", "Coop"], cafes: ["Caffe Vergnano", "Pasticceria Marchesi"], gym: "Virgin Active", clinic: "Isokinetic", boots: "Calcio Shop", tech: "MediaWorld", watches: "Pisa Orologeria", club: "Hollywood Rythmoteque" },
  Portugal: { market: ["Continente", "Pingo Doce"], cafes: ["Fabrica Coffee Roasters", "Padaria Portuguesa"], gym: "Holmes Place", clinic: "Clinica do Dragao", boots: "Futbol Emotion", tech: "Worten", watches: "Boutique dos Relogios", club: "Lux Fragil" },
  Netherlands: { market: ["Albert Heijn"], cafes: ["Coffee Company"], gym: "Basic-Fit", clinic: "Sportmedisch Centrum", boots: "Voetbalshop", tech: "Coolblue", watches: "Gassan", club: "Shelter" },
  Belgium: { market: ["Delhaize", "Colruyt"], cafes: ["Le Pain Quotidien"], gym: "Basic-Fit", clinic: "Sportsmedical", boots: "Unisport", tech: "MediaMarkt", watches: "Bucherer", club: "Fuse" },
  Turkey: { market: ["Migros"], cafes: ["Kahve Dunyasi"], gym: "Mac Fit", clinic: "Acibadem Sports", boots: "Decathlon", tech: "Teknosa", watches: "Bucherer", club: "Sortie" },
  "Saudi Arabia": { market: ["Lulu Hypermarket", "Tamimi Markets", "Danube"], cafes: ["Barns", "Half Million"], gym: "Fitness Time", clinic: "Dr Sulaiman Al Habib Hospital", boots: "Sun and Sand Sports", tech: "eXtra", watches: "Rivoli", club: "MDLBEAST Lounge" },
  USA: { market: ["Whole Foods Market", "Target"], cafes: ["Blue Bottle Coffee", "Dunkin'"], gym: "Equinox", clinic: "Hospital for Special Surgery", boots: "Soccer Village", tech: "Best Buy", watches: "Tourneau", club: "LIV" },
  Mexico: { market: ["Soriana", "Walmart"], cafes: ["Cielito Querido"], gym: "Smart Fit", clinic: "Hospital Angeles", boots: "Innovasport", tech: "Liverpool Electronica", watches: "Berger Joyeros", club: "Bar Americas" },
  Brazil: { market: ["Pao de Acucar", "Carrefour"], cafes: ["Fran's Cafe"], gym: "Smart Fit", clinic: "Hospital Israelita Albert Einstein", boots: "Centauro", tech: "Fast Shop", watches: "Bucherer", club: "Provocateur" },
  Argentina: { market: ["Coto", "Carrefour"], cafes: ["Havanna"], gym: "Megatlon", clinic: "Clinica Fleni", boots: "Dexter", tech: "Fravega", watches: "Bucherer", club: "Crobar" },
  India: { market: ["Reliance Smart", "DMart"], cafes: ["Blue Tokai", "Third Wave Coffee"], small: "Cafe Coffee Day", gym: "Cult.fit", clinic: "Centre for Sports Science", boots: "Decathlon", tech: "Croma", watches: "Ethos Watch Boutique", club: "Kitty Su", everyday: "Toyota and Honda", prestige: "Infinity Cars", super: "Lamborghini and Ferrari", bikes: "Honda and Kawasaki" },
  Greece: { market: ["Sklavenitis"], cafes: ["Coffee Island"], gym: "Holmes Place", clinic: "Hygeia Hospital", boots: "Decathlon", tech: "Kotsovolos", watches: "Bucherer", club: "Lohan" },
  Austria: { market: ["Billa", "Spar"], cafes: ["Cafe Sacher"], gym: "John Harris", clinic: "Sportordination", boots: "11teamsports", tech: "MediaMarkt", watches: "Wempe", club: "Club Auslage" },
  Denmark: { market: ["Netto", "Fotex"], cafes: ["Joe and the Juice"], gym: "Fitness World", clinic: "Aleris", boots: "Unisport", tech: "Elgiganten", watches: "Hester Bijou", club: "Culture Box" },
  Croatia: { market: ["Konzum"], cafes: ["Cogito Coffee"], gym: "Fitness Zone", clinic: "Sv. Katarina", boots: "Decathlon", tech: "Links", watches: "Bucherer", club: "Boogaloo" },
  default: { market: ["Carrefour"], cafes: ["Costa Coffee"], gym: "Anytime Fitness", clinic: "Sports Medicine Clinic", boots: "Decathlon", tech: "MediaMarkt", watches: "Bucherer", club: "Pacha" }
};
// city: the size of the place (1 small, 2 big, 3 a capital), the mall, the luxury row, the restaurant, the club,
// the stadium a youth player looks up at, and the homes, cheapest to dearest (shared, apartment, penthouse, villa, mansion)
const CITY_INFO = {
  London: { tier: 3, mall: "Westfield London", row: "Bond Street", restaurant: "Sexy Fish", club: "Cirque le Soir", gym: "Third Space", stadium: "Wembley Stadium", homes: ["Stratford", "Canary Wharf", "Chelsea", "Hampstead", "The Bishops Avenue"] },
  Manchester: { tier: 2, mall: "Trafford Centre", row: "King Street", restaurant: "San Carlo", club: "Chinawhite", stadium: "Old Trafford", homes: ["Salford", "Ancoats", "Deansgate", "Hale", "Alderley Edge"] },
  Liverpool: { tier: 2, mall: "Liverpool ONE", row: "Metquarter", restaurant: "Panoramic 34", club: "Level", stadium: "Anfield", homes: ["Wavertree", "Albert Dock", "Waterfront", "Woolton", "Formby"] },
  Birmingham: { tier: 2, mall: "Bullring", row: "Mailbox", restaurant: "Opheem", club: "Pryzm", homes: ["Selly Oak", "Jewellery Quarter", "Brindleyplace", "Edgbaston", "Sutton Coldfield"] },
  Leeds: { tier: 2, mall: "Trinity Leeds", row: "Victoria Quarter", homes: ["Headingley", "Leeds Dock", "City Centre", "Roundhay", "Harrogate"] },
  "Newcastle upon Tyne": { tier: 2, mall: "Eldon Square", homes: ["Heaton", "Quayside", "Quayside", "Jesmond", "Ponteland"] },
  Glasgow: { tier: 2, mall: "Buchanan Galleries", row: "Princes Square", homes: ["Partick", "Merchant City", "Finnieston", "Bearsden", "Milngavie"] },
  Madrid: { tier: 3, mall: "La Vaguada", row: "Calle Serrano", restaurant: "Ten Con Ten", club: "Teatro Kapital", gym: "Holmes Place", stadium: "Santiago Bernabeu", homes: ["Lavapies", "Chamberi", "Salamanca", "Pozuelo", "La Finca"] },
  Barcelona: { tier: 3, mall: "L'illa Diagonal", row: "Passeig de Gracia", restaurant: "Xiringuito Escriba", club: "Opium Barcelona", stadium: "Spotify Camp Nou", homes: ["Gracia", "Eixample", "Diagonal Mar", "Pedralbes", "Castelldefels"] },
  Seville: { tier: 2, mall: "Lagoh", homes: ["Triana", "Nervion", "Los Remedios", "Aljarafe", "Simon Verde"] },
  Valencia: { tier: 2, mall: "Bonaire", restaurant: "La Pepica", homes: ["Ruzafa", "Ciutat Vella", "Malvarrosa", "Campolivar", "Rocafort"] },
  Paris: { tier: 3, mall: "Westfield Forum des Halles", row: "Avenue Montaigne", restaurant: "Le Cinq", club: "Raspoutine", stadium: "Parc des Princes", homes: ["Belleville", "Le Marais", "Saint Germain", "Neuilly", "Saint Cloud"] },
  Monaco: { tier: 3, mall: "Metropole Shopping Monte-Carlo", row: "Avenue des Beaux-Arts", restaurant: "Le Louis XV", club: "Jimmy'z", stadium: "Stade Louis II", homes: ["Moneghetti", "La Condamine", "Fontvieille", "Monte-Carlo", "Cap d'Ail"] },
  Marseille: { tier: 2, mall: "Les Terrasses du Port", restaurant: "Le Petit Nice", homes: ["Le Panier", "Vieux Port", "Le Roucas Blanc", "Endoume", "Cassis"] },
  Lyon: { tier: 2, mall: "La Part-Dieu", homes: ["Croix-Rousse", "Presqu'ile", "Confluence", "Monts d'Or", "Monts d'Or"] },
  Munich: { tier: 3, mall: "Funf Hofe", row: "Maximilianstrasse", restaurant: "Tantris", club: "P1", stadium: "Allianz Arena", homes: ["Maxvorstadt", "Schwabing", "Bogenhausen", "Grunwald", "Starnberg"] },
  Berlin: { tier: 2, mall: "Mall of Berlin", row: "Kurfurstendamm", club: "Berghain", homes: ["Neukolln", "Prenzlauer Berg", "Mitte", "Grunewald", "Dahlem"] },
  Dortmund: { tier: 2, mall: "Thier-Galerie", homes: ["Kreuzviertel", "Phoenix See", "Phoenix See", "Hochst", "Syburg"] },
  Milan: { tier: 3, mall: "CityLife Shopping District", row: "Via Montenapoleone", restaurant: "Langosteria", club: "Hollywood Rythmoteque", stadium: "San Siro", homes: ["Navigli", "Brera", "Porta Nuova", "CityLife", "Lake Como"] },
  Turin: { tier: 2, mall: "8 Gallery Lingotto", row: "Via Roma", homes: ["San Salvario", "Crocetta", "Centro", "Collina", "Collina"] },
  Rome: { tier: 3, mall: "Porta di Roma", row: "Via Condotti", restaurant: "La Pergola", club: "Shari Vari", stadium: "Stadio Olimpico", homes: ["Trastevere", "Monti", "Parioli", "Aventino", "Appia Antica"] },
  Naples: { tier: 2, mall: "Vulcano Buono", restaurant: "Rosiello", homes: ["Vomero", "Chiaia", "Posillipo", "Posillipo", "Capri"] },
  Lisbon: { tier: 2, mall: "Centro Colombo", row: "Avenida da Liberdade", restaurant: "Feitoria", club: "Lux Fragil", stadium: "Estadio da Luz", homes: ["Alfama", "Chiado", "Belem", "Cascais", "Quinta da Marinha"] },
  Porto: { tier: 2, mall: "NorteShopping", restaurant: "The Yeatman", homes: ["Bonfim", "Ribeira", "Foz do Douro", "Foz do Douro", "Matosinhos"] },
  Amsterdam: { tier: 2, mall: "De Bijenkorf", row: "PC Hooftstraat", homes: ["De Pijp", "Jordaan", "Zuidas", "Amstelveen", "Bloemendaal"] },
  Istanbul: { tier: 3, mall: "Istinye Park", row: "Abdi Ipekci", restaurant: "Sunset Grill", club: "Sortie", homes: ["Kadikoy", "Besiktas", "Bebek", "Sariyer", "Yenikoy"] },
  Riyadh: { tier: 3, mall: "Kingdom Centre", row: "Via Riyadh", restaurant: "Nusr-Et", club: "MDLBEAST Lounge", stadium: "Kingdom Arena", homes: ["Olaya", "Al Malqa", "Kingdom Tower", "Hittin", "Diplomatic Quarter"] },
  Jeddah: { tier: 2, mall: "Red Sea Mall", row: "Tahlia Street", restaurant: "Byblos", homes: ["Al Rawdah", "Al Hamra", "Corniche", "Obhur", "Obhur Beach"] },
  "Fort Lauderdale": { tier: 2, mall: "Galleria Fort Lauderdale", row: "Las Olas Boulevard", restaurant: "Casa D'Angelo", club: "LIV", homes: ["Victoria Park", "Las Olas", "Las Olas Isles", "Coral Ridge", "Fort Lauderdale Beach"] },
  "Los Angeles": { tier: 3, mall: "The Grove", row: "Rodeo Drive", restaurant: "Nobu Malibu", club: "Delilah", homes: ["Koreatown", "West Hollywood", "Century City", "Bel Air", "Beverly Hills"] },
  "Buenos Aires": { tier: 3, mall: "Galerias Pacifico", row: "Avenida Alvear", restaurant: "Don Julio", club: "Crobar", homes: ["Palermo", "Recoleta", "Puerto Madero", "San Isidro", "Nordelta"] },
  "Rio de Janeiro": { tier: 3, mall: "Shopping Leblon", row: "Rua Garcia d'Avila", restaurant: "Satyricon", club: "Provocateur", homes: ["Botafogo", "Ipanema", "Leblon", "Barra da Tijuca", "Joa"] },
  "Sao Paulo": { tier: 3, mall: "Shopping Iguatemi", row: "Rua Oscar Freire", restaurant: "D.O.M.", club: "Provocateur", homes: ["Vila Madalena", "Pinheiros", "Itaim Bibi", "Jardins", "Morumbi"] },
  "Mexico City": { tier: 3, mall: "Antara Fashion Hall", row: "Avenida Presidente Masaryk", restaurant: "Pujol", club: "Bar Americas", homes: ["Roma Norte", "Condesa", "Polanco", "Lomas de Chapultepec", "Bosques de las Lomas"] },
  Mumbai: { tier: 3, mall: "Phoenix Palladium", row: "Jio World Plaza", restaurant: "The Sea Lounge", club: "Kitty Su", stadium: "Mumbai Football Arena", homes: ["Andheri", "Bandra West", "Worli Sea Face", "Juhu", "Malabar Hill"] },
  Delhi: { tier: 3, mall: "Select Citywalk", row: "DLF Emporio", restaurant: "Indian Accent", club: "Kitty Su", stadium: "Jawaharlal Nehru Stadium", homes: ["Lajpat Nagar", "Hauz Khas", "Vasant Vihar", "Chhatarpur", "Lutyens Delhi"] },
  Bengaluru: { tier: 2, mall: "Phoenix Marketcity", row: "UB City", restaurant: "Karavalli", club: "Skyye", cafes: ["Third Wave Coffee", "Blue Tokai"], stadium: "Sree Kanteerava Stadium", homes: ["Koramangala", "Indiranagar", "UB City", "Whitefield", "Sadashivanagar"] },
  Kolkata: { tier: 2, mall: "Quest Mall", row: "Park Street", restaurant: "Peter Cat", club: "Roxy", stadium: "Salt Lake Stadium", homes: ["Salt Lake", "Ballygunge", "Park Street", "New Town", "Alipore"] },
  Chennai: { tier: 2, mall: "Express Avenue", restaurant: "Bay View", club: "Pasha", stadium: "Jawaharlal Nehru Stadium", homes: ["T Nagar", "Anna Nagar", "Besant Nagar", "Adyar", "Boat Club Road"] },
  Hyderabad: { tier: 2, mall: "Inorbit Mall", row: "Banjara Hills", restaurant: "Falaknuma", club: "Prism", stadium: "GMC Balayogi Stadium", homes: ["Madhapur", "Gachibowli", "Banjara Hills", "Jubilee Hills", "Jubilee Hills"] },
  Kochi: { tier: 1, mall: "Lulu Mall", restaurant: "Fort House", club: "Coco Bar", stadium: "Jawaharlal Nehru Stadium", homes: ["Kakkanad", "Edappally", "Marine Drive", "Fort Kochi", "Panampilly Nagar"] },
  Goa: { tier: 1, mall: "Mall de Goa", restaurant: "Thalassa", club: "Club Cubana", stadium: "Fatorda Stadium", homes: ["Porvorim", "Panaji", "Dona Paula", "Candolim", "Assagao"] },
  Guwahati: { tier: 1, mall: "City Centre Guwahati", club: "Club Mint", stadium: "Indira Gandhi Athletic Stadium", homes: ["Beltola", "Dispur", "GS Road", "Khanapara", "Khanapara"] },
  Jamshedpur: { tier: 1, mall: "P and M Hi-Tech City Centre", club: "Club Krish", stadium: "JRD Tata Sports Complex", homes: ["Sakchi", "Bistupur", "Bistupur", "Kadma", "Sonari"] },
  Bhubaneswar: { tier: 1, mall: "Esplanade One", club: "Club Sky", stadium: "Kalinga Stadium", homes: ["Patia", "Saheed Nagar", "Saheed Nagar", "Khandagiri", "Old Town"] },
  Shillong: { tier: 1, mall: "Glory's Mall", club: "Cloud 9", stadium: "Jawaharlal Nehru Stadium", homes: ["Police Bazaar", "Laitumkhrah", "Upper Shillong", "Upper Shillong", "Mawlai"] },
  Mohali: { tier: 1, mall: "Bestech Square", stadium: "Tau Devi Lal Stadium", homes: ["Phase 7", "Sector 70", "Sector 70", "Sector 82", "Kharar"] },
  Pune: { tier: 2, mall: "Phoenix Marketcity Pune", row: "Koregaon Park", club: "High Spirits", homes: ["Kothrud", "Viman Nagar", "Koregaon Park", "Baner", "Kalyani Nagar"] }
};
// the other big cities (tier 2); everything not listed anywhere is tier 1
const BIG_CITIES = ["Nottingham", "Sheffield", "Leicester", "Brighton", "Bristol", "Southampton", "Edinburgh", "Bilbao", "Malaga", "Florence", "Genoa", "Bologna",
  "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Dusseldorf", "Leipzig", "Nice", "Lille", "Bordeaux", "Toulouse", "Rotterdam", "Eindhoven", "Brussels", "Antwerp",
  "Ankara", "Izmir", "Dammam", "Khobar", "Copenhagen", "Zagreb", "Piraeus", "Salzburg", "Seattle", "Atlanta", "Austin", "New York", "Guadalajara", "Monterrey",
  "Belo Horizonte", "Porto Alegre", "Salvador", "Fortaleza", "Recife", "Rosario", "Cordoba", "Bergamo", "Leverkusen"];
// the stadium for the club he plays for (anything not here is "<club> Stadium")
const STADIUMS = {
  Arsenal: "Emirates Stadium", "Aston Villa": "Villa Park", Brentford: "Gtech Community Stadium", Brighton: "Amex Stadium", Chelsea: "Stamford Bridge",
  "Crystal Palace": "Selhurst Park", Everton: "Hill Dickinson Stadium", Fulham: "Craven Cottage", "Leeds United": "Elland Road", Liverpool: "Anfield",
  "Man City": "Etihad Stadium", "Man United": "Old Trafford", Newcastle: "St James' Park", "Nottingham Forest": "City Ground", Tottenham: "Tottenham Hotspur Stadium",
  "West Ham": "London Stadium", "Real Madrid": "Santiago Bernabeu", Barcelona: "Spotify Camp Nou", "Atletico Madrid": "Riyadh Air Metropolitano",
  "Athletic Bilbao": "San Mames", "Real Betis": "Benito Villamarin", Sevilla: "Ramon Sanchez-Pizjuan", Valencia: "Mestalla", "Inter Milan": "San Siro",
  "AC Milan": "San Siro", Juventus: "Allianz Stadium", Napoli: "Stadio Diego Armando Maradona", Atalanta: "Gewiss Stadium", Roma: "Stadio Olimpico",
  Lazio: "Stadio Olimpico", Fiorentina: "Stadio Artemio Franchi", "Bayern Munich": "Allianz Arena", "Bayer Leverkusen": "BayArena",
  "Borussia Dortmund": "Signal Iduna Park", PSG: "Parc des Princes", Marseille: "Orange Velodrome", Monaco: "Stade Louis II", Lyon: "Groupama Stadium",
  Ajax: "Johan Cruijff ArenA", PSV: "Philips Stadion", Feyenoord: "De Kuip", Benfica: "Estadio da Luz", Porto: "Estadio do Dragao",
  "Sporting CP": "Estadio Jose Alvalade", Galatasaray: "RAMS Park", Fenerbahce: "Ulker Stadium", Besiktas: "Tupras Stadium", "Al-Hilal": "Kingdom Arena",
  "Al-Nassr": "Al-Awwal Park", "Al-Ittihad": "King Abdullah Sports City", "Al-Ahli": "King Abdullah Sports City", "Inter Miami": "Chase Stadium",
  LAFC: "BMO Stadium", Celtic: "Celtic Park", Rangers: "Ibrox Stadium", "Boca Juniors": "La Bombonera", "River Plate": "Estadio Monumental",
  Flamengo: "Maracana", Palmeiras: "Allianz Parque", Corinthians: "Neo Quimica Arena",
  "Mohun Bagan Super Giant": "Salt Lake Stadium", "East Bengal": "Salt Lake Stadium", "Bengaluru FC": "Sree Kanteerava Stadium",
  "Mumbai City FC": "Mumbai Football Arena", "FC Goa": "Fatorda Stadium", "Kerala Blasters": "Jawaharlal Nehru Stadium", "Chennaiyin FC": "Jawaharlal Nehru Stadium",
  "Jamshedpur FC": "JRD Tata Sports Complex", "Odisha FC": "Kalinga Stadium", "NorthEast United": "Indira Gandhi Athletic Stadium", "Punjab FC": "Tau Devi Lal Stadium", "Mohammedan SC": "Kishore Bharati Krirangan"
};
// the country each known city is in (anything else falls back to his club's league)
const CITY_COUNTRY = {
  London: "England", Manchester: "England", Liverpool: "England", Birmingham: "England", Leeds: "England", "Newcastle upon Tyne": "England", Glasgow: "Scotland",
  Madrid: "Spain", Barcelona: "Spain", Seville: "Spain", Valencia: "Spain", Paris: "France", Marseille: "France", Lyon: "France", Monaco: "Monaco",
  Munich: "Germany", Berlin: "Germany", Dortmund: "Germany", Milan: "Italy", Turin: "Italy", Rome: "Italy", Naples: "Italy", Lisbon: "Portugal", Porto: "Portugal",
  Amsterdam: "Netherlands", Istanbul: "Turkey", Riyadh: "Saudi Arabia", Jeddah: "Saudi Arabia", "Fort Lauderdale": "USA", "Los Angeles": "USA",
  "Buenos Aires": "Argentina", "Rio de Janeiro": "Brazil", "Sao Paulo": "Brazil", "Mexico City": "Mexico",
  Mumbai: "India", Delhi: "India", Bengaluru: "India", Kolkata: "India", Chennai: "India", Hyderabad: "India", Kochi: "India", Goa: "India", Guwahati: "India",
  Jamshedpur: "India", Bhubaneswar: "India", Shillong: "India", Mohali: "India", Pune: "India"
};
// the supercar showroom: every capital, and every big city except where the market is still small
const NO_SUPERCARS = ["India"];
// generic names for a mall when the city has none listed
const MALL_NAME = {
  England: c => c + " Shopping Centre", Scotland: c => c + " Shopping Centre", Wales: c => c + " Shopping Centre", Spain: c => "Centro Comercial " + c,
  Mexico: c => "Plaza " + c, Argentina: c => "Shopping " + c, Italy: c => "Centro Commerciale " + c, Portugal: c => c + " Shopping", Brazil: c => "Shopping " + c,
  France: c => "Centre Commercial " + c, Belgium: c => "Centre Commercial " + c, Germany: c => c + " Arcaden", Austria: c => c + " Arcaden",
  Netherlands: c => "Winkelcentrum " + c, Turkey: c => "Forum " + c, "Saudi Arabia": c => c + " Park Mall", India: c => "Phoenix Mall " + c, USA: c => c + " Galleria"
};

// ---------- the city: the places, by city and by country ----------
// palette: sky top, sky bottom, ground, buildings, the accent light; climate drives the weather
const CLIMATE = {
  monsoon: { months: { 6: "storm", 7: "rain", 8: "rain", 9: "rain" }, base: ["clear", "clear", "haze", "cloud"], temp: [24, 34] },
  maritime: { months: {}, base: ["rain", "cloud", "cloud", "clear", "fog"], temp: [2, 22] },
  continental: { months: { 12: "snow", 1: "snow", 2: "snow" }, base: ["clear", "cloud", "rain", "clear"], temp: [-4, 28] },
  mediterranean: { months: { 11: "rain", 12: "rain", 1: "rain" }, base: ["clear", "clear", "clear", "cloud"], temp: [6, 34] },
  desert: { months: {}, base: ["clear", "clear", "clear", "haze"], temp: [16, 44] },
  tropical: { months: { 1: "rain", 2: "rain", 3: "rain", 12: "rain" }, base: ["clear", "cloud", "rain", "storm"], temp: [20, 33] },
  temperate: { months: { 1: "snow" }, base: ["clear", "cloud", "rain", "clear"], temp: [0, 30] }
};
const CITY_STYLE = {
  default: { climate: "temperate", sky: ["#0b1630", "#e58a52"], ground: "#1d2420", build: "#2b3138", accent: "#d0e85c", height: 1, water: false, districts: ["Old Town", "Riverside", "Hillside", "The Docks"] },
  Mumbai: { climate: "monsoon", sky: ["#101c3a", "#f08a4b"], ground: "#26231c", build: "#3a3633", accent: "#ffb547", height: 1.4, water: true, districts: ["Bandra", "Worli", "Juhu", "Powai"] },
  Goa: { climate: "monsoon", sky: ["#0d2340", "#f6a25a"], ground: "#283223", build: "#d9c7a4", accent: "#ff7a70", height: 0.45, water: true, districts: ["Panaji", "Candolim", "Porvorim", "Dona Paula"] },
  Kolkata: { climate: "monsoon", sky: ["#1a1d33", "#e8915a"], ground: "#2a2720", build: "#5a4b40", accent: "#ffcf5c", height: 0.8, water: true, districts: ["Salt Lake", "Park Street", "Ballygunge", "New Town"] },
  Bengaluru: { climate: "tropical", sky: ["#13213b", "#e99c63"], ground: "#232a22", build: "#3d4148", accent: "#7ad0ff", height: 1, water: false, districts: ["Indiranagar", "Koramangala", "Whitefield", "Jayanagar"] },
  Chennai: { climate: "tropical", sky: ["#0f2140", "#f39658"], ground: "#2b2a22", build: "#4c4740", accent: "#ffd35c", height: 0.8, water: true, districts: ["Adyar", "Besant Nagar", "Anna Nagar", "T Nagar"] },
  Kochi: { climate: "monsoon", sky: ["#0d2238", "#eda05f"], ground: "#203024", build: "#c7b89a", accent: "#ffcf5c", height: 0.6, water: true, districts: ["Fort Kochi", "Kakkanad", "Edappally", "Marine Drive"] },
  Guwahati: { climate: "monsoon", sky: ["#14203a", "#dd8f5f"], ground: "#22301f", build: "#4a4a42", accent: "#9ae66e", height: 0.6, water: true, districts: ["Dispur", "Paltan Bazaar", "Beltola", "Khanapara"] },
  Jamshedpur: { climate: "monsoon", sky: ["#171d33", "#de8a55"], ground: "#2a2a24", build: "#4c4844", accent: "#ff9a52", height: 0.6, water: false, districts: ["Bistupur", "Sakchi", "Kadma", "Sonari"] },
  Hyderabad: { climate: "tropical", sky: ["#1a1d36", "#eb9256"], ground: "#2c2a22", build: "#4b4740", accent: "#ffd35c", height: 1, water: true, districts: ["Banjara Hills", "Jubilee Hills", "Gachibowli", "Madhapur"] },
  Bhubaneswar: { climate: "monsoon", sky: ["#14203a", "#e8955a"], ground: "#28301f", build: "#4a463e", accent: "#ffb547", height: 0.6, water: false, districts: ["Saheed Nagar", "Patia", "Khandagiri", "Old Town"] },
  Delhi: { climate: "desert", sky: ["#1d1f33", "#e3a066"], ground: "#2e2b24", build: "#544c42", accent: "#ff9a52", height: 0.9, water: false, districts: ["Vasant Vihar", "Hauz Khas", "Gurugram", "Saket"] },
  Shillong: { climate: "monsoon", sky: ["#0f1e33", "#c88a66"], ground: "#1f3022", build: "#4a5048", accent: "#9ae66e", height: 0.5, water: false, districts: ["Laitumkhrah", "Police Bazaar", "Upper Shillong", "Mawlai"] },
  London: { climate: "maritime", sky: ["#0c1424", "#7d8ea6"], ground: "#1d2226", build: "#3b4048", accent: "#d0e85c", height: 1.3, water: true, districts: ["Chelsea", "Hampstead", "Canary Wharf", "Richmond"] },
  Manchester: { climate: "maritime", sky: ["#0d1422", "#7f8798"], ground: "#1d2224", build: "#4a3a36", accent: "#7ad0ff", height: 1, water: true, districts: ["Ancoats", "Didsbury", "Hale", "Spinningfields"] },
  Liverpool: { climate: "maritime", sky: ["#0d1422", "#8a8f9c"], ground: "#1d2224", build: "#4a3c38", accent: "#ff7a70", height: 0.9, water: true, districts: ["Albert Dock", "Formby", "Woolton", "Baltic Triangle"] },
  Madrid: { climate: "continental", sky: ["#14244a", "#f2a65e"], ground: "#2f2a22", build: "#d8c8ae", accent: "#ffd35c", height: 0.9, water: false, districts: ["Salamanca", "La Moraleja", "Chamberi", "Pozuelo"] },
  Barcelona: { climate: "mediterranean", sky: ["#11264a", "#f2a660"], ground: "#2c2a22", build: "#d2bca0", accent: "#ff7a70", height: 0.8, water: true, districts: ["Eixample", "Gracia", "Pedralbes", "Castelldefels"] },
  Paris: { climate: "temperate", sky: ["#121c36", "#d79a78"], ground: "#24262a", build: "#cfc3ad", accent: "#ffd35c", height: 0.8, water: true, districts: ["Le Marais", "Saint Germain", "Neuilly", "Montmartre"] },
  Munich: { climate: "continental", sky: ["#101c36", "#c9a07a"], ground: "#23262a", build: "#c9bca4", accent: "#ff5a52", height: 0.8, water: true, districts: ["Schwabing", "Bogenhausen", "Grunwald", "Maxvorstadt"] },
  Milan: { climate: "continental", sky: ["#121d38", "#d89b6c"], ground: "#26262a", build: "#c4b49a", accent: "#7ad0ff", height: 1, water: false, districts: ["Brera", "Porta Nuova", "Navigli", "Como"] },
  Turin: { climate: "continental", sky: ["#111c36", "#d29a6c"], ground: "#25262a", build: "#c8b69c", accent: "#ffffff", height: 0.8, water: true, districts: ["Crocetta", "Collina", "San Salvario", "Centro"] },
  Rome: { climate: "mediterranean", sky: ["#14214a", "#efa462"], ground: "#2c2a22", build: "#d9b893", accent: "#ffcf5c", height: 0.7, water: true, districts: ["Parioli", "Trastevere", "Monti", "Aventino"] },
  Lisbon: { climate: "mediterranean", sky: ["#13264a", "#f2a660"], ground: "#2c2a22", build: "#e3d4bc", accent: "#ff7a70", height: 0.7, water: true, districts: ["Alfama", "Chiado", "Cascais", "Belem"] },
  Riyadh: { climate: "desert", sky: ["#1a1f3a", "#f0a85e"], ground: "#3a3226", build: "#c9b08a", accent: "#7ad0ff", height: 1.5, water: false, districts: ["Olaya", "Al Malqa", "Diplomatic Quarter", "Hittin"] },
  Jeddah: { climate: "desert", sky: ["#152040", "#f2a65e"], ground: "#38301f", build: "#d6c09a", accent: "#7ad0ff", height: 1.1, water: true, districts: ["Al Hamra", "Obhur", "Al Rawdah", "Corniche"] }
};
const COUNTRY_STYLE = {
  India: "Mumbai", England: "London", Spain: "Madrid", France: "Paris", Germany: "Munich", Italy: "Milan", Portugal: "Lisbon",
  "Saudi Arabia": "Riyadh", Scotland: "Manchester", Netherlands: "Manchester", Belgium: "Paris", Turkey: "Rome", USA: "default"
};
// fallback names for a restaurant or a gym in a city with nothing real listed
const PLACE_NAMES = {
  restaurant: ["The Lantern", "Ember Grill", "Harbour Table", "Saffron House", "Olive and Oak", "The Long Table"],
  gym: ["Forge Performance", "Ironline Club", "Pulse Lab", "Apex Body Works"],
  mall: ["Meridian Mall", "Skyline Galleria", "Riverside Centre", "The Arcade"],
  shops: ["Gold Row", "The Avenue", "Silk Street", "Mercer Lane"]
};

module.exports = {
  HOMES, CARS, ITEMS, MEALS, GYM, SPONSORS, POSTS, CLIMATE, CITY_STYLE, COUNTRY_STYLE, PLACE_NAMES,
  MORE_CARS, ALL_CARS, MORE_ITEMS, ALL_ITEMS, BOOT_BRANDS, GROCERIES, AISLES, CAFE_MENU, CLUB_MENU, CLINIC_MENU,
  STORES, LUXURY, PLACE_STYLE, CHAIN_STYLE, COUNTRY_INFO, CITY_INFO, BIG_CITIES, STADIUMS, CITY_COUNTRY, NO_SUPERCARS, MALL_NAME
};
