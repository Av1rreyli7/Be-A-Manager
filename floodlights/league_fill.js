// League fill: real clubs added so every league plays a realistic number of matchweeks.
// Squads are generated from region name pools around each club's tier rating.
// Super Lig, Eredivisie, Primeira Liga and Saudi Pro League go to 18 clubs (34 rounds),
// Belgian Pro League to 16 (30), Scottish Premiership to 12 (22), Liga MX to 18 (34),
// Brasileirao to 20 (38, the real count), MLS and Argentina to 16 (30, trimmed from
// their real 30 club formats so the season fits in 38 weeks).

const FILL_NAMES = {
  turkey: {
    first: ["Emre", "Mert", "Kaan", "Berat", "Yusuf", "Arda", "Baris", "Halil", "Ozan", "Umut", "Furkan", "Serdar"],
    last: ["Yilmaz", "Demir", "Sahin", "Celik", "Aydin", "Kaya", "Arslan", "Dogan", "Kilic", "Aslan", "Cetin", "Kurt", "Koc", "Ozdemir"]
  },
  netherlands: {
    first: ["Daan", "Sem", "Luuk", "Thijs", "Jesse", "Ruben", "Sven", "Mees", "Bram", "Joris", "Teun", "Wout"],
    last: ["de Jong", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "Mulder", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Kuipers"]
  },
  portugal: {
    first: ["Joao", "Tiago", "Diogo", "Afonso", "Rodrigo", "Tomas", "Goncalo", "Duarte", "Martim", "Francisco", "Vasco", "Henrique"],
    last: ["Silva", "Santos", "Ferreira", "Pereira", "Oliveira", "Costa", "Rodrigues", "Martins", "Sousa", "Fonseca", "Carvalho", "Teixeira", "Moreira", "Ramos"]
  },
  belgium: {
    first: ["Lucas", "Arthur", "Noah", "Louis", "Victor", "Milan", "Maxime", "Simon", "Thibo", "Wout", "Senne", "Jarne"],
    last: ["Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens", "Wouters", "De Smet", "Dubois", "Lambert", "Vermeulen", "Hermans"]
  },
  scotland: {
    first: ["Callum", "Lewis", "Finlay", "Ross", "Euan", "Fraser", "Kieran", "Logan", "Blair", "Cameron", "Rory", "Angus"],
    last: ["MacDonald", "Campbell", "Stewart", "Robertson", "Ferguson", "Grant", "Murray", "Wallace", "Boyd", "Craig", "Duncan", "McLean", "Paterson", "Sinclair"]
  },
  saudi: {
    first: ["Abdullah", "Fahad", "Saud", "Nawaf", "Turki", "Khalid", "Faisal", "Majed", "Salem", "Rayan", "Ziyad", "Hamdan"],
    last: ["Al-Qahtani", "Al-Otaibi", "Al-Ghamdi", "Al-Harbi", "Al-Shehri", "Al-Dossari", "Al-Mutairi", "Al-Zahrani", "Al-Amri", "Al-Salem", "Al-Juwayr", "Al-Buraikan", "Al-Najei", "Al-Rashidi"]
  },
  mexico: {
    first: ["Diego", "Santiago", "Emiliano", "Alexis", "Uriel", "Fernando", "Carlos", "Jesus", "Angel", "Eduardo", "Marcelo", "Rodrigo"],
    last: ["Hernandez", "Garcia", "Martinez", "Lopez", "Gonzalez", "Rodriguez", "Sanchez", "Ramirez", "Torres", "Flores", "Vazquez", "Jimenez", "Reyes", "Aguilar"]
  },
  brazil: {
    first: ["Gabriel", "Matheus", "Lucas", "Pedro", "Vinicius", "Kaique", "Thiago", "Rafael", "Caio", "Igor", "Wesley", "Yago"],
    last: ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Ferreira", "Alves", "Ribeiro", "Carvalho", "Gomes", "Martins", "Barbosa", "Rocha"]
  },
  argentina: {
    first: ["Mateo", "Thiago", "Valentin", "Joaquin", "Bautista", "Franco", "Lautaro", "Nicolas", "Ramiro", "Gonzalo", "Facundo", "Ignacio"],
    last: ["Fernandez", "Gonzalez", "Rodriguez", "Lopez", "Martinez", "Diaz", "Perez", "Romero", "Alvarez", "Suarez", "Molina", "Castro", "Rojas", "Acosta"]
  },
  usa: {
    first: ["Tyler", "Brandon", "Caleb", "Jordan", "Mason", "Dylan", "Austin", "Chase", "Trevor", "Cole", "Devin", "Grant"],
    last: ["Johnson", "Miller", "Davis", "Anderson", "Wilson", "Moore", "Taylor", "Thomas", "Harris", "Clark", "Lewis", "Walker", "Young", "Allen"]
  }
};

const FILL_CLUBS = {
  // Super Lig up to 18
  "Rizespor": { league: "Super Lig", region: "turkey", tier: 72 },
  "Konyaspor": { league: "Super Lig", region: "turkey", tier: 72 },
  "Gaziantep": { league: "Super Lig", region: "turkey", tier: 71 },
  "Kayserispor": { league: "Super Lig", region: "turkey", tier: 70 },
  "Eyupspor": { league: "Super Lig", region: "turkey", tier: 71 },
  "Kocaelispor": { league: "Super Lig", region: "turkey", tier: 69 },
  "Genclerbirligi": { league: "Super Lig", region: "turkey", tier: 69 },
  "Karagumruk": { league: "Super Lig", region: "turkey", tier: 69 },
  // Eredivisie up to 18
  "Groningen": { league: "Eredivisie", region: "netherlands", tier: 72 },
  "Fortuna Sittard": { league: "Eredivisie", region: "netherlands", tier: 71 },
  "PEC Zwolle": { league: "Eredivisie", region: "netherlands", tier: 71 },
  "Heracles": { league: "Eredivisie", region: "netherlands", tier: 70 },
  "NAC Breda": { league: "Eredivisie", region: "netherlands", tier: 70 },
  "Excelsior": { league: "Eredivisie", region: "netherlands", tier: 69 },
  "Volendam": { league: "Eredivisie", region: "netherlands", tier: 68 },
  "Telstar": { league: "Eredivisie", region: "netherlands", tier: 67 },
  // Primeira Liga up to 18
  "Moreirense": { league: "Primeira Liga", region: "portugal", tier: 72 },
  "Arouca": { league: "Primeira Liga", region: "portugal", tier: 71 },
  "Estrela Amadora": { league: "Primeira Liga", region: "portugal", tier: 70 },
  "Nacional": { league: "Primeira Liga", region: "portugal", tier: 70 },
  "Santa Clara": { league: "Primeira Liga", region: "portugal", tier: 71 },
  "Tondela": { league: "Primeira Liga", region: "portugal", tier: 68 },
  "AVS": { league: "Primeira Liga", region: "portugal", tier: 68 },
  "Alverca": { league: "Primeira Liga", region: "portugal", tier: 67 },
  // Belgian Pro League up to 16
  "Cercle Brugge": { league: "Belgian Pro League", region: "belgium", tier: 72 },
  "Sint-Truiden": { league: "Belgian Pro League", region: "belgium", tier: 71 },
  "OH Leuven": { league: "Belgian Pro League", region: "belgium", tier: 70 },
  "Dender": { league: "Belgian Pro League", region: "belgium", tier: 68 },
  "Zulte Waregem": { league: "Belgian Pro League", region: "belgium", tier: 69 },
  "La Louviere": { league: "Belgian Pro League", region: "belgium", tier: 67 },
  // Scottish Premiership up to 12
  "Falkirk": { league: "Scottish Premiership", region: "scotland", tier: 66 },
  "Livingston": { league: "Scottish Premiership", region: "scotland", tier: 67 },
  // Saudi Pro League up to 18
  "Al-Fayha": { league: "Saudi Pro League", region: "saudi", tier: 72 },
  "Damac": { league: "Saudi Pro League", region: "saudi", tier: 71 },
  "Al-Riyadh": { league: "Saudi Pro League", region: "saudi", tier: 71 },
  "Al-Okhdood": { league: "Saudi Pro League", region: "saudi", tier: 69 },
  "Al-Kholood": { league: "Saudi Pro League", region: "saudi", tier: 69 },
  "Neom": { league: "Saudi Pro League", region: "saudi", tier: 75 },
  "Al-Najma": { league: "Saudi Pro League", region: "saudi", tier: 68 },
  "Al-Hazem": { league: "Saudi Pro League", region: "saudi", tier: 68 },
  // Liga MX up to 18
  "Tijuana": { league: "Liga MX", region: "mexico", tier: 73 },
  "Juarez": { league: "Liga MX", region: "mexico", tier: 71 },
  "Necaxa": { league: "Liga MX", region: "mexico", tier: 72 },
  "Queretaro": { league: "Liga MX", region: "mexico", tier: 70 },
  "Atlas": { league: "Liga MX", region: "mexico", tier: 72 },
  "Puebla": { league: "Liga MX", region: "mexico", tier: 70 },
  "Atlante": { league: "Liga MX", region: "mexico", tier: 70 },
  "Atletico San Luis": { league: "Liga MX", region: "mexico", tier: 71 },
  // Brasileirao up to 20, the real count
  "Bahia": { league: "Brasileirao", region: "brazil", tier: 76 },
  "Fortaleza": { league: "Brasileirao", region: "brazil", tier: 75 },
  "Atletico Mineiro": { league: "Brasileirao", region: "brazil", tier: 76 },
  "Vasco da Gama": { league: "Brasileirao", region: "brazil", tier: 74 },
  "Bragantino": { league: "Brasileirao", region: "brazil", tier: 75 },
  "Juventude": { league: "Brasileirao", region: "brazil", tier: 71 },
  "Vitoria": { league: "Brasileirao", region: "brazil", tier: 72 },
  "Ceara": { league: "Brasileirao", region: "brazil", tier: 72 },
  "Sport Recife": { league: "Brasileirao", region: "brazil", tier: 71 },
  "Mirassol": { league: "Brasileirao", region: "brazil", tier: 73 },
  // Argentina up to 16
  "Newells Old Boys": { league: "Argentina", region: "argentina", tier: 72 },
  "Huracan": { league: "Argentina", region: "argentina", tier: 72 },
  "Argentinos Juniors": { league: "Argentina", region: "argentina", tier: 73 },
  "Banfield": { league: "Argentina", region: "argentina", tier: 70 },
  "Belgrano": { league: "Argentina", region: "argentina", tier: 71 },
  "Tigre": { league: "Argentina", region: "argentina", tier: 70 },
  // MLS up to 16
  "NYCFC": { league: "MLS", region: "usa", tier: 74 },
  "New York Red Bulls": { league: "MLS", region: "usa", tier: 73 },
  "Philadelphia Union": { league: "MLS", region: "usa", tier: 74 },
  "Charlotte FC": { league: "MLS", region: "usa", tier: 72 },
  "Orlando City": { league: "MLS", region: "usa", tier: 73 },
  "Minnesota United": { league: "MLS", region: "usa", tier: 72 }
};

function buildNamePool(region, used) {
  const pool = FILL_NAMES[region];
  const combos = [];
  for (const f of pool.first) for (const l of pool.last) combos.push(f + " " + l);
  for (const f of pool.first) for (const l1 of pool.last) for (const l2 of pool.last) {
    if (l1 !== l2 && combos.length < 4000) combos.push(f + " " + l1 + " " + l2);
  }
  const free = combos.filter(n => !used.has(n));
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  return free;
}

function buildFillClubs(existingNames) {
  const used = new Set(existingNames);
  const pools = {};
  const out = {};
  for (const [name, info] of Object.entries(FILL_CLUBS)) {
    if (!pools[info.region]) pools[info.region] = buildNamePool(info.region, used);
    const pool = pools[info.region];
    const slots = [["GK", 2], ["DF", 5], ["MF", 5], ["FW", 4]];
    const squad = [];
    for (const [pos, n] of slots) {
      for (let k = 0; k < n; k++) {
        const pname = pool.pop();
        used.add(pname);
        const rating = Math.max(60, Math.min(info.tier + 6, info.tier + Math.floor(Math.random() * 10) - 4));
        const age = 18 + Math.floor(Math.random() * 16);
        squad.push([pname, pos, age, rating]);
      }
    }
    out[name] = { league: info.league, squad };
  }
  return out;
}

module.exports = { FILL_CLUBS, buildFillClubs };
