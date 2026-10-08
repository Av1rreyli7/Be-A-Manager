// Player Career: the life off the pitch. Homes, cars, shops, food, the gym, sponsors and the city itself.
// Every brand here is made up. Prices are in pounds; the screens convert them to the player's own money.

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

// ---------- cars ----------
const CARS = [
  { id: "scoot", tier: 0, brand: "Nimbus", model: "Scoot 125", price: 1100, upkeep: 6, flash: 0, colour: "#3f8fd8", body: "scooter" },
  { id: "pico", tier: 1, brand: "Veltra", model: "Pico", price: 11000, upkeep: 25, flash: 1, colour: "#e8e4dc", body: "hatch" },
  { id: "aero", tier: 2, brand: "Kestrel", model: "Aero", price: 32000, upkeep: 55, flash: 2, colour: "#1d2a44", body: "saloon" },
  { id: "gt", tier: 3, brand: "Aurion", model: "GT", price: 78000, upkeep: 120, flash: 4, colour: "#0d0f12", body: "coupe" },
  { id: "corsa", tier: 4, brand: "Strada", model: "Corsa", price: 190000, upkeep: 260, flash: 7, colour: "#c8102e", body: "sports" },
  { id: "regent", tier: 4, brand: "Monarch", model: "Regent", price: 240000, upkeep: 300, flash: 6, colour: "#20262b", body: "suv" },
  { id: "hypra", tier: 5, brand: "Vanta", model: "Hypra", price: 2400000, upkeep: 2200, flash: 12, colour: "#d0e85c", body: "hyper" }
];

// ---------- things to buy: where to find them, what they cost, what they do ----------
// look: buying it unlocks that accessory for the 3D look (the wardrobe at home puts it on or takes it off)
const ITEMS = [
  { id: "hoodie", shop: "mall", brand: "Northline", label: "Northline hoodie", price: 85, mood: 1, flash: 0 },
  { id: "kicks", shop: "mall", brand: "Kurobe", label: "Kurobe street trainers", price: 190, mood: 2, flash: 1 },
  { id: "phones", shop: "mall", brand: "Lumen", label: "Lumen noise cancelling headphones", price: 320, mood: 2, flash: 0, perk: "focus" },
  { id: "console", shop: "mall", brand: "Pixelforge", label: "Pixelforge games console", price: 480, mood: 4, flash: 0, perk: "unwind" },
  { id: "phone", shop: "mall", brand: "Lumen", label: "Lumen One phone", price: 1100, mood: 2, flash: 1, perk: "social" },
  { id: "steelwatch", shop: "shops", brand: "Arden", label: "Arden steel watch", price: 2400, mood: 2, flash: 2, look: { watch: "steel" } },
  { id: "chain", shop: "shops", brand: "Solenne", label: "Solenne silver chain", price: 3200, mood: 2, flash: 3, look: { necklace: "silver" } },
  { id: "jacket", shop: "shops", brand: "Halcyon", label: "Halcyon leather jacket", price: 4800, mood: 3, flash: 3 },
  { id: "studs", shop: "shops", brand: "Solenne", label: "Solenne diamond studs", price: 9500, mood: 3, flash: 4, look: { earrings: "diamond" } },
  { id: "goldwatch", shop: "shops", brand: "Celestor", label: "Celestor gold watch", price: 38000, mood: 4, flash: 6, look: { watch: "gold" } },
  { id: "suit", shop: "shops", brand: "Maison Orrè", label: "Maison Orrè tailored suit", price: 14000, mood: 3, flash: 5 },
  { id: "goldchain", shop: "shops", brand: "Solenne", label: "Solenne gold chain", price: 26000, mood: 3, flash: 6, look: { necklace: "gold" } }
];

// ---------- food ----------
const MEALS = [
  { id: "healthy", label: "A clean meal, chicken, rice, greens", price: 18, fitness: 2, fatigue: -3, morale: 0, form: 0.05, note: "Fuel. The nutritionist would approve." },
  { id: "treat", label: "Burger, fries and a shake", price: 22, fitness: -2, fatigue: 0, morale: 3, form: -0.05, note: "Worth it. Probably." },
  { id: "fine", label: "Tasting menu at the fancy place", price: 260, fitness: 0, fatigue: -2, morale: 5, form: 0, social: 0.004, note: "Eight courses, tiny plates, a photo for the feed." }
];

// ---------- the gym ----------
const GYM = [
  { id: "weights", label: "Strength session", price: 0, attrs: { strength: 0.35, jumping: 0.12 }, fatigue: 8, risk: 0.006 },
  { id: "engine", label: "Engine work on the bike", price: 0, attrs: { stamina: 0.35, acceleration: 0.08 }, fatigue: 9, risk: 0.005 },
  { id: "mobility", label: "Mobility and core", price: 0, attrs: { agility: 0.18, balance: 0.2 }, fatigue: 3, risk: 0 },
  { id: "spa", label: "Ice bath, sauna and a massage", price: 70, attrs: {}, fatigue: -14, risk: 0, mood: 2 }
];

// ---------- sponsors: made up brands that come knocking as his name grows ----------
// need: commercial reputation needed; base: pounds a week at that level; time: free time slots a deal takes in a week
const SPONSORS = [
  { id: "greenleaf", brand: "Greenleaf", kind: "Food", need: 8, base: 30, time: 0, line: "Healthy snacks, local ads." },
  { id: "fizzline", brand: "Fizzline", kind: "Sports drink", need: 15, base: 90, time: 0, line: "Your face on the bottle in your city." },
  { id: "stride", brand: "Stride", kind: "Sportswear", need: 25, base: 260, time: 0, line: "Training kit and one shoot a season." },
  { id: "lumen", brand: "Lumen", kind: "Tech", need: 35, base: 700, time: 0, line: "Headphones in the tunnel, an advert on the telly." },
  { id: "crestbank", brand: "Crestbank", kind: "Bank", need: 45, base: 1600, time: 0, line: "A national campaign. Smile, you are trustworthy now." },
  { id: "pixelforge", brand: "Pixelforge", kind: "Gaming", need: 52, base: 2800, time: 0, line: "Your face on the cover of a football game." },
  { id: "aurion", brand: "Aurion", kind: "Cars", need: 62, base: 5200, time: 0, line: "A free car and a television advert.", gift: "gt" },
  { id: "celestor", brand: "Celestor", kind: "Watches", need: 72, base: 9800, time: 0, line: "Global ambassador. Gold on your wrist in every photo.", gift: "goldwatch" },
  { id: "apex", brand: "Apex", kind: "Boots", need: 20, base: 180, time: 0, boots: true, line: "Your own boots, made for you." },
  { id: "korra", brand: "Korra", kind: "Boots", need: 40, base: 1100, time: 0, boots: true, line: "A signature colourway in shops." },
  { id: "valore", brand: "Valoré", kind: "Boots", need: 66, base: 7400, time: 0, boots: true, line: "A signature boot line, worldwide." }
];

// ---------- social media ----------
const POSTS = [
  { id: "training", label: "A training clip", base: 0.004, commercial: 0.2, risk: 0 },
  { id: "match", label: "Match day photo", base: 0.006, commercial: 0.3, risk: 0, needsMatch: true },
  { id: "lifestyle", label: "Lifestyle shot (the car, the watch, the holiday)", base: 0.008, commercial: 0.6, risk: 0.25 },
  { id: "charity", label: "Visit a school back home", base: 0.005, commercial: 0.4, risk: 0, local: 1.5 },
  { id: "fans", label: "Thank the fans", base: 0.005, commercial: 0.2, risk: 0, local: 0.6 }
];

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
// what the places are called in a city: made up names, the same pattern everywhere
const PLACE_NAMES = {
  restaurant: ["The Lantern", "Ember Grill", "Harbour Table", "Saffron House", "Olive and Oak", "The Long Table"],
  gym: ["Forge Performance", "Ironline Club", "Pulse Lab", "Apex Body Works"],
  mall: ["Meridian Mall", "Skyline Galleria", "Riverside Centre", "The Arcade"],
  shops: ["Gold Row", "The Avenue", "Silk Street", "Mercer Lane"]
};

module.exports = { HOMES, CARS, ITEMS, MEALS, GYM, SPONSORS, POSTS, CLIMATE, CITY_STYLE, COUNTRY_STYLE, PLACE_NAMES };
