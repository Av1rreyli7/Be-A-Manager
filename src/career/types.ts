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
  /** the people round him (never his own creator look): a woman's figure */
  fem?: boolean;
  /** a lip colour */
  lips?: string;
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
  /** his side's name; lines saved before it was kept have none */
  team?: string;
  /** won, lost or drawn, his side's way round */
  res?: "W" | "L" | "D";
  /** the week it was played in */
  wk?: number;
  live?: boolean;
  national?: boolean;
  pro?: boolean;
  home?: boolean;
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
    /** replies he can send (a friend's text); answered is the one he picked, expired if he never did */
    replies?: { label: string; d: number }[];
    answered?: number;
    expired?: boolean;
    /** his own reply */
    mine?: boolean;
  }[];
}

/** someone at one of his places this week (a classmate, a teammate), with what they look like */
export interface SocialPerson {
  id: string;
  name: string;
  first: string;
  kind: string;
  role: string;
  fem: boolean;
  look: Partial<Look> & Record<string, unknown>;
  outfit: { shirt: string; trim: string; shorts: string; socks: string; bottom?: "shorts" | "trousers" | "skirt" | "dress" | "gown"; top?: "tee" | "vest"; plain?: boolean; shoe?: [string, string]; tights?: string; sleeve?: boolean };
  h: number;
  w: number;
  rel: number | null;
  num: boolean;
  trait: string;
  likes: string[];
  age?: number;
}
export interface Friend {
  id: string;
  name: string;
  role: string;
  level: string;
  rel: number;
  num: boolean;
  fem: boolean;
  trait: string;
  likes: string[];
  hung: boolean;
}
/** a chat in progress: what they said, what he can say, how it went, and what next */
export interface Talk {
  id: string;
  place: string;
  name: string;
  first: string;
  role: string;
  line: string;
  choices: { id: string; label: string }[];
  said: string | null;
  result: string | null;
  rel?: number;
  level?: string;
  follow: { id: string; label: string }[];
}
/** someone he is seeing, or talking to */
export interface DateWho {
  id: string;
  name: string;
  first: string;
  stage: "met" | "talking" | "dating" | "serious" | "engaged" | "married" | "ex";
  stageWord: string;
  rel: number;
  dates: number;
  age: number;
  trait: string;
  likes: string[];
  look: SocialPerson["look"];
  outfit: SocialPerson["outfit"];
  night: SocialPerson["outfit"];
  h: number;
  w: number;
  /** picks which building in the city is hers */
  seed: number;
}
export interface DatePlan {
  id: string;
  venue: string;
  place: string;
  hour: number;
  pickup: boolean;
  byCar: boolean;
  /** the week it was planned for */
  w: number;
  status: "set" | "together" | "on" | "done";
  late: number;
  who: DateWho;
  label: string;
  at: string;
}
export interface DateScene {
  id: string;
  name: string;
  first: string;
  venue: string;
  step: number;
  keys: string[];
  beat: { t: string; choices: { id: string; label: string }[] } | null;
  said: string[];
  result: { res: "great" | "good" | "bad"; text: string; rel: number; stage: string; proposal?: "yes" | "no" } | null;
}
export interface Ring {
  id: string;
  brand: string;
  label: string;
  price: number;
  note?: string;
}
export interface WedScene {
  step: number;
  said: string[];
  beat: { t: string; choices: { id: string; label: string }[] } | null;
  result: { res: "great" | "good" | "bad"; text: string; rel: number; stage: string } | null;
  size: string;
}
export interface Dating {
  eligible: boolean;
  partner: (DateWho & { ring?: string | null }) | null;
  contacts: DateWho[];
  plan: DatePlan | null;
  scene: DateScene | null;
  venues: { id: string; label: string }[];
  /** the ring in his pocket, and the ones in the boutique */
  ring?: Ring | null;
  rings?: Ring[];
  weddings?: { id: string; label: string; cost: number }[];
  wedding?: { size: string; cost: number; status: "today" | "on" | "done"; w: number; who: string } | null;
  wscene?: WedScene | null;
}
export interface Social {
  friends: Friend[];
  present: Record<string, SocialPerson[]>;
  talk: Talk | null;
  dating?: Dating;
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
  body: "scooter" | "bike" | "hatch" | "saloon" | "coupe" | "sports" | "suv" | "hyper" | "van";
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
  world?: LifeWorld;
  catalog?: LifeCatalog;
  visited?: string[];
  garage?: string[];
  cityOutfit?: CityOutfit;
  fame?: number;
  moments?: LifeMoment[];
  week?: LifeWeek;
}
/** this week's small counters: cafe orders, supermarket buys and street fans used of their limits, the clinic */
export interface LifeWeek {
  cafe: number;
  market: number;
  fans: number;
  treat: boolean;
  checkup: boolean;
  limits: { cafe: number; market: number; fans: number };
  guarded: boolean;
}

export type PlaceKind = "store" | "mall" | "supermarket" | "cafe" | "restaurant" | "club" | "clinic" | "gym" | "training"
  | "stadium" | "dealer" | "watches" | "home" | "school" | "college" | "wedding";
/** a school, college or club behind a place: how good it is (1 to 10), its seed and colours, whether it is his */
export interface PlaceInst {
  key: string;
  kind: "school" | "college" | "club" | "centre";
  standing: number;
  seed: number;
  cols: [string, string];
  mine: boolean;
  academy?: boolean;
  ground: string;
  team: string;
}
export interface PlaceStyle { floor: string; wall: string; accent: string; trim: string; vibe: string }
export interface WorldPlace {
  id: string;
  kind: PlaceKind;
  name: string;
  brand?: string;
  where: "street" | "mall" | "luxury" | "seafront" | "centre" | "outskirts" | "hill" | "suburb";
  style: PlaceStyle;
  minAge?: number;
  inside?: string[];
  homeId?: string;
  owned?: boolean;
  living?: boolean;
  price?: number;
  inst?: PlaceInst;
}
export interface CatalogItem {
  id: string;
  store: string;
  brand: string;
  cat: "top" | "bottom" | "shoes" | "outer" | "watch" | "jewellery" | "boots" | "tech" | "bag";
  label: string;
  price: number;
  mood: number;
  flash: number;
  look?: Record<string, string>;
  outfit?: { shirt?: string; trim?: string; shorts?: string };
  colour: string;
  need?: number;
  lockReason?: string;
  owned: boolean;
  wearing: boolean;
  canBuy: boolean;
  boot?: number;
  perk?: string;
}
export interface CatalogCar {
  id: string;
  dealer: string;
  brand: string;
  model: string;
  price: number;
  upkeep: number;
  flash: number;
  colour: string;
  body: "scooter" | "bike" | "hatch" | "saloon" | "coupe" | "sports" | "suv" | "hyper" | "van";
  feel: { top: number; accel: number; grip: number; mass: number };
  need?: number;
  lockReason?: string;
  owned: boolean;
  canBuy: boolean;
  minAge?: number;
  tier?: number;
  daily?: boolean;
  sellFor?: number;
}
export interface Grocery { id: string; label: string; price: number; aisle: string; colour: string; note: string }
export interface MenuItem { id: string; label: string; price: number; note: string; time?: number }
export interface LifeWorld { seed: number; tier: 1 | 2 | 3; places: WorldPlace[] }
export interface LifeCatalog {
  items: CatalogItem[];
  cars: CatalogCar[];
  groceries: Grocery[];
  menus: { cafe: MenuItem[]; restaurant: MenuItem[]; club: MenuItem[]; clinic: MenuItem[] };
}
export interface CityOutfit { shirt: string; trim: string; shorts: string; socks: string }
export interface LifeMoment { id: string; kind: string; s: number; w: number; title: string; text: string; seen: boolean; item?: string; price?: number }

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
  /** friends, who is where this week, a chat in progress (older servers send none) */
  social?: Social;
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
  /** this week's match: can he play it live (player lock), and why not when he cannot */
  play?: { can: boolean; code: string; kind: "youth" | "pro"; why: string };
}
