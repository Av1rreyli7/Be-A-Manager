/** Runtime league state. Everything here is plain JSON so it can be cloned to the worker and saved in IndexedDB. */
import type { Cba } from "../config/cba";
import type { ContractOption, ContractType, SeasonStatLine, TeamId, PlayerId } from "./seed";

export type { TeamId, PlayerId };
export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

export const ATTRIBUTE_KEYS = [
  // scoring
  "closeShot", "midRange", "threePoint", "freeThrow", "layup", "standingDunk", "drivingDunk",
  "postHook", "postFade", "postControl", "drawFoul", "shotIQ",
  // playmaking
  "passAccuracy", "passVision", "passIQ", "ballHandle", "speedWithBall",
  // defense
  "interiorD", "perimeterD", "steal", "block", "helpDefIQ", "passPerception",
  // rebounding
  "offRebound", "defRebound",
  // physical
  "speed", "acceleration", "strength", "vertical", "stamina", "durability", "hustle",
  // mental
  "offConsistency", "defConsistency", "clutch",
] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

/** Shot/usage tendencies drive the sim so box scores resemble each player's real profile. */
export interface Tendencies {
  usage: number; // share of team possessions used while on court (~0.12..0.36)
  threeRate: number; // 3PA / FGA
  rimRate: number; // of 2PA, share at the rim
  ftRate: number; // FTA / FGA
  astRate: number; // assists per possession on court (relative)
  tovRate: number; // turnovers per usage
  orebRate: number;
  drebRate: number;
  stlRate: number;
  blkRate: number;
  foulRate: number;
}

export interface Personality {
  loyalty: number; // 0-100
  winning: number;
  money: number;
  playTime: number;
  workEthic: number;
  ego: number;
}

export interface Injury {
  type: string;
  severity: "minor" | "moderate" | "major" | "season-ending";
  daysOut: number;
  startDate: string;
  outForSeason?: boolean;
}

export interface StatLine {
  gp: number; gs: number; min: number;
  fgm: number; fga: number; fg3m: number; fg3a: number; ftm: number; fta: number;
  oreb: number; dreb: number; ast: number; stl: number; blk: number; tov: number; pf: number; pts: number;
  pm: number; // plus-minus
  dd: number; td: number;
  clutchPts: number; clutchMin: number; clutchPm: number;
}

export interface PlayerSeasonStats {
  season: string;
  teamId: TeamId;
  regular: StatLine;
  playoffs: StatLine;
  cup?: StatLine;
}

export interface AwardRecord {
  season: string;
  award: string; // "MVP", "All-NBA 1st", "Champion", ...
  teamId?: TeamId;
}

export interface Contract {
  id: string;
  playerId: PlayerId | null;
  playerName: string;
  teamId: TeamId;
  type: ContractType;
  years: { season: string; salary: number; guaranteed: number; option: ContractOption; approximate?: boolean }[];
  tradeKicker: { pct: number; value: number } | null;
  noTradeClause: boolean;
  signedDate: string;
  /** exception used to sign (affects hard caps) */
  signedWith?: "room" | "bird" | "early-bird" | "non-bird" | "nt-mle" | "tp-mle" | "room-mle" | "bae" | "minimum" | "rookie" | "second-round" | "two-way" | "rfa-offer" | "sign-and-trade" | "extension";
  deadMoney: boolean;
  /** two-way game counter */
  twoWayGames?: number;
  /** ten-day contract expiry */
  expires?: string;
  isExtension?: boolean;
  notes: string[];
}

export interface ScoutingInfo {
  /** 0..100 - how much of the true rating the user's scouts have uncovered */
  revealed: number;
  combine?: { heightNoShoes: number; wingspan: number; standingReach: number; vertical: number; laneAgility: number; sprint: number };
  workedOut?: boolean;
  userRank?: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  firstName: string;
  lastName: string;
  teamId: TeamId | null; // null = free agent (or retired / prospect by status)
  status: "active" | "fa" | "retired" | "prospect" | "undrafted";
  dob: string;
  born: { place: string | null; country: string | null };
  college: string | null;
  heightIn: number;
  weightLb: number;
  pos: Position;
  positions: string[];
  jersey: string | null;
  experience: number; // years of NBA service
  draft: { year: number; round: number; pick: number; teamId: TeamId | null } | null;
  ratings: Attributes;
  ovr: number;
  pot: number;
  tendencies: Tendencies;
  traits: string[];
  personality: Personality;
  morale: number; // 0-100
  tradeRequest: boolean;
  injury: Injury | null;
  contractId: string | null;
  /** for Bird rights: consecutive seasons with current team (completed) */
  seasonsWithTeam: number;
  /** date acquired in a trade (60-day re-aggregation rule) */
  acquiredDate?: string;
  acquiredAggregated?: boolean;
  gLeague: boolean;
  realStats: SeasonStatLine[];
  stats: PlayerSeasonStats[];
  awards: AwardRecord[];
  ratingHistory: { season: string; ovr: number; pot: number }[];
  scouting?: ScoutingInfo;
  /** true rating of prospects (hidden in UI until scouted) */
  hiddenOvr?: number;
  hiddenPot?: number;
  retiredSeason?: string;
  legacy?: string;
  hallOfFame?: boolean;
  /** RFA: team holding matching rights */
  rfaTeam?: TeamId | null;
  qualifyingOffer?: number;
  /** FA asking price */
  demand?: { salary: number; years: number; updated: string };
  /** 10-day contracts signed this season: team -> count */
  tenDays?: Record<string, number>;
  summerLeague?: { season: string; ppg: number; boost: number };
  lastSeasonSalary?: number;
}

export interface PickAsset {
  id: string; // `${year}-${round}-${originalTeam}`
  year: number;
  round: 1 | 2;
  originalTeam: TeamId;
  owner: TeamId;
  protection: { kind: "none" | "top" | "range" | "complex"; keepTop?: number; text: string };
  /** where the pick goes if protection triggers (default: stays with original team) */
  swap: boolean;
  conditional: boolean;
  frozen: boolean;
  forfeited: boolean;
  terms: string[];
  /** set once the draft order is known */
  resolvedPick?: number;
  /** a protection added in-game ("rolls over" not modelled: protected picks convert to a 2nd if not conveyed) */
  custom?: boolean;
}

export interface TradeException {
  id: string;
  amount: number;
  created: string;
  expires: string;
  fromPlayer: string;
  fromSignAndTrade: boolean;
}

export interface TeamStrategy {
  mode: "contending" | "retooling" | "rebuilding";
  updated: string;
}

export interface Coach {
  id: string;
  name: string;
  role: "HC" | "Assistant" | "Player Development" | "Medical";
  offense: number;
  defense: number;
  development: number;
  motivation: number;
  age: number;
  salary: number;
  contractYears: number;
  teamId: TeamId | null;
}

export interface TeamFinances {
  ticketPrice: number; // average $
  revenue: number; // season to date
  expenses: number;
  attendance: number[]; // per home game
  cash: number;
  history: { season: string; revenue: number; expenses: number; payroll: number; tax: number; profit: number }[];
}

export interface Team {
  id: TeamId;
  city: string;
  name: string;
  fullName: string;
  conference: "East" | "West";
  division: string;
  colors: { primary: string; secondary: string };
  venue: string | null;
  market: number; // 1 (small) .. 5 (huge)
  arenaCapacity: number;
  depth: DepthChart;
  strategy: TeamStrategy;
  hardCap: "first" | "second" | null;
  exceptions: {
    mleUsed: number; // $ used this league year
    mleType: "nt" | "tp" | "room" | null; // type committed to (first use)
    baeUsed: number;
    baeLastUsedSeason: string | null;
    tpes: TradeException[];
    dpe: { amount: number; expires: string } | null;
    roomUsed: number;
  };
  cashSent: number; // this league year
  cashReceived: number;
  taxHistory: { season: string; paid: number }[];
  rights: { playerId: PlayerId; type: "bird" | "early-bird" | "non-bird"; capHold: number; renounced: boolean }[];
  draftRights: { playerId: PlayerId; year: number }[];
  finances: TeamFinances;
  hype: number; // 0-100
  owner: { patience: number; goals: { type: "win" | "playoffs" | "develop" | "profit"; target: number }[]; jobSecurity: number };
  gLeagueName: string;
  retiredNumbers: { number: string; playerName: string; season: string }[];
  preseasonExpectation?: number; // projected wins (for COY)
}

export interface DepthChart {
  starters: PlayerId[]; // 5
  rotation: PlayerId[]; // ordered bench
  minutes: Record<PlayerId, number>; // target minutes
  auto: boolean;
}

export type GameType = "preseason" | "regular" | "cup-group" | "cup-knockout" | "cup-final" | "play-in" | "playoffs" | "all-star" | "summer";

export interface ScheduledGame {
  id: string;
  date: string;
  home: TeamId;
  away: TeamId;
  type: GameType;
  cupGroup?: string;
  round?: string; // playoff round / cup round label
  seriesId?: string;
  played: boolean;
  result?: GameResultSummary;
}

export interface BoxLine extends Omit<StatLine, "gp" | "dd" | "td" | "clutchPts" | "clutchMin" | "clutchPm"> {
  playerId: PlayerId;
  name: string;
  starter: boolean;
  dnp?: string;
}

export interface GameResultSummary {
  homeScore: number;
  awayScore: number;
  ot: number;
  quarters: { home: number[]; away: number[] };
  topHome: { playerId: PlayerId; name: string; pts: number; reb: number; ast: number };
  topAway: { playerId: PlayerId; name: string; pts: number; reb: number; ast: number };
}

export interface BoxScore {
  gameId: string;
  date: string;
  type: GameType;
  home: TeamId;
  away: TeamId;
  summary: GameResultSummary;
  lines: { home: BoxLine[]; away: BoxLine[] };
  teamStats: { home: Record<string, number>; away: Record<string, number> };
  pbp?: PlayByPlay[];
  injuries: { playerId: PlayerId; type: string; daysOut: number }[];
}

export interface PlayByPlay {
  q: number;
  clock: string;
  team: TeamId | null;
  text: string;
  score: [number, number]; // home, away
}

export interface TeamSeasonRecord {
  teamId: TeamId;
  w: number;
  l: number;
  homeW: number; homeL: number;
  awayW: number; awayL: number;
  confW: number; confL: number;
  divW: number; divL: number;
  pf: number;
  pa: number;
  streak: number; // +n wins, -n losses
  last10: ("W" | "L")[];
  vs: Record<TeamId, { w: number; l: number }>;
  cupW: number; cupL: number; cupPd: number; cupPf: number;
}

export interface PlayoffSeries {
  id: string;
  round: number; // 1..4
  conference: "East" | "West" | "Finals";
  high: TeamId; // higher seed / home court
  low: TeamId;
  highSeed: number;
  lowSeed: number;
  winsHigh: number;
  winsLow: number;
  games: string[]; // game ids
  winner?: TeamId;
}

export interface PlayInGame {
  id: string;
  conference: "East" | "West";
  kind: "7v8" | "9v10" | "final";
  home: TeamId;
  away: TeamId;
  winner?: TeamId;
  loser?: TeamId;
  gameId?: string;
}

export interface NewsItem {
  id: string;
  date: string;
  type: "trade" | "signing" | "injury" | "award" | "draft" | "retirement" | "milestone" | "rumor" | "request" | "game" | "league" | "release" | "extension" | "firing";
  text: string;
  teams: TeamId[];
  players: PlayerId[];
  important?: boolean;
}

export interface TradeOffer {
  id: string;
  from: TeamId; // AI team making the offer
  to: TeamId; // user team
  assets: TradeAssets;
  created: string;
  expires: string;
  reasoning: string[];
}

export interface TradeSide {
  teamId: TeamId;
  players: PlayerId[];
  picks: string[]; // PickAsset ids
  cash: number;
  tpe?: string; // TPE id used to absorb
  /** receiving assignment for 3-4 team trades: asset id -> destination team */
}

export interface TradeAssets {
  sides: TradeSide[];
  /** destination for each asset: key `p:${playerId}` / `k:${pickId}` / `c:${teamId}` -> receiving team */
  destinations: Record<string, TeamId>;
  /** sign-and-trade: player ids being signed & traded, with the new contract */
  signAndTrade?: { playerId: PlayerId; salary: number; years: number }[];
  /** protections added to traded picks: pick id -> top-N protected */
  protections?: Record<string, number>;
  /** new swap rights: `from` grants `to` the right to swap picks in that draft */
  swaps?: { year: number; round: 1 | 2; from: TeamId; to: TeamId }[];
}

export interface DraftProspect {
  playerId: PlayerId;
  mockRank: number;
  boardRank: Record<TeamId, number>;
}

export interface DraftState {
  year: number;
  order: { pick: number; round: 1 | 2; pickId: string; owner: TeamId; originalTeam: TeamId; playerId?: PlayerId }[];
  lottery?: { results: { teamId: TeamId; preLottery: number; pick: number }[]; done: boolean };
  current: number; // index into order
  prospects: PlayerId[];
  classStrength: number; // 0.8 .. 1.2
  scoutingPoints: number;
}

export interface FreeAgencyOffer {
  id: string;
  teamId: TeamId;
  playerId: PlayerId;
  salary: number; // first-year
  years: number;
  raisePct: number;
  option: "player" | "team" | null;
  exception: Contract["signedWith"];
  created: string;
  status: "pending" | "accepted" | "rejected" | "matched" | "withdrawn";
  offerSheet?: boolean; // RFA offer sheet
  matchDeadline?: string;
}

export type Phase =
  | "preseason"
  | "regular"
  | "play-in"
  | "playoffs"
  | "season-end" // awards, retirements
  | "draft-lottery"
  | "pre-draft" // scouting, combine
  | "draft"
  | "options" // player/team options + QOs
  | "free-agency" // moratorium then open FA
  | "summer-league"
  | "training-camp";

export interface Settings {
  difficulty: "easy" | "normal" | "hard" | "insane";
  tradeDifficulty: number; // 0.8 .. 1.3 (AI's required value margin)
  injuryFrequency: number; // multiplier 0 .. 2
  salaryCap: boolean; // false = ignore cap rules (fantasy mode)
  seasonLength: number; // games per team (82 default; 20..82)
  commissioner: boolean;
  autoRosterAI: boolean;
  quarterLength: number; // minutes
  progressionVariance: number; // 0.5..1.5
  aiTrades: boolean;
  /** enforce the 1st/2nd-apron trade restrictions (100% matching, no aggregation, no cash) */
  strictAprons?: boolean;
}

export interface SeasonHistory {
  season: string;
  champion?: TeamId;
  runnerUp?: TeamId;
  finalsMvp?: PlayerId;
  cupChampion?: TeamId;
  cupMvp?: PlayerId;
  awards: { award: string; playerId?: PlayerId; teamId?: TeamId; name: string; coachId?: string }[];
  standings?: { teamId: TeamId; w: number; l: number; seed?: number }[];
  draftTop?: { pick: number; playerId: PlayerId; name: string; teamId: TeamId }[];
}

export interface Records {
  singleGame: { stat: string; value: number; playerId: PlayerId; name: string; date: string; season: string; opp: TeamId }[];
  singleSeason: { stat: string; value: number; playerId: PlayerId; name: string; season: string }[];
}

export interface AllStarState {
  season: string;
  votes: Record<PlayerId, number>;
  rosters?: { East: PlayerId[]; West: PlayerId[]; captains?: [PlayerId, PlayerId] };
  gameId?: string;
  threePoint?: { playerId: PlayerId; scores: number[] }[];
  dunk?: { playerId: PlayerId; scores: number[] }[];
  mvp?: PlayerId;
  threeWinner?: PlayerId;
  dunkWinner?: PlayerId;
}

export interface CupState {
  season: string;
  groups: Record<string, TeamId[]>; // "East A" ...
  knockout: { qf: { id: string; home: TeamId; away: TeamId; winner?: TeamId; gameId?: string }[]; sf: { id: string; home: TeamId; away: TeamId; winner?: TeamId; gameId?: string }[]; final?: { id: string; home: TeamId; away: TeamId; winner?: TeamId; gameId?: string } };
  champion?: TeamId;
  mvp?: PlayerId;
}

/** Online league with friends: the host's browser runs the league, friends each control one team. */
export interface OnlineInfo {
  code: string;
  hostTeam: TeamId;
  /** team id -> manager's display name */
  members: Record<TeamId, string>;
  /** first season played in this league */
  startSeason?: string;
}

export interface League {
  version: number;
  online?: OnlineInfo;
  id: string;
  name: string;
  created: string;
  userTeams: TeamId[];
  season: string; // "2026-27"
  date: string;
  phase: Phase;
  phaseDay: number; // day counter within phase (FA days etc.)
  rngState: number;
  settings: Settings;
  cba: Cba;
  cbaBySeason: Record<string, Cba>;
  teams: Record<TeamId, Team>;
  players: Record<PlayerId, Player>;
  contracts: Record<string, Contract>;
  picks: Record<string, PickAsset>;
  schedule: ScheduledGame[];
  boxScores: Record<string, BoxScore>; // recent / user-relevant only
  standings: Record<TeamId, TeamSeasonRecord>;
  playIn: PlayInGame[];
  playoffs: PlayoffSeries[];
  cup: CupState | null;
  allStar: AllStarState | null;
  draft: DraftState | null;
  freeAgency: { offers: FreeAgencyOffer[]; day: number; log: string[] };
  news: NewsItem[];
  tradeOffers: TradeOffer[];
  tradeBlock: PlayerId[];
  history: SeasonHistory[];
  records: Records;
  coaches: Record<string, Coach>;
  nextId: number;
  dataFetchedAt: string;
  gameLog: Record<PlayerId, { gameId: string; date: string; opp: TeamId; home: boolean; min: number; pts: number; reb: number; ast: number; stl: number; blk: number; fgm: number; fga: number; fg3m: number; fg3a: number; ftm: number; fta: number; tov: number; pm: number }[]>;
  transactions: { date: string; text: string; teams: TeamId[] }[];
  alerts: { id: string; text: string; href?: string; level: "info" | "warn" | "danger" }[];
}

export function emptyLine(): StatLine {
  return {
    gp: 0, gs: 0, min: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
    oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 0, pm: 0, dd: 0, td: 0,
    clutchPts: 0, clutchMin: 0, clutchPm: 0,
  };
}
