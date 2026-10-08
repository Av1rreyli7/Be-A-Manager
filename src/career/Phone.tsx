"use client";
/**
 * His phone: messages from home, the agent and the brands, the team chat, his social account, the news, the
 * calendar and the bank. Everything here reads the career state; posts, deals and savings go to the server.
 */
import { useState } from "react";
import clsx from "clsx";
import { ChatCircle, Briefcase, InstagramLogo, Newspaper, CalendarBlank, Bank, UsersThree, Heart } from "@phosphor-icons/react";
import { careerApi, type Saved } from "./api";
import type { CareerState } from "./types";

type Run = <T>(fn: () => Promise<T>, after?: (r: T) => void) => Promise<void>;
export type PhoneApp = "home" | "messages" | "agent" | "social" | "news" | "calendar" | "bank" | "team";

export function compact(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "m";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k";
  return String(Math.round(n));
}

/** one of his matches as the server keeps it (week reports, the season log, the internationals) */
export interface ResultLine {
  comp: string;
  opp: string;
  team?: string;
  gf?: number;
  ga?: number;
  res?: string;
  role: string;
  mins: number;
  g?: number;
  a?: number;
  rating?: number;
  live?: boolean;
  national?: boolean;
  pro?: boolean;
  level?: string;
  s?: number;
  w?: number;
  wk?: number;
}
const WORD = { W: "Won", L: "Lost", D: "Drew" } as const;
/** won, lost or drawn, from his side's point of view (old saves have no res, so the score decides) */
export function outcome(m: ResultLine): "W" | "L" | "D" | null {
  if (m.res === "W" || m.res === "L" || m.res === "D") return m.res;
  if (typeof m.gf !== "number" || typeof m.ga !== "number") return null;
  return m.gf > m.ga ? "W" : m.gf < m.ga ? "L" : "D";
}
/** the week a line was played in (lines from before wk was kept: youth weeks were stored one lower) */
export function weekOf(m: ResultLine): number | null {
  if (typeof m.wk === "number") return m.wk;
  if (typeof m.w !== "number") return null;
  return m.pro || m.level ? m.w : m.w + 1;
}
function roleText(m: ResultLine) {
  if (m.live) return "Played live";
  if (m.role === "start") return "Started";
  if (m.role === "sub") return "Off the bench" + (m.mins ? ", " + m.mins + " min" : "");
  if (m.role === "injured") return "Injured";
  if (m.role === "out") return "Not picked";
  return "On the bench";
}
/**
 * One result, read at a glance: the W, L or D chip, his team first with the score his way round, then the
 * competition, the week, how he took part and his rating.
 */
export function ResultRow({ m, team, when }: { m: ResultLine; team: string; when?: string }) {
  const res = outcome(m);
  const played = m.mins > 0 && typeof m.rating === "number";
  const meta = [m.comp, when, roleText(m), m.g ? m.g + " goal" + (m.g > 1 ? "s" : "") : "", m.a ? m.a + " assist" + (m.a > 1 ? "s" : "") : ""].filter(Boolean);
  return (
    <div className={clsx("pc-res", m.level && "is-intl")}>
      {res ? (
        <span className={"k-wdl " + res.toLowerCase()} title={WORD[res]} aria-label={WORD[res]}>
          {res}
        </span>
      ) : (
        <span className="pc-res-none" aria-hidden="true" />
      )}
      <p className="pc-res-line">
        <b>{team}</b>
        {res ? <span className="pc-res-score">{m.gf + "-" + m.ga}</span> : <span className="pc-res-v">v</span>}
        <span>{m.opp}</span>
      </p>
      <p className="pc-res-meta">{meta.join(" · ")}</p>
      {played ? (
        <b className={clsx("pc-rate", "pc-res-rate", (m.rating || 0) >= 7.5 && "is-good", (m.rating || 0) < 6 && "is-bad")} title="Match rating">
          {(m.rating || 0).toFixed(1)}
        </b>
      ) : (
        <span className="pc-res-rate pc-dim" title="No rating, he did not play">
          -
        </span>
      )}
    </div>
  );
}

export default function Phone({
  state,
  saved,
  run,
  busy,
  money,
  app,
  setApp,
  onClose,
}: {
  state: CareerState;
  saved: Saved;
  run: Run;
  busy: boolean;
  money: (n: number, o?: { week?: boolean }) => string;
  app: PhoneApp;
  setApp: (a: PhoneApp) => void;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const life = state.life;
  const threads = state.phone.threads;
  const unread = (ids: (t: string) => boolean) => threads.filter((t) => ids(t.id)).reduce((s, t) => s + t.msgs.filter((m) => !m.read).length, 0);
  const isMsg = (id: string) => id !== "agent" && id !== "team";
  const open = (id: string) => {
    setThread(id);
    const t = threads.find((x) => x.id === id);
    if (t && t.msgs.some((m) => !m.read)) run(() => careerApi.read(saved, id));
  };
  const handle = "@" + (state.person.nick || state.person.first + state.person.last).toLowerCase().replace(/[^a-z0-9]/g, "") + state.person.num;
  const APPS: { id: PhoneApp; label: string; Icon: typeof ChatCircle; badge?: number; tone: string }[] = [
    { id: "messages", label: "Messages", Icon: ChatCircle, badge: unread(isMsg), tone: "#63d68f" },
    { id: "agent", label: "Agent", Icon: Briefcase, badge: unread((id) => id === "agent") + life.sponsorOffers.length, tone: "#e8c46a" },
    { id: "social", label: "Social", Icon: InstagramLogo, tone: "#ff7a9a" },
    { id: "team", label: "Team", Icon: UsersThree, badge: unread((id) => id === "team"), tone: "#7ad0ff" },
    { id: "news", label: "News", Icon: Newspaper, tone: "#c9cdc4" },
    { id: "calendar", label: "Calendar", Icon: CalendarBlank, tone: "#ff9a52" },
    { id: "bank", label: "Bank", Icon: Bank, tone: "#d0e85c" },
  ];
  const openApp = (id: PhoneApp) => {
    setApp(id);
    if (id === "team" && threads.some((t) => t.id === "team" && t.msgs.some((m) => !m.read))) run(() => careerApi.read(saved, "team"));
  };
  const back = () => {
    if (thread) setThread(null);
    else if (posting) setPosting(false);
    else setApp("home");
  };
  const chat = (id: string) => {
    const t = threads.find((x) => x.id === id);
    if (!t) return <p className="pc-dim pc-phone-empty">Nothing here yet.</p>;
    return (
      <div className="pc-chat">
        {t.msgs.map((m, i) => (
          <p key={i} className="pc-bubble">
            {id === "team" && <b className="pc-bubble-from">{m.from}</b>}
            {m.text}
            <small>
              Season {m.s}, week {m.w + 1}
            </small>
          </p>
        ))}
      </div>
    );
  };
  let body: React.ReactNode = null;
  if (app === "home") {
    body = (
      <div className="pc-apps">
        {APPS.map(({ id, label, Icon, badge, tone }) => (
          <button type="button" key={id} className="pc-app" onClick={() => openApp(id)} style={{ "--app": tone } as React.CSSProperties}>
            <span className="pc-app-ic">
              <Icon size={24} weight="fill" aria-hidden="true" />
              {badge ? <em>{badge}</em> : null}
            </span>
            {label}
          </button>
        ))}
      </div>
    );
  } else if (app === "messages") {
    body = thread ? (
      chat(thread)
    ) : (
      <ul className="pc-threads">
        {threads
          .filter((t) => isMsg(t.id))
          .map((t) => {
            const last = t.msgs[t.msgs.length - 1];
            const n = t.msgs.filter((m) => !m.read).length;
            return (
              <li key={t.id}>
                <button type="button" onClick={() => open(t.id)}>
                  <span className="pc-avatar">{t.name.slice(0, 1)}</span>
                  <span className="pc-thread-txt">
                    <b>{t.name}</b>
                    <span>{last?.text}</span>
                  </span>
                  {n > 0 && <em>{n}</em>}
                </button>
              </li>
            );
          })}
      </ul>
    );
  } else if (app === "team") {
    body = chat("team");
  } else if (app === "agent") {
    body = (
      <div className="pc-phone-scroll">
        {state.agent ? (
          <div className="pc-phone-card">
            <b>{state.agent.name}</b>
            <span>{state.agent.agency}</span>
            <p>{state.agent.blurb}</p>
          </div>
        ) : (
          <div className="pc-phone-card">
            <b>No agent</b>
            <p>Brands and clubs talk to you directly. An agent gets better deals and bigger sponsors, for a cut.</p>
          </div>
        )}
        {life.sponsorOffers.length > 0 && <h4 className="pc-h4">Brands that want you</h4>}
        {life.sponsorOffers.map((o) => (
          <div key={o.id} className="pc-phone-card is-offer">
            <b>
              {o.brand} <span className="pc-dim">{o.kind}</span>
            </b>
            <p>{o.line}</p>
            <p>
              {money(o.weekly, { week: true })} for {o.weeks} weeks
            </p>
            <div className="pc-phone-btns">
              <button type="button" className="k-btn k-btn-sm" disabled={busy} onClick={() => run(() => careerApi.sponsor(saved, o.id, false))}>
                No thanks
              </button>
              <button type="button" className="k-btn k-btn-primary k-btn-sm" disabled={busy} onClick={() => run(() => careerApi.sponsor(saved, o.id, true))}>
                Sign
              </button>
            </div>
          </div>
        ))}
        <h4 className="pc-h4">Your deals</h4>
        {life.sponsors.length ? (
          <ul className="pc-ledger">
            {life.sponsors.map((s) => (
              <li key={s.id}>
                <span>
                  {s.brand}, {s.kind.toLowerCase()} <span className="pc-dim">{s.weeksLeft} weeks left</span>
                </span>
                <b>{money(s.weekly, { week: true })}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pc-dim">No sponsors yet. They follow followers, and followers follow good football.</p>
        )}
        {threads.some((t) => t.id === "agent") && (
          <>
            <h4 className="pc-h4">Messages</h4>
            <button type="button" className="k-btn" onClick={() => open("agent")}>
              Open the chat
            </button>
          </>
        )}
      </div>
    );
    if (thread) body = chat(thread);
  } else if (app === "social") {
    body = posting ? (
      <div className="pc-phone-scroll">
        <h4 className="pc-h4">What are you posting?</h4>
        <ul className="pc-buys">
          {life.postKinds.map((k) => (
            <li key={k.id} className="pc-buy">
              <div>
                <b>{k.label}</b>
              </div>
              <button
                type="button"
                className="k-btn k-btn-primary k-btn-sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () => careerApi.post(saved, k.id),
                    () => setPosting(false),
                  )
                }
              >
                Post
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : (
      <div className="pc-phone-scroll">
        <div className="pc-social-head">
          <span className="pc-avatar is-big">{state.person.first.slice(0, 1)}</span>
          <div>
            <b>{handle}</b>
            <span>
              <strong>{compact(life.followers)}</strong> followers · {life.posts.length} posts
            </span>
          </div>
        </div>
        <button type="button" className="k-btn k-btn-primary pc-social-post" disabled={life.postedThisWeek} onClick={() => setPosting(true)}>
          {life.postedThisWeek ? "Posted this week" : "New post"}
        </button>
        <ul className="pc-feed">
          {life.posts.map((p, i) => (
            <li key={i} className={clsx(p.backlash && "is-bad")}>
              <div className="pc-feed-pic" data-kind={p.kind} aria-hidden="true" />
              <p>
                <b>{p.label}</b>
              </p>
              <p className="pc-feed-meta">
                <Heart size={14} weight="fill" aria-hidden="true" /> {compact(p.likes)} · +{compact(p.gain)} followers
              </p>
              {p.comments.map((c, k) => (
                <p key={k} className="pc-feed-c">
                  {c}
                </p>
              ))}
            </li>
          ))}
          {!life.posts.length && <li className="pc-dim">No posts yet. Fans like to see the work, the wins and where you come from.</li>}
        </ul>
      </div>
    );
  } else if (app === "news") {
    body = (
      <ul className="pc-news pc-phone-scroll">
        {state.news.map((n, i) => (
          <li key={i} className={"is-" + n.kind}>
            {n.text}
          </li>
        ))}
      </ul>
    );
  } else if (app === "calendar") {
    const results = (state.stats.log as unknown as ResultLine[]).slice(0, 5);
    body = (
      <ul className="pc-ledger pc-phone-scroll">
        {results.length > 0 && (
          <li className="pc-res-head">
            <h4 className="pc-h4">Results</h4>
          </li>
        )}
        {results.map((m, i) => (
          <li key={"r" + i} className="pc-res-li">
            <ResultRow m={m} team={m.team || (m.s === state.season ? state.team : null) || "Your team"} when={weekOf(m) ? "week " + weekOf(m) : undefined} />
          </li>
        ))}
        {results.length > 0 && (
          <li className="pc-res-head">
            <h4 className="pc-h4">Coming up</h4>
          </li>
        )}
        {state.calendar.map((c) => (
          <li key={c.week}>
            <span>
              Week {c.week}
              {c.intl ? <span className="pc-dim">, international window</span> : null}
            </span>
            <b>{c.match ? (c.match.home === false ? "at " : "v ") + c.match.opp : "Free"}</b>
          </li>
        ))}
      </ul>
    );
  } else if (app === "bank") {
    const cash = state.money.cash;
    const save = (n: number) => run(() => careerApi.bank(saved, "save", n));
    const take = (n: number) => run(() => careerApi.bank(saved, "take", n));
    body = (
      <div className="pc-phone-scroll">
        <div className="pc-bank">
          <div>
            <span>Current account</span>
            <b>{money(cash)}</b>
          </div>
          <div>
            <span>Savings</span>
            <b>{money(life.savings)}</b>
          </div>
        </div>
        <p className="pc-dim">Savings earn a little every week, and cover you if the account goes into the red. Living costs about {money(life.weeklyCost, { week: true })}.</p>
        <div className="pc-phone-btns">
          <button type="button" className="k-btn k-btn-sm" disabled={busy || cash < 10} onClick={() => save(Math.floor(cash / 4))}>
            Save a quarter
          </button>
          <button type="button" className="k-btn k-btn-sm" disabled={busy || cash < 10} onClick={() => save(Math.floor(cash / 2))}>
            Save half
          </button>
          <button type="button" className="k-btn k-btn-sm" disabled={busy || life.savings < 1} onClick={() => take(life.savings)}>
            Take it all out
          </button>
        </div>
        <h4 className="pc-h4">Recent</h4>
        <ul className="pc-ledger">
          {state.money.log.slice(0, 12).map((m, i) => (
            <li key={i}>
              <span>{m.text}</span>
              <b className={m.amt < 0 ? "pc-bad" : ""}>{money(m.amt)}</b>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const title = app === "home" ? "" : APPS.find((a) => a.id === app)?.label || "";
  return (
    <div className="k-scrim pc-phone-wrap" role="dialog" aria-modal="true" aria-label="Phone" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pc-phone">
        <div className="pc-phone-notch" />
        <header>
          {app !== "home" ? (
            <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={back}>
              Back
            </button>
          ) : (
            <b>{state.week.replace(/^Season [0-9-]+, /, "")}</b>
          )}
          {title && <b>{title}</b>}
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        {body}
      </div>
    </div>
  );
}
