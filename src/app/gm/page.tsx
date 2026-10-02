"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Basketball, Broadcast, CaretDown, Check, GearSix, Plus, Scales, SunHorizon, Trash, UploadSimple, UsersFour, UsersThree } from "@phosphor-icons/react";
import { Button, Card, Field, Tabs, TeamMark, inputCls, seg } from "@/components/ui";
import { useTeamTheme } from "@/lib/theme";
import { AppearancePicker } from "@/components/AppearancePicker";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { deleteSave, listSaves, saveLeague, type SaveMeta } from "@/lib/db";
import { callWorker, useGame } from "@/lib/store";
import { loadSeed, loadTeamsOnly } from "@/lib/seed";
import { PHASE_LABEL } from "@/lib/format";
import type { SeedTeam } from "@/engine/types/seed";
import type { League, Settings } from "@/engine/types/game";
import { DEFAULT_SETTINGS } from "@/engine/league/init";

type Mode = "single" | "multi" | "commissioner";

export default function Home() {
  const router = useRouter();
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [teams, setTeams] = useState<SeedTeam[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("single");
  const [name, setName] = useState("My League");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState<"solo" | "friends">("solo");
  const fileRef = useRef<HTMLInputElement>(null);
  const { load, setLeague, toast } = useGame();

  useEffect(() => {
    listSaves().then(setSaves).catch(() => setSaves([]));
    loadTeamsOnly().then((t) => setTeams([...(t as SeedTeam[])].sort((a, b) => a.fullName.localeCompare(b.fullName))));
  }, []);

  const toggle = (id: string) => {
    if (mode === "single") setPicked([id]);
    else setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const start = async () => {
    const userTeams = mode === "commissioner" ? (picked.length ? picked : [teams[0].id]) : picked;
    if (!userTeams.length) return toast("Pick a team to manage", "error");
    setBusy("Loading real 2026-27 rosters…");
    try {
      const seed = await loadSeed();
      setBusy("Generating ratings, schedule and NBA Cup draw…");
      const res = await callWorker({ cmd: "new", seed, userTeams, name, settings: { ...settings, commissioner: mode === "commissioner" } });
      const l = res.league as League;
      await saveLeague(l);
      setLeague(l);
      localStorage.setItem("fo:lastSave", l.id);
      router.push("/game");
    } catch (e) {
      toast(`Couldn't create league: ${(e as Error).message}`, "error");
      setBusy(null);
    }
  };

  const open = async (id: string) => {
    setBusy("Loading save…");
    if (await load(id)) router.push("/game");
    else setBusy(null);
  };

  const importFile = async (f: File) => {
    try {
      const l = JSON.parse(await f.text()) as League;
      if (!l.players || !l.teams || !l.season) throw new Error("Not a Front Office save");
      await saveLeague(l);
      setSaves(await listSaves());
      toast(`Imported “${l.name}”`, "success");
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, "error");
    }
  };

  const preview = teams.find((t) => t.id === picked[0]);
  return (
    <main id="main" className="relative mx-auto max-w-[1280px] px-5 pb-16 pt-10 sm:px-10 sm:pt-14">
      <SiteBackdrop />
      <ThemePreview colors={preview?.colors} />
      <header className="relative mb-8 grid items-end gap-6 sm:mb-10 lg:grid-cols-[1.25fr_1fr]">
        <div className="anim-rise">
          <Link href="/front-office" className="mb-5 inline-flex items-center gap-2 font-num text-[10.5px] font-bold uppercase tracking-[0.16em] text-dim transition-colors hover:text-ink">
            <ArrowLeft size={12} weight="bold" /> All games
          </Link>
          <div className="mb-4 flex items-center gap-2">
            <span className="bam-dots" aria-hidden />
            <span className="label !text-accent">2026-27 season</span>
          </div>
          <h1 className="font-display text-[44px] font-black uppercase leading-[0.98] tracking-[0.02em] sm:text-[72px]">
            Front
            <br />
            <span className="text-accent">Office</span>
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-dim">Run an NBA franchise with real 2026-27 rosters, contracts, draft picks and the full collective bargaining agreement.</p>
        </div>
        <div className="anim-rise grid gap-4 [animation-delay:80ms]">
        <dl className="grid grid-cols-3 gap-px overflow-hidden border border-line bg-line [animation-delay:80ms]">
          {[
            ["605", "Real players"],
            ["30", "Franchises"],
            ["82", "Game seasons"],
          ].map(([v, k]) => (
            <div key={k} className="bg-panel px-3 py-4 sm:px-4">
              <dd className="font-num text-[26px] font-bold leading-none sm:text-[32px]">{v}</dd>
              <dt className="label mt-2">{k}</dt>
            </div>
          ))}
        </dl>
        <AppearancePicker compact />
        </div>
      </header>

      <div className="relative mb-6">
        <Tabs tabs={[{ id: "solo", label: "Single player" }, { id: "friends", label: "Play with friends" }]} value={tab} onChange={setTab} />
      </div>

      {tab === "friends" && (
        <div className="relative grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <Link href="/online?mode=host" className="group panel lift relative overflow-hidden p-6">
            <div className="side-wash stripes absolute inset-0" />
            <div className="relative">
              <Broadcast size={30} weight="duotone" className="text-accent" />
              <h2 className="mt-3 font-display text-[24px] font-black uppercase leading-none tracking-[0.03em]">Host a league</h2>
              <p className="mt-2 max-w-[44ch] text-sm text-dim">Create a room, share the code, and everyone picks a team. You run the sim. Each friend runs their own franchise: trades, free agency, draft and lineups.</p>
              <span className="mt-5 inline-flex items-center gap-2 font-num text-[11px] font-bold uppercase tracking-[0.1em] text-accent">Open a room <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-1" /></span>
            </div>
          </Link>
          <Link href="/online?mode=join" className="group panel lift p-6">
            <UsersFour size={30} weight="duotone" className="text-dim" />
            <h2 className="mt-3 font-display text-[24px] font-black uppercase leading-none tracking-[0.03em]">Join a friend</h2>
            <p className="mt-2 max-w-[40ch] text-sm text-dim">Got a room code? Join, pick a team nobody has taken and you&apos;re in, even mid-season.</p>
            <span className="mt-5 inline-flex items-center gap-2 font-num text-[11px] font-bold uppercase tracking-[0.1em] text-ink">Enter a code <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </div>
      )}

      {tab === "solo" && busy && (
        <div className="panel relative mb-6 flex items-center gap-3 overflow-hidden px-5 py-4">
          <Basketball size={22} weight="duotone" className="animate-spin text-accent [animation-duration:2.4s]" />
          <span className="font-semibold">{busy}</span>
          <div aria-hidden className="shimmer pointer-events-none absolute inset-0 opacity-60" />
        </div>
      )}

      {tab === "solo" && (
        <div className="relative grid items-start gap-5 lg:grid-cols-[1fr_1.25fr]">
          <Card title="Saved leagues" right={<Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><UploadSimple size={14} /> Import</Button>}>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            {saves === null ? (
              <div className="space-y-2">
                {[0, 1].map((i) => <div key={i} className="h-14 animate-pulse bg-ink/[0.04]" />)}
              </div>
            ) : saves.length === 0 ? (
              <div className="py-6 text-sm text-dim">No saves yet. Pick a franchise on the right to start your first league.</div>
            ) : (
              <ul className="stagger space-y-2">
                {saves.map((s, i) => {
                  const st = teams.find((t) => t.id === s.userTeams[0]);
                  return (
                    <li key={s.id} style={{ ["--i" as string]: i }} className="inset group flex items-center gap-3 overflow-hidden pr-2 transition-colors hover:border-line-2">
                      <span aria-hidden className="w-[3px] self-stretch" style={{ background: st?.colors.primary ?? "var(--accent)" }} />
                      <button className="min-w-0 flex-1 py-2.5 text-left" onClick={() => open(s.id)}>
                        <div className="truncate font-display text-[15px] font-extrabold uppercase leading-none tracking-[0.04em] group-hover:text-accent">{s.name}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dim">
                          {s.online && <span className="chip !text-accent">Online</span>}
                          <span className="font-semibold text-ink/80">{s.userTeams.join(", ")}</span>
                          <span>{s.season}</span>
                          <span>{PHASE_LABEL[s.phase] ?? s.phase}</span>
                          <span className="text-mute">{s.date}</span>
                        </div>
                      </button>
                      <Button size="sm" variant="primary" onClick={() => open(s.id)}>
                        Continue
                      </Button>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-[4px] text-mute transition-colors hover:bg-bad/10 hover:text-bad"
                        aria-label={`Delete ${s.name}`}
                        title="Delete"
                        onClick={async () => {
                          if (!confirm(`Delete “${s.name}”? This can't be undone.`)) return;
                          await deleteSave(s.id);
                          setSaves(await listSaves());
                        }}
                      >
                        <Trash size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {!showNew && saves !== null && saves.length > 0 && (
              <Button variant="default" className="mt-4 w-full" onClick={() => setShowNew(true)}>
                <Plus size={14} weight="bold" /> New league
              </Button>
            )}
          </Card>

          {showNew || saves?.length === 0 ? (
            <Card title="New league">
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <Field label="League name">
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Mode">
                  <div className="flex gap-1">
                    {(["single", "multi", "commissioner"] as Mode[]).map((m) => (
                      <button key={m} onClick={() => (setMode(m), m === "single" && setPicked(picked.slice(0, 1)))} className={clsx(seg(mode === m), "capitalize")}>
                        {m === "multi" ? "Multi-team" : m}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="mb-4">
                <span className="label mb-1.5 block">Salary cap</span>
                <div className="flex gap-1">
                  {[
                    { on: true, label: "On: real CBA rules" },
                    { on: false, label: "Off: sign & trade freely" },
                  ].map((o) => (
                    <button key={String(o.on)} onClick={() => setSettings({ ...settings, salaryCap: o.on })} className={seg(settings.salaryCap === o.on)}>
                      {o.label}
                    </button>
                  ))}
                </div>
                {!settings.salaryCap && <p className="mt-1.5 text-xs text-dim">No salary matching, cap room, aprons or luxury-tax limits on trades and signings. Roster limits still apply.</p>}
              </div>
              <p className="label mb-2">{mode === "single" ? "Pick the franchise you'll run" : mode === "multi" ? "Pick every team you want to control" : "Commissioner mode: full edit powers. Pick a home team"}</p>
              <div className="scroll-thin grid max-h-[340px] grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
                {teams.map((t) => {
                  const on = picked.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle(t.id)}
                      aria-pressed={on}
                      className={clsx("group relative flex items-center gap-2 overflow-hidden rounded-[6px] border px-2 py-2 text-left text-xs transition-[border-color,background-color,transform] duration-200 active:scale-[0.98]", on ? "card-wash on-dark border-transparent text-white" : "border-line bg-ink/[0.02] hover:border-line-2 hover:bg-ink/[0.05]")}
                      style={on ? { ["--tc-team" as string]: t.colors.primary } : undefined}
                    >
                      <TeamMark id={t.id} colors={t.colors} size="sm" />
                      <span className="truncate font-semibold">{t.fullName}</span>
                      {on && <Check size={14} weight="bold" className="ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <details className="group mt-4 border border-line">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  <GearSix size={16} className="text-mute" /> League settings
                  <CaretDown size={12} weight="bold" className="ml-auto text-mute transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-4 border-t border-line p-3 sm:grid-cols-2">
                  <Field label="Difficulty">
                    <select className={inputCls} value={settings.difficulty} onChange={(e) => setSettings({ ...settings, difficulty: e.target.value as Settings["difficulty"] })}>
                      {["easy", "normal", "hard", "insane"].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Trade difficulty (${settings.tradeDifficulty.toFixed(2)})`}>
                    <input type="range" min={0.8} max={1.3} step={0.05} value={settings.tradeDifficulty} onChange={(e) => setSettings({ ...settings, tradeDifficulty: Number(e.target.value) })} className="w-full" />
                  </Field>
                  <Field label={`Injury frequency (${settings.injuryFrequency.toFixed(1)}×)`}>
                    <input type="range" min={0} max={2} step={0.1} value={settings.injuryFrequency} onChange={(e) => setSettings({ ...settings, injuryFrequency: Number(e.target.value) })} className="w-full" />
                  </Field>
                  <Field label={`Season length (${settings.seasonLength} games)`}>
                    <input type="range" min={20} max={82} step={2} value={settings.seasonLength} onChange={(e) => setSettings({ ...settings, seasonLength: Number(e.target.value) })} className="w-full" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={settings.aiTrades} onChange={(e) => setSettings({ ...settings, aiTrades: e.target.checked })} /> AI-to-AI trades
                  </label>
                </div>
              </details>
              <Button variant="primary" className="mt-4 h-12 w-full text-[12px]" disabled={!!busy || !picked.length} onClick={start}>
                {picked.length ? <>Tip off with {picked.join(", ")} <ArrowRight size={14} weight="bold" /></> : "Pick a team to start"}
              </Button>
            </Card>
          ) : (
            <section className="panel overflow-hidden">
              <div className="hero-wash stripes on-dark px-5 py-6">
                <h2 className="font-display text-[22px] font-black uppercase leading-none tracking-[0.03em] text-white">The whole front office</h2>
                <p className="mt-2 max-w-[60ch] text-sm text-white/75">Every lever a real GM pulls, wired to the actual 2026-27 numbers.</p>
              </div>
              <ul className="grid gap-px bg-line sm:grid-cols-2">
                {[
                  { I: UsersThree, t: "Real rosters", d: "605 players with contracts, two-way deals and 2027-33 picks with protections." },
                  { I: Scales, t: "Full CBA", d: "Cap, tax, aprons and exceptions. The trade machine explains every failure." },
                  { I: Basketball, t: "Possession sim", d: "NBA Cup, All-Star weekend, Play-In, playoffs and awards with the 65-game rule." },
                  { I: SunHorizon, t: "Full offseason", d: "Lottery, scouting, draft, options, RFA, extensions, free agency and progression." },
                ].map(({ I, t, d }) => (
                  <li key={t} className="bg-panel p-4">
                    <I size={22} weight="duotone" className="text-accent" />
                    <div className="mt-2.5 font-display text-[13px] font-extrabold uppercase leading-none tracking-[0.06em]">{t}</div>
                    <p className="mt-1.5 text-[13px] text-dim">{d}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

/** Live-preview the picked franchise's colours across the whole menu. */
function ThemePreview({ colors }: { colors?: { primary: string; secondary: string } }) {
  useTeamTheme(colors);
  return null;
}
