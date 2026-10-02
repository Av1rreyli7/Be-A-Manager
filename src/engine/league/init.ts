/** Build a new League from seed data (data/*.json). */
import type { SeedContract, SeedPick, SeedPlayer, SeedTeam } from "../types/seed";
import type { Coach, Contract, League, PickAsset, Player, Settings, Team } from "../types/game";
import { type Cba, cloneCba, DEFAULT_CBA } from "../config/cba";
import { rateSeedPlayers } from "../ratings/fromStats";
import { hashString } from "../ratings/ratings";
import { seasonCalendar, seasonLabel } from "../util/dates";
import { randomName } from "../util/names";
import { clamp, Rng } from "../util/rng";
import { generateSchedule } from "../season/schedule";
import { drawCupGroups } from "../season/cup";
import { emptyRecord } from "../season/standings";
import { autoDepth } from "./depth";
import { updateStrategies } from "../trade/strategy";
import { LEAGUE_VERSION } from "./migrate";
import { generateDraftClass } from "../offseason/draft";

export interface SeedData {
  teams: SeedTeam[];
  players: SeedPlayer[];
  contracts: SeedContract[];
  picks: SeedPick[];
  cba?: Cba;
  fetchedAt?: string;
  /** data/ratingOverrides.json - player name → pinned OVR */
  ratingOverrides?: Record<string, number>;
}

/** Relative market size (1-5) - a game-design setting, not sourced data. */
const MARKET: Record<string, number> = {
  NY: 5, LAL: 5, LAC: 5, GS: 5, CHI: 5, BKN: 5, DAL: 4, HOU: 4, PHI: 4, TOR: 4, BOS: 4, MIA: 4, ATL: 4, WSH: 4, PHX: 4,
  DET: 3, MIN: 3, DEN: 3, ORL: 3, CLE: 3, SAC: 3, POR: 3, CHA: 3, SA: 3, IND: 3, UTAH: 2, MIL: 2, MEM: 2, NO: 2, OKC: 2,
};

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "normal",
  tradeDifficulty: 1.0,
  injuryFrequency: 1.0,
  salaryCap: true,
  seasonLength: 82,
  commissioner: false,
  autoRosterAI: true,
  quarterLength: 12,
  progressionVariance: 1.0,
  aiTrades: true,
  strictAprons: false,
};

function coachRatings(rng: Rng, base: number) {
  const r = () => Math.round(clamp(rng.normal(base, 9), 30, 97));
  return { offense: r(), defense: r(), development: r(), motivation: r() };
}

export function makeCoach(rng: Rng, id: string, role: Coach["role"], teamId: string | null, name?: string, experience = 0): Coach {
  const n = name ?? (() => { const x = randomName(rng); return `${x.first} ${x.last}`; })();
  const base = role === "HC" ? 60 + Math.min(12, experience) : 55;
  return {
    id,
    name: n,
    role,
    ...coachRatings(rng, base),
    age: Math.round(clamp(rng.normal(role === "HC" ? 50 : 42, 8), 30, 75)),
    salary: role === "HC" ? Math.round(rng.range(4, 10) * 1e6) : Math.round(rng.range(0.4, 1.5) * 1e6),
    contractYears: rng.int(1, 4),
    teamId,
  };
}

export function createLeague(seed: SeedData, opts: { userTeams: string[]; name: string; settings?: Partial<Settings>; rngSeed?: number }): League {
  const rng = new Rng(opts.rngSeed ?? (Date.now() & 0xffffffff));
  const startYear = 2026;
  const season = seasonLabel(startYear);
  const cba = cloneCba(seed.cba ?? DEFAULT_CBA);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...opts.settings };
  const cal = seasonCalendar(startYear);

  // ---- players ----
  const rated = rateSeedPlayers(seed.players, seed.ratingOverrides ?? {}, Object.fromEntries(seed.teams.filter((t) => t.prevRecord).map((t) => [t.id, t.prevRecord!.w / (t.prevRecord!.w + t.prevRecord!.l)])));
  const players: Record<string, Player> = {};
  const teamEspnToId = new Map(seed.teams.map((t) => [t.espnId, t.id]));
  for (const sp of seed.players) {
    const r = rated.get(sp.id)!;
    const p: Player = {
      id: sp.id,
      name: sp.name,
      firstName: sp.firstName,
      lastName: sp.lastName,
      teamId: sp.teamId,
      status: "active",
      dob: sp.dob ?? `${startYear - sp.age}-01-01`,
      born: { place: sp.birthPlace, country: sp.country },
      college: sp.college,
      heightIn: sp.heightIn,
      weightLb: sp.weightLb,
      pos: r.pos,
      positions: sp.positions,
      jersey: sp.jersey,
      experience: sp.experienceYears,
      draft: sp.draft ? { year: sp.draft.year, round: sp.draft.round, pick: sp.draft.pick, teamId: sp.draft.teamEspnId ? teamEspnToId.get(sp.draft.teamEspnId) ?? null : null } : null,
      ratings: r.ratings,
      ovr: r.ovr,
      pot: r.pot,
      tendencies: r.tendencies,
      traits: r.traits,
      personality: r.personality,
      morale: 70,
      tradeRequest: false,
      injury: sp.injury && /out|day/i.test(sp.injury.status)
        ? {
            type: sp.injury.type ?? "Undisclosed",
            severity: /out/i.test(sp.injury.status) ? "moderate" : "minor",
            daysOut: sp.injury.returnDate ? Math.max(1, Math.round((Date.parse(sp.injury.returnDate) - Date.parse(cal.preseasonStart)) / 86400000)) : /out/i.test(sp.injury.status) ? 21 : 3,
            startDate: cal.preseasonStart,
          }
        : null,
      contractId: null,
      seasonsWithTeam: sp.seasonsWithTeam,
      gLeague: false,
      realStats: sp.stats,
      stats: [],
      awards: [],
      ratingHistory: [{ season, ovr: r.ovr, pot: r.pot }],
    };
    players[p.id] = p;
  }

  // ---- contracts ----
  const contracts: Record<string, Contract> = {};
  seed.contracts.forEach((sc, i) => {
    const id = `c${i + 1}`;
    const c: Contract = {
      id,
      playerId: sc.playerId,
      playerName: sc.playerName,
      teamId: sc.teamId,
      type: sc.type,
      years: sc.years.map((y) => ({ ...y })),
      tradeKicker: sc.tradeKicker,
      noTradeClause: sc.noTradeClause,
      signedDate: sc.tradeRestricted ? cal.preseasonStart : `${startYear - 1}-07-06`,
      deadMoney: sc.deadMoney,
      twoWayGames: sc.type === "two-way" ? 0 : undefined,
      notes: sc.notes,
    };
    contracts[id] = c;
    if (sc.playerId && players[sc.playerId] && !sc.deadMoney) players[sc.playerId].contractId = id;
  });

  // ---- picks ----
  const picks: Record<string, PickAsset> = {};
  for (const sp of seed.picks) picks[sp.id] = { ...sp, terms: [...sp.terms] };

  // ---- coaches ----
  const coaches: Record<string, Coach> = {};
  let cid = 0;
  for (const t of seed.teams) {
    const cr = new Rng(hashString("coach:" + t.id));
    const hc = makeCoach(cr, `co${++cid}`, "HC", t.id, t.headCoach?.name, t.headCoach?.experience ?? 0);
    coaches[hc.id] = hc;
    for (const role of ["Assistant", "Assistant", "Player Development", "Medical"] as const) {
      const c = makeCoach(cr, `co${++cid}`, role, t.id);
      coaches[c.id] = c;
    }
  }
  for (let i = 0; i < 30; i++) {
    const role = (["HC", "Assistant", "Player Development", "Medical"] as const)[i % 4];
    const c = makeCoach(rng, `co${++cid}`, role, null, undefined, rng.int(0, 12));
    coaches[c.id] = c;
  }

  // ---- teams ----
  const teams: Record<string, Team> = {};
  for (const st of seed.teams) {
    const market = MARKET[st.id] ?? 3;
    const reasons = st.hardCap?.reasons ?? [];
    teams[st.id] = {
      id: st.id,
      city: st.city,
      name: st.name,
      fullName: st.fullName,
      conference: st.conference,
      division: st.division,
      colors: st.colors,
      venue: st.venue,
      market,
      arenaCapacity: 17_500 + market * 400,
      depth: { starters: [], rotation: [], minutes: {}, auto: true },
      strategy: { mode: "retooling", updated: cal.preseasonStart },
      hardCap: st.hardCap?.level ?? null,
      exceptions: {
        mleUsed: reasons.some((r) => /mid-level/i.test(r)) ? cba.exceptions.nonTaxpayerMLE.value : 0,
        mleType: reasons.some((r) => /non-taxpayer mid-level/i.test(r)) ? "nt" : reasons.some((r) => /taxpayer mid-level/i.test(r)) ? "tp" : null,
        baeUsed: reasons.some((r) => /bi-annual/i.test(r)) ? cba.exceptions.biAnnual.value : 0,
        baeLastUsedSeason: reasons.some((r) => /bi-annual/i.test(r)) ? season : null,
        tpes: [],
        dpe: null,
        roomUsed: 0,
      },
      cashSent: 0,
      cashReceived: 0,
      taxHistory: cba.tax.repeaterTeams2026_27.includes(st.id)
        ? ["2023-24", "2024-25", "2025-26"].map((s) => ({ season: s, paid: 1 }))
        : [],
      rights: [],
      draftRights: [],
      finances: { ticketPrice: 60 + market * 22, revenue: 0, expenses: 0, attendance: [], cash: 120_000_000 + market * 20_000_000, history: [] },
      hype: Math.round(clamp(35 + (st.prevRecord ? (st.prevRecord.w - 41) * 1.1 : 0) + market * 3, 5, 95)),
      owner: { patience: 50 + Math.round(new Rng(hashString("own" + st.id)).normal(0, 12)), goals: [], jobSecurity: 70 },
      gLeagueName: `${st.city} ${st.name} G`,
      retiredNumbers: [],
    };
  }

  const league: League = {
    version: LEAGUE_VERSION,
    id: `lg-${Date.now().toString(36)}${rng.int(0, 1e6).toString(36)}`,
    name: opts.name,
    created: new Date().toISOString(),
    userTeams: opts.userTeams,
    season,
    date: cal.preseasonStart,
    phase: "preseason",
    phaseDay: 0,
    rngState: rng.state,
    settings,
    cba,
    cbaBySeason: { [season]: cloneCba(cba) },
    teams,
    players,
    contracts,
    picks,
    schedule: [],
    boxScores: {},
    standings: Object.fromEntries(Object.keys(teams).map((t) => [t, emptyRecord(t)])),
    playIn: [],
    playoffs: [],
    cup: null,
    allStar: null,
    draft: null,
    freeAgency: { offers: [], day: 0, log: [] },
    news: [],
    tradeOffers: [],
    tradeBlock: [],
    history: [],
    records: { singleGame: [], singleSeason: [] },
    coaches,
    nextId: 1000,
    dataFetchedAt: seed.fetchedAt ?? "",
    gameLog: {},
    transactions: [],
    alerts: [],
  };

  // ---- schedule & cup ----
  const prevWinPct: Record<string, number> = {};
  for (const st of seed.teams) prevWinPct[st.id] = st.prevRecord ? st.prevRecord.w / Math.max(1, st.prevRecord.w + st.prevRecord.l) : 0.5;
  const useCup = settings.seasonLength >= 60;
  const groups = useCup ? drawCupGroups(league, prevWinPct, rng) : null;
  league.cup = groups ? { season, groups, knockout: { qf: [], sf: [] } } : null;
  league.schedule = generateSchedule(Object.values(teams), { startYear, gamesPerTeam: settings.seasonLength, cupGroups: groups }, rng);

  // record last season in history for context (standings only)
  league.history.push({
    season: seasonLabel(startYear - 1),
    awards: [],
    standings: seed.teams.filter((t) => t.prevRecord).map((t) => ({ teamId: t.id, w: t.prevRecord!.w, l: t.prevRecord!.l, seed: t.prevRecord!.seed ?? undefined })),
  });

  for (const t of Object.values(teams)) t.depth = autoDepth(league, t.id);
  // the 2027 draft class exists from day one so it can be scouted all season
  league.draft = generateDraftClass(league, startYear + 1, rng);
  updateStrategies(league);
  league.rngState = rng.state;
  league.news.push({
    id: "n0",
    date: league.date,
    type: "league",
    text: `Training camps open for the ${season} season. Rosters reflect real transactions through ${seed.fetchedAt ? seed.fetchedAt.slice(0, 10) : "the latest data refresh"}.`,
    teams: [],
    players: [],
    important: true,
  });
  return league;
}
