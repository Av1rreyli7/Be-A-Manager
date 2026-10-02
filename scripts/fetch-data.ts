/**
 * Front Office data pipeline.
 *
 *   npm run fetch-data            # uses the on-disk HTTP cache where present
 *   npm run refresh-data          # ignores the cache and re-pulls everything
 *
 * Writes data/teams.json, players.json, contracts.json, draftPicks.json, cba.json and DATA_REPORT.md.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BirdRights, ContractOption, ContractType, ContractYear, SeasonStatLine, SeedContract, SeedPick, SeedPlayer, SeedTeam,
} from "../src/engine/types/seed";
import { CBA_2026_27 } from "./data/cba-2026-27";
import { pool, setRefresh, stats as httpStats } from "./lib/http";
import * as espn from "./sources/espn";
import * as hn from "./sources/hoopsnightly";
import * as hr from "./sources/hoopsrumors";

const OUT = path.join(process.cwd(), "data");
const SEASON = "2026-27";
const SEASON_END_YEAR = 2027;
const STAT_SEASONS = ["2025-26", "2024-25", "2023-24"];

const report = {
  fetchedAt: new Date().toISOString(),
  warnings: [] as string[],
  unmatchedCapRows: [] as string[],
  noContract: [] as string[],
  salaryMismatch: [] as string[],
  optionMismatch: [] as string[],
  pickIssues: [] as string[],
  complexPicks: [] as string[],
  roster: {} as Record<string, { espn: number; standard: number; twoWay: number; camp: number }>,
};

// ---------- helpers ----------
export function normName(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
}

function seasonLabel(endYear: number): string {
  return `${endYear - 1}-${String(endYear % 100).padStart(2, "0")}`;
}

function splitMadeAtt(s: string): [number, number] {
  const [a, b] = s.split("-").map(Number);
  return [a || 0, b || 0];
}

function buildStats(st: espn.EspnStats | null, abbrevByEspnId: Map<string, string>): { lines: SeasonStatLine[]; bySeasonTeams: Map<string, string[]> } {
  const lines: SeasonStatLine[] = [];
  const bySeasonTeams = new Map<string, string[]>();
  if (!st?.categories) return { lines, bySeasonTeams };
  const avg = st.categories.find((c) => c.name === "averages");
  const tot = st.categories.find((c) => c.name === "totals");
  if (!avg || !tot) return { lines, bySeasonTeams };
  const idx = (names: string[], key: string) => names.indexOf(key);
  for (let i = 0; i < avg.statistics.length; i++) {
    const a = avg.statistics[i];
    const t = tot.statistics[i];
    if (!t || a.season.displayName !== t.season.displayName) continue;
    const season = a.season.displayName;
    if (a.teamId) {
      const list = bySeasonTeams.get(season) ?? [];
      list.push(a.teamId);
      bySeasonTeams.set(season, list);
    }
    if (!STAT_SEASONS.includes(season)) continue;
    const gp = Number(a.stats[idx(avg.names, "gamesPlayed")]) || 0;
    const gs = Number(a.stats[idx(avg.names, "gamesStarted")]) || 0;
    const mpg = Number(a.stats[idx(avg.names, "avgMinutes")]) || 0;
    const g = (k: string) => t.stats[idx(tot.names, k)] ?? "0";
    const [fgm, fga] = splitMadeAtt(g("fieldGoalsMade-fieldGoalsAttempted"));
    const [fg3m, fg3a] = splitMadeAtt(g("threePointFieldGoalsMade-threePointFieldGoalsAttempted"));
    const [ftm, fta] = splitMadeAtt(g("freeThrowsMade-freeThrowsAttempted"));
    lines.push({
      season,
      team: a.teamId ? abbrevByEspnId.get(a.teamId) ?? a.teamSlug ?? "?" : "TOT",
      gp, gs, min: Math.round(mpg * gp),
      fgm, fga, fg3m, fg3a, ftm, fta,
      oreb: Number(g("offensiveRebounds")) || 0,
      dreb: Number(g("defensiveRebounds")) || 0,
      reb: Number(g("totalRebounds")) || 0,
      ast: Number(g("assists")) || 0,
      stl: Number(g("steals")) || 0,
      blk: Number(g("blocks")) || 0,
      tov: Number(g("turnovers")) || 0,
      pf: Number(g("fouls")) || 0,
      pts: Number(g("points")) || 0,
    });
  }
  // one line per season: prefer the multi-team "TOT" row
  const out: SeasonStatLine[] = [];
  for (const s of STAT_SEASONS) {
    const rows = lines.filter((l) => l.season === s);
    if (!rows.length) continue;
    out.push(rows.find((r) => r.team === "TOT") ?? rows[0]);
  }
  return { lines: out, bySeasonTeams };
}

function seasonsWithTeam(bySeasonTeams: Map<string, string[]>, teamEspnId: string): number {
  // completed seasons, most recent first, consecutive, where the player finished with this team
  let n = 0;
  for (let y = SEASON_END_YEAR - 1; y > SEASON_END_YEAR - 12; y--) {
    const teams = bySeasonTeams.get(seasonLabel(y));
    if (!teams || teams[teams.length - 1] !== teamEspnId) break;
    n++;
    if (teams.length > 1) break; // joined mid-season (traded players keep Bird rights, but stop counting)
  }
  return n;
}

function birdFromSeasons(n: number): BirdRights {
  return n >= 3 ? "full" : n === 2 ? "early" : "non-bird";
}

function minSalaryFor(years: number): number {
  const t = CBA_2026_27.minimumSalary.byService;
  return t[Math.min(years, t.length - 1)];
}

// ---------- main ----------
async function main() {
  setRefresh(process.argv.includes("--refresh"));
  await mkdir(OUT, { recursive: true });

  console.log("• teams (ESPN)");
  const eTeams = await espn.fetchTeams();
  const groupIds = [...new Set(eTeams.flatMap((t) => [t.divisionId, t.conferenceId]).filter(Boolean) as string[])];
  const groupNames = new Map<string, string>();
  for (const g of groupIds) groupNames.set(g, (await espn.fetchGroupName(g)) ?? g);
  const abbrevByEspnId = new Map(eTeams.map((t) => [t.id, t.abbreviation]));

  const teams: SeedTeam[] = eTeams.map((t) => {
    const conf = groupNames.get(t.conferenceId ?? "") ?? "";
    return {
      id: t.abbreviation,
      espnId: t.id,
      nbaId: null,
      city: t.location,
      name: t.name,
      fullName: t.displayName,
      conference: /east/i.test(conf) ? "East" : "West",
      division: groupNames.get(t.divisionId ?? "") ?? "?",
      colors: { primary: "#" + (t.color ?? "444444"), secondary: "#" + (t.alternateColor ?? "999999") },
      venue: t.venue,
      hnSlug: hn.HN_SLUGS[t.abbreviation] ?? "",
      headCoach: null,
      prevRecord: null,
      hardCap: null,
    };
  });
  for (const t of teams) if (!t.hnSlug) report.warnings.push(`No hoopsnightly slug for ${t.id}`);
  const teamByName = new Map(teams.map((t) => [t.name.toLowerCase(), t]));

  console.log("• previous-season standings (ESPN) & hard caps (Hoops Rumors)");
  const prev = await espn.fetchStandings(SEASON_END_YEAR - 1);
  if (!prev) report.warnings.push("2025-26 standings unavailable");
  for (const t of teams) t.prevRecord = prev?.[t.espnId] ?? null;
  const caps = await hr.fetchHardCaps();
  if (!caps) report.warnings.push("Hard-cap list unavailable - all teams start without a hard cap");
  for (const c of caps ?? []) {
    const t = teams.find((x) => c.teamFullName.toLowerCase().endsWith(x.name.toLowerCase()));
    if (!t) {
      report.warnings.push(`Hard-cap entry for unknown team "${c.teamFullName}"`);
      continue;
    }
    // second apron is stricter; keep the lower (first) apron if a team appears in both sections
    if (!t.hardCap || c.level === "first") t.hardCap = { level: c.level, reasons: [...(t.hardCap?.reasons ?? []), ...c.reasons] };
  }

  console.log("• rosters (ESPN)");
  const rosterEntries: { team: SeedTeam; a: espn.EspnRosterAthlete }[] = [];
  let rosterSeason = "?";
  for (const t of teams) {
    const r = await espn.fetchRoster(t.espnId);
    rosterSeason = r.season;
    t.headCoach = r.coach;
    for (const a of r.athletes) rosterEntries.push({ team: t, a });
  }
  const coachTeams = new Map<string, string[]>();
  for (const t of teams) if (t.headCoach) coachTeams.set(t.headCoach.name, [...(coachTeams.get(t.headCoach.name) ?? []), t.id]);
  for (const [name, ids] of coachTeams) if (ids.length > 1) report.warnings.push(`Head coach "${name}" listed for ${ids.join(" and ")} - one is likely stale on ESPN; fix in teams.json`);
  if (rosterSeason !== SEASON) report.warnings.push(`ESPN roster season is "${rosterSeason}", expected ${SEASON}`);
  console.log(`  ${rosterEntries.length} rostered players`);

  console.log("• player details, contracts, stats (ESPN)");
  let done = 0;
  const details = await pool(rosterEntries, 6, async ({ a }) => {
    const [detail, contract, st] = await Promise.all([espn.fetchAthlete(a.id), espn.fetchContract(a.id), espn.fetchStats(a.id)]);
    if (++done % 50 === 0) console.log(`  ${done}/${rosterEntries.length}`);
    return { detail, contract, st };
  });

  const players: SeedPlayer[] = [];
  const espnContracts = new Map<string, espn.EspnContract | null>();
  rosterEntries.forEach(({ team, a }, i) => {
    const { detail, contract, st } = details[i];
    const { lines, bySeasonTeams } = buildStats(st, abbrevByEspnId);
    const inj = a.injuries?.[0];
    const pos = (a.position?.abbreviation ?? "").split("-").filter(Boolean);
    espnContracts.set(a.id, contract);
    players.push({
      id: a.id,
      name: a.displayName,
      firstName: a.firstName,
      lastName: a.lastName,
      teamId: team.id,
      jersey: a.jersey ?? null,
      positions: pos.length ? pos : ["F"],
      heightIn: a.height ?? 78,
      weightLb: a.weight ?? 215,
      age: a.age ?? 0,
      dob: a.dateOfBirth ? a.dateOfBirth.slice(0, 10) : null,
      birthPlace: [a.birthPlace?.city, a.birthPlace?.state, a.birthPlace?.country].filter(Boolean).join(", ") || null,
      country: a.birthPlace?.country ?? detail?.citizenship ?? null,
      college: a.college?.name ?? null,
      experienceYears: a.experience?.years ?? 0,
      draft: detail?.draft
        ? { year: detail.draft.year, round: detail.draft.round, pick: detail.draft.selection, teamEspnId: espn.teamIdFromRef(detail.draft.team?.$ref) }
        : null,
      injury: inj
        ? {
            status: inj.status ?? "Out",
            type: inj.type?.description ?? inj.details?.type ?? null,
            detail: inj.shortComment ?? inj.longComment ?? inj.details?.detail ?? null,
            returnDate: inj.details?.returnDate ?? null,
          }
        : null,
      stats: lines,
      seasonsWithTeam: seasonsWithTeam(bySeasonTeams, team.espnId),
      rosterSlot: "standard",
    });
  });
  if (!players.some((p) => p.stats.length)) report.warnings.push("No stats were parsed - check ESPN stats endpoint");

  console.log("• cap sheets & pick ledgers (hoopsnightly, 1.5s spacing)");
  const capSheets = new Map<string, hn.HnCapSheet | null>();
  const ledgers = new Map<string, hn.HnPickLedger | null>();
  for (const t of teams) {
    capSheets.set(t.id, await hn.fetchCapSheet(t.hnSlug));
    ledgers.set(t.id, await hn.fetchPickLedger(t.hnSlug));
    if (!capSheets.get(t.id)) report.warnings.push(`Cap sheet unavailable for ${t.id}`);
    if (!ledgers.get(t.id)) report.warnings.push(`Pick ledger unavailable for ${t.id}`);
  }

  // ---------- contracts ----------
  console.log("• two-way tracker (Hoops Rumors)");
  const tw = await hr.fetchTwoWays();
  if (!tw) report.warnings.push("Two-way tracker unavailable - two-way players will be classed as camp deals");
  else report.warnings.push(`Two-way tracker last updated ${tw.updated ?? "?"} (${tw.entries.length} entries)`);

  console.log("• merging contracts");
  const byNorm = new Map<string, SeedPlayer[]>();
  for (const p of players) byNorm.set(normName(p.name), [...(byNorm.get(normName(p.name)) ?? []), p]);
  const lastKey = (n: string) => normName(n.replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, "").trim().split(/\s+/).slice(1).join(" "));
  const firstKey = (n: string) => normName(n.split(/\s+/)[0]);
  /** exact normalised name, then same surname + compatible first name (Rob/Robert, Ron/Ronald) */
  function matchPlayer(name: string, teamId?: string): SeedPlayer | null {
    const pool_ = (xs: SeedPlayer[]) => (teamId ? xs.filter((p) => p.teamId === teamId) : xs);
    const exact = pool_(byNorm.get(normName(name)) ?? []);
    if (exact.length === 1) return exact[0];
    const ln = lastKey(name);
    const fn = firstKey(name);
    const fuzzy = pool_(players).filter((p) => {
      if (lastKey(p.name) !== ln) return false;
      const pf = firstKey(p.name);
      return pf.startsWith(fn) || fn.startsWith(pf) || pf.slice(0, 3) === fn.slice(0, 3);
    });
    return fuzzy.length === 1 ? fuzzy[0] : null;
  }

  const twoWay = new Map<string, { twoYear: boolean; official: boolean }>();
  for (const e of tw?.entries ?? []) {
    const team = teams.find((t) => e.teamFullName.toLowerCase().endsWith(t.name.toLowerCase()));
    const p = (team && matchPlayer(e.name, team.id)) ?? matchPlayer(e.name);
    if (!p) {
      report.noContract.push(`${e.name} - two-way with ${e.teamFullName} per Hoops Rumors, not on ESPN roster`);
      continue;
    }
    if (team && p.teamId !== team.id) report.warnings.push(`${e.name}: two-way with ${team.id} per Hoops Rumors, ESPN roster ${p.teamId}`);
    twoWay.set(p.id, { twoYear: e.twoYear, official: e.official });
  }

  const contracts: SeedContract[] = [];
  const contracted = new Set<string>();
  const sameName = (a: string, b: string) => normName(a) === normName(b) || (lastKey(a) === lastKey(b) && firstKey(a).slice(0, 3) === firstKey(b).slice(0, 3));

  for (const t of teams) {
    const sheet = capSheets.get(t.id);
    if (!sheet) continue;
    for (const row of sheet.rows) {
      const seasons = sheet.seasons.filter((s) => row.cells[s]);
      if (!seasons.length) continue;
      const onTeam = matchPlayer(row.name, t.id);
      const elsewhere = onTeam ? null : matchPlayer(row.name);
      const notes: string[] = [];
      let player: SeedPlayer | null = onTeam;
      let owner = t.id;
      let deadMoney = false;
      if (!onTeam && elsewhere) {
        const newSheetHas = capSheets.get(elsewhere.teamId!)?.rows.some((r) => sameName(r.name, elsewhere.name)) ?? false;
        if (newSheetHas || twoWay.has(elsewhere.id)) {
          deadMoney = true;
          notes.push(`Former ${t.id} player now with ${elsewhere.teamId} - remaining salary treated as ${t.id} dead money`);
          report.unmatchedCapRows.push(`${row.name} - ${t.id} dead money (now ${twoWay.has(elsewhere.id) ? "two-way" : "signed"} with ${elsewhere.teamId})`);
        } else {
          player = elsewhere;
          owner = elsewhere.teamId!;
          notes.push(`Cap sheet lists him on ${t.id}; ESPN roster has him on ${owner} - contract moved with the player (verify)`);
          report.unmatchedCapRows.push(`${row.name} - ${t.id} cap sheet but ESPN roster ${owner}; contract assigned to ${owner} (verify)`);
        }
      } else if (!onTeam) {
        deadMoney = true;
        notes.push("Not on any ESPN roster - treated as dead money (waived/stretched/unsigned)");
        report.unmatchedCapRows.push(`${row.name} - on ${t.id} cap sheet but not on any ESPN roster → dead money (verify)`);
      }
      if (player && twoWay.has(player.id) && !deadMoney) continue; // two-way tracker takes priority
      if (player && contracted.has(player.id)) continue;

      const years: ContractYear[] = seasons.map((s) => {
        const c = row.cells[s];
        const opt: ContractOption = c.option === "P" ? "player" : c.option === "T" ? "team" : c.option === "ETO" ? "eto" : null;
        const exact = s === SEASON ? sheet.exact[row.name] : undefined;
        return { season: s, salary: exact ?? c.amount, guaranteed: 0, option: opt, approximate: exact == null };
      });

      const ec = player && !deadMoney ? espnContracts.get(player.id) : null;
      // Cross-check current-season salary against ESPN
      if (ec?.salary && years[0].season === SEASON) {
        const diff = Math.abs(ec.salary - years[0].salary) / Math.max(1, years[0].salary);
        if (diff > 0.02) report.salaryMismatch.push(`${row.name} (${owner}): hoopsnightly $${years[0].salary.toLocaleString()} vs ESPN $${ec.salary.toLocaleString()} - using hoopsnightly`);
        if (years[0].approximate && diff <= 0.02) {
          years[0].salary = ec.salary;
          years[0].approximate = false;
        }
      }

      // Rookie-scale deals: years 3 & 4 are team options until exercised
      const draft = deadMoney ? null : player?.draft;
      const rookieScale = !!draft && draft.round === 1 && draft.year >= SEASON_END_YEAR - 4 && draft.year <= SEASON_END_YEAR - 1;
      if (rookieScale && draft) {
        years.forEach((y) => {
          const yearOfDeal = Number(y.season.slice(0, 4)) - draft.year + 1; // 1..4
          if ((yearOfDeal === 3 || yearOfDeal === 4) && !y.option && Number(y.season.slice(0, 4)) >= 2027) y.option = "team";
        });
      }

      // Guarantees: fill years in order until the published guaranteed total is used up
      let g = row.guaranteed ?? years.reduce((s, y) => s + (y.option ? 0 : y.salary), 0);
      const tol = 150_000; // table amounts are rounded to $0.1M
      for (const y of years) {
        if (g <= tol) break;
        if (y.option === "player" || y.option === "team") break;
        y.guaranteed = g + tol >= y.salary ? y.salary : Math.max(0, Math.round(g));
        g -= y.salary;
      }
      if (deadMoney) years.forEach((y) => (y.guaranteed = y.salary));
      const nonGuaranteedYears = years.filter((y) => y.guaranteed < y.salary && !y.option).length;
      if (nonGuaranteedYears) notes.push(`${nonGuaranteedYears} season(s) not (fully) guaranteed per published guaranteed total`);

      if (ec && ec.yearsRemaining && Math.abs(ec.yearsRemaining - years.length) > 1) {
        report.optionMismatch.push(`${row.name} (${owner}): ${years.length} seasons on cap sheet vs ESPN yearsRemaining=${ec.yearsRemaining}`);
      }

      const cur = years[0].salary;
      let type: ContractType = "standard";
      if (rookieScale) type = "rookie-scale";
      else if (draft && draft.round === 2 && draft.year >= SEASON_END_YEAR - 3 && cur <= minSalaryFor(3) * 1.6) type = "second-round";
      else if (player && cur <= minSalaryFor(player.experienceYears) + 5_000) type = "minimum";

      contracts.push({
        playerId: deadMoney ? null : player?.id ?? null,
        playerName: row.name,
        teamId: owner,
        type,
        years,
        tradeKicker: ec?.tradeKicker?.active ? { pct: ec.tradeKicker.percentage, value: ec.tradeKicker.value } : null,
        noTradeClause: false,
        tradeRestricted: ec?.tradeRestriction ?? false,
        birdRights: birdFromSeasons((player?.seasonsWithTeam ?? 0) + 1),
        deadMoney,
        sources: ["hoopsnightly.com cap sheet", ...(ec ? ["ESPN contract record"] : [])],
        verified: !!onTeam && !years[0].approximate,
        notes,
      });
      if (player && !deadMoney) contracted.add(player.id);
    }
  }

  // Rostered players with no cap-sheet row: two-way (per tracker) or camp (Exhibit 10 / non-guaranteed) deals
  for (const p of players) {
    if (contracted.has(p.id)) continue;
    const ec = espnContracts.get(p.id);
    const twInfo = twoWay.get(p.id);
    p.rosterSlot = twInfo ? "two-way" : "camp";
    const salary = twInfo ? CBA_2026_27.exceptions.twoWaySalary.value : ec?.salary || minSalaryFor(p.experienceYears);
    const years: ContractYear[] = [{ season: SEASON, salary, guaranteed: 0, option: null, approximate: !twInfo && !ec?.salary }];
    if (twInfo?.twoYear) years.push({ season: "2027-28", salary: Math.round(salary * 1.07), guaranteed: 0, option: null, approximate: true });
    contracts.push({
      playerId: p.id,
      playerName: p.name,
      teamId: p.teamId!,
      type: twInfo ? "two-way" : "exhibit-10",
      years,
      tradeKicker: null,
      noTradeClause: false,
      tradeRestricted: ec?.tradeRestriction ?? false,
      birdRights: birdFromSeasons(p.seasonsWithTeam + 1),
      deadMoney: false,
      sources: twInfo ? ["Hoops Rumors two-way tracker"] : ec ? ["ESPN contract record"] : [],
      verified: !!twInfo?.official || !!ec?.salary,
      notes: [
        twInfo
          ? `Two-way contract${twInfo.twoYear ? " (2 years)" : ""}${twInfo.official ? "" : " - reported, not yet official"}`
          : "Not on published cap sheet or two-way tracker - assumed training-camp / Exhibit 10 non-guaranteed minimum deal",
      ],
    });
  }

  for (const t of teams) {
    const ps = players.filter((p) => p.teamId === t.id);
    report.roster[t.id] = {
      espn: ps.length,
      standard: ps.filter((p) => p.rosterSlot === "standard").length,
      twoWay: ps.filter((p) => p.rosterSlot === "two-way").length,
      camp: ps.filter((p) => p.rosterSlot === "camp").length,
    };
  }

  // ---------- picks ----------
  console.log("• normalising draft picks");
  // learn NBA team ids from "owed to" rows (key carries the original team's NBA id)
  for (const t of teams) {
    for (const r of ledgers.get(t.id)?.owedTo ?? []) {
      const orig = teamByName.get(r.team.toLowerCase());
      if (orig && r.originalNbaId && !orig.nbaId) orig.nbaId = r.originalNbaId;
    }
  }
  const picks: SeedPick[] = [];
  for (const t of teams) {
    const led = ledgers.get(t.id);
    if (!led) continue;
    for (const y of led.years) {
      for (const slot of y.slots) {
        const id = `${y.year}-${slot.round}-${t.id}`;
        const outRow = led.owedBy.find((r) => r.year === y.year && r.round === slot.round);
        const nameIn = (s: string) => {
          const m = s.match(/(?:to|go to)\s+(?:the\s+)?([A-Z][A-Za-z0-9 ]+?)(?:\s*$|,|\.| ·)/);
          return m ? teamByName.get(m[1].trim().toLowerCase()) ?? null : null;
        };
        const counterpart = (outRow ? teamByName.get(outRow.team.toLowerCase()) : null) ?? nameIn(slot.headline);
        const pill = slot.pill.toLowerCase();
        let owner = t.id;
        let protection: SeedPick["protection"] = { kind: "none", text: "unprotected" };
        let swap = false;
        let conditional = false;
        let frozen = false;
        let forfeited = false;
        let verified = true;
        const ownRange = slot.terms[0]?.match(/^1-(\d+) Own/);
        const hasSwap = slot.terms.some((x) => /swap|favorable/i.test(x));

        if (pill === "own") {
          owner = t.id;
        } else if (pill === "owed") {
          if (counterpart) owner = counterpart.id;
          else {
            verified = false;
            report.pickIssues.push(`${id}: owed but destination not parsed ("${slot.headline}")`);
          }
          const pt = outRow?.summary ?? "unprotected";
          protection = /unprotected/i.test(pt) ? { kind: "none", text: "unprotected" } : { kind: "complex", text: pt };
        } else if (pill === "protected") {
          const m = slot.headline.match(/(\d+)-(\d+)\s*protected/i);
          const keepTop = m && Number(m[1]) === 1 ? Number(m[2]) : ownRange ? Number(ownRange[1]) : null;
          if (counterpart) {
            owner = counterpart.id;
            protection = keepTop ? { kind: "top", keepTop, text: `top-${keepTop} protected` } : { kind: "range", text: slot.headline };
          } else {
            // protected + swap chain: the original team keeps it inside the protected range, otherwise terms decide
            swap = hasSwap;
            protection = { kind: "complex", keepTop: keepTop ?? undefined, text: slot.terms.join(" ") };
            report.complexPicks.push(`${id} (protected, multi-team): ${slot.terms.join(" ")}`);
          }
        } else if (pill === "frozen") {
          frozen = true;
          protection = { kind: "none", text: slot.terms.join("; ") || "frozen by the league" };
        } else if (pill === "forfeited") {
          forfeited = true;
          protection = { kind: "complex", keepTop: ownRange ? Number(ownRange[1]) : undefined, text: slot.terms.join(" ") };
          report.complexPicks.push(`${id} (forfeited): ${slot.terms.join(" ")}`);
        } else if (pill === "swap") {
          swap = true;
          protection = { kind: "complex", text: slot.terms.join("; ") || slot.headline };
          report.complexPicks.push(`${id} (swap): ${slot.terms.join("; ")}`);
        } else if (pill === "conditional") {
          conditional = true;
          if (counterpart && slot.held === 0) owner = counterpart.id;
          protection = { kind: "complex", text: slot.terms.join("; ") || slot.headline };
          report.complexPicks.push(`${id} (conditional): ${slot.terms.join("; ")}`);
        } else {
          verified = false;
          protection = { kind: "complex", text: `${slot.pill}: ${slot.headline}; ${slot.terms.join("; ")}` };
          report.pickIssues.push(`${id}: unrecognised status "${slot.pill}"`);
        }
        if (protection.kind === "complex" && !swap && !conditional) report.complexPicks.push(`${id}: ${protection.text}`);

        picks.push({
          id,
          year: y.year,
          round: slot.round,
          originalTeam: t.id,
          owner,
          protection,
          swap,
          conditional,
          frozen,
          forfeited,
          projectedPick: slot.projectedPick,
          terms: slot.terms,
          verified,
        });
      }
    }
  }
  // cross-check: every conveyed pick should appear on the receiving team's "owed to" list
  for (const p of picks) {
    if (p.owner === p.originalTeam || p.swap || p.forfeited) continue;
    const orig = teams.find((t) => t.id === p.originalTeam)!;
    const rec = ledgers.get(p.owner)?.owedTo ?? [];
    const found = rec.some((r) => r.year === p.year && r.round === p.round && (r.team.toLowerCase() === orig.name.toLowerCase() || r.originalNbaId === orig.nbaId));
    if (!found) {
      p.verified = false;
      report.pickIssues.push(`${p.id} → ${p.owner}: not found on ${p.owner}'s incoming list`);
    }
  }

  // ---------- write ----------
  const cba = { ...CBA_2026_27, generatedAt: report.fetchedAt };
  await writeFile(path.join(OUT, "teams.json"), JSON.stringify(teams, null, 1));
  await writeFile(path.join(OUT, "players.json"), JSON.stringify(players, null, 1));
  await writeFile(path.join(OUT, "contracts.json"), JSON.stringify(contracts, null, 1));
  await writeFile(path.join(OUT, "draftPicks.json"), JSON.stringify(picks, null, 1));
  await writeFile(path.join(OUT, "cba.json"), JSON.stringify(cba, null, 1));
  await writeFile(path.join(OUT, "DATA_REPORT.md"), renderReport(teams, players, contracts, picks));
  console.log(
    `\n✓ ${teams.length} teams, ${players.length} players, ${contracts.length} contracts, ${picks.length} picks` +
      `\n  http: ${httpStats.network} network, ${httpStats.cached} cached, ${httpStats.blocked.length} robots-blocked, ${httpStats.failed.length} failed`,
  );
}

function list(items: string[], empty = "_None._"): string {
  return items.length ? items.map((s) => `- ${s}`).join("\n") : empty;
}

function renderReport(teams: SeedTeam[], players: SeedPlayer[], contracts: SeedContract[], picks: SeedPick[]): string {
  const unverifiedCba: string[] = [];
  const walk = (o: unknown, p: string) => {
    if (!o || typeof o !== "object") return;
    const r = o as Record<string, unknown>;
    if (r.verified === false) unverifiedCba.push(`\`${p}\` - ${String(r.source ?? "")}`);
    for (const [k, v] of Object.entries(r)) if (v && typeof v === "object" && !Array.isArray(v)) walk(v, p ? `${p}.${k}` : k);
  };
  walk(CBA_2026_27, "");
  const payroll = teams.map((t) => {
    const sum = contracts.filter((c) => c.teamId === t.id && c.type !== "two-way" && c.type !== "exhibit-10").reduce((s, c) => s + (c.years.find((y) => y.season === SEASON)?.salary ?? 0), 0);
    const r = report.roster[t.id];
    return `| ${t.id} | ${t.fullName} | ${t.conference} | ${t.division} | ${r?.espn ?? 0} | ${r?.standard ?? 0} | ${r?.twoWay ?? 0} | ${r?.camp ?? 0} | $${(sum / 1e6).toFixed(1)}M |`;
  });
  const approx = contracts.reduce((n, c) => n + c.years.filter((y) => y.approximate).length, 0);
  const totalYears = contracts.reduce((n, c) => n + c.years.length, 0);
  return `# Data report

Fetched: **${report.fetchedAt}** · Season: **${SEASON}** · Regenerate with \`npm run refresh-data\`.

## Sources

| Data | Source | Notes |
|---|---|---|
| Teams, head coaches, rosters, bio (age, DOB, height, weight, college, birthplace, experience), injuries | ESPN public API (\`site.api.espn.com\`) | No robots.txt restrictions on API hosts |
| Draft slot, current-season contract record (salary, trade kicker, trade restriction) | ESPN core API (\`sports.core.api.espn.com\`) | |
| Last 3 seasons of regular-season stats | ESPN web API (\`site.web.api.espn.com\`) | |
| Multi-year salaries, player/team options, guaranteed totals | hoopsnightly.com team cap pages | robots.txt explicitly allows Claude agents |
| Two-way contracts | Hoops Rumors 2026/27 two-way tracker | robots.txt allows; crawl-delay honoured |
| Hard caps & exception usage (2026-27) | Hoops Rumors "NBA Teams With Hard Caps For 2026/27" | |
| 2025-26 final standings | ESPN standings API | |
| Draft picks 2027-2033 (ownership, protections, swaps) | hoopsnightly.com team draft-pick ledgers | "verified weekly against the trade record" |
| CBA figures | NBA.com / Hoops Rumors (announced 2026-06-30) | see cba.json \`source\` fields |

**Not used (blocked or disallowed):** Basketball-Reference, Spotrac, RealGM (HTTP 403 to automated requests / robots.txt disallows AI agents), HoopsHype (robots.txt disallows Claude), NBA.com stats (robots.txt disallows AI agents).

## Summary

- ${teams.length} teams · ${players.length} rostered players · ${contracts.length} contracts · ${picks.length} pick records
- ${approx} of ${totalYears} contract-seasons are **approximate** (future years published rounded to $0.1M)
- ${picks.filter((p) => !p.verified).length} pick records failed cross-verification · ${report.complexPicks.length} have complex/conditional terms kept as text

| Team | Name | Conf | Division | ESPN roster | Standard | Two-way | Camp | 2026-27 payroll* |
|---|---|---|---|---|---|---|---|---|
${payroll.join("\n")}

\\* sum of standard contracts incl. dead money; excludes two-way/camp deals and cap holds.

## ⚠ Items to verify manually

### Warnings
${list(report.warnings)}

### Cap-sheet rows not matched to a rostered player (dead money / waived / name mismatch)
${list(report.unmatchedCapRows)}

### Two-way / contract records that could not be matched
${list(report.noContract)}

### Current-season salary disagreements (>2%) between hoopsnightly and ESPN
${list(report.salaryMismatch)}

### Contract length disagreements between sources
${list(report.optionMismatch)}

### Draft-pick records that failed cross-verification
${list(report.pickIssues)}

### Complex / conditional pick terms (stored verbatim, simplified in the engine)
${list(report.complexPicks)}

### Fields not available from any allowed source (defaults used)
- **No-trade clauses**: not published by the sources used → all set to \`false\`. Known NTCs must be set by hand in contracts.json.
- **Trade kickers**: from ESPN contract records only; may be incomplete.
- **Bird rights**: derived from consecutive seasons with current team in ESPN stat rows (traded players keep Bird rights under the CBA - edit manually if needed).
- **ETO (early termination)**: only where the cap sheet marks it.
- **Future-year salaries**: rounded to $0.1M on the source; flagged \`approximate: true\`.
- **Rookie-scale years 3-4**: marked as team options when the player was drafted in the 1st round 2023-2026 and no option decision is published.

### CBA figures not confirmed against a 2026 publication
${list(unverifiedCba)}
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
