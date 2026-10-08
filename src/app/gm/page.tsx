"use client";
/**
 * Front Office entry, a clone of the Floodlights entry: your name, create a game, or join one with a code.
 * Creating opens a room with a code; friends join it and pick their teams; the host starts. Playing alone is
 * the same thing: create, pick a team and start with nobody else in the room. Saved leagues sit behind the
 * card at the foot of the panel.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, UploadSimple } from "@phosphor-icons/react";
import { Button, Field, Modal, inputCls, seg } from "@/components/ui";
import { useCourtMode, useTeamTheme } from "@/lib/theme";
import { useKitEntry } from "@/lib/entry";
import { STARS_A, STARS_B } from "@/lib/starfield";
import { deleteSave, listSaves, saveLeague, type SaveMeta } from "@/lib/db";
import { useGame } from "@/lib/store";
import { loadTeamsOnly } from "@/lib/seed";
import { PHASE_LABEL } from "@/lib/format";
import type { SeedTeam } from "@/engine/types/seed";
import type { League, Settings } from "@/engine/types/game";
import { DEFAULT_SETTINGS } from "@/engine/league/init";
import { guestClaim, guestJoin, hostCreate, hostKick, hostSetOptions, hostStart, leaveOnline, savedGuestSession, type Lobby } from "@/lib/online/session";

const NAME_KEY = "fo:name";
const COURT = { primary: "#ff8a3d", secondary: "#ffbe4a" };
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};
const keepName = (n: string) => {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
};

export default function FrontOfficeEntry() {
  useCourtMode();
  return (
    // its own layer, so the starfield sits above the page ground the way it does on Floodlights
    <div data-kmode="court" className="relative isolate z-0">
      <div className="k-stars" aria-hidden>
        <i style={{ boxShadow: STARS_A }} />
        <i style={{ boxShadow: STARS_B }} />
      </div>
      <Suspense>
        <Home />
      </Suspense>
    </div>
  );
}

function Home() {
  const online = useGame((s) => s.online);
  const league = useGame((s) => s.league);
  const toast = useGame((s) => s.toast);
  const router = useRouter();
  const params = useSearchParams();
  const [teams, setTeams] = useState<SeedTeam[]>([]);

  useEffect(() => {
    loadTeamsOnly().then((t) => setTeams([...(t as SeedTeam[])].sort((a, b) => a.fullName.localeCompare(b.fullName))));
  }, []);

  // a guest refreshed the page inside a league: reconnect with the same name
  useEffect(() => {
    if (params.get("rejoin") !== "1" || online) return;
    const s = savedGuestSession();
    if (!s) return;
    void guestJoin(s.code, s.name).catch((e) => toast((e as Error).message, "error"));
  }, [params, online, toast]);

  // the league just went live with this person in it: go and play
  const was = useRef(online?.status);
  useEffect(() => {
    const before = was.current;
    was.current = online?.status;
    if (online?.status === "playing" && before !== "playing" && league?.online) router.push("/game");
  }, [online?.status, league, router]);

  const inRoom = !!online?.lobby && online.status !== "disconnected" && online.status !== "connecting";
  const myTeamColors = useMemo(() => {
    if (!inRoom || !online?.lobby) return null;
    const me = online.role === "host" ? online.lobby.members.find((m) => m.host) : online.lobby.members.find((m) => m.name.toLowerCase() === online.name.toLowerCase());
    return teams.find((t) => t.id === me?.team)?.colors ?? null;
  }, [inRoom, online, teams]);
  // before a team is picked the room wears the court accent, the way Floodlights wears volt
  useTeamTheme(myTeamColors ?? (inRoom ? COURT : null));

  if (inRoom && online?.lobby) return <Room lobby={online.lobby} teams={teams} />;
  return <Entry />;
}

// ---------------------------------------------------------------- the entry

function Entry() {
  const online = useGame((s) => s.online);
  const load = useGame((s) => s.load);
  const params = useSearchParams();
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  useKitEntry(root);
  const [name, setName] = useState("");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [savesOpen, setSavesOpen] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => setName(readName()));
  }, []);
  useEffect(() => {
    if (online?.error) void Promise.resolve().then(() => setMsg(online.error ?? ""));
  }, [online?.error]);

  const create = async () => {
    const n = name.trim();
    if (!n) return setMsg("Enter a name first.");
    keepName(n);
    setMsg("");
    setBusy(true);
    try {
      await hostCreate({ name: n, team: null, leagueName: `${n}'s League`, salaryCap: true });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const join = async () => {
    const n = name.trim();
    if (!n) return setMsg("Enter a name first.");
    if (code.trim().length < 4) return setMsg("Type the room code first.");
    keepName(n);
    setMsg("");
    setBusy(true);
    try {
      await guestJoin(code, n);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const open = async (id: string) => {
    setSavesOpen(false);
    setMsg("Loading your league.");
    if (await load(id)) router.push("/game");
    else setMsg("That save could not be opened.");
  };

  return (
    <main ref={root} id="main" className="k-entry">
      <div className="k-frame" aria-hidden>
        <span className="ln ln-t" />
        <span className="ln ln-b" />
        <span className="ln ln-l" />
        <span className="ln ln-r" />
        <span className="cn cn-tl" />
        <span className="cn cn-tr" />
        <span className="cn cn-bl" />
        <span className="cn cn-br" />
      </div>
      <div className="k-entry-in">
        <div className="k-hero">
          <div className="k-brand">
            <span className="sq" />
            <Link className="homelink" href="/front-office" title="Back to Game Night">
              <span className="k-dec">Be-A-Manager</span>
            </Link>
            <span className="tg">
              <span className="k-dec">NBA front office mode</span>
            </span>
          </div>
          <h1 className="k-title" style={{ ["--k-title-em" as string]: 7.42 }}>
            <span className="hrise">
              Front <span>Office</span>
            </span>
          </h1>
          <p className="k-sub">
            Pick a team with friends, trade for anyone in the <em>league</em> and play out full seasons together.
          </p>
          <dl className="k-stats">
            <div>
              <dt>
                <span className="k-dec">Players</span>
              </dt>
              <dd>605</dd>
            </div>
            <div>
              <dt>
                <span className="k-dec">Teams</span>
              </dt>
              <dd>30</dd>
            </div>
            <div>
              <dt>
                <span className="k-dec">Games a season</span>
              </dt>
              <dd>82</dd>
            </div>
          </dl>
        </div>
        <div className="k-card">
          <label className="flab k-label" htmlFor="nameIn">
            Your manager name
          </label>
          <div className="row">
            <input id="nameIn" className="k-input" maxLength={20} placeholder="e.g. Ayan" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} />
          </div>
          <div className="row">
            <button className="k-btn k-btn-primary k-create" disabled={busy} onClick={() => void create()}>
              {busy && online?.status === "connecting" && online.role === "host" ? "Opening the room" : "Create a game"}
            </button>
          </div>
          <div className="cardsplit" />
          <label className="flab k-label" htmlFor="codeIn">
            Or join with a code
          </label>
          <div className="row">
            <input id="codeIn" className="k-input k-code" maxLength={8} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && void join()} />
            <button className="k-btn" disabled={busy} onClick={() => void join()}>
              Join
            </button>
          </div>
          <div className="msg" role="status">
            {msg}
          </div>
          <button className="k-mode" onClick={() => setSavesOpen(true)}>
            <b>Saved leagues</b>
            <span>Carry on a league you started before, or bring one in from a file.</span>
            <i aria-hidden>&rarr;</i>
          </button>
        </div>
      </div>
      <SavesModal open={savesOpen} onClose={() => setSavesOpen(false)} onOpen={open} />
    </main>
  );
}

function SavesModal({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (id: string) => void }) {
  const toast = useGame((s) => s.toast);
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [teams, setTeams] = useState<SeedTeam[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    listSaves().then(setSaves).catch(() => setSaves([]));
    loadTeamsOnly().then((t) => setTeams(t as SeedTeam[]));
  }, [open]);
  const importFile = async (f: File) => {
    try {
      const l = JSON.parse(await f.text()) as League;
      if (!l.players || !l.teams || !l.season) throw new Error("Not a Front Office save");
      await saveLeague(l);
      setSaves(await listSaves());
      toast(`Imported "${l.name}"`, "success");
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, "error");
    }
  };
  return (
    <Modal open={open} onClose={onClose} kicker="Front Office" title="Saved leagues">
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
      {saves === null ? (
        <p className="k-pickhelp">Loading.</p>
      ) : saves.length === 0 ? (
        <p className="k-pickhelp">No saves yet. Create a game to start your first league.</p>
      ) : (
        <div>
          {saves.map((s, i) => {
            const t = teams.find((x) => x.id === s.userTeams[0]);
            return (
              <div key={s.id} className="k-mgrow">
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <button className="min-w-0 text-left" onClick={() => onOpen(s.id)}>
                  <div className="nm truncate">{s.name}</div>
                  <div className="cl">
                    {t?.fullName ?? s.userTeams.join(", ")} &middot; {s.season} &middot; {PHASE_LABEL[s.phase] ?? s.phase}
                    {s.online ? " · with friends" : ""}
                  </div>
                </button>
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="primary" onClick={() => onOpen(s.id)}>
                    Continue
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    title={`Delete ${s.name}`}
                    onClick={async () => {
                      if (!confirm(`Delete "${s.name}"? You can't undo this.`)) return;
                      await deleteSave(s.id);
                      setSaves(await listSaves());
                    }}
                  >
                    Delete
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          <UploadSimple size={14} /> Import a save
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- the room before the season

function Room({ lobby, teams }: { lobby: Lobby; teams: SeedTeam[] }) {
  const online = useGame((s) => s.online)!;
  const toast = useGame((s) => s.toast);
  const router = useRouter();
  const isHost = online.role === "host";
  const me = isHost ? lobby.members.find((m) => m.host) : lobby.members.find((m) => m.name.toLowerCase() === online.name.toLowerCase());
  const taken = new Map(lobby.members.filter((m) => m.team && m !== me).map((m) => [m.team!, m.name]));
  const byId = new Map(teams.map((t) => [t.id, t]));
  const myTeam = me?.team ? byId.get(me.team) : undefined;
  const alone = lobby.members.length === 1;
  const [conf, setConf] = useState<"All" | "East" | "West">("All");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [many, setMany] = useState(false);
  const [extra, setExtra] = useState<string[]>([]);
  const [commissioner, setCommissioner] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const soloExtras = isHost && alone && many;

  const pick = (id: string) => {
    if (lobby.started && me?.team) return;
    if (!isHost) return guestClaim(id);
    if (soloExtras && me?.team && id !== me.team) return setExtra((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
    hostSetOptions({ team: id });
  };
  const start = async () => {
    setStarting(true);
    try {
      const how = await hostStart(settings, { extraTeams: soloExtras ? extra : [], commissioner: alone && commissioner });
      if (how === "solo") router.push("/game");
      else if (!how) setStarting(false);
    } catch (e) {
      toast(`Could not start: ${(e as Error).message}`, "error");
      setStarting(false);
    }
  };

  const seated = lobby.members.filter((m) => m.team).length;
  const shown = teams.filter((t) => conf === "All" || t.conference === conf);
  return (
    <main id="main" className="k-wrap relative">
      <div className="k-topbar">
        <div className="k-brand">
          <span className="sq" />
          <span className="nm">FRONT OFFICE</span>
          <span className="tg">NBA FRONT OFFICE MODE</span>
        </div>
        <div className="k-chips">
          <Link className="chip" href="/front-office">
            Game Night
          </Link>
          <span className="chip">
            Room <b className="code">{online.local ? "THIS DEVICE" : lobby.code}</b>
          </span>
          <span className="chip">
            Season <b>2026-27</b> &middot; <b>{settings.seasonLength}</b> games
          </span>
          <span className="chip">
            <span className="k-pulse" />
            {lobby.members.filter((m) => m.online).length} {lobby.members.filter((m) => m.online).length === 1 ? "manager" : "managers"} live
          </span>
          <span className="chip">
            {online.name}
            {isHost ? " (host)" : ""}
          </span>
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => leaveOnline()}>
            Leave
          </button>
        </div>
      </div>

      <div className="k-hubhead">
        <div>
          <div className="who">
            Welcome &middot; {online.name}
            {isHost ? " (host)" : ""}
          </div>
          <h1 className="clubname">{myTeam ? myTeam.fullName : "No team yet"}</h1>
        </div>
        <div className="k-clubmeta">
          <span className="k-cm">
            <span className="k-cmk">Managers</span>
            <b className="k-cmv">{lobby.members.length}</b>
          </span>
          <span className="k-cm">
            <span className="k-cmk">Teams free</span>
            <b className="k-cmv">{teams.length ? teams.length - seated : "-"}</b>
          </span>
          <span className="k-cm">
            <span className="k-cmk">Last season</span>
            <b className="k-cmv">{myTeam?.prevRecord ? `${myTeam.prevRecord.w}-${myTeam.prevRecord.l}` : "-"}</b>
          </span>
          <span className="k-cm">
            <span className="k-cmk">Salary cap</span>
            <b className="k-cmv k-acc">{lobby.salaryCap ? "On" : "Off"}</b>
          </span>
        </div>
      </div>

      <section className="k-panel k-room">
        <div className="k-lobbygrid">
          <div className="k-lobbyleft">
            <div className="k-msub">{isHost ? (online.local ? "YOUR LEAGUE IS READY. THIS ROOM IS ON THIS DEVICE ONLY." : "YOUR LEAGUE IS READY. SHARE THE CODE.") : lobby.started ? "THE LEAGUE IS ON. PICK A FREE TEAM TO JUMP IN." : me?.team ? "YOU ARE IN. MORE FRIENDS CAN JOIN WITH THE CODE." : "YOU ARE IN. PICK A TEAM BELOW."}</div>
            <div className="k-codeboxes" aria-label={`Room code ${lobby.code}`}>
              {lobby.code.split("").map((c, i) => (
                <div key={i} className="k-codebox" style={{ width: "min(92px, calc((100% - 40px) / 6))" }}>
                  {c}
                </div>
              ))}
            </div>
            <div className="k-controls">
              {isHost ? (
                <>
                  <button className="k-btn k-btn-primary" disabled={starting || !me?.team || lobby.started} onClick={() => void start()}>
                    {starting ? "Building the league" : <>Start league &rarr;</>}
                  </button>
                  <button className="k-btn k-btn-ghost k-btn-sm" disabled={lobby.started} onClick={() => setSettingsOpen(true)}>
                    League settings
                  </button>
                  {lobby.started && (
                    <Link className="k-btn" href="/game">
                      Back to the league
                    </Link>
                  )}
                  <span className="k-msub">{lobby.started ? "THE LEAGUE IS ON" : me?.team ? "HOST RUNS THE SIM" : "PICK YOUR TEAM FIRST"}</span>
                </>
              ) : (
                <span className="k-msub">{lobby.started ? "THE HOST RUNS THE SIM" : me?.team ? "WAITING FOR THE HOST TO START" : "THE HOST RUNS THE SIM"}</span>
              )}
            </div>
            {online.error && <p className="k-pickhelp !mt-0 text-accent">{online.error}</p>}
          </div>
          <div className="k-lobbyright">
            <div className="k-mgrhead">
              <span className="k-pulse" />
              <span className="k-msub">MANAGERS &middot; {lobby.members.length}</span>
            </div>
            {lobby.members.map((m, i) => {
              const t = m.team ? byId.get(m.team) : undefined;
              const you = m === me;
              return (
                <div key={m.connId} className="k-mgrow">
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="nm">{m.name}</div>
                    <div className="cl">{t ? t.fullName : m.online ? "CHOOSING A TEAM..." : "OFFLINE"}</div>
                  </div>
                  <span className="flex items-center gap-2">
                    <span className={you ? "k-tag k-acc" : "k-tag"}>{you ? "YOU" : m.host ? "HOST" : m.team ? "READY" : "PICKING"}</span>
                    {isHost && !m.host && (
                      <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => hostKick(m.connId)}>
                        Remove
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
            <div className="k-msub" style={{ padding: "12px 0", color: "var(--k-ghost)" }}>
              {online.local ? "NOBODY CAN JOIN A ROOM ON THIS DEVICE." : "WAITING FOR MORE MANAGERS..."}
            </div>
          </div>
        </div>
        <div className="k-pickzone">
          <div className="k-mlab">PICK YOUR TEAM</div>
          <p className="k-pickhelp">
            One team each, from all 30. Every roster, contract and pick is the real 2026-27 one. Any team nobody picks, the AI runs.
            {soloExtras && me?.team ? " Running more than one team: tap more teams to add them." : ""}
          </p>
          <div className="k-controls" style={{ marginTop: 14 }}>
            <label className="k-msub" htmlFor="pickConf">
              CONFERENCE
            </label>
            <select id="pickConf" className="k-input" style={{ width: "auto" }} value={conf} onChange={(e) => setConf(e.target.value as typeof conf)}>
              <option value="All">All teams</option>
              <option value="East">East</option>
              <option value="West">West</option>
            </select>
          </div>
          <div className="k-teampick">
            {shown.map((t) => {
              const who = taken.get(t.id);
              const mine = me?.team === t.id || (soloExtras && extra.includes(t.id));
              const locked = !!who || (lobby.started && !!me?.team && !mine);
              return (
                <button key={t.id} className={mine ? "mine" : who ? "taken" : undefined} disabled={locked} style={{ ["--team" as string]: t.colors.primary }} onClick={() => pick(t.id)}>
                  {t.fullName}
                  <br />
                  <span style={{ fontSize: 11, color: "var(--k-dim)" }}>
                    {t.id} &middot; {who ?? (mine ? "You" : "Free")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="k-ticker" data-label="TIP OFF">
        <div className="k-ticker-inner">
          {lobby.started ? "The league is on. " : "Waiting for the first tip off... "}
          {lobby.members.map((m) => m.name + (m.team && byId.get(m.team) ? ` (${byId.get(m.team)!.fullName})` : "")).join(" \u00b7 ")}
        </div>
      </div>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} kicker="Before tip off" title="League settings">
        <div className="grid gap-4">
          <Field label="League name">
            <input className={inputCls} value={lobby.leagueName} maxLength={40} onChange={(e) => hostSetOptions({ leagueName: e.target.value })} />
          </Field>
          <div>
            <span className="k-label mb-1.5 block">Salary cap</span>
            <div className="flex gap-2">
              {[
                { on: true, label: "On: real cap rules" },
                { on: false, label: "Off: sign and trade freely" },
              ].map((o) => (
                <button key={String(o.on)} className={seg(lobby.salaryCap === o.on)} onClick={() => hostSetOptions({ salaryCap: o.on })}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Difficulty">
              <select className={inputCls} value={settings.difficulty} onChange={(e) => setSettings({ ...settings, difficulty: e.target.value as Settings["difficulty"] })}>
                {["easy", "normal", "hard", "insane"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label={`Trade difficulty (${settings.tradeDifficulty.toFixed(2)})`}>
              <input type="range" className="k-check w-full" min={0.8} max={1.3} step={0.05} value={settings.tradeDifficulty} onChange={(e) => setSettings({ ...settings, tradeDifficulty: Number(e.target.value) })} />
            </Field>
            <Field label={`Injuries (${settings.injuryFrequency.toFixed(1)}x)`}>
              <input type="range" className="k-check w-full" min={0} max={2} step={0.1} value={settings.injuryFrequency} onChange={(e) => setSettings({ ...settings, injuryFrequency: Number(e.target.value) })} />
            </Field>
            <Field label={`Season length (${settings.seasonLength} games)`}>
              <input type="range" className="k-check w-full" min={20} max={82} step={2} value={settings.seasonLength} onChange={(e) => setSettings({ ...settings, seasonLength: Number(e.target.value) })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="k-check" checked={settings.aiTrades} onChange={(e) => setSettings({ ...settings, aiTrades: e.target.checked })} /> AI teams trade with each other
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="k-check" disabled={!alone} checked={alone && many} onChange={(e) => (setMany(e.target.checked), setExtra([]))} /> Run more than one team (on your own only)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="k-check" disabled={!alone} checked={alone && commissioner} onChange={(e) => setCommissioner(e.target.checked)} /> Commissioner: you can edit anything (on your own only)
          </label>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setSettingsOpen(false)}>
              Done <ArrowRight size={14} weight="bold" />
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
