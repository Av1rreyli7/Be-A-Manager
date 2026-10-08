/** The shapes the Player Career screens read. They mirror career/core.js view() on the server. */

export interface Look {
  skinF: number;
  faceW: number;
  jaw: number;
  chin: number;
  cheeks: number;
  eyes: number;
  eyeCol: number;
  brows: number;
  nose: number;
  mouth: number;
  ears: number;
  hairline: number;
  hair: number;
  hairCol: number;
  beard: number;
  moustache: number;
  muscle: number;
  shoulders: number;
  legs: number;
  watch: string | null;
  necklace: string | null;
  earrings: string | null;
  bracelet: string | null;
  headband: string | null;
  gloves: string | null;
  compression: string | null;
  boot: number;
}

export interface PersonForm {
  first: string;
  last: string;
  nick: string;
  dobY: number;
  dobM: number;
  dobD: number;
  country: string;
  nat: string;
  nat2: string;
  lang: string;
  foot: "Right" | "Left" | "Both";
  height: number;
  weight: number;
  pos: string;
  pos2: string | null;
  num: number;
  style: string | null;
}

export interface Person {
  first: string;
  last: string;
  nick: string;
  dob: { y: number; m: number; d: number };
  country: string;
  nat: string;
  nat2: string;
  lang: string;
  foot: string;
  height: number;
  weight: number;
  pos: string;
  pos2: string | null;
  num: number;
  style: string | null;
  startAge: number;
}

export interface Decision {
  id: string;
  kind: string;
  title: string;
  options: string[];
  optional?: boolean;
  trial?: string;
}

export interface Offer {
  id: string;
  club: string;
  league: string;
  status: string;
  why: string;
  wage: number;
  years: number;
  role: string;
  signing: number;
  bonus: { app: number; goal: number; assist: number; cs: number };
  release: number | null;
  negotiated: number;
  first: boolean;
  kind?: "first" | "transfer" | "loan" | "free" | "renewal";
  fee?: number;
}

export interface MatchLine {
  s: number;
  w: number;
  comp: string;
  opp: string;
  gf: number;
  ga: number;
  role: string;
  mins: number;
  g?: number;
  a?: number;
  rating?: number;
  level?: string;
}

export interface CareerSummary {
  name: string;
  age: number;
  matches: number;
  goals: number;
  assists: number;
  avg: number;
  best: number;
  clubs: string[];
  trophies: { s: number; title: string; club: string }[];
  awards: { s: number; title: string }[];
  caps: Record<string, number>;
  intlGoals: Record<string, number>;
  highestRating: number;
  fees: number;
  earnings: number;
  homes: number;
}

export interface Session {
  label: string;
  grows: string[] | null;
  fatigue: number;
  risk: number;
  cost?: number;
}

export interface StatLine {
  apps: number;
  starts: number;
  mins: number;
  g: number;
  a: number;
  cs: number;
  rSum: number;
  rN: number;
  best: number;
  motm: number;
}

export interface Thread {
  id: string;
  name: string;
  last?: number;
  msgs: {
    from: string;
    text: string;
    s: number;
    w: number;
    read: boolean;
    offer?: string;
  }[];
}

export interface LifeHome {
  id: string;
  tier: number;
  label: string;
  rent: number;
  buy: number;
  upkeep: number;
  mood: number;
  rooms: number;
  note: string;
  mode?: "rent" | "own" | "family";
  city?: string;
  canRent?: boolean;
  canBuy?: boolean;
  price?: number;
}
export interface LifeCar {
  id: string;
  tier: number;
  brand: string;
  model: string;
  price: number;
  upkeep: number;
  flash: number;
  colour: string;
  body: "scooter" | "hatch" | "saloon" | "coupe" | "sports" | "suv" | "hyper";
  owned?: boolean;
  canBuy?: boolean;
}
export interface LifeItem {
  id: string;
  shop: "mall" | "shops";
  brand: string;
  label: string;
  price: number;
  mood: number;
  flash: number;
  look?: Record<string, string>;
  perk?: string;
  owned: boolean;
  wearing: boolean;
}
export type WeatherKind = "clear" | "cloud" | "rain" | "storm" | "snow" | "fog" | "haze";
export interface CityStyle {
  key: string;
  climate: string;
  sky: [string, string];
  ground: string;
  build: string;
  accent: string;
  height: number;
  water: boolean;
  districts: string[];
}
export interface Post {
  s: number;
  w: number;
  kind: string;
  label: string;
  likes: number;
  gain: number;
  comments: string[];
  backlash: boolean;
}
export interface Life {
  city: string;
  hometown: string;
  style: CityStyle;
  places: { restaurant: string; gym: string; mall: string; shops: string };
  weather: { kind: WeatherKind; temp: number; month: number };
  time: number;
  freeTime: number;
  done: { place: string; action: string; text: string }[];
  home: LifeHome;
  owned: LifeHome[];
  homes: LifeHome[];
  car: LifeCar | null;
  cars: LifeCar[];
  items: LifeItem[];
  meals: { id: string; label: string; price: number; note: string }[];
  gym: { id: string; label: string; price: number; fatigue: number }[];
  postKinds: { id: string; label: string }[];
  followers: number;
  posts: Post[];
  postedThisWeek: boolean;
  sponsors: { id: string; brand: string; kind: string; weekly: number; weeksLeft: number; boots?: boolean }[];
  sponsorOffers: { id: string; brand: string; kind: string; line: string; weekly: number; weeks: number; expires: number; boots: boolean; gift: string | null }[];
  savings: number;
  weeklyCost: number;
}

export interface LifeEvent {
  id: string;
  kind: string;
  s: number;
  w: number;
  tease: string;
  title: string;
  text: string;
  choices: { id: string; label: string }[];
}
export interface People {
  family: { id: string; name: string; role: string; rel: number }[];
  friend: { name: string; rel: number };
  best: { name: string; rel: number } | null;
  team: number;
  agent: number | null;
  coach: number;
  pending: LifeEvent | null;
  log: { id: string; kind: string; s: number; w: number; title: string; choice: string; note: string }[];
}

export interface CareerState {
  mode: "player";
  week: string;
  season: number;
  round: number;
  total: number;
  seasonOver: boolean;
  person: Person;
  look: Partial<Look> & Record<string, unknown>;
  stage: "school" | "college" | "academy" | "centre" | "pro";
  path: string;
  player: {
    id: number;
    name: string;
    age: number;
    pos: string;
    pos2: string | null;
    rating: number;
    potential: [number, number];
    value: number;
    club: string;
    league: string;
    role: string | null;
    num: number;
  };
  attrs: Record<string, number>;
  lastGains: Record<string, number>;
  training: {
    slots: string[];
    intensity: string;
    sessions: Record<string, Session>;
    intensities: string[];
  };
  cond: {
    fatigue: number;
    fitness: number;
    morale: number;
    confidence: number;
    form: number;
    inj: { name: string; weeks: number; total: number } | null;
  };
  traits: Record<string, number>;
  rep: {
    local: number;
    national: number;
    international: number;
    club: number;
    commercial: number;
  };
  trust: number;
  coachRel: number;
  team: string | null;
  school: string | null;
  college: string | null;
  academy: { club: string; tier: string } | null;
  centre: { name: string } | null;
  next: {
    week: number;
    comp: string;
    opp: string;
    national?: boolean;
    home?: boolean;
  } | null;
  decisions: Decision[];
  trials: {
    id: string;
    club: string;
    week: number;
    season: number;
    status: string;
    score?: number;
    bar?: number;
  }[];
  offers: Offer[];
  scouts: { club: string; level: number }[];
  contract: {
    club: string;
    wage: number;
    years: number;
    role: string;
    bonus: Offer["bonus"];
    release: number | null;
    until: number;
  } | null;
  agent: { id: string; name: string; agency: string; blurb: string } | null;
  money: {
    cash: number;
    earned: number;
    log: { s: number; w: number; amt: number; text: string }[];
  };
  stats: {
    season: StatLine;
    career: StatLine;
    seasons: Record<string, unknown>[];
    log: Record<string, unknown>[];
  };
  phone: { threads: Thread[]; unread: number };
  news: { s: number; w: number; text: string; kind: string }[];
  moments: Record<
    string,
    {
      s: number;
      w: number;
      club?: string;
      opp?: string;
      wage?: number;
      years?: number;
      role?: string;
      fee?: number;
      level?: string;
      nation?: string;
      title?: string;
      seen: boolean;
    }
  >;
  city: string;
  currency: string;
  national: {
    level: string | null;
    caps: Record<string, number>;
    goals: Record<string, number>;
    log: MatchLine[];
    strength: number;
  };
  captain: boolean;
  loan: { from: string; to: string; s: number } | null;
  requested: boolean;
  freeAgent: boolean;
  trophies: { s: number; title: string; club: string }[];
  awards: { s: number; title: string }[];
  transfers: {
    s: number;
    from: string;
    to: string;
    fee: number;
    kind: string;
  }[];
  canRetire: boolean;
  retired: {
    s: number;
    age: number;
    lastClub: string;
    summary: CareerSummary;
  } | null;
  managerOptions: string[];
  life: Life;
  people: People;
  kit: [string, string] | null;
  natKit: [string, string] | null;
  lastKit: [string, string] | null;
  calendar: { week: number; match: { comp: string; opp: string; home?: boolean; national?: boolean } | null; intl: boolean }[];
}
