/// <reference lib="webworker" />
/**
 * Simulation worker: all multi-day sims, phase transitions and heavy AI searches run here so the UI
 * never blocks. The main thread sends the league (structured clone) and receives the updated league.
 */
import type { League, TeamId } from "../engine/types/game";
import { advancePhase, simTo, type DayReport, type SimTarget } from "../engine/league/advance";
import { createLeague, type SeedData } from "../engine/league/init";
import type { Settings } from "../engine/types/game";
import { findOffers, findPlayers, whatWouldItTakeWithReason } from "../engine/trade/ai";

export type WorkerRequest =
  | { id: number; cmd: "sim"; league: League; target: SimTarget; team?: TeamId }
  | { id: number; cmd: "phase"; league: League }
  | { id: number; cmd: "new"; seed: SeedData; userTeams: TeamId[]; name: string; settings?: Partial<Settings> }
  | { id: number; cmd: "findOffers"; league: League; playerIds: string[]; pickIds?: string[]; team: TeamId }
  | { id: number; cmd: "whatWouldItTake"; league: League; target: string; team: TeamId }
  | { id: number; cmd: "findPlayers"; league: League; team: TeamId; filter: { pos?: string; maxSalary?: number; minOvr?: number } };

export interface WorkerOk {
  id: number;
  ok: true;
  league?: League;
  result?: unknown;
  reports?: DayReport[];
  message?: string;
}
export type WorkerResponse =
  | WorkerOk
  | { id: number; ok: false; error: string }
  | { id: number; progress: { date: string; games: number } };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    switch (req.cmd) {
      case "sim": {
        let n = 0;
        const reports = simTo(
          req.league,
          req.target,
          (r) => {
            if (++n % 3 === 0) ctx.postMessage({ id: req.id, progress: { date: r.date, games: r.games } } satisfies WorkerResponse);
          },
          { team: req.team },
        );
        ctx.postMessage({ id: req.id, ok: true, league: req.league, reports: reports.map((r) => ({ ...r })) } satisfies WorkerResponse);
        break;
      }
      case "phase": {
        const message = advancePhase(req.league);
        ctx.postMessage({ id: req.id, ok: true, league: req.league, message } satisfies WorkerResponse);
        break;
      }
      case "new": {
        const league = createLeague(req.seed, { userTeams: req.userTeams, name: req.name, settings: req.settings });
        ctx.postMessage({ id: req.id, ok: true, league } satisfies WorkerResponse);
        break;
      }
      case "findOffers":
        ctx.postMessage({ id: req.id, ok: true, result: findOffers(req.league, req.playerIds, req.team, 20, req.pickIds ?? []) } satisfies WorkerResponse);
        break;
      case "whatWouldItTake":
        ctx.postMessage({ id: req.id, ok: true, result: whatWouldItTakeWithReason(req.league, req.target, req.team) } satisfies WorkerResponse);
        break;
      case "findPlayers":
        ctx.postMessage({ id: req.id, ok: true, result: findPlayers(req.league, req.team, req.filter).map((x) => ({ playerId: x.player.id, offer: x.offer })) } satisfies WorkerResponse);
        break;
    }
  } catch (err) {
    ctx.postMessage({ id: req.id, ok: false, error: (err as Error).stack ?? String(err) } satisfies WorkerResponse);
  }
};
