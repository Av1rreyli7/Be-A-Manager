/**
 * Seed-data schema. Produced by scripts/fetch-data.ts, consumed by the engine.
 * Seasons are labelled "2026-27"; SeasonYear 2027 means the 2026-27 season (the year it ends).
 */

export type Conference = "East" | "West";
export type TeamId = string; // our abbreviation, e.g. "LAL"
export type PlayerId = string; // ESPN athlete id (stable across refreshes)

export interface SeedTeam {
  id: TeamId;
  espnId: string;
  nbaId: string | null;
  city: string;
  name: string;
  fullName: string;
  conference: Conference;
  division: string;
  colors: { primary: string; secondary: string };
  venue: string | null;
  /** slug used by hoopsnightly.com (source for cap sheets & picks) */
  hnSlug: string;
  headCoach: { name: string; experience: number } | null;
  /** 2025-26 final record */
  prevRecord: { w: number; l: number; seed: number | null } | null;
  /** hard cap already triggered this league year, with the triggering moves */
  hardCap: { level: "first" | "second"; reasons: string[] } | null;
}

export interface SeasonStatLine {
  season: string; // "2025-26"
  team: string; // team abbreviation or "TOT" for multi-team totals
  gp: number;
  gs: number;
  min: number; // total minutes
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  pts: number;
}

export interface SeedInjury {
  status: string; // "Out", "Day-To-Day", ...
  type: string | null; // body part / description
  detail: string | null;
  returnDate: string | null; // ISO date if reported
}

export interface SeedPlayer {
  id: PlayerId;
  name: string;
  firstName: string;
  lastName: string;
  teamId: TeamId | null;
  jersey: string | null;
  positions: string[]; // e.g. ["G"], ["F","C"]
  heightIn: number;
  weightLb: number;
  age: number;
  dob: string | null;
  birthPlace: string | null;
  country: string | null;
  college: string | null;
  experienceYears: number;
  draft: { year: number; round: number; pick: number; teamEspnId: string | null } | null;
  injury: SeedInjury | null;
  /** most recent first; up to 3 NBA regular seasons */
  stats: SeasonStatLine[];
  /** consecutive seasons (incl. the current one) with current team - for Bird rights */
  seasonsWithTeam: number;
  rosterSlot: "standard" | "two-way" | "camp";
}

export type ContractOption = "player" | "team" | "eto" | null;

export interface ContractYear {
  season: string; // "2026-27"
  salary: number;
  /** amount of this year's salary that is guaranteed */
  guaranteed: number;
  option: ContractOption;
  /** true when the exact dollar figure was not published (rounded or projected) */
  approximate: boolean;
}

export type ContractType =
  | "standard"
  | "rookie-scale"
  | "second-round"
  | "minimum"
  | "two-way"
  | "exhibit-10"
  | "10-day";

export type BirdRights = "full" | "early" | "non-bird";

export interface SeedContract {
  playerId: PlayerId | null; // null for dead-money rows we could not match to a rostered player
  playerName: string;
  teamId: TeamId;
  type: ContractType;
  years: ContractYear[];
  tradeKicker: { pct: number; value: number } | null;
  noTradeClause: boolean;
  /** CBA: recently signed players can't be traded until an allowed date */
  tradeRestricted: boolean;
  birdRights: BirdRights;
  deadMoney: boolean;
  sources: string[];
  verified: boolean;
  notes: string[];
}

export type PickStatus = "own" | "protected" | "swap" | "owed" | "conditional" | "acquired";

export interface SeedPick {
  id: string; // `${year}-${round}-${originalTeam}`
  year: number; // draft year
  round: 1 | 2;
  originalTeam: TeamId;
  owner: TeamId; // team currently holding it (for protected picks: the team it conveys to)
  /** e.g. protected top-4: the original team keeps it if it lands 1-4 */
  protection: { kind: "none" | "top" | "range" | "complex"; keepTop?: number; text: string };
  swap: boolean;
  conditional: boolean;
  /** 2nd-apron rule: the league froze this pick (untradable) */
  frozen: boolean;
  /** forfeited by league penalty - will not be made */
  forfeited: boolean;
  projectedPick: number | null;
  terms: string[];
  verified: boolean;
}
