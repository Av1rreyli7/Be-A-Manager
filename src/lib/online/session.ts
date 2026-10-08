"use client";
/**
 * Online league session. The host's browser owns the league (sims, saves) and relays every change;
 * guests control one team each and send their changes to the host as patches.
 */
import type { BoxScore, League, Settings, TeamId } from "@/engine/types/game";
import { setIdSalt } from "@/engine/league/helpers";
import { saveLeague } from "@/lib/db";
import { loadSeed } from "@/lib/seed";
import { callWorker, useGame, setChangeSink, setGameSubmitter } from "@/lib/store";
import type { Op } from "./diff";
import { ClientNet, HostNet, makeCode, normalizeCode } from "./net";

export interface Member {
  connId: string; // "host" for the host
  name: string;
  team: TeamId | null;
  online: boolean;
  host?: boolean;
}

export interface Lobby {
  code: string;
  started: boolean;
  leagueName: string;
  salaryCap: boolean;
  members: Member[];
}

export interface OnlineState {
  role: "host" | "guest";
  code: string;
  name: string;
  status: "connecting" | "lobby" | "playing" | "disconnected";
  lobby: Lobby | null;
  error?: string;
  /** the room could not reach the matchmaking server: it runs on this device only, nobody can join */
  local?: boolean;
}

type ToHost = { k: "hello"; name: string } | { k: "claim"; team: TeamId } | { k: "patch"; ops: Op[] } | { k: "played"; req: number; gameId: string; box: BoxScore };
type ToGuest = { k: "lobby"; lobby: Lobby } | { k: "league"; league: League; team: TeamId } | { k: "patch"; ops: Op[] } | { k: "error"; text: string } | { k: "playedAck"; req: number; error: string | null };

const GUEST_KEY = "fo:guest";
let host: HostNet | null = null;
let guest: ClientNet | null = null;
/** the connection currently being opened (so a second join attempt can cancel it) */
let joining: ClientNet | null = null;
let lobby: Lobby | null = null;
const queued: { from: string; ops: Op[] }[] = [];

const store = () => useGame.getState();
const setOnline = (o: Partial<OnlineState> | null) => {
  const cur = store().online;
  useGame.setState({ online: o === null ? null : ({ ...(cur ?? {}), ...o } as OnlineState) });
};

export function savedGuestSession(): { code: string; name: string } | null {
  try {
    const raw = sessionStorage.getItem(GUEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- host

function pushLobby() {
  if (!lobby) return;
  lobby = { ...lobby, members: [...lobby.members] };
  setOnline({ lobby });
  if (host) void host.broadcast({ k: "lobby", lobby } satisfies ToGuest);
}

function takenTeams(): Set<TeamId> {
  const l = store().league;
  const s = new Set<TeamId>();
  if (lobby?.started && l?.online) for (const t of Object.keys(l.online.members)) s.add(t);
  for (const m of lobby?.members ?? []) if (m.team) s.add(m.team);
  return s;
}

function applyFromGuest(from: string, ops: Op[]) {
  store().applyRemote(ops);
  void host?.broadcast({ k: "patch", ops } satisfies ToGuest, from);
}

function flushQueue() {
  if (store().busy) return;
  while (queued.length) {
    const q = queued.shift()!;
    applyFromGuest(q.from, q.ops);
  }
}

function wireHost(h: HostNet) {
  h.onJoin = () => undefined;
  h.onLeave = (connId) => {
    const m = lobby?.members.find((x) => x.connId === connId);
    if (m) {
      m.online = false;
      pushLobby();
    }
  };
  h.onError = (text) => store().toast(text, "error");
  h.onMessage = (connId, raw) => {
    const msg = raw as ToHost;
    if (!lobby) return;
    if (msg.k === "hello") {
      const name = String(msg.name || "Guest").slice(0, 24);
      // rejoin: the same name takes back their seat (a refresh can arrive before the old connection times out)
      const back = lobby.members.find((m) => !m.host && m.name.toLowerCase() === name.toLowerCase());
      if (lobby.members[0]?.name.toLowerCase() === name.toLowerCase()) {
        void h.send(connId, { k: "error", text: `“${name}” is the host's name - pick another name.` } satisfies ToGuest);
        return;
      }
      if (back) {
        back.connId = connId;
        back.online = true;
      } else lobby.members.push({ connId, name, team: null, online: true });
      pushLobby();
      const me = lobby.members.find((m) => m.connId === connId)!;
      const l = store().league;
      if (lobby.started && l && me.team) void h.send(connId, { k: "league", league: l, team: me.team } satisfies ToGuest);
      return;
    }
    const me = lobby.members.find((m) => m.connId === connId);
    if (!me) return;
    if (msg.k === "claim") {
      const l = store().league;
      if (me.team && lobby.started) return; // teams are locked once the league has started
      if (takenTeams().has(msg.team) && me.team !== msg.team) {
        void h.send(connId, { k: "error", text: "That team is already taken." } satisfies ToGuest);
        return;
      }
      me.team = msg.team;
      if (lobby.started && l) {
        // late joiner: their team becomes human-controlled
        store().mutate((lg) => {
          if (!lg.userTeams.includes(msg.team)) lg.userTeams.push(msg.team);
          if (lg.online) lg.online.members[msg.team] = me.name;
        });
        void h.send(connId, { k: "league", league: store().league!, team: msg.team } satisfies ToGuest);
      }
      pushLobby();
      return;
    }
    if (msg.k === "played") {
      void (async () => {
        const reply = (error: string | null) => void h.send(connId, { k: "playedAck", req: msg.req, error } satisfies ToGuest);
        const g = store().league?.schedule.find((x) => x.id === msg.gameId);
        if (!lobby?.started || !g) return reply("That game isn't on the schedule.");
        if (me.team !== g.home && me.team !== g.away) return reply("That isn't your game.");
        // the host's sim wins: wait for any running sim, then the game only counts if it is still unplayed
        while (store().busy) await new Promise((r) => setTimeout(r, 200));
        if (g.played) return reply("The host simmed this game while you were playing, so the simmed result counts.");
        reply(await store().recordGame(msg.gameId, msg.box));
      })();
      return;
    }
    if (msg.k === "patch") {
      if (!lobby.started) return;
      if (store().busy) queued.push({ from: connId, ops: msg.ops });
      else applyFromGuest(connId, msg.ops);
    }
  };
}

function hostSink(ops: Op[]) {
  void host?.broadcast({ k: "patch", ops } satisfies ToGuest);
}

/**
 * Create a game: open a room with a code friends can join. Playing alone is the same room, started with nobody
 * else in it. When the matchmaking server cannot be reached the room still opens, on this device only.
 */
export async function hostCreate(opts: { name: string; team?: TeamId | null; leagueName: string; salaryCap: boolean }) {
  leaveOnline();
  const code = makeCode();
  setOnline({ role: "host", code, name: opts.name, status: "connecting", lobby: null, error: undefined, local: false });
  const h = new HostNet();
  wireHost(h);
  let local = false;
  try {
    await h.start(code);
    host = h;
  } catch (e) {
    h.close();
    local = true;
    setOnline({ error: `${(e as Error).message} You can still play on your own.` });
  }
  lobby = { code, started: false, leagueName: opts.leagueName, salaryCap: opts.salaryCap, members: [{ connId: "host", name: opts.name, team: opts.team ?? null, online: true, host: true }] };
  setOnline({ status: "lobby", lobby, local });
}

export function hostSetOptions(o: Partial<Pick<Lobby, "leagueName" | "salaryCap">> & { team?: TeamId }) {
  if (!lobby || lobby.started) return;
  if (o.team) {
    const taken = lobby.members.some((m) => !m.host && m.team === o.team);
    if (!taken) lobby.members[0].team = o.team;
  }
  if (o.leagueName != null) lobby.leagueName = o.leagueName;
  if (o.salaryCap != null) lobby.salaryCap = o.salaryCap;
  pushLobby();
}

export function hostKick(connId: string) {
  if (!lobby) return;
  lobby.members = lobby.members.filter((m) => m.connId !== connId || m.host);
  pushLobby();
}

/**
 * Start the game. With friends in the room: the league is created with every claimed team human-controlled and
 * sent to everyone. Alone in the room: a normal league on this device (no room behind it), with the extra teams
 * and commissioner powers a solo player may ask for. Returns "solo" or "online".
 */
export async function hostStart(baseSettings: Settings, solo?: { extraTeams?: TeamId[]; commissioner?: boolean }): Promise<"solo" | "online" | null> {
  if (!lobby || !lobby.members[0].team) return null;
  const hostTeam = lobby.members[0].team;
  if (!host || lobby.members.length === 1) {
    const seed = await loadSeed();
    const userTeams = [hostTeam, ...(solo?.extraTeams ?? []).filter((t) => t !== hostTeam)];
    const res = await callWorker({ cmd: "new", seed, userTeams, name: lobby.leagueName || "My League", settings: { ...baseSettings, salaryCap: lobby.salaryCap, commissioner: !!solo?.commissioner } });
    const l = res.league as League;
    await saveLeague(l);
    store().setLeague(l);
    localStorage.setItem("fo:lastSave", l.id);
    leaveOnline();
    return "solo";
  }
  if (!host) return null;
  const seated = lobby.members.filter((m) => m.team);
  const userTeams = [...new Set(seated.map((m) => m.team!))];
  const seed = await loadSeed();
  const res = await callWorker({ cmd: "new", seed, userTeams: [hostTeam, ...userTeams.filter((t) => t !== hostTeam)], name: lobby.leagueName || "Friends League", settings: { ...baseSettings, salaryCap: lobby.salaryCap, commissioner: false } });
  const l = res.league as League;
  l.online = { code: lobby.code, hostTeam, startSeason: l.season, members: Object.fromEntries(seated.map((m) => [m.team!, m.name])) };
  lobby.members = lobby.members.filter((m) => m.host || m.team); // guests without a team drop out
  lobby.started = true;
  await saveLeague(l);
  store().setLeague(l);
  useGame.setState({ team: hostTeam });
  localStorage.setItem("fo:lastSave", l.id);
  setChangeSink(hostSink);
  setOnline({ status: "playing" });
  pushLobby();
  for (const m of lobby.members) if (!m.host && m.online && m.team) void host.send(m.connId, { k: "league", league: l, team: m.team } satisfies ToGuest);
  return "online";
}

/** Re-open the room for a saved online league (host only). */
export async function hostResume() {
  const l = store().league;
  if (!l?.online) return;
  leaveOnline(false);
  const code = l.online.code;
  setOnline({ role: "host", code, name: l.online.members[l.online.hostTeam] ?? "Host", status: "connecting", lobby: null, error: undefined });
  const h = new HostNet();
  wireHost(h);
  try {
    await h.start(code);
  } catch (e) {
    setOnline({ status: "disconnected", error: (e as Error).message });
    store().toast((e as Error).message, "error");
    return;
  }
  host = h;
  lobby = {
    code,
    started: true,
    leagueName: l.name,
    salaryCap: l.settings.salaryCap,
    members: Object.entries(l.online.members).map(([team, name]) => (team === l.online!.hostTeam ? { connId: "host", name, team, online: true, host: true } : { connId: `off-${team}`, name, team, online: false })),
  };
  lobby.members.sort((a, b) => Number(!!b.host) - Number(!!a.host));
  useGame.setState({ team: l.online.hostTeam });
  setChangeSink(hostSink);
  setOnline({ status: "playing", lobby });
}

// ---------------------------------------------------------------- guest

export async function guestJoin(codeRaw: string, name: string) {
  const code = normalizeCode(codeRaw);
  // already connected/connecting to this room as this name: nothing to do
  const cur = store().online;
  if ((joining || guest) && cur?.role === "guest" && cur.code === code && cur.name === name && cur.status !== "disconnected") return;
  leaveOnline(false);
  setOnline({ role: "guest", code, name, status: "connecting", lobby: null, error: undefined });
  const c = new ClientNet();
  joining = c;
  c.onMessage = (raw) => {
    if (guest !== c) return; // a stale connection
    const msg = raw as ToGuest;
    if (msg.k === "lobby") setOnline({ lobby: msg.lobby, status: store().online?.status === "playing" ? "playing" : "lobby" });
    else if (msg.k === "error") {
      setOnline({ error: msg.text });
      store().toast(msg.text, "error");
    } else if (msg.k === "league") {
      setIdSalt("~" + Math.random().toString(36).slice(2, 6));
      store().setRemoteLeague(msg.league, msg.team);
      setChangeSink((ops) => void guest?.send({ k: "patch", ops } satisfies ToHost));
      setGameSubmitter(submitToHost);
      setOnline({ status: "playing" });
    } else if (msg.k === "patch") store().applyRemote(msg.ops);
    else if (msg.k === "playedAck") {
      pendingPlayed.get(msg.req)?.(msg.error);
      pendingPlayed.delete(msg.req);
    }
  };
  c.onClose = () => {
    if (guest !== c) return;
    setChangeSink(null);
    setGameSubmitter(null);
    setOnline({ status: "disconnected", error: "Lost connection to the host." });
  };
  try {
    await c.connect(code);
  } catch (e) {
    if (joining === c) joining = null;
    setOnline({ status: "disconnected", error: (e as Error).message });
    throw e;
  }
  if (joining !== c) {
    c.close(); // superseded by a newer attempt
    return;
  }
  joining = null;
  guest = c;
  sessionStorage.setItem(GUEST_KEY, JSON.stringify({ code, name }));
  await c.send({ k: "hello", name } satisfies ToHost);
  setOnline({ status: "lobby" });
}

const pendingPlayed = new Map<number, (error: string | null) => void>();
let playedSeq = 0;
/** Guest: send a hand-played game to the host and wait for it to be accepted (or refused). */
function submitToHost(gameId: string, box: BoxScore): Promise<string | null> {
  const c = guest;
  if (!c) return Promise.resolve("You're not connected to the host, so the result couldn't be sent.");
  const req = ++playedSeq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingPlayed.delete(req);
      resolve("The host didn't answer, so the result wasn't recorded.");
    }, 20000);
    pendingPlayed.set(req, (error) => {
      clearTimeout(timer);
      resolve(error);
    });
    void c.send({ k: "played", req, gameId, box } satisfies ToHost);
  });
}

export function guestClaim(team: TeamId) {
  void guest?.send({ k: "claim", team } satisfies ToHost);
}

// ---------------------------------------------------------------- common

/** Close the connection. Guests also drop the league (it lives on the host). */
export function leaveOnline(clearGuest = true) {
  const wasGuest = store().online?.role === "guest";
  host?.close();
  guest?.close();
  joining?.close();
  host = null;
  guest = null;
  joining = null;
  lobby = null;
  queued.length = 0;
  setChangeSink(null);
  setGameSubmitter(null);
  setIdSalt("");
  setOnline(null);
  if (clearGuest) {
    try {
      sessionStorage.removeItem(GUEST_KEY);
    } catch {
      /* ignore */
    }
    if (wasGuest) useGame.setState({ league: null, team: null });
  }
}

// flush guest patches that arrived while the host was simulating
useGame.subscribe((s, prev) => {
  if (prev.busy && !s.busy && queued.length) flushQueue();
});
