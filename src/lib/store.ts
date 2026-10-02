"use client";
/**
 * Game store. The league is mutated in place by engine functions (fast, no copying); `version` bumps
 * after every change so subscribed components re-render. Multi-day sims run in the Web Worker.
 */
import { create } from "zustand";
import type { BoxScore, League, TeamId } from "@/engine/types/game";
import { recordPlayedGame, type SimTarget, type DayReport } from "@/engine/league/advance";
import type { WorkerOk, WorkerRequest, WorkerResponse } from "@/worker/sim.worker";
import { saveLeague, loadSave } from "./db";
import { touch } from "@/engine/league/helpers";
import { computeAlerts } from "@/engine/league/alerts";
import { migrateLeague } from "@/engine/league/migrate";
import { createSimWorker } from "./workerFactory";
import ratingOverrides from "../../data/ratingOverrides.json";
import seedTeams from "../../data/teams.json";
import { applyOps, diff, snapshotFor, type Op } from "./online/diff";
import type { OnlineState } from "./online/session";

/** Heavy collections only the host's sims change - skipped when diffing a guest/host UI action. */
const SIM_ONLY = ["boxScores", "gameLog", "schedule"];
let changeSink: ((ops: Op[]) => void) | null = null;
/** Online play: receives every local change as patch ops (null when offline). */
export function setChangeSink(fn: ((ops: Op[]) => void) | null) {
  changeSink = fn;
}
/** Online guests: sends a hand-played game result to the host (set by the online session). */
let gameSubmitter: ((gameId: string, box: BoxScore) => Promise<string | null>) | null = null;
export function setGameSubmitter(fn: typeof gameSubmitter) {
  gameSubmitter = fn;
}

const lastSeasonWinPct: Record<string, number> = Object.fromEntries(
  (seedTeams as { id: string; prevRecord: { w: number; l: number } | null }[]).filter((t) => t.prevRecord).map((t) => [t.id, t.prevRecord!.w / (t.prevRecord!.w + t.prevRecord!.l)]),
);

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
type Req = DistributiveOmit<WorkerRequest, "id">;

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: WorkerOk) => void; reject: (e: Error) => void; onProgress?: (p: { date: string; games: number }) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = createSimWorker();
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if ("progress" in msg) return p.onProgress?.(msg.progress);
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg as WorkerOk);
      else p.reject(new Error(msg.error));
    };
  }
  return worker;
}

export function callWorker(req: Req, onProgress?: (p: { date: string; games: number }) => void): Promise<WorkerOk> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ ...req, id } as WorkerRequest);
  });
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "success" | "error";
}

interface GameState {
  league: League | null;
  version: number;
  team: TeamId | null; // active user team
  busy: string | null;
  progress: string | null;
  lastReports: DayReport[];
  toasts: Toast[];
  online: OnlineState | null;
  /** online guests: league received from the host (not saved locally) */
  setRemoteLeague: (l: League, team: TeamId) => void;
  /** online: apply a patch that came over the network */
  applyRemote: (ops: Op[]) => void;
  setLeague: (l: League | null) => void;
  mutate: (fn: (l: League) => void) => void;
  sim: (target: SimTarget) => Promise<void>;
  /** Record a game played by hand in Hardwood Legends. Resolves to an error message, or null when it counted. */
  recordGame: (gameId: string, box: BoxScore) => Promise<string | null>;
  advancePhase: () => Promise<void>;
  load: (id: string) => Promise<boolean>;
  saveNow: () => Promise<void>;
  setTeam: (t: TeamId) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
}

function scheduleSave(l: League) {
  if (useGame.getState().online?.role === "guest") return; // the host keeps the save
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveLeague(l).catch(() => undefined), 800);
}

export const useGame = create<GameState>((set, get) => ({
  league: null,
  version: 0,
  team: null,
  busy: null,
  progress: null,
  lastReports: [],
  toasts: [],
  online: null,
  setRemoteLeague: (l, team) => {
    set({ league: l, team, version: get().version + 1 });
  },
  applyRemote: (ops) => {
    const l = get().league;
    if (!l || !ops.length) return;
    applyOps(l, ops);
    touch(l);
    computeAlerts(l);
    set({ version: get().version + 1 });
    scheduleSave(l);
  },
  setLeague: (l) => {
    if (l) migrateLeague(l, ratingOverrides as unknown as Record<string, number>, lastSeasonWinPct);
    const pref = l?.online?.hostTeam ?? get().team;
    set({ league: l, version: get().version + 1, team: l ? (pref && l.userTeams.includes(pref) ? pref : l.userTeams[0]) : null });
    if (l) scheduleSave(l);
  },
  mutate: (fn) => {
    const l = get().league;
    if (!l) return;
    const before = changeSink ? snapshotFor(l, SIM_ONLY) : null;
    fn(l);
    touch(l);
    computeAlerts(l);
    set({ version: get().version + 1 });
    scheduleSave(l);
    if (before && changeSink) {
      const ops = diff(before, l, SIM_ONLY);
      if (ops.length) changeSink(ops);
    }
  },
  sim: async (target) => {
    const l = get().league;
    if (!l || get().busy) return;
    if (get().online?.role === "guest") return get().toast("Only the host can sim in an online league", "error");
    set({ busy: `Simulating…`, progress: null });
    try {
      const res = await callWorker({ cmd: "sim", league: l, target, team: get().team ?? undefined }, (p) => set({ progress: p.date }));
      const reports = res.reports ?? [];
      set({ league: res.league!, version: get().version + 1, lastReports: reports, busy: null, progress: null });
      scheduleSave(res.league!);
      if (changeSink) changeSink(diff(l, res.league!));
      const stop = reports.find((r) => r.stop && r.stop !== "Season complete")?.stop;
      if (stop) get().toast(stop, "error");
    } catch (e) {
      set({ busy: null, progress: null });
      get().toast(`Sim failed: ${(e as Error).message.split("\n")[0]}`, "error");
      console.error(e);
    }
  },
  recordGame: async (gameId, box) => {
    const l = get().league;
    if (!l) return "No league is loaded.";
    if (get().online?.role === "guest") {
      if (!gameSubmitter) return "You're not connected to the host, so the result couldn't be sent.";
      return gameSubmitter(gameId, box);
    }
    if (get().busy) return "The league is simming right now, so the simmed result counts.";
    // full diff (schedule, box scores and game logs included) so friends get the result too
    const before = changeSink ? snapshotFor(l, []) : null;
    const err = recordPlayedGame(l, gameId, box);
    if (err) return err;
    touch(l);
    set({ version: get().version + 1 });
    scheduleSave(l);
    if (before && changeSink) changeSink(diff(before, l));
    return null;
  },
  advancePhase: async () => {
    const l = get().league;
    if (!l || get().busy) return;
    if (get().online?.role === "guest") return get().toast("Only the host can advance the league", "error");
    set({ busy: "Advancing…" });
    try {
      const res = await callWorker({ cmd: "phase", league: l });
      set({ league: res.league!, version: get().version + 1, busy: null });
      scheduleSave(res.league!);
      if (changeSink) changeSink(diff(l, res.league!));
      if (res.message) get().toast(res.message, "success");
    } catch (e) {
      set({ busy: null });
      get().toast(`Failed: ${(e as Error).message.split("\n")[0]}`, "error");
      console.error(e);
    }
  },
  load: async (id) => {
    const l = await loadSave(id);
    if (!l) return false;
    get().setLeague(l);
    if (typeof window !== "undefined") localStorage.setItem("fo:lastSave", id);
    return true;
  },
  saveNow: async () => {
    const l = get().league;
    if (l) {
      await saveLeague(l);
      get().toast("Game saved", "success");
    }
  },
  setTeam: (t) => set({ team: t, version: get().version + 1 }),
  toast: (text, kind = "info") => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, text, kind }] });
    setTimeout(() => get().dismissToast(id), 4500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Subscribe to the league (re-renders on every mutation). */
export function useLeague(): League {
  const league = useGame((s) => s.league);
  useGame((s) => s.version);
  return league as League;
}

/** Is this team controlled by the person at this screen? (online: only their own team) */
export function isMine(l: League, teamId: TeamId | null | undefined): boolean {
  if (!teamId) return false;
  if (l.online) return teamId === useGame.getState().team;
  return l.userTeams.includes(teamId);
}

export function useIsOnlineGuest(): boolean {
  return useGame((s) => s.online?.role === "guest");
}

export function useTeamId(): TeamId {
  return useGame((s) => s.team) ?? "";
}

// dev-only handle for debugging in the browser console
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __fo: typeof useGame }).__fo = useGame;
