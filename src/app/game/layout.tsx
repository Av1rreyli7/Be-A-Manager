"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  FileText,
  GearSix,
  IdentificationCard,
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
  type Icon,
} from "@phosphor-icons/react";
import { useGame, useLeague } from "@/lib/store";
import { SimControls } from "@/components/SimControls";
import { PHASE_LABEL, money } from "@/lib/format";
import { fmtDate } from "@/engine/util/dates";
import { guestJoin, hostResume, savedGuestSession } from "@/lib/online/session";
import { useCourtMode, useTeamTheme } from "@/lib/theme";
import { km, useEnterScreen } from "@/lib/motion";
import { conferenceStandings, emptyRecord } from "@/engine/season/standings";
import { capStatus } from "@/engine/cap/payroll";
import { teamPlayers } from "@/engine/league/helpers";

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
      router.replace("/gm?rejoin=1");
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

  useCourtMode();
  return (
    <div data-kmode="court" className="court-root">
      {league ? <Shell>{children}</Shell> : <BootScreen text={tried ? "Taking you back" : "Loading your league"} />}
    </div>
  );
}

function BootScreen({ text }: { text: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="k-brand">
          <span className="sq" />
          <span className="k-msub" style={{ letterSpacing: "0.2em", color: "#fff", fontWeight: 700 }}>
            FRONT OFFICE
          </span>
        </div>
        <div className="h-px w-44 overflow-hidden bg-line">
          <div className="k-shimmer h-full w-full" />
        </div>
        <span className="k-label">{text}</span>
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
  const online = useGame((s) => s.online);
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
  // every screen settles in when the route changes
  const page = useRef<HTMLDivElement>(null);
  useEnterScreen(page, path);
  // the kit indicator slides under the active tab, the same as Floodlights
  const tabs = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const bar = tabs.current;
    if (!bar) return;
    const on = bar.querySelector<HTMLElement>('[aria-current="page"]');
    km.tabIndicator(bar, on);
    bar.classList.add("has-ind");
    on?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [path]);
  const items = l.online ? [{ href: "/game/online", label: "Friends Challenge", icon: UsersFour }, ...NAV.flatMap((g) => g.items)] : NAV.flatMap((g) => g.items);
  const rec = team ? l.standings[team] ?? emptyRecord(team) : null;
  const cap = team ? capStatus(l, team) : null;
  const conf = myTeam ? conferenceStandings(l, myTeam.conference) : [];
  const seed = team ? conf.indexOf(team) + 1 : 0;
  const roster = team ? teamPlayers(l, team).length : 0;
  const manager = l.online && team ? l.online.members[team] : null;
  const live = online?.lobby ? online.lobby.members.filter((m) => m.online).length : 0;

  return (
    <div className="min-h-[100dvh]">
      <div className="k-wrap">
        <div className="k-topbar">
          <div className="k-brand">
            <span className="sq" />
            <span className="nm">FRONT OFFICE</span>
            <span className="tg">NBA FRONT OFFICE MODE</span>
          </div>
          <div className="k-chips">
            <Link className="chip" href="/gm" title="Back to the Front Office main menu">
              Main menu
            </Link>
            {l.online && (
              <span className="chip">
                Room <b className="code">{l.online.code}</b>
              </span>
            )}
            <span className="chip">
              Season <b>{l.season}</b> &middot; <b>{fmtDate(l.date, { month: "short", day: "numeric" })}</b>
            </span>
            <span className="chip">{PHASE_LABEL[l.phase]}</span>
            {l.online && (
              <span className="chip">
                <span className="k-pulse" />
                {live} {live === 1 ? "manager" : "managers"} live
              </span>
            )}
            {l.settings.commissioner && <span className="chip">Commissioner</span>}
            {l.userTeams.length > 1 && !l.online && (
              <span className="chip">
                <select aria-label="Team you are managing" className="k-input" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={team ?? ""} onChange={(e) => setTeam(e.target.value)}>
                  {l.userTeams.map((t) => (
                    <option key={t} value={t}>
                      {l.teams[t].fullName}
                    </option>
                  ))}
                </select>
              </span>
            )}
          </div>
        </div>
        <OnlineBar />

        <div className="k-hubhead">
          <div className="min-w-0">
            <div className="who">
              Your team &middot; {myTeam?.conference ?? ""}
              {manager ? <> &middot; Managed by {manager}</> : null}
            </div>
            <div className="clubname">{myTeam?.fullName}</div>
          </div>
          <div className="k-clubmeta">
            <span className="k-cm">
              <span className="k-cmk">Record</span>
              <b className="k-cmv k-acc">{rec ? `${rec.w}-${rec.l}` : "-"}</b>
            </span>
            <span className="k-cm">
              <span className="k-cmk">Seed</span>
              <b className="k-cmv">{seed > 0 ? ordinal(seed) : "-"}</b>
            </span>
            <span className="k-cm">
              <span className="k-cmk">Payroll</span>
              <b className="k-cmv">{cap ? money(cap.salary) : "-"}</b>
            </span>
            <span className="k-cm">
              <span className="k-cmk">Cap space</span>
              <b className={clsx("k-cmv", cap && cap.room > 0 ? "k-good" : undefined)}>{cap ? money(cap.room) : "-"}</b>
            </span>
            <span className="k-cm">
              <span className="k-cmk">Roster</span>
              <b className="k-cmv">{roster}</b>
            </span>
          </div>
        </div>

        <div className="k-controls">
          {busy ? (
            <span className="k-msub mr-auto flex items-center gap-2">
              <span className="k-pulse" />
              {busy} {progress && <b className="text-white">{fmtDate(progress)}</b>}
            </span>
          ) : (
            <span className="mr-auto" />
          )}
          <SimControls />
        </div>

        <nav ref={tabs} className="k-tabs sticky top-0 z-[6] mb-[18px]" aria-label="Game">
          {items.map((i) => (
            <Link key={i.href} href={i.href} aria-current={isActive(i.href, path) ? "page" : undefined}>
              {i.label}
            </Link>
          ))}
        </nav>

        <main id="main" className="min-w-0">
          <div key={path} ref={page}>
            {children}
          </div>
        </main>
      </div>
      <Ticker />
    </div>
  );
}

const ordinal = (n: number) => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");

/** The wire along the foot of the screen, like Floodlights: the latest final scores league wide, then headlines. */
function Ticker() {
  const l = useLeague();
  const played = l.schedule.filter((g) => g.played && g.result);
  const scores = played.slice(-14).reverse();
  const news = l.news.slice(0, 6);
  const count = scores.length + news.length;
  return (
    <div className="k-ticker" data-label="AROUND THE LEAGUE">
      <div className="k-ticker-inner" style={{ animationDuration: `${Math.max(40, count * 6)}s` }}>
        {count === 0 && <span>Welcome to the league. Results and news run here once the season starts.</span>}
        {scores.map((g) => {
          const r = g.result!;
          return (
            <Link key={g.id} href={`/game/box/${encodeURIComponent(g.id)}`} className="pr-6">
              Final &middot; {g.away} {r.awayScore} &middot; {g.home} {r.homeScore}
            </Link>
          );
        })}
        {news.map((n) => (
          <Link key={n.id} href="/game/news" className="pr-6">
            {n.type} &middot; {n.text}
          </Link>
        ))}
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
  const cls = "k-controls !mb-0 border-b border-line py-2.5";
  if (!online)
    return (
      <div className={cls}>
        <span className="k-msub mr-auto">ONLINE LEAGUE. FRIENDS CAN&apos;T CONNECT UNTIL YOU OPEN THE ROOM.</span>
        <button disabled={working} className="k-btn k-btn-sm" onClick={async () => { setWorking(true); await hostResume(); setWorking(false); }}>
          {working ? "Opening" : `Open room ${l.online.code}`}
        </button>
      </div>
    );
  if (online.status === "disconnected")
    return (
      <div className={cls}>
        <span className="k-msub mr-auto" style={{ color: "var(--k-bad)" }}>{online.error ?? "Disconnected."}</span>
        {online.role === "guest" && (
          <button disabled={working} className="k-btn k-btn-sm" onClick={async () => { const s = savedGuestSession(); if (!s) return; setWorking(true); try { await guestJoin(s.code, s.name); } catch (e) { toast((e as Error).message, "error"); } setWorking(false); }}>
            {working ? "Reconnecting" : "Reconnect"}
          </button>
        )}
        {online.role === "host" && <button className="k-btn k-btn-sm" onClick={() => void hostResume()}>Re-open room</button>}
      </div>
    );
  return (
    <div className={cls}>
      <span className="k-msub mr-auto">{online.role === "host" ? "YOU ARE THE HOST: YOU RUN THE SIM" : "THE HOST RUNS THE SIM"}</span>
      <Link href="/game/online" className="k-btn k-btn-sm">Friends Challenge</Link>
    </div>
  );
}
