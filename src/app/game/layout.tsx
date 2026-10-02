"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArrowsLeftRight,
  Bank,
  Binoculars,
  Briefcase,
  CalendarBlank,
  ChartBar,
  ChartPieSlice,
  ClipboardText,
  ClockCounterClockwise,
  DotsThreeOutline,
  FileText,
  GearSix,
  IdentificationCard,
  List,
  ListNumbers,
  Medal,
  Newspaper,
  Scales,
  Signature,
  SquaresFour,
  SunHorizon,
  Swap,
  Trophy,
  UserPlus,
  UsersFour,
  UsersThree,
  WifiHigh,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useGame, useLeague } from "@/lib/store";
import { SimControls } from "@/components/SimControls";
import { AppearancePicker } from "@/components/AppearancePicker";
import { TeamMark } from "@/components/ui";
import { PHASE_LABEL } from "@/lib/format";
import { fmtDate } from "@/engine/util/dates";
import { guestJoin, hostResume, savedGuestSession } from "@/lib/online/session";
import { useTeamTheme } from "@/lib/theme";
import { emptyRecord } from "@/engine/season/standings";

/** Where to take the user when the league enters each phase. */
const PHASE_ROUTE: Record<string, string> = {
  preseason: "/game",
  "play-in": "/game/playoffs",
  playoffs: "/game/playoffs",
  "season-end": "/game/offseason",
  "draft-lottery": "/game/offseason",
  "pre-draft": "/game/draft",
  draft: "/game/draft",
  options: "/game/offseason",
  "free-agency": "/game/free-agency",
  "summer-league": "/game/offseason",
  "training-camp": "/game/offseason",
};

type NavItem = { href: string; label: string; icon: Icon };

const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Team", items: [
    { href: "/game", label: "Dashboard", icon: SquaresFour },
    { href: "/game/roster", label: "Roster", icon: UsersThree },
    { href: "/game/depth", label: "Rotation", icon: Swap },
    { href: "/game/schedule", label: "Schedule", icon: CalendarBlank },
    { href: "/game/cap", label: "Cap Sheet", icon: ChartPieSlice },
    { href: "/game/finances", label: "Finances", icon: Bank },
    { href: "/game/staff", label: "Staff & G League", icon: ClipboardText },
  ] },
  { group: "Front Office", items: [
    { href: "/game/trade", label: "Trade Machine", icon: ArrowsLeftRight },
    { href: "/game/finder", label: "Trade Finder", icon: Binoculars },
    { href: "/game/assets", label: "My Assets", icon: Briefcase },
    { href: "/game/free-agency", label: "Free Agency", icon: Signature },
    { href: "/game/contracts", label: "Contracts & Extensions", icon: FileText },
    { href: "/game/draft", label: "Draft & Scouting", icon: UserPlus },
    { href: "/game/offseason", label: "Offseason Hub", icon: SunHorizon },
  ] },
  { group: "League", items: [
    { href: "/game/standings", label: "Standings", icon: ListNumbers },
    { href: "/game/playoffs", label: "Playoffs & Cup", icon: Trophy },
    { href: "/game/stats", label: "Stats & Leaders", icon: ChartBar },
    { href: "/game/news", label: "News & Transactions", icon: Newspaper },
    { href: "/game/awards", label: "Awards & All-Star", icon: Medal },
    { href: "/game/history", label: "History & Records", icon: ClockCounterClockwise },
    { href: "/game/players", label: "All Players", icon: IdentificationCard },
    { href: "/game/compare", label: "Compare Players", icon: Scales },
  ] },
  { group: "", items: [{ href: "/game/settings", label: "Settings & Saves", icon: GearSix }] },
];

/** Phone bottom bar: the screens a GM checks most. */
const QUICK: NavItem[] = [
  { href: "/game", label: "Home", icon: SquaresFour },
  { href: "/game/roster", label: "Roster", icon: UsersThree },
  { href: "/game/trade", label: "Trade", icon: ArrowsLeftRight },
  { href: "/game/standings", label: "Standings", icon: ListNumbers },
];

const isActive = (href: string, path: string) => (href === "/game" ? path === "/game" : path.startsWith(href));

export default function GameLayout({ children }: { children: ReactNode }) {
  const league = useGame((s) => s.league);
  const load = useGame((s) => s.load);
  const router = useRouter();
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (league) return;
    // an online guest refreshed: the league lives on the host, so reconnect instead of loading a save
    if (savedGuestSession()) {
      router.replace("/online?rejoin=1");
      return;
    }
    const last = localStorage.getItem("fo:lastSave");
    if (!last) {
      router.replace("/gm");
      return;
    }
    load(last).then((ok) => {
      setTried(true);
      if (!ok) router.replace("/gm");
    });
  }, [league, load, router]);

  if (!league) return <BootScreen text={tried ? "Redirecting" : "Loading league"} />;
  return <Shell>{children}</Shell>;
}

function BootScreen({ text }: { text: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center">
      <div className="flex flex-col items-center gap-3">
        <span className="font-display text-4xl font-black uppercase tracking-[0.02em]">
          Front <span className="text-accent">Office</span>
        </span>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-line">
          <div className="shimmer h-full w-full" />
        </div>
        <span className="label">{text}</span>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const l = useLeague();
  const team = useGame((s) => s.team);
  const setTeam = useGame((s) => s.setTeam);
  const busy = useGame((s) => s.busy);
  const progress = useGame((s) => s.progress);
  const path = usePathname();
  const router = useRouter();
  const myTeam = team ? l.teams[team] : null;
  useTeamTheme(myTeam?.colors);
  // follow the season: when the phase changes, jump to that step's screen
  const lastPhase = useRef(l.phase);
  useEffect(() => {
    if (lastPhase.current === l.phase) return;
    lastPhase.current = l.phase;
    const to = PHASE_ROUTE[l.phase];
    if (to && path !== to) router.push(to);
  }, [l.phase, path, router]);
  const [open, setOpen] = useState(false);
  // expose the header height so the sticky sidebar sits flush under it
  const hdr = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = hdr.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--hdr", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const navGroups = l.online ? [{ group: "Online", items: [{ href: "/game/online", label: "Friends Challenge", icon: UsersFour }] }, ...NAV] : NAV;
  const rec = team ? l.standings[team] ?? emptyRecord(team) : null;

  const nav = (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Game">
      {navGroups.map((g) => (
        <div key={g.group || "x"}>
          {g.group && <div className="label mb-1.5 px-2 !text-[10px] !tracking-[0.16em]">{g.group}</div>}
          {g.items.map((i) => {
            const active = isActive(i.href, path);
            const I = i.icon;
            return (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "group relative flex items-center gap-2.5 rounded-[4px] px-2 py-[7px] text-[13.5px] font-medium transition-colors duration-150",
                  active ? "bg-accent/12 text-ink" : "text-dim hover:bg-ink/[0.04] hover:text-ink",
                )}
              >
                {active && <span aria-hidden className="absolute -left-3 top-1 bottom-1 w-[3px] bg-accent" />}
                <I size={17} weight={active ? "fill" : "regular"} className={clsx("shrink-0 transition-colors", active ? "text-accent" : "text-mute group-hover:text-dim")} />
                <span className="truncate">{i.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-1 border-t border-line px-2 pt-4">
        <AppearancePicker compact />
      </div>
    </nav>
  );

  return (
    <div className="min-h-[100dvh]">
      <header ref={hdr} className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="team-band on-dark relative">
          <div className="stripes pointer-events-none absolute inset-y-0 left-0 w-[46%] [mask-image:linear-gradient(90deg,black,transparent)]" />
          <div className="relative flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-4">
            <button className="grid h-9 w-9 place-items-center rounded-[4px] text-ink/90 hover:bg-ink/10 lg:hidden" onClick={() => setOpen(!open)} aria-label="Open menu" aria-expanded={open}>
              <List size={22} weight="bold" />
            </button>
            <Link href="/gm" className="hidden shrink-0 font-display text-[22px] font-black uppercase leading-none tracking-[0.02em] text-white drop-shadow sm:block" title="Main menu">
              Front<span className="text-white/55">Office</span>
            </Link>
            <span aria-hidden className="hidden h-7 w-px -skew-x-12 bg-white/25 sm:block" />
            <div className="flex min-w-0 items-center gap-2.5">
              {myTeam && <TeamMark id={myTeam.id} colors={myTeam.colors} size="md" />}
              <div className="min-w-0 leading-tight">
                {l.userTeams.length > 1 && !l.online ? (
                  <select aria-label="Team you are managing" className="max-w-40 rounded-[3px] border border-white/20 bg-black/30 px-1.5 py-0.5 text-[13px] font-semibold text-white" value={team ?? ""} onChange={(e) => setTeam(e.target.value)}>
                    {l.userTeams.map((t) => (
                      <option key={t} value={t}>
                        {l.teams[t].fullName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="truncate font-display text-lg font-extrabold uppercase leading-none tracking-[0.02em] text-white">{myTeam?.name}</div>
                )}
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
                  {rec && <span className="font-display text-[13px] font-bold text-white num">{rec.w}-{rec.l}</span>}
                  <span className="hidden truncate sm:inline">{fmtDate(l.date, { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span className="hidden md:inline">{PHASE_LABEL[l.phase]}</span>
                  {l.settings.commissioner && <span className="rounded-[2px] bg-gold/90 px-1 text-[9.5px] font-bold uppercase text-[#1a1406]">Comm</span>}
                </div>
              </div>
            </div>
            <div className="ml-auto">
              <SimControls />
            </div>
          </div>
        </div>
        <OnlineBar />
        {busy ? (
          <div className="shimmer flex items-center gap-2 border-t border-line px-4 py-1.5 text-xs text-dim">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            {busy} {progress && <span className="font-semibold text-ink">{fmtDate(progress)}</span>}
          </div>
        ) : (
          <Ticker />
        )}
      </header>
      <div className="flex">
        <aside className="scroll-thin sticky top-[var(--hdr,92px)] hidden h-[calc(100dvh-var(--hdr,92px))] w-60 shrink-0 overflow-y-auto border-r border-line bg-bg/40 lg:block">{nav}</aside>
        {open && (
          <div className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
            <aside className="anim-rise scroll-thin h-full w-[min(84vw,300px)] overflow-y-auto border-r border-line bg-panel" onClick={(e) => e.stopPropagation()}>
              <div className="team-band on-dark flex items-center justify-between px-4 py-3">
                <Link href="/gm" onClick={() => setOpen(false)} className="font-display text-xl font-black uppercase text-white">
                  Front<span className="text-white/55">Office</span>
                </Link>
                <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-[4px] text-white hover:bg-ink/10" aria-label="Close menu">
                  <X size={18} weight="bold" />
                </button>
              </div>
              {nav}
            </aside>
          </div>
        )}
        <main id="main" className="min-w-0 flex-1 px-3 pb-24 pt-4 sm:px-6 sm:pt-6 lg:pb-10">
          <div key={path} className="page-enter mx-auto max-w-[1440px]">
            {children}
          </div>
        </main>
      </div>
      <BottomBar path={path} onMore={() => setOpen(true)} />
    </div>
  );
}

function BottomBar({ path, onMore }: { path: string; onMore: () => void }) {
  return (
    <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {QUICK.map((q) => {
        const on = isActive(q.href, path);
        const I = q.icon;
        return (
          <Link key={q.href} href={q.href} aria-current={on ? "page" : undefined} className={clsx("relative flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold", on ? "text-ink" : "text-mute")}>
            {on && <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] -skew-x-12 bg-accent" />}
            <I size={21} weight={on ? "fill" : "regular"} className={on ? "text-accent" : undefined} />
            {q.label}
          </Link>
        );
      })}
      <button onClick={onMore} className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold text-mute">
        <DotsThreeOutline size={21} />
        More
      </button>
    </nav>
  );
}

/** ESPN-style bottom line: latest final scores league-wide, then headlines. */
function Ticker() {
  const l = useLeague();
  const played = l.schedule.filter((g) => g.played && g.result);
  const scores = played.slice(-14).reverse();
  const news = l.news.slice(0, 6);
  if (!scores.length && !news.length) return null;
  const items = (
    <>
      {scores.map((g) => {
        const r = g.result!;
        const awayWon = r.awayScore > r.homeScore;
        return (
          <Link key={g.id} href={`/game/box/${encodeURIComponent(g.id)}`} className="flex shrink-0 items-center gap-2 border-r border-line px-3.5 hover:bg-ink/5">
            <span className="label !text-[9.5px] !text-accent">Final</span>
            <span className={clsx("font-display text-[14px] font-bold", awayWon ? "text-ink" : "text-mute")}>{g.away} <span className="num">{r.awayScore}</span></span>
            <span className={clsx("font-display text-[14px] font-bold", !awayWon ? "text-ink" : "text-mute")}>{g.home} <span className="num">{r.homeScore}</span></span>
          </Link>
        );
      })}
      {news.map((n) => (
        <Link key={n.id} href="/game/news" className="flex shrink-0 items-center gap-2 border-r border-line px-3.5 text-[12px] text-dim hover:bg-ink/5 hover:text-ink">
          <span className="label !text-[9.5px] !text-ink">{n.type}</span>
          <span className="max-w-[52ch] truncate">{n.text}</span>
        </Link>
      ))}
    </>
  );
  const count = scores.length + news.length;
  return (
    <div className="ticker relative flex h-8 items-stretch overflow-hidden border-t border-line bg-bg/80 text-sm">
      <span className="z-[1] flex shrink-0 items-center bg-accent px-3 font-display text-[13px] font-black uppercase tracking-[0.08em] text-accent-ink [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)] pr-5">
        Around the league
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_24px,black_calc(100%-24px),transparent)]">
        <div className="ticker-track flex h-full w-max items-stretch" style={{ ["--ticker-dur" as string]: `${Math.max(30, count * 6)}s` }}>
          <div className="flex items-stretch">{items}</div>
          <div className="flex items-stretch" aria-hidden>{items}</div>
        </div>
      </div>
    </div>
  );
}

function OnlineBar() {
  const l = useLeague();
  const online = useGame((s) => s.online);
  const toast = useGame((s) => s.toast);
  const [working, setWorking] = useState(false);
  if (!l.online) return null;
  const cls = "flex flex-wrap items-center gap-2 border-t border-line px-4 py-1.5 text-xs";
  const btn = "rounded-[3px] bg-accent px-2 py-0.5 font-bold text-accent-ink transition hover:brightness-110 disabled:opacity-50";
  if (!online)
    return (
      <div className={clsx(cls, "bg-warn/10 text-warn")}>
        <WifiHigh size={14} weight="bold" /> Online league. Friends can&apos;t connect until you open the room.
        <button disabled={working} className={btn} onClick={async () => { setWorking(true); await hostResume(); setWorking(false); }}>
          {working ? "Opening…" : `Open room ${l.online.code}`}
        </button>
      </div>
    );
  if (online.status === "disconnected")
    return (
      <div className={clsx(cls, "bg-bad/10 text-bad")}>
        {online.error ?? "Disconnected."}
        {online.role === "guest" && (
          <button disabled={working} className={btn} onClick={async () => { const s = savedGuestSession(); if (!s) return; setWorking(true); try { await guestJoin(s.code, s.name); } catch (e) { toast((e as Error).message, "error"); } setWorking(false); }}>
            {working ? "Reconnecting…" : "Reconnect"}
          </button>
        )}
        {online.role === "host" && <button className={btn} onClick={() => void hostResume()}>Re-open room</button>}
      </div>
    );
  const members = online.lobby?.members ?? [];
  const on = members.filter((m) => m.online).length;
  return (
    <div className={clsx(cls, "text-dim")}>
      <WifiHigh size={14} weight="bold" className="text-good" /> Room <span className="font-display text-sm font-black tracking-[0.18em] text-accent">{online.code}</span>
      <span className="num">{on}/{members.length} online</span>
      <span className="hidden sm:inline">{online.role === "host" ? "You're the host (you sim)" : "The host sims"}</span>
      <Link href="/game/online" className="ml-auto font-semibold text-accent hover:underline">Friends Challenge</Link>
    </div>
  );
}
