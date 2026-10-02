"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Check, Copy, SignOut } from "@phosphor-icons/react";
import { Button, Card, Field, TeamMark, inputCls, seg } from "@/components/ui";
import { useGame } from "@/lib/store";
import { loadTeamsOnly } from "@/lib/seed";
import type { SeedTeam } from "@/engine/types/seed";
import { DEFAULT_SETTINGS } from "@/engine/league/init";
import { guestClaim, guestJoin, hostCreate, hostKick, hostSetOptions, hostStart, leaveOnline, savedGuestSession, type Lobby } from "@/lib/online/session";

function TeamChip({ t, small }: { t: SeedTeam; small?: boolean }) {
  return <TeamMark id={t.id} colors={t.colors} size={small ? "sm" : "md"} />;
}

function TeamGrid({ teams, taken, selected, onPick, disabled }: { teams: SeedTeam[]; taken: Map<string, string>; selected: string | null; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="scroll-thin grid max-h-80 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
      {teams.map((t) => {
        const who = taken.get(t.id);
        const mine = selected === t.id;
        return (
          <button
            key={t.id}
            disabled={disabled || (!!who && !mine)}
            onClick={() => onPick(t.id)}
            className={clsx("flex items-center gap-2 rounded-[4px] border px-2 py-1.5 text-left text-xs transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed", mine ? "card-wash on-dark border-transparent text-white" : who ? "border-line opacity-45" : "border-line bg-bg/40 hover:border-line-2")}
            style={mine ? { ["--tc-team" as string]: t.colors.primary } : undefined}
          >
            <TeamChip t={t} />
            <span className="min-w-0 flex-1 truncate font-semibold">{t.fullName}</span>
            {mine && <Check size={14} weight="bold" className="shrink-0" />}
            {who && !mine && <span className="truncate text-[10px] text-gold">{who}</span>}
          </button>
        );
      })}
    </div>
  );
}

function LobbyView({ lobby, teams }: { lobby: Lobby; teams: SeedTeam[] }) {
  const online = useGame((s) => s.online)!;
  const toast = useGame((s) => s.toast);
  const [starting, setStarting] = useState(false);
  const isHost = online.role === "host";
  const me = isHost ? lobby.members.find((m) => m.host) : lobby.members.find((m) => m.name.toLowerCase() === online.name.toLowerCase());
  const taken = new Map(lobby.members.filter((m) => m.team).map((m) => [m.team!, m.name]));
  const byId = new Map(teams.map((t) => [t.id, t]));
  const link = typeof window !== "undefined" ? `${window.location.origin}/online` : "/online";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Join my Front Office league! Go to ${link} and enter code ${lobby.code}`);
      toast("Invite copied", "success");
    } catch {
      toast(`Code: ${lobby.code}`, "info");
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-4">
        <Card title="Room code">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1" aria-label={`Room code ${lobby.code}`}>
              {lobby.code.split("").map((ch, i) => (
                <span key={i} className="anim-flip grid h-14 w-11 place-items-center rounded-[4px] border border-line-2 bg-bg font-display text-4xl font-black text-accent shadow-[inset_0_-14px_0_color-mix(in_oklab,var(--ink)_3%,transparent)]" style={{ animationDelay: `${i * 50}ms` }}>{ch}</span>
              ))}
            </div>
            <Button size="sm" onClick={copy}><Copy size={14} /> Copy invite</Button>
          </div>
          <p className="mt-2 text-xs text-dim">Friends open <span className="text-ink">{link}</span>, tap “Join with a code” and type this code.{isHost ? " Keep this tab open: your browser runs the league." : ""}</p>
        </Card>
        <Card title={`Managers (${lobby.members.length})`}>
          <ul className="divide-y divide-line">
            {lobby.members.map((m) => {
              const t = m.team ? byId.get(m.team) : null;
              return (
                <li key={m.connId} className="flex items-center gap-2 py-2 text-sm">
                  <span title={m.online ? "Online" : "Offline"} className={clsx("h-2 w-2 rounded-full", m.online ? "bg-good shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-good)_25%,transparent)]" : "bg-mute")} />
                  <span className="font-semibold">{m.name}</span>
                  {m.host && <span className="chip !text-accent">host</span>}
                  <span className="ml-auto flex items-center gap-2 text-xs text-dim">{t ? <><TeamChip t={t} small /> {t.fullName}</> : "picking a team…"}</span>
                  {isHost && !m.host && <button className="text-xs text-mute hover:text-bad" onClick={() => hostKick(m.connId)}>remove</button>}
                </li>
              );
            })}
          </ul>
        </Card>
        {isHost ? (
          <Card title="League settings">
            <div className="grid gap-3">
              <Field label="League name">
                <input className={inputCls} value={lobby.leagueName} onChange={(e) => hostSetOptions({ leagueName: e.target.value })} />
              </Field>
              <div className="flex gap-1">
                {[{ on: true, label: "Salary cap on" }, { on: false, label: "Salary cap off" }].map((o) => (
                  <button key={String(o.on)} onClick={() => hostSetOptions({ salaryCap: o.on })} className={seg(lobby.salaryCap === o.on)}>
                    {o.label}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                disabled={starting || !me?.team}
                onClick={async () => {
                  setStarting(true);
                  try {
                    await hostStart({ ...DEFAULT_SETTINGS });
                  } catch (e) {
                    toast(`Couldn't start: ${(e as Error).message}`, "error");
                    setStarting(false);
                  }
                }}
              >
                {starting ? "Building the league…" : `Start league with ${lobby.members.filter((m) => m.team).length} manager${lobby.members.filter((m) => m.team).length === 1 ? "" : "s"}`}
              </Button>
              <p className="text-xs text-dim">Friends can also join after it starts: they pick any team nobody has. Only you can sim; everyone runs their own team&apos;s trades, signings and lineups.</p>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm">{lobby.started ? "The league has started: pick a team to jump in." : me?.team ? "You're in. Waiting for the host to start the league…" : "Pick your team from the list."}</p>
          </Card>
        )}
      </div>
      <Card title={isHost ? "Your team" : "Pick your team"}>
        <TeamGrid
          teams={teams}
          taken={taken}
          selected={me?.team ?? null}
          disabled={lobby.started && !!me?.team}
          onPick={(id) => (isHost ? hostSetOptions({ team: id }) : guestClaim(id))}
        />
      </Card>
    </div>
  );
}

function Online() {
  const router = useRouter();
  const params = useSearchParams();
  const online = useGame((s) => s.online);
  const league = useGame((s) => s.league);
  const toast = useGame((s) => s.toast);
  const [teams, setTeams] = useState<SeedTeam[]>([]);
  const [mode, setMode] = useState<"host" | "join">(params.get("mode") === "join" ? "join" : "host");
  const [name, setName] = useState("");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [team, setTeam] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("Friends League");
  const [salaryCap, setSalaryCap] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadTeamsOnly().then((t) => setTeams([...(t as SeedTeam[])].sort((a, b) => a.fullName.localeCompare(b.fullName))));
    void Promise.resolve().then(() => {
      try {
        setName(localStorage.getItem("fo:name") ?? "");
      } catch {
        /* ignore */
      }
    });
  }, []);

  // guest refreshed the page: reconnect with the same name
  useEffect(() => {
    if (params.get("rejoin") !== "1" || online) return;
    const s = savedGuestSession();
    if (!s) return;
    void Promise.resolve()
      .then(() => {
        setBusy(true);
        return guestJoin(s.code, s.name);
      })
      .catch((e) => toast((e as Error).message, "error")).finally(() => setBusy(false));
  }, [params, online, toast]);

  // league is live and I have a team: go play
  useEffect(() => {
    if (online?.status === "playing" && league?.online) router.push("/game");
  }, [online?.status, league, router]);

  const remember = (n: string) => {
    try {
      localStorage.setItem("fo:name", n);
    } catch {
      /* ignore */
    }
  };

  const taken = useMemo(() => new Map<string, string>(), []);

  if (online?.lobby && online.status !== "disconnected") return <LobbyView lobby={online.lobby} teams={teams} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <Card title="Play with friends">
        <p className="text-sm text-dim">Everyone takes a team in the same league. Trade with each other and with the AI teams, sign free agents, run your own rotation: the host sims the season for everyone. Best team wins the challenge.</p>
        <div className="mt-4 flex gap-1">
          {(["host", "join"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={seg(mode === m)}>
              {m === "host" ? "Host a league" : "Join with a code"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3">
          <Field label="Your name">
            <input className={inputCls} value={name} maxLength={24} placeholder="e.g. Ayan" onChange={(e) => setName(e.target.value)} />
          </Field>
          {mode === "join" ? (
            <>
              <Field label="Room code">
                <input className={clsx(inputCls, "font-display text-xl tracking-[0.2em] uppercase")} value={code} maxLength={8} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </Field>
              <Button
                variant="primary"
                disabled={busy || !name.trim() || code.trim().length < 4}
                onClick={async () => {
                  remember(name.trim());
                  setBusy(true);
                  try {
                    await guestJoin(code, name.trim());
                  } catch (e) {
                    toast((e as Error).message, "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Connecting…" : "Join league"}
              </Button>
            </>
          ) : (
            <>
              <Field label="League name">
                <input className={inputCls} value={leagueName} onChange={(e) => setLeagueName(e.target.value)} />
              </Field>
              <div className="flex gap-1">
                {[{ on: true, label: "Salary cap on" }, { on: false, label: "Salary cap off" }].map((o) => (
                  <button key={String(o.on)} onClick={() => setSalaryCap(o.on)} className={seg(salaryCap === o.on)}>
                    {o.label}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                disabled={busy || !name.trim() || !team}
                onClick={async () => {
                  remember(name.trim());
                  setBusy(true);
                  try {
                    await hostCreate({ name: name.trim(), team: team!, leagueName, salaryCap });
                  } catch (e) {
                    toast((e as Error).message, "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Opening room…" : team ? "Create room" : "Pick your team first"}
              </Button>
            </>
          )}
          {online?.error && <p className="rounded-[4px] border border-bad/40 px-3 py-2 text-sm text-bad">{online.error}</p>}
          <p className="text-xs text-mute">Connections go directly between browsers. Some school or work networks block this: if joining fails, try a phone hotspot.</p>
        </div>
      </Card>
      {mode === "host" ? (
        <Card title="Your team">
          <TeamGrid teams={teams} taken={taken} selected={team} onPick={setTeam} />
        </Card>
      ) : (
        <Card title="How it works">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-dim">
            <li>Get the room code from whoever is hosting.</li>
            <li>Enter your name and the code, then pick a team nobody has taken.</li>
            <li>Manage your team: trades (with friends or AI), free agency, extensions, lineups, draft picks.</li>
            <li>The host sims days, weeks or the whole season. Standings decide the challenge.</li>
          </ol>
        </Card>
      )}
    </div>
  );
}

export default function OnlinePage() {
  const online = useGame((s) => s.online);
  return (
    <main id="main" className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="mb-8 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <Link href="/gm" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-dim transition-colors hover:text-ink">
            <ArrowLeft size={14} weight="bold" /> Main menu
          </Link>
          <h1 className="font-display text-5xl font-black uppercase leading-[0.85] sm:text-7xl">
            Friends <span className="text-accent">league</span>
          </h1>
        </div>
        {online && (
          <button className="ml-auto inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1.5 text-sm font-semibold text-dim transition-colors hover:bg-bad/10 hover:text-bad" onClick={() => leaveOnline()}>
            <SignOut size={15} /> Leave room
          </button>
        )}
      </div>
      <Suspense>
        <Online />
      </Suspense>
    </main>
  );
}
