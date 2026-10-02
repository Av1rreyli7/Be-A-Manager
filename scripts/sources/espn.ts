/**
 * ESPN public JSON APIs (site.api / sports.core.api / site.web.api). These hosts publish no
 * robots.txt restrictions; requests are rate-limited in lib/http.ts.
 */
import { getJson } from "../lib/http";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba";
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba";

/** ESPN labels a season by the year it ends: 2027 === 2026-27. */
export const CURRENT_SEASON_YEAR = 2027;

export interface EspnTeam {
  id: string;
  abbreviation: string;
  location: string;
  name: string;
  displayName: string;
  color?: string;
  alternateColor?: string;
  divisionId: string | null;
  conferenceId: string | null;
  venue: string | null;
}

export async function fetchTeams(): Promise<EspnTeam[]> {
  const list = await getJson<any>(`${SITE}/teams`);
  if (!list) throw new Error("ESPN team list unavailable");
  const teams = list.sports[0].leagues[0].teams.map((t: any) => t.team);
  const out: EspnTeam[] = [];
  for (const t of teams) {
    const detail = await getJson<any>(`${SITE}/teams/${t.id}`);
    const g = detail?.team?.groups;
    out.push({
      id: String(t.id),
      abbreviation: t.abbreviation,
      location: t.location,
      name: t.name,
      displayName: t.displayName,
      color: t.color,
      alternateColor: t.alternateColor,
      divisionId: g?.id ?? null,
      conferenceId: g?.parent?.id ?? null,
      venue: detail?.team?.franchise?.venue?.fullName ?? null,
    });
  }
  return out;
}

export async function fetchGroupName(groupId: string): Promise<string | null> {
  const g = await getJson<any>(`${CORE}/seasons/${CURRENT_SEASON_YEAR}/types/2/groups/${groupId}`);
  return g?.name ?? null;
}

export interface EspnRosterAthlete {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  weight?: number;
  height?: number;
  age?: number;
  dateOfBirth?: string;
  birthPlace?: { city?: string; state?: string; country?: string };
  college?: { name?: string };
  jersey?: string;
  position?: { abbreviation?: string; displayName?: string };
  injuries?: { status?: string; date?: string; type?: { description?: string }; details?: any; shortComment?: string; longComment?: string }[];
  experience?: { years?: number };
  status?: { type?: string };
}

export async function fetchRoster(teamEspnId: string): Promise<{ season: string; athletes: EspnRosterAthlete[]; coach: { name: string; experience: number } | null }> {
  const r = await getJson<any>(`${SITE}/teams/${teamEspnId}/roster`);
  if (!r) throw new Error(`ESPN roster unavailable for team ${teamEspnId}`);
  const c = r.coach?.[0];
  return {
    season: r.season?.displayName ?? "?",
    athletes: r.athletes ?? [],
    coach: c ? { name: `${c.firstName} ${c.lastName}`.trim(), experience: Number(c.experience) || 0 } : null,
  };
}

export interface EspnAthleteDetail {
  draft?: { year: number; round: number; selection: number; team?: { $ref: string } };
  debutYear?: number;
  citizenship?: string;
}

export async function fetchAthlete(id: string): Promise<EspnAthleteDetail | null> {
  return getJson<EspnAthleteDetail>(`${CORE}/athletes/${id}`);
}

export interface EspnContract {
  salary: number;
  yearsRemaining: number;
  optionType: number;
  birdStatus: number;
  minimumSalaryException: boolean;
  tradeRestriction: boolean;
  tradeKicker?: { active: boolean; percentage: number; value: number };
  unsignedForeignPick?: boolean;
  active?: boolean;
  team?: { $ref: string };
}

export async function fetchContract(id: string, seasonYear = CURRENT_SEASON_YEAR): Promise<EspnContract | null> {
  return getJson<EspnContract>(`${CORE}/athletes/${id}/contracts/${seasonYear}`);
}

export interface EspnStatRow {
  teamId?: string;
  teamSlug?: string;
  season: { year: number; displayName: string };
  stats: string[];
}
export interface EspnStats {
  categories: { name: string; names: string[]; statistics: EspnStatRow[] }[];
}

export async function fetchStats(id: string): Promise<EspnStats | null> {
  return getJson<EspnStats>(`${WEB}/athletes/${id}/stats`);
}

export function teamIdFromRef(ref: string | undefined): string | null {
  const m = ref?.match(/teams\/(\d+)/);
  return m ? m[1] : null;
}

/** Final standings of a completed season (ESPN labels seasons by end year). */
export async function fetchStandings(seasonYear: number): Promise<Record<string, { w: number; l: number; seed: number | null }> | null> {
  const d = await getJson<any>(`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${seasonYear}`);
  if (!d?.children) return null;
  const out: Record<string, { w: number; l: number; seed: number | null }> = {};
  for (const c of d.children) {
    for (const e of c.standings?.entries ?? []) {
      const stat = (n: string) => e.stats.find((s: any) => s.name === n)?.value;
      out[String(e.team.id)] = { w: Number(stat("wins")) || 0, l: Number(stat("losses")) || 0, seed: Number(stat("playoffSeed")) || null };
    }
  }
  return out;
}
