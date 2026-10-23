/**
 * The real boxers. Likeness comes through build (height, reach, weight), stance, how they fight, the trunks they
 * are remembered in, and attributes on one scale. Ratings are the game's own judgement, not official numbers.
 * Hair styles and colours are the indexes of the site's body builder; skin is its smooth 0 to 1 slider.
 */
import type { FighterDef, Look } from "./types";

/** a weight class from a fighting weight */
export function weightClass(kg: number): string {
  if (kg >= 90.7) return "Heavyweight";
  if (kg >= 79.4) return "Cruiserweight";
  if (kg >= 76.2) return "Light heavyweight";
  if (kg >= 72.6) return "Super middleweight";
  if (kg >= 69.9) return "Middleweight";
  if (kg >= 66.7) return "Super welterweight";
  if (kg >= 63.5) return "Welterweight";
  if (kg >= 61.2) return "Super lightweight";
  if (kg >= 59) return "Lightweight";
  if (kg >= 57.2) return "Super featherweight";
  if (kg >= 55.3) return "Featherweight";
  if (kg >= 53.5) return "Super bantamweight";
  return "Bantamweight";
}

type Row = Omit<FighterDef, "real" | "weightClass" | "look"> & { look: Partial<Look> & Pick<Look, "skin" | "hair" | "trunks"> };

const LOOK: Look = { skin: 0.5, hair: 1, hairCol: 0, beard: 0, moustache: 0, trunks: ["#111111", "#ffffff", "#ffffff"], gloves: "#b3121b", gloveTrim: "#f2f2f2", boots: "#111111", muscle: 0.6, shoulders: 0.6, belly: 0 };

const ROWS: Row[] = [
  {
    id: "ali", name: "Muhammad Ali", nick: "The Greatest", country: "United States", era: "1960 to 1981",
    stance: "orthodox", style: "outboxer", guard: "normal", heightCm: 191, reachIn: 78, weightKg: 98,
    attrs: { power: 80, speed: 95, chin: 93, stamina: 90, defense: 90 }, traits: ["dancer", "jab"],
    blurb: "Floats round the ring, jabs from range and makes you miss.",
    look: { skin: 0.62, hair: 1, hairCol: 0, trunks: ["#f4f4f2", "#111111", "#111111"], gloves: "#b3121b", boots: "#f2f2f2", muscle: 0.55, shoulders: 0.62 },
  },
  {
    id: "tyson", name: "Mike Tyson", nick: "Iron Mike", country: "United States", era: "1985 to 2005",
    stance: "orthodox", style: "pressure", guard: "high", heightCm: 178, reachIn: 71, weightKg: 100,
    attrs: { power: 97, speed: 90, chin: 88, stamina: 78, defense: 84 }, traits: ["peek", "bomb"],
    blurb: "Bobs under your punches and explodes with hooks from the peek a boo.",
    look: { skin: 0.7, hair: 0, hairCol: 0, trunks: ["#0c0c0c", "#0c0c0c", "#0c0c0c"], gloves: "#121212", gloveTrim: "#121212", boots: "#0c0c0c", muscle: 0.95, shoulders: 0.9 },
  },
  {
    id: "mayweather", name: "Floyd Mayweather Jr.", nick: "Money", country: "United States", era: "1996 to 2017",
    stance: "orthodox", style: "counter", guard: "philly", heightCm: 173, reachIn: 72, weightKg: 67,
    attrs: { power: 72, speed: 94, chin: 88, stamina: 90, defense: 99 }, traits: ["shell", "counter", "hands"],
    blurb: "Rolls everything off the shoulder and makes you pay with the right hand.",
    look: { skin: 0.66, hair: 0, hairCol: 0, trunks: ["#121212", "#d4af37", "#d4af37"], gloves: "#151515", gloveTrim: "#d4af37", boots: "#151515", muscle: 0.7, shoulders: 0.6 },
  },
  {
    id: "canelo", name: "Canelo Alvarez", nick: "Canelo", country: "Mexico", era: "2005 to now",
    stance: "orthodox", style: "body", guard: "normal", heightCm: 173, reachIn: 70.5, weightKg: 76,
    attrs: { power: 90, speed: 84, chin: 94, stamina: 86, defense: 90 }, traits: ["body", "counter", "iron"],
    blurb: "Walks you down behind a tight guard and digs hooks into the body.",
    look: { skin: 0.12, hair: 1, hairCol: 8, beard: 1, trunks: ["#0f7a3d", "#c8102e", "#f4f4f4"], gloves: "#c8102e", boots: "#f2f2f2", muscle: 0.85, shoulders: 0.8 },
  },
  {
    id: "fury", name: "Tyson Fury", nick: "The Gypsy King", country: "United Kingdom", era: "2008 to 2024",
    stance: "orthodox", style: "outboxer", guard: "normal", heightCm: 206, reachIn: 85, weightKg: 120,
    attrs: { power: 86, speed: 78, chin: 90, stamina: 84, defense: 86 }, traits: ["awkward", "jab", "heart"],
    blurb: "A giant who moves like a small man, jabs from miles away and gets up from anything.",
    look: { skin: 0.08, hair: 1, hairCol: 1, beard: 1, trunks: ["#1f2a44", "#c9a227", "#c9a227"], gloves: "#1f2a44", gloveTrim: "#c9a227", boots: "#f2f2f2", muscle: 0.45, shoulders: 0.6, belly: 0.5 },
  },
  {
    id: "pacquiao", name: "Manny Pacquiao", nick: "Pac Man", country: "Philippines", era: "1995 to 2021",
    stance: "southpaw", style: "pressure", guard: "normal", heightCm: 166, reachIn: 67, weightKg: 66,
    attrs: { power: 86, speed: 96, chin: 86, stamina: 94, defense: 80 }, traits: ["hands", "engine"],
    blurb: "A southpaw storm: in and out at angles, punches in bunches all night.",
    look: { skin: 0.36, hair: 8, hairCol: 0, trunks: ["#1b3fa0", "#c8102e", "#f2d000"], gloves: "#c8102e", boots: "#1b3fa0", muscle: 0.75, shoulders: 0.6 },
  },
  {
    id: "robinson", name: "Sugar Ray Robinson", nick: "Sugar", country: "United States", era: "1940 to 1965",
    stance: "orthodox", style: "counter", guard: "normal", heightCm: 180, reachIn: 72.5, weightKg: 70,
    attrs: { power: 86, speed: 94, chin: 88, stamina: 90, defense: 92 }, traits: ["hook", "hands"],
    blurb: "Pound for pound the best ever: every punch in the book, thrown perfectly.",
    look: { skin: 0.6, hair: 8, hairCol: 0, trunks: ["#f0ece0", "#2a2a2a", "#2a2a2a"], gloves: "#7a1d1d", boots: "#141414", muscle: 0.6, shoulders: 0.6 },
  },
  {
    id: "leonard", name: "Sugar Ray Leonard", nick: "Sugar", country: "United States", era: "1977 to 1997",
    stance: "orthodox", style: "outboxer", guard: "normal", heightCm: 178, reachIn: 74, weightKg: 66,
    attrs: { power: 82, speed: 96, chin: 82, stamina: 86, defense: 90 }, traits: ["hands", "dancer"],
    blurb: "Flashy hand speed and footwork, finishes rounds in a blur.",
    look: { skin: 0.56, hair: 9, hairCol: 0, moustache: 1, trunks: ["#f6f6f6", "#c8102e", "#c8102e"], gloves: "#c8102e", boots: "#f6f6f6", muscle: 0.6, shoulders: 0.55 },
  },
  {
    id: "frazier", name: "Joe Frazier", nick: "Smokin Joe", country: "United States", era: "1965 to 1981",
    stance: "orthodox", style: "pressure", guard: "high", heightCm: 182, reachIn: 73.5, weightKg: 93,
    attrs: { power: 90, speed: 82, chin: 93, stamina: 92, defense: 78 }, traits: ["hook", "peek", "heart"],
    blurb: "Bobs and weaves straight at you and throws the left hook all night.",
    look: { skin: 0.74, hair: 1, hairCol: 0, moustache: 1, trunks: ["#0f5132", "#d4af37", "#d4af37"], gloves: "#7a1d1d", boots: "#141414", muscle: 0.8, shoulders: 0.75 },
  },
  {
    id: "foreman", name: "George Foreman", nick: "Big George", country: "United States", era: "1969 to 1997",
    stance: "orthodox", style: "pressure", guard: "high", heightCm: 192, reachIn: 79, weightKg: 104,
    attrs: { power: 99, speed: 66, chin: 92, stamina: 72, defense: 72 }, traits: ["bomb", "iron"],
    blurb: "Slow, heavy steps and the hardest punches you will ever feel.",
    look: { skin: 0.72, hair: 3, hairCol: 0, moustache: 1, trunks: ["#b31b1b", "#f4f4f4", "#1d3c8f"], gloves: "#b31b1b", boots: "#f4f4f4", muscle: 0.8, shoulders: 0.85, belly: 0.15 },
  },
  {
    id: "lewis", name: "Lennox Lewis", nick: "The Lion", country: "United Kingdom", era: "1989 to 2003",
    stance: "orthodox", style: "outboxer", guard: "normal", heightCm: 196, reachIn: 84, weightKg: 111,
    attrs: { power: 92, speed: 78, chin: 82, stamina: 84, defense: 86 }, traits: ["jab", "bomb"],
    blurb: "Long jab, then the right hand down the middle when you walk onto it.",
    look: { skin: 0.6, hair: 11, hairCol: 0, beard: 4, trunks: ["#f4f4f4", "#c8102e", "#1d3c8f"], gloves: "#c8102e", boots: "#f4f4f4", muscle: 0.7, shoulders: 0.75 },
  },
  {
    id: "hagler", name: "Marvin Hagler", nick: "Marvelous", country: "United States", era: "1973 to 1987",
    stance: "southpaw", style: "pressure", guard: "normal", heightCm: 177, reachIn: 75, weightKg: 72,
    attrs: { power: 88, speed: 84, chin: 97, stamina: 92, defense: 84 }, traits: ["iron", "engine"],
    blurb: "Shaved head, iron chin, and a southpaw who never takes a step back.",
    look: { skin: 0.72, hair: 6, hairCol: 0, beard: 4, moustache: 1, trunks: ["#5a1a24", "#d4af37", "#d4af37"], gloves: "#5a1a24", boots: "#141414", muscle: 0.85, shoulders: 0.75 },
  },
  {
    id: "hearns", name: "Thomas Hearns", nick: "The Hitman", country: "United States", era: "1977 to 2006",
    stance: "orthodox", style: "outboxer", guard: "normal", heightCm: 185, reachIn: 78, weightKg: 66,
    attrs: { power: 93, speed: 90, chin: 74, stamina: 82, defense: 80 }, traits: ["bomb", "jab"],
    blurb: "A rangy flicker jab and a right hand that ends nights.",
    look: { skin: 0.68, hair: 2, hairCol: 0, moustache: 1, trunks: ["#e0a80f", "#c8102e", "#c8102e"], gloves: "#c8102e", boots: "#f4f4f4", muscle: 0.5, shoulders: 0.6 },
  },
  {
    id: "duran", name: "Roberto Duran", nick: "Hands of Stone", country: "Panama", era: "1968 to 2001",
    stance: "orthodox", style: "pressure", guard: "normal", heightCm: 170, reachIn: 66, weightKg: 61,
    attrs: { power: 90, speed: 86, chin: 95, stamina: 88, defense: 86 }, traits: ["body", "heart"],
    blurb: "Mean, smart and relentless: rough inside and hard to hit cleanly.",
    look: { skin: 0.36, hair: 7, hairCol: 0, beard: 1, trunks: ["#c8102e", "#f4f4f4", "#f4f4f4"], gloves: "#c8102e", boots: "#141414", muscle: 0.75, shoulders: 0.65 },
  },
  {
    id: "chavez", name: "Julio Cesar Chavez", nick: "JC Superstar", country: "Mexico", era: "1980 to 2005",
    stance: "orthodox", style: "body", guard: "normal", heightCm: 170, reachIn: 68, weightKg: 64,
    attrs: { power: 88, speed: 82, chin: 97, stamina: 94, defense: 82 }, traits: ["body", "iron"],
    blurb: "The great body puncher: cuts off the ring and breaks you down to the ribs.",
    look: { skin: 0.3, hair: 1, hairCol: 0, moustache: 1, trunks: ["#c8102e", "#0f7a3d", "#f4f4f4"], gloves: "#0f7a3d", boots: "#c8102e", muscle: 0.75, shoulders: 0.65 },
  },
  {
    id: "delahoya", name: "Oscar De La Hoya", nick: "Golden Boy", country: "United States", era: "1992 to 2008",
    stance: "orthodox", style: "outboxer", guard: "normal", heightCm: 179, reachIn: 73, weightKg: 66,
    attrs: { power: 84, speed: 90, chin: 82, stamina: 80, defense: 84 }, traits: ["hook", "jab"],
    blurb: "A sharp jab and one of the best lead hooks there ever was.",
    look: { skin: 0.28, hair: 12, hairCol: 0, trunks: ["#f4f4f4", "#0f7a3d", "#c8102e"], gloves: "#f4f4f4", gloveTrim: "#c8102e", boots: "#f4f4f4", muscle: 0.6, shoulders: 0.6 },
  },
  {
    id: "jones", name: "Roy Jones Jr.", nick: "Superman", country: "United States", era: "1989 to 2018",
    stance: "orthodox", style: "counter", guard: "normal", heightCm: 180, reachIn: 74, weightKg: 79,
    attrs: { power: 88, speed: 99, chin: 78, stamina: 84, defense: 92 }, traits: ["hands", "counter", "dancer"],
    blurb: "Hands low, reflexes off the charts, counters from angles nobody else sees.",
    look: { skin: 0.7, hair: 0, hairCol: 0, beard: 4, trunks: ["#121212", "#c8102e", "#c8102e"], gloves: "#c8102e", boots: "#121212", muscle: 0.8, shoulders: 0.7 },
  },
  {
    id: "holyfield", name: "Evander Holyfield", nick: "The Real Deal", country: "United States", era: "1984 to 2011",
    stance: "orthodox", style: "pressure", guard: "normal", heightCm: 189, reachIn: 77.5, weightKg: 98,
    attrs: { power: 88, speed: 84, chin: 93, stamina: 92, defense: 84 }, traits: ["heart", "engine"],
    blurb: "A warrior who outworks you inside and never stops coming.",
    look: { skin: 0.68, hair: 0, hairCol: 0, moustache: 1, trunks: ["#4b2a8c", "#f4f4f4", "#f4f4f4"], gloves: "#4b2a8c", boots: "#f4f4f4", muscle: 0.95, shoulders: 0.85 },
  },
  {
    id: "golovkin", name: "Gennady Golovkin", nick: "GGG", country: "Kazakhstan", era: "2006 to 2022",
    stance: "orthodox", style: "pressure", guard: "normal", heightCm: 179, reachIn: 70, weightKg: 72,
    attrs: { power: 94, speed: 82, chin: 96, stamina: 90, defense: 82 }, traits: ["iron", "jab"],
    blurb: "A heavy jab, a chin of granite and calm, crushing pressure.",
    look: { skin: 0.16, hair: 1, hairCol: 1, trunks: ["#00a3dd", "#f2c200", "#f2c200"], gloves: "#00a3dd", gloveTrim: "#f2c200", boots: "#f2f2f2", muscle: 0.75, shoulders: 0.7 },
  },
  {
    id: "usyk", name: "Oleksandr Usyk", nick: "The Cat", country: "Ukraine", era: "2013 to now",
    stance: "southpaw", style: "outboxer", guard: "normal", heightCm: 191, reachIn: 78, weightKg: 100,
    attrs: { power: 82, speed: 92, chin: 90, stamina: 96, defense: 92 }, traits: ["dancer", "engine"],
    blurb: "A southpaw who never stops moving and never stops working.",
    look: { skin: 0.1, hair: 6, hairCol: 2, trunks: ["#0057b7", "#ffd700", "#ffd700"], gloves: "#0057b7", gloveTrim: "#ffd700", boots: "#ffd700", muscle: 0.65, shoulders: 0.65 },
  },
  {
    id: "inoue", name: "Naoya Inoue", nick: "The Monster", country: "Japan", era: "2012 to now",
    stance: "orthodox", style: "counter", guard: "normal", heightCm: 165, reachIn: 67.5, weightKg: 55,
    attrs: { power: 92, speed: 94, chin: 86, stamina: 88, defense: 92 }, traits: ["body", "hands"],
    blurb: "Precise and brutal: times you, then finds the body or the chin.",
    look: { skin: 0.1, hair: 1, hairCol: 0, trunks: ["#0f0f0f", "#e60012", "#f4f4f4"], gloves: "#e60012", boots: "#f4f4f4", muscle: 0.7, shoulders: 0.55 },
  },
  {
    id: "crawford", name: "Terence Crawford", nick: "Bud", country: "United States", era: "2008 to 2025",
    stance: "southpaw", style: "counter", guard: "normal", heightCm: 173, reachIn: 74, weightKg: 70,
    attrs: { power: 86, speed: 92, chin: 90, stamina: 90, defense: 94 }, traits: ["counter", "awkward"],
    blurb: "Switches stances, reads you for a round, then takes you apart.",
    look: { skin: 0.66, hair: 0, hairCol: 0, beard: 1, trunks: ["#1d1d1d", "#2e7d32", "#f4f4f4"], gloves: "#1d1d1d", gloveTrim: "#2e7d32", boots: "#1d1d1d", muscle: 0.7, shoulders: 0.6 },
  },
  {
    id: "lomachenko", name: "Vasiliy Lomachenko", nick: "Hi Tech", country: "Ukraine", era: "2013 to 2024",
    stance: "southpaw", style: "outboxer", guard: "normal", heightCm: 170, reachIn: 65.5, weightKg: 61,
    attrs: { power: 78, speed: 96, chin: 84, stamina: 92, defense: 94 }, traits: ["dancer", "hands"],
    blurb: "Footwork like nobody else: steps round you and hits from the side.",
    look: { skin: 0.12, hair: 1, hairCol: 2, beard: 3, trunks: ["#f4f4f4", "#0057b7", "#ffd700"], gloves: "#f4f4f4", gloveTrim: "#0057b7", boots: "#f4f4f4", muscle: 0.6, shoulders: 0.55 },
  },
  {
    id: "joshua", name: "Anthony Joshua", nick: "AJ", country: "United Kingdom", era: "2013 to now",
    stance: "orthodox", style: "outboxer", guard: "normal", heightCm: 198, reachIn: 82, weightKg: 110,
    attrs: { power: 93, speed: 80, chin: 78, stamina: 78, defense: 80 }, traits: ["bomb", "upper"],
    blurb: "A sculpted heavyweight with a big right hand and a cruel uppercut.",
    look: { skin: 0.64, hair: 9, hairCol: 0, beard: 1, trunks: ["#f4f4f4", "#c9a227", "#c9a227"], gloves: "#f4f4f4", gloveTrim: "#c9a227", boots: "#f4f4f4", muscle: 1, shoulders: 0.95 },
  },
  {
    id: "wilder", name: "Deontay Wilder", nick: "The Bronze Bomber", country: "United States", era: "2008 to now",
    stance: "orthodox", style: "outboxer", guard: "normal", heightCm: 201, reachIn: 83, weightKg: 98,
    attrs: { power: 99, speed: 80, chin: 72, stamina: 76, defense: 70 }, traits: ["bomb", "awkward"],
    blurb: "Wild and rangy, and one right hand is all he ever needs.",
    look: { skin: 0.7, hair: 0, hairCol: 0, beard: 4, trunks: ["#8c5a2b", "#e0b04a", "#e0b04a"], gloves: "#e0b04a", gloveTrim: "#8c5a2b", boots: "#e0b04a", muscle: 0.55, shoulders: 0.6 },
  },
  {
    id: "marciano", name: "Rocky Marciano", nick: "The Brockton Blockbuster", country: "United States", era: "1947 to 1955",
    stance: "orthodox", style: "pressure", guard: "high", heightCm: 179, reachIn: 68, weightKg: 85,
    attrs: { power: 94, speed: 76, chin: 99, stamina: 98, defense: 72 }, traits: ["iron", "engine", "heart"],
    blurb: "Short arms, a granite chin and an engine that never stops: 49 and 0.",
    look: { skin: 0.12, hair: 1, hairCol: 1, trunks: ["#111111", "#f4f4f4", "#111111"], gloves: "#7a1d1d", boots: "#111111", muscle: 0.8, shoulders: 0.75 },
  },
  {
    id: "louis", name: "Joe Louis", nick: "The Brown Bomber", country: "United States", era: "1934 to 1951",
    stance: "orthodox", style: "counter", guard: "normal", heightCm: 188, reachIn: 76, weightKg: 91,
    attrs: { power: 95, speed: 86, chin: 82, stamina: 86, defense: 82 }, traits: ["bomb", "counter"],
    blurb: "Stalks you calmly, then short, crisp combinations end it.",
    look: { skin: 0.64, hair: 8, hairCol: 0, trunks: ["#141414", "#e9e9e9", "#141414"], gloves: "#7a1d1d", boots: "#141414", muscle: 0.7, shoulders: 0.7 },
  },
];

export const ROSTER: FighterDef[] = ROWS.map(r => ({
  ...r,
  real: true,
  weightClass: weightClass(r.weightKg),
  look: { ...LOOK, gloveTrim: r.look.gloves === "#f4f4f4" ? "#1a1a1a" : LOOK.gloveTrim, ...r.look },
}));

export function rosterById(id: string): FighterDef | undefined {
  return ROSTER.find(f => f.id === id);
}
