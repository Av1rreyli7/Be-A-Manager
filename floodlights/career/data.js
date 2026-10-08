// Player Career: the fixed data the career runs on. Countries and how a career starts in each, the India
// school and college pathway, the Indian Super League (it exists only inside Player Career saves, so Manager
// Career never sees it), agents, attributes and how each position weighs them, and the training menu.
// Real school names are kept (the person asked for them); colleges, academies and agents are invented. The brands
// (shops, cars, watches, sponsors) are real ones and live in life_data.js.

// ---------- attributes ----------
// 0 to 99 each. Grouped the way the career screens show them.
const ATTRS = {
  technical: ["control", "dribbling", "passing", "crossing", "finishing", "longShots", "firstTouch", "freeKicks", "penalties", "heading"],
  defending: ["tackling", "marking"],
  physical: ["pace", "acceleration", "strength", "stamina", "agility", "balance", "jumping"],
  mental: ["composure", "vision", "positioning", "reactions", "decisions", "leadership", "concentration"],
  keeping: ["diving", "handling", "reflexes", "gkPositioning", "kicking"]
};
const ATTR_LIST = [].concat(...Object.values(ATTRS));
const ATTR_LABEL = {
  control: "Ball control", dribbling: "Dribbling", passing: "Passing", crossing: "Crossing", finishing: "Finishing",
  longShots: "Long shots", firstTouch: "First touch", freeKicks: "Free kicks", penalties: "Penalties", heading: "Heading",
  tackling: "Tackling", marking: "Marking",
  pace: "Pace", acceleration: "Acceleration", strength: "Strength", stamina: "Stamina", agility: "Agility", balance: "Balance", jumping: "Jumping",
  composure: "Composure", vision: "Vision", positioning: "Positioning", reactions: "Reactions", decisions: "Decision making",
  leadership: "Leadership", concentration: "Concentration",
  diving: "Diving", handling: "Handling", reflexes: "Reflexes", gkPositioning: "Keeper positioning", kicking: "Kicking"
};

// how much each attribute counts towards the overall rating in each position (weights sum to 1)
const W = (o) => { const s = Object.values(o).reduce((a, b) => a + b, 0); const r = {}; for (const k in o) r[k] = o[k] / s; return r; };
const POS_WEIGHTS = {
  GK: W({ diving: 20, handling: 18, reflexes: 22, gkPositioning: 18, kicking: 8, reactions: 6, composure: 4, jumping: 4 }),
  CB: W({ tackling: 18, marking: 18, heading: 12, strength: 10, positioning: 10, jumping: 7, reactions: 7, composure: 6, passing: 5, pace: 4, concentration: 3 }),
  RB: W({ tackling: 13, marking: 11, pace: 12, stamina: 10, crossing: 10, acceleration: 8, positioning: 8, passing: 8, reactions: 6, dribbling: 6, control: 4, agility: 4 }),
  LB: null, RWB: null, LWB: null,
  CDM: W({ tackling: 14, marking: 10, passing: 14, positioning: 10, stamina: 9, strength: 8, decisions: 8, vision: 7, composure: 7, control: 7, reactions: 6 }),
  CM: W({ passing: 17, vision: 12, control: 11, firstTouch: 8, decisions: 9, stamina: 9, dribbling: 7, longShots: 6, composure: 7, reactions: 6, positioning: 4, tackling: 4 }),
  CAM: W({ passing: 15, vision: 15, dribbling: 13, control: 12, firstTouch: 9, composure: 8, finishing: 9, longShots: 7, agility: 6, decisions: 6 }),
  RM: W({ pace: 13, crossing: 13, dribbling: 13, passing: 10, acceleration: 9, stamina: 9, control: 10, agility: 7, vision: 6, finishing: 5, decisions: 5 }),
  LM: null,
  RW: W({ pace: 14, dribbling: 16, acceleration: 11, control: 12, finishing: 10, crossing: 8, agility: 9, firstTouch: 7, composure: 6, vision: 4, balance: 3 }),
  LW: null,
  ST: W({ finishing: 22, positioning: 13, composure: 10, control: 9, firstTouch: 8, pace: 9, acceleration: 7, heading: 7, strength: 6, reactions: 6, longShots: 3 }),
  CF: W({ finishing: 16, control: 13, vision: 11, passing: 10, dribbling: 11, firstTouch: 10, composure: 10, positioning: 9, longShots: 5, agility: 5 })
};
POS_WEIGHTS.LB = POS_WEIGHTS.RB; POS_WEIGHTS.RWB = POS_WEIGHTS.RB; POS_WEIGHTS.LWB = POS_WEIGHTS.RB;
POS_WEIGHTS.LM = POS_WEIGHTS.RM; POS_WEIGHTS.LW = POS_WEIGHTS.RW;
const POSITIONS = ["GK", "RB", "RWB", "CB", "LB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "ST", "CF"];
// the world's four groups and the match engine's roles (the shared database uses these)
const POS_GROUP = { GK: "GK", RB: "DF", RWB: "DF", CB: "DF", LB: "DF", LWB: "DF", CDM: "MF", CM: "MF", CAM: "MF", RM: "MF", LM: "MF", RW: "FW", LW: "FW", ST: "FW", CF: "FW" };
const POS_ROLE = { GK: "GK", RB: "RB", RWB: "RB", CB: "CB", LB: "LB", LWB: "LB", CDM: "CDM", CM: "CM", CAM: "CAM", RM: "RW", LM: "LW", RW: "RW", LW: "LW", ST: "ST", CF: "ST" };

// playing styles tilt the starting attributes and later the growth (a little, never a lot)
const STYLES = {
  "Poacher":        { pos: ["ST", "CF"], tilt: { finishing: 4, positioning: 4, composure: 2, passing: -2 } },
  "Target man":     { pos: ["ST", "CF"], tilt: { heading: 5, strength: 4, jumping: 3, pace: -3 } },
  "Speedster":      { pos: ["RW", "LW", "ST", "RM", "LM"], tilt: { pace: 5, acceleration: 5, strength: -3 } },
  "Dribbler":       { pos: ["RW", "LW", "CAM", "RM", "LM", "CF"], tilt: { dribbling: 5, agility: 4, balance: 3, heading: -3 } },
  "Playmaker":      { pos: ["CAM", "CM", "CF"], tilt: { vision: 5, passing: 4, composure: 2, strength: -2 } },
  "Box to box":     { pos: ["CM", "CDM"], tilt: { stamina: 5, tackling: 2, passing: 2, finishing: 1 } },
  "Ball winner":    { pos: ["CDM", "CB", "CM"], tilt: { tackling: 5, marking: 4, strength: 2, dribbling: -2 } },
  "Ball playing defender": { pos: ["CB"], tilt: { passing: 4, composure: 4, vision: 2, heading: -1 } },
  "Stopper":        { pos: ["CB"], tilt: { tackling: 4, heading: 4, strength: 3, passing: -2 } },
  "Attacking full back": { pos: ["RB", "LB", "RWB", "LWB"], tilt: { crossing: 5, stamina: 3, pace: 2, marking: -2 } },
  "Sweeper keeper": { pos: ["GK"], tilt: { kicking: 5, gkPositioning: 3, reactions: 2 } },
  "Shot stopper":   { pos: ["GK"], tilt: { reflexes: 5, diving: 4, kicking: -2 } }
};

// ---------- countries ----------
// path: "school" (the India school and college journey), "academy" (a youth academy at a club at home), or
// "abroad" (a national development centre at home, then trials abroad). currency is only for display.
const COUNTRIES = {
  "India":        { path: "school", league: "Indian Super League", currency: "INR", lang: ["English", "Hindi", "Marathi", "Bengali", "Malayalam", "Tamil", "Punjabi", "Konkani"], city: "Mumbai" },
  "England":      { path: "academy", league: "Premier League", currency: "GBP", lang: ["English"], city: "Manchester" },
  "Spain":        { path: "academy", league: "La Liga", currency: "EUR", lang: ["Spanish", "Catalan", "English"], city: "Madrid" },
  "Italy":        { path: "academy", league: "Serie A", currency: "EUR", lang: ["Italian", "English"], city: "Milan" },
  "Germany":      { path: "academy", league: "Bundesliga", currency: "EUR", lang: ["German", "English"], city: "Munich" },
  "France":       { path: "academy", league: "Ligue 1", currency: "EUR", lang: ["French", "English"], city: "Paris" },
  "Netherlands":  { path: "academy", league: "Eredivisie", currency: "EUR", lang: ["Dutch", "English"], city: "Amsterdam" },
  "Portugal":     { path: "academy", league: "Primeira Liga", currency: "EUR", lang: ["Portuguese", "English"], city: "Lisbon" },
  "Belgium":      { path: "academy", league: "Belgian Pro League", currency: "EUR", lang: ["Dutch", "French", "English"], city: "Brussels" },
  "Turkey":       { path: "academy", league: "Super Lig", currency: "TRY", lang: ["Turkish", "English"], city: "Istanbul" },
  "Scotland":     { path: "academy", league: "Scottish Premiership", currency: "GBP", lang: ["English"], city: "Glasgow" },
  "Saudi Arabia": { path: "academy", league: "Saudi Pro League", currency: "SAR", lang: ["Arabic", "English"], city: "Riyadh" },
  "USA":          { path: "academy", league: "MLS", currency: "USD", lang: ["English", "Spanish"], city: "Los Angeles" },
  "Mexico":       { path: "academy", league: "Liga MX", currency: "MXN", lang: ["Spanish", "English"], city: "Mexico City" },
  "Brazil":       { path: "academy", league: "Brasileirao", currency: "BRL", lang: ["Portuguese", "English"], city: "Rio de Janeiro" },
  "Argentina":    { path: "academy", league: "Argentina", currency: "ARS", lang: ["Spanish", "English"], city: "Buenos Aires" },
  "Nigeria":      { path: "abroad", league: "Belgian Pro League", currency: "NGN", lang: ["English", "Yoruba", "Igbo", "Hausa"], city: "Lagos" },
  "Ghana":        { path: "abroad", league: "Belgian Pro League", currency: "GHS", lang: ["English", "Twi"], city: "Accra" },
  "Japan":        { path: "abroad", league: "Belgian Pro League", currency: "JPY", lang: ["Japanese", "English"], city: "Tokyo" },
  "South Korea":  { path: "abroad", league: "Eredivisie", currency: "KRW", lang: ["Korean", "English"], city: "Seoul" },
  "Australia":    { path: "abroad", league: "Scottish Premiership", currency: "AUD", lang: ["English"], city: "Sydney" },
  "Morocco":      { path: "abroad", league: "Ligue 1", currency: "MAD", lang: ["Arabic", "French", "English"], city: "Casablanca" },
  "Canada":       { path: "abroad", league: "MLS", currency: "CAD", lang: ["English", "French"], city: "Toronto" },
  "Uruguay":      { path: "abroad", league: "Argentina", currency: "UYU", lang: ["Spanish", "English"], city: "Montevideo" },
  "Colombia":     { path: "abroad", league: "Liga MX", currency: "COP", lang: ["Spanish", "English"], city: "Bogota" }
};
// £1 in each currency, for showing money the local way
const FX = { GBP: { sym: "£", r: 1 }, EUR: { sym: "€", r: 1.17 }, USD: { sym: "$", r: 1.27 }, INR: { sym: "₹", r: 106 }, TRY: { sym: "₺", r: 43 }, SAR: { sym: "SAR ", r: 4.76 }, MXN: { sym: "MX$", r: 23 }, BRL: { sym: "R$", r: 7 }, ARS: { sym: "AR$", r: 1250 }, NGN: { sym: "₦", r: 1950 }, GHS: { sym: "GH₵", r: 16 }, JPY: { sym: "¥", r: 190 }, KRW: { sym: "₩", r: 1750 }, AUD: { sym: "A$", r: 1.95 }, MAD: { sym: "MAD ", r: 12.7 }, CAD: { sym: "C$", r: 1.74 }, UYU: { sym: "$U", r: 51 }, COP: { sym: "COL$", r: 5200 } };

// ---------- India: schools (real names, our own numbers) ----------
// ratings 1 to 10. tuition is per school year in pounds (shown in rupees in Mumbai).
const SCHOOLS = [
  { id: "oberoi", name: "Oberoi International School", area: "Goregaon, Mumbai", facilities: 9, coaching: 7, academics: 10, competition: 7, training: 8, exposure: 6, lifestyle: 9, tuition: 9800, connections: 8, tournaments: 7,
    blurb: "Big green campus in Goregaon, a full size turf and a strong inter school side. Smart, busy, a little intense." },
  { id: "dais", name: "Dhirubhai Ambani International School", area: "Bandra Kurla Complex, Mumbai", facilities: 8, coaching: 7, academics: 10, competition: 8, training: 7, exposure: 8, lifestyle: 10, tuition: 11200, connections: 10, tournaments: 8,
    blurb: "The famous one in BKC. Connections everywhere, scouts know the name, and every match is watched." },
  { id: "ascend", name: "Ascend International School", area: "Bandra Kurla Complex, Mumbai", facilities: 7, coaching: 8, academics: 8, competition: 6, training: 8, exposure: 6, lifestyle: 8, tuition: 8600, connections: 7, tournaments: 7,
    blurb: "Smaller, sport friendly, coaches who give real minutes. A good place to play every week." },
  { id: "asb", name: "American School of Bombay", area: "Bandra Kurla Complex, Mumbai", facilities: 9, coaching: 8, academics: 9, competition: 7, training: 9, exposure: 7, lifestyle: 9, tuition: 13500, connections: 8, tournaments: 9,
    blurb: "American style sport programme, travel tournaments abroad and the best gym of the lot. Costly." },
  { id: "ecole", name: "Ecole Mondiale World School", area: "Juhu, Mumbai", facilities: 7, coaching: 6, academics: 9, competition: 5, training: 6, exposure: 5, lifestyle: 9, tuition: 9200, connections: 7, tournaments: 6,
    blurb: "Juhu, near the beach. Calmer football, plenty of game time, a relaxed and friendly squad." },
  { id: "local", name: "Andheri Municipal School and Bombay Boys Club", area: "Andheri, Mumbai", facilities: 3, coaching: 5, academics: 5, competition: 6, training: 4, exposure: 4, lifestyle: 4, tuition: 120, connections: 3, tournaments: 6,
    blurb: "The local school plus the neighbourhood club on a dusty ground. Almost free, hungry players, every match a fight." }
];
// ---------- India: football colleges and development programmes (invented) ----------
const COLLEGES = [
  { id: "ncfe", name: "National Centre for Football Excellence", city: "Bhubaneswar", reputation: 9, coaching: 9, facilities: 10, fitness: 9, tactical: 8, youth: 9, exposure: 9, competition: 10, academics: 6, cost: 7800,
    blurb: "Elite and selective. The best coaches in the country and scouts at every session, but you fight for a place." },
  { id: "wifc", name: "Western India Football College", city: "Pune", reputation: 8, coaching: 8, facilities: 8, fitness: 8, tactical: 9, youth: 8, exposure: 7, competition: 8, academics: 8, cost: 5400,
    blurb: "Tactically sharp and well run, with a good degree on the side. Near enough to Mumbai for family weekends." },
  { id: "csu", name: "Coastal Sports University", city: "Goa", reputation: 7, coaching: 7, facilities: 7, fitness: 7, tactical: 7, youth: 8, exposure: 8, competition: 7, academics: 7, cost: 4600,
    blurb: "Football is a religion in Goa. FC Goa scouts come to every match and the beach is ten minutes away." },
  { id: "bfi", name: "Bengal Football Institute", city: "Kolkata", reputation: 8, coaching: 7, facilities: 6, fitness: 7, tactical: 7, youth: 7, exposure: 9, competition: 9, academics: 6, cost: 3900,
    blurb: "Old school and passionate. The two giant Kolkata clubs watch closely and the crowds are mad." },
  { id: "nefa", name: "Northeast Football Academy College", city: "Shillong", reputation: 7, coaching: 8, facilities: 6, fitness: 8, tactical: 7, youth: 10, exposure: 6, competition: 7, academics: 6, cost: 3100,
    blurb: "The hills that produce half the national team. Brilliant for growing as a player, far from the spotlight." },
  { id: "mccs", name: "Mumbai College of Sport", city: "Mumbai", reputation: 5, coaching: 6, facilities: 6, fitness: 6, tactical: 6, youth: 6, exposure: 6, competition: 5, academics: 7, cost: 2600,
    blurb: "Stay home in Mumbai, play a lot of minutes in a smaller league and keep your old life." }
];

// ---------- the Indian Super League (only inside Player Career saves) ----------
// [name, city, strength band, budget in £m]. Squads are generated with Indian names plus a few foreigners.
const ISL = [
  ["Mohun Bagan Super Giant", "Kolkata", 70, 6], ["East Bengal", "Kolkata", 66, 4.5], ["Bengaluru FC", "Bengaluru", 67, 4.5],
  ["Mumbai City FC", "Mumbai", 68, 5.5], ["FC Goa", "Goa", 67, 4.5], ["Kerala Blasters", "Kochi", 65, 4],
  ["Chennaiyin FC", "Chennai", 63, 3.5], ["Jamshedpur FC", "Jamshedpur", 63, 3.5], ["Odisha FC", "Bhubaneswar", 64, 3.5],
  ["NorthEast United", "Guwahati", 63, 3], ["Punjab FC", "Mohali", 62, 3], ["Mohammedan SC", "Kolkata", 60, 2.5]
];
const ISL_NAME = "Indian Super League";
const IN_FIRST = ["Aarav", "Rohan", "Arjun", "Vikram", "Siddharth", "Karan", "Rahul", "Aniket", "Sahil", "Ishaan", "Manvir", "Lalengmawia", "Jeakson", "Akash", "Nikhil", "Pritam", "Subhasish", "Anwar", "Ashique", "Liston", "Brandon", "Glan", "Udanta", "Bipin", "Thoiba", "Lalthathanga", "Chinglensana", "Vishal", "Gurmeet", "Harmanjot", "Ayush", "Naorem", "Amarjit", "Hormipam", "Mehtab", "Sunil", "Gurpreet", "Sandesh", "Anirudh", "Suresh", "Yasir", "Rahim", "Farukh", "Lalrinliana", "Pronay", "Deepak", "Abhishek", "Jithin", "Sahal", "Mohammed", "Dheeraj", "Vignesh", "Kiyan", "Imran", "Tekcham", "Robin", "Ninthoi", "Shubham", "Prabhsukhan", "Dippendu"];
const IN_LAST = ["Singh", "Kumar", "Sharma", "Bose", "Das", "Fernandes", "Colaco", "D'Souza", "Rodrigues", "Pereira", "Chhetri", "Thapa", "Gurung", "Lalthlamuana", "Ralte", "Pachau", "Hnamte", "Meitei", "Khan", "Ali", "Ahmed", "Nair", "Menon", "Pillai", "Varghese", "Abraham", "Mondal", "Ghosh", "Banerjee", "Chakraborty", "Halder", "Bhattacharya", "Rao", "Reddy", "Iyer", "Naik", "Gawde", "Shetty", "Patil", "Jadhav", "Kamble", "Sawant", "Dias", "Gill", "Sandhu", "Dhillon", "Bheke", "Jhingan", "Samad", "Mohan"];
const FOREIGN_FIRST = ["Diego", "Jason", "Dimitrios", "Alberto", "Jordi", "Cleiton", "Greg", "Sergio", "Roy", "Hugo", "Jamie", "Tom", "Nestor", "Javier", "Petr", "Luka", "Adrian", "Kiyan", "Jon", "Marcos"];
const FOREIGN_LAST = ["Mauricio", "Cummings", "Petratos", "Rodriguez", "Montal", "Silva", "Stewart", "Castel", "Krishna", "Boumous", "Maclaren", "Aldred", "Albiach", "Siverio", "Ruiz", "Majcen", "Luna", "Nassiri", "Toral", "Botelho"];

// ---------- agents (invented) ----------
// negotiate: better wages and fees. europe: offers from abroad. sponsor: brand deals. care: looks after you.
const AGENTS = [
  { id: "rk", name: "Rakesh Kapoor", agency: "Kapoor Sports Management", base: "Mumbai", fee: 0.08, negotiate: 6, europe: 3, sponsor: 7, care: 7, blurb: "Knows every brand manager in Mumbai. Loud, warm, always on the phone." },
  { id: "mb", name: "Meera Bhatt", agency: "Fieldhouse Talent", base: "Bengaluru", fee: 0.07, negotiate: 8, europe: 4, sponsor: 5, care: 8, blurb: "Quiet, careful, reads every clause twice. Players trust her." },
  { id: "jv", name: "Joao Vieira", agency: "Atlantico Football", base: "Lisbon", fee: 0.1, negotiate: 7, europe: 9, sponsor: 5, care: 5, blurb: "Moves young players into Portugal and Belgium. Fast, ambitious, a bit cold." },
  { id: "sh", name: "Sophie Hartmann", agency: "Hartmann Sports Group", base: "London", fee: 0.12, negotiate: 9, europe: 9, sponsor: 8, care: 6, blurb: "Elite agency, elite clients. Only takes players who are going places." },
  { id: "dk", name: "Daniel Okafor", agency: "Northline Representation", base: "Manchester", fee: 0.09, negotiate: 7, europe: 7, sponsor: 9, care: 6, blurb: "Turns players into brands. Boots, gaming, music, he knows everyone." },
  { id: "af", name: "Anil Fernandes", agency: "Goa Football Partners", base: "Goa", fee: 0.05, negotiate: 5, europe: 4, sponsor: 4, care: 9, blurb: "Family friend type. Cheap, honest, will always pick up the phone." }
];

// ---------- training ----------
// each session: what it grows, how tiring it is (fatigue points), how risky (injury weight) and a cost when paid
const SESSIONS = {
  technical: { label: "Technical", grows: ["control", "firstTouch", "dribbling", "passing"], fatigue: 8, risk: 0.6 },
  finishing: { label: "Finishing", grows: ["finishing", "composure", "longShots", "penalties"], fatigue: 8, risk: 0.6 },
  passing: { label: "Passing and vision", grows: ["passing", "vision", "crossing", "decisions"], fatigue: 6, risk: 0.4 },
  setpieces: { label: "Set pieces", grows: ["freeKicks", "penalties", "crossing", "heading"], fatigue: 5, risk: 0.3 },
  defending: { label: "Defending", grows: ["tackling", "marking", "positioning", "heading"], fatigue: 9, risk: 0.9 },
  keeping: { label: "Goalkeeping", grows: ["diving", "handling", "reflexes", "gkPositioning", "kicking"], fatigue: 8, risk: 0.6 },
  speed: { label: "Speed and agility", grows: ["pace", "acceleration", "agility", "balance"], fatigue: 13, risk: 1.4 },
  strength: { label: "Strength and power", grows: ["strength", "jumping", "balance"], fatigue: 12, risk: 1.1 },
  stamina: { label: "Fitness and stamina", grows: ["stamina", "concentration"], fatigue: 14, risk: 0.9 },
  tactical: { label: "Tactical session", grows: ["positioning", "decisions", "vision", "concentration", "marking"], fatigue: 4, risk: 0.2 },
  mental: { label: "Mental coaching", grows: ["composure", "concentration", "leadership", "decisions"], fatigue: 2, risk: 0, cost: 60 },
  individual: { label: "Individual coaching", grows: null, fatigue: 9, risk: 0.6, cost: 180 },
  recovery: { label: "Recovery and physio", grows: [], fatigue: -18, risk: -0.5 },
  rest: { label: "Rest day", grows: [], fatigue: -24, risk: -0.8 }
};
const INTENSITY = { light: { gain: 0.6, fatigue: 0.6, risk: 0.5 }, normal: { gain: 1, fatigue: 1, risk: 1 }, hard: { gain: 1.45, fatigue: 1.5, risk: 2.1 } };
const SLOTS = 5; // sessions a week

// ---------- injuries ----------
const INJURIES = [
  { name: "Hamstring strain", weeks: [2, 4], part: "hamstring" }, { name: "Ankle sprain", weeks: [1, 3], part: "ankle" },
  { name: "Calf strain", weeks: [1, 3], part: "calf" }, { name: "Groin strain", weeks: [2, 4], part: "groin" },
  { name: "Knee ligament sprain", weeks: [4, 8], part: "knee" }, { name: "Thigh bruise", weeks: [1, 2], part: "thigh" },
  { name: "Broken toe", weeks: [3, 5], part: "foot" }, { name: "Shoulder knock", weeks: [1, 2], part: "shoulder" },
  { name: "Torn hamstring", weeks: [6, 10], part: "hamstring" }, { name: "Fractured metatarsal", weeks: [8, 12], part: "foot" }
];

// ---------- youth football in India: what the school and college leagues are called ----------
const YOUTH_COMPS = {
  school: [{ name: "Mumbai Inter School League", weeks: "league" }, { name: "Subroto Cup", weeks: [16, 17, 18, 19], national: true }, { name: "Mumbai Schools Cup", weeks: [28, 29, 30] }],
  college: [{ name: "All India University League", weeks: "league" }, { name: "Khelo India University Games", weeks: [20, 21, 22], national: true }, { name: "Santosh Trophy trials", weeks: [32, 33] }]
};
const SCHOOL_RIVALS = ["Cathedral and John Connon School", "Bombay Scottish School", "Don Bosco High School", "St Mary's School", "Jamnabai Narsee School", "Podar International School", "Campion School", "Utpal Shanghvi School", "Smt Sulochanadevi Singhania School", "St Stanislaus High School", "Hiranandani Foundation School"];
const COLLEGE_RIVALS = ["Delhi University Sports XI", "Calcutta University", "Goa University", "University of Kerala", "Punjab University", "Manipur University", "Mizoram University", "Christ University", "Jamia Millia Islamia", "Kalinga Institute", "Savitribai Phule Pune University"];

// ---------- national youth teams: the level, the age limit and what it takes ----------
const NATIONAL_LEVELS = [
  { id: "u17", label: "U17", maxAge: 16, need: 50 }, { id: "u20", label: "U20", maxAge: 19, need: 58 },
  { id: "u23", label: "U23", maxAge: 22, need: 64 }, { id: "senior", label: "Senior", maxAge: 99, need: 0 }
];

module.exports = {
  ATTRS, ATTR_LIST, ATTR_LABEL, POS_WEIGHTS, POSITIONS, POS_GROUP, POS_ROLE, STYLES, COUNTRIES, FX, SCHOOLS, COLLEGES,
  ISL, ISL_NAME, IN_FIRST, IN_LAST, FOREIGN_FIRST, FOREIGN_LAST, AGENTS, SESSIONS, INTENSITY, SLOTS, INJURIES,
  YOUTH_COMPS, SCHOOL_RIVALS, COLLEGE_RIVALS, NATIONAL_LEVELS
};
