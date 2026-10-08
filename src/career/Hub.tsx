"use client";
/**
 * The career hub: who he is, how he is, what this week holds, the choices waiting for him, his phone.
 * Everything changes through the server; this screen only shows the state and sends what the person picks.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import clsx from "clsx";
import gsap from "gsap";
import { careerApi, ApiError, type Saved, type WeekReport } from "./api";
import type { CareerState, Offer } from "./types";
import type { Meta } from "./Creator";
import { OUTFITS, kitOutfit } from "./body";
import Phone, { type PhoneApp } from "./Phone";

const Stage = dynamic(() => import("./Stage"), {
  ssr: false,
  loading: () => <div className="pc-stage-wait" />,
});

const City = dynamic(() => import("./city/City"), {
  ssr: false,
  loading: () => <div className="pc-city pc-stage-wait" />,
});

const GFX = [
  { name: "Low", note: "No shadows, simple light, a lighter city. For older laptops." },
  { name: "Medium", note: "Shadows on, fewer effects, a little softer." },
  { name: "High", note: "Shadows, reflections and the full city. The best fit for most laptops." },
  { name: "Ultra", note: "The sharpest picture and the biggest shadows. For strong machines." },
];

const STAGE_LABEL: Record<string, string> = {
  school: "School",
  college: "College",
  academy: "Academy",
  centre: "Development centre",
  pro: "Professional",
};
const LEVEL_LABEL: Record<string, string> = {
  u17: "Under 17s",
  u20: "Under 20s",
  u23: "Under 23s",
  senior: "Senior team",
};
const OFFER_KIND: Record<string, string> = {
  first: "First contract",
  transfer: "Transfer",
  loan: "Loan",
  free: "Free transfer",
  renewal: "New deal",
};
const initials = (club: string) =>
  club
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3);

export function useMoney(meta: Meta, currency: string) {
  return useMemo(() => {
    const fx = meta.fx[currency] || meta.fx.GBP;
    return (amtGbp: number, opts?: { week?: boolean }) => {
      const v = amtGbp * fx.r;
      const abs = Math.abs(v);
      const s = abs >= 1e6 ? (abs / 1e6).toFixed(abs >= 1e8 ? 0 : abs >= 1e7 ? 1 : 2) + "m" : abs >= 1e5 ? Math.round(abs / 1000) + "k" : Math.round(abs).toLocaleString("en-GB");
      return (v < 0 ? "-" : "") + fx.sym + s + (opts?.week ? " a week" : "");
    };
  }, [meta, currency]);
}

function Bar({ label, v, max = 100, tone }: { label: string; v: number; max?: number; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="pc-bar">
      <span>{label}</span>
      <i>
        <b className={clsx(tone && "is-" + tone)} style={{ width: Math.max(2, Math.min(100, (v / max) * 100)) + "%" }} />
      </i>
      <em>{Math.round(v)}</em>
    </div>
  );
}

export default function Hub({
  saved,
  state,
  setState,
  meta,
  quality,
  setQuality,
  auto,
  setAuto,
  onSlow,
  onExit,
}: {
  saved: Saved;
  state: CareerState;
  setState: (s: CareerState) => void;
  meta: Meta;
  quality: number;
  setQuality: (q: number) => void;
  auto: boolean;
  setAuto: (on: boolean) => void;
  /** the frame guard's way down a level (undefined when the person switched it off) */
  onSlow?: (q: number) => void;
  onExit: () => void;
}) {
  const money = useMoney(meta, state.currency);
  const [gfxOpen, setGfxOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // a live match played on the Floodlights page leaves its week report behind for this screen
  const [reports, setReports] = useState<WeekReport[]>(() => {
    try {
      const raw = sessionStorage.getItem("fl_pc_report");
      sessionStorage.removeItem("fl_pc_report");
      return raw ? (JSON.parse(raw) as WeekReport[]) : [];
    } catch {
      return [];
    }
  });
  // the plan on screen is the server's, or the one just picked while it is being saved
  const [pending, setPending] = useState<{
    slots: string[];
    intensity: string;
  } | null>(null);
  const plan = pending ? pending.slots : state.training.slots;
  const intensity = pending ? pending.intensity : state.training.intensity;
  const [picker, setPicker] = useState<null | {
    kind: string;
    id: string;
    title: string;
    options: { id: string; [k: string]: unknown }[];
  }>(null);
  const [offersOpen, setOffersOpen] = useState(false);
  const [phoneApp, setPhoneApp] = useState<PhoneApp | null>(null);
  const [tab, setTab] = useState<"career" | "city">("career");
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  // what the person was doing when an event stopped the week: it carries on once the event is answered
  const retry = useRef<null | (() => void)>(null);
  const [note, setNote] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const p = state.player;
  const S = state.stats.season;
  const avg = S.rN ? (S.rSum / S.rN).toFixed(2) : "-";
  const moment = Object.entries(state.moments).find(([k, m]) => !m.seen && k !== "retire");
  const C = state.stats.career;
  const careerAvg = C.rN ? (C.rSum / C.rN).toFixed(2) : "-";
  const caps = Object.entries(state.national.caps || {});

  useEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".pc-card-in", {
        y: 14,
        opacity: 0,
        duration: 0.45,
        stagger: 0.04,
        ease: "power3.out",
        clearProps: "all",
      });
    }, root);
    return () => ctx.revert();
  }, []);

  const run = async <T,>(fn: () => Promise<T>, after?: (r: T) => void) => {
    setBusy(true);
    setErr("");
    try {
      const r = await fn();
      const st = (r as { state?: CareerState }).state;
      if (st) setState(st);
      if (after) after(r);
    } catch (e) {
      if (e instanceof ApiError && e.event) {
        retry.current = () => run(fn, after);
        setEventOpen(true);
      } else if (e instanceof ApiError && e.decision) openDecision(e.decision.id);
      else setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const openDecision = async (id: string) => {
    const d = state.decisions.find((x) => x.id === id) || state.decisions[0];
    if (!d) return;
    if (d.kind === "trial") {
      setPicker({
        kind: "trial",
        id: d.id,
        title: d.title,
        options: [
          { id: "go", label: "Go to the trial" },
          { id: "decline", label: "Not now" },
        ],
      });
      return;
    }
    const kind = d.kind === "centre" ? null : d.kind;
    if (!kind) {
      run(() => careerApi.decide(saved, d.id, "centre"));
      return;
    }
    const r = await careerApi.options<{
      id?: string;
      club?: string;
      [k: string]: unknown;
    }>(saved, kind);
    setPicker({
      kind,
      id: d.id,
      title: d.title,
      options: r.options.map((o) => ({ ...o, id: String(o.id || o.club) })),
    });
  };

  const savePlan = (slots: string[], inten: string) => {
    setPending({ slots, intensity: inten });
    run(() => careerApi.plan(saved, slots, inten)).then(() => setPending(null));
  };

  const week = (n: number) =>
    run(
      () => careerApi.week(saved, n),
      (r) => {
        setReports(r.reports.slice().reverse());
      },
    );

  const blocking = state.decisions.filter((d) => !d.optional);
  const sessionOpts = Object.entries(state.training.sessions);
  const outfit = state.stage === "school" ? OUTFITS.school : OUTFITS.training;

  const pendingEv = state.people.pending;
  // his league match this week can be played live (player lock) when he is a fit outfield professional
  const canPlayLive =
    state.stage === "pro" &&
    !!state.player.club &&
    state.person.pos !== "GK" &&
    !state.cond.inj &&
    !state.seasonOver &&
    !!state.next &&
    !state.next.national &&
    state.next.comp === state.player.league;
  const playLive = () => {
    if (state.decisions.some((d) => !d.optional)) return openDecision(state.decisions.find((d) => !d.optional)!.id);
    // the match overlay lives on the Floodlights page; it comes back here when the match is over
    window.location.assign(new URL("/floodlights/#pcmatch", window.location.origin).href);
  };
  const alerts = (blocking.length > 0 || state.decisions.length > 0 || state.offers.length > 0 || !!pendingEv) && (
    <section className="pc-alerts pc-card-in">
      {pendingEv && (
        <button type="button" className="pc-alert is-brew" onClick={() => setEventOpen(true)}>
          <b>Something is brewing</b>
          {pendingEv.tease}
        </button>
      )}
      {state.decisions.map((d) => (
        <button type="button" key={d.id} className={clsx("pc-alert", !d.optional && "is-urgent")} onClick={() => openDecision(d.id)}>
          <b>{d.optional ? "Choice" : "Your call"}</b>
          {d.title}
        </button>
      ))}
      {state.offers.length > 0 && (
        <button type="button" className="pc-alert is-gold" onClick={() => setOffersOpen(true)}>
          <b>{state.offers.every((o) => o.kind === "renewal") ? "New deal" : "Offers"}</b>
          {offerAlert(state.offers)}
        </button>
      )}
    </section>
  );

  return (
    <div className="pc-hub" ref={root}>
      <header className="pc-top">
        <button type="button" className="pc-brand" onClick={onExit}>
          <span className="pc-dot" />
          Floodlights <b>Player Career</b>
        </button>
        {!state.retired && (
          <nav className="pc-tabs" aria-label="Screens">
            <button type="button" className={clsx(tab === "career" && "is-on")} aria-pressed={tab === "career"} onClick={() => setTab("career")}>
              Career
            </button>
            <button type="button" className={clsx(tab === "city" && "is-on")} aria-pressed={tab === "city"} onClick={() => setTab("city")}>
              {state.life.city}
            </button>
          </nav>
        )}
        <span className="pc-week">{state.week}</span>
        <span className="pc-cash" title="Your money">
          {money(state.money.cash)}
        </span>
        <button type="button" className="pc-phone-btn" onClick={() => setPhoneApp("home")} aria-label={"Phone, " + state.phone.unread + " unread"}>
          Phone {state.phone.unread > 0 && <b>{state.phone.unread}</b>}
        </button>
        <div className="pc-gfx-wrap">
          <button type="button" className="pc-gfx" aria-expanded={gfxOpen} aria-haspopup="dialog" onClick={() => setGfxOpen((v) => !v)}>
            Graphics <b>{GFX[quality].name}</b>
          </button>
          {gfxOpen && (
            <div className="pc-gfx-pop" role="dialog" aria-label="Graphics settings">
              <p className="pc-kicker">Graphics</p>
              {GFX.map((g, i) => (
                <button type="button" key={g.name} className={clsx("pc-gfx-tier", quality === i && "is-on")} aria-pressed={quality === i} onClick={() => setQuality(i)}>
                  <b>{g.name}</b>
                  <span>{g.note}</span>
                </button>
              ))}
              <label className="pc-gfx-auto">
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                <span>
                  <b>Keep it smooth</b>
                  Drop a level on its own when frames run long, so it stays near 60 a second.
                </span>
              </label>
              <button type="button" className="pc-link" onClick={() => setGfxOpen(false)}>
                Done
              </button>
            </div>
          )}
        </div>
      </header>

      {state.retired ? (
        <Retired state={state} saved={saved} money={money} quality={quality} />
      ) : tab === "city" ? (
        <>
          {alerts}
          <City
            state={state}
            saved={saved}
            quality={quality}
            setQuality={onSlow || (() => {})}
            money={money}
            run={run}
            busy={busy}
            onPhone={(a) => setPhoneApp(a as PhoneApp)}
            onWeek={() => week(1)}
          />
        </>
      ) : (
        <>
          <section className="pc-hero pc-card-in">
            <Stage look={state.look} person={state.person} outfit={outfit} view="body" quality={quality} onSlow={onSlow} className="pc-hero-stage" />
            <div className="pc-hero-info">
              <p className="pc-kicker">
                {STAGE_LABEL[state.stage]} · {state.team || (state.freeAgent ? "Free agent" : "No club")}
                {state.captain && (
                  <span className="pc-tag is-gold" title="Club captain">
                    Captain
                  </span>
                )}
                {state.loan && <span className="pc-tag">On loan from {state.loan.from}</span>}
                {state.requested && <span className="pc-tag is-warn">Transfer listed</span>}
              </p>
              <h1 className="pc-name">
                {state.person.first} <b>{state.person.last}</b>
              </h1>
              <p className="pc-meta">
                {p.age} · {p.pos}
                {p.pos2 ? " / " + p.pos2 : ""} · {state.person.foot} foot · {state.person.nat} · {state.city}
              </p>
              <div className="pc-ovr">
                <div>
                  <b className="pc-ovr-n">{p.rating}</b>
                  <span>Overall</span>
                </div>
                <div>
                  <b className="pc-ovr-p">
                    {p.potential[0]} to {p.potential[1]}
                  </b>
                  <span>Potential, the coaches think</span>
                </div>
                {state.contract && (
                  <div>
                    <b className="pc-ovr-p">{money(state.contract.wage)}</b>
                    <span>a week, {state.contract.role}</span>
                  </div>
                )}
              </div>
              <div className="pc-conds">
                <Bar label="Form" v={state.cond.form * 10} tone={state.cond.form >= 7 ? "good" : state.cond.form < 6 ? "bad" : undefined} />
                <Bar label="Fitness" v={state.cond.fitness} tone={state.cond.fitness < 70 ? "warn" : "good"} />
                <Bar label="Fatigue" v={state.cond.fatigue} tone={state.cond.fatigue > 70 ? "bad" : state.cond.fatigue > 50 ? "warn" : undefined} />
                <Bar label="Morale" v={state.cond.morale} />
                <Bar label="Confidence" v={state.cond.confidence} />
                {state.stage === "pro" ? <Bar label="Manager trust" v={state.trust} /> : <Bar label="Coach" v={state.coachRel} />}
              </div>
              {state.cond.inj && (
                <p className="pc-inj">
                  Injured: {state.cond.inj.name}, about {state.cond.inj.weeks} week{state.cond.inj.weeks === 1 ? "" : "s"} to go. Recovery sessions speed it up.
                </p>
              )}
            </div>
          </section>

          {alerts}

          <div className="pc-grid">
            <section className="pc-panel pc-week-panel pc-card-in">
              <h3 className="pc-h3">This week</h3>
              {state.next ? (
                <p className="pc-next">
                  <span className="pc-dim">Week {state.next.week}</span> {state.next.comp}
                  {state.next.national ? " (national)" : ""} against <b>{state.next.opp}</b>
                  {state.next.home !== undefined ? (state.next.home ? ", at home" : ", away") : ""}
                </p>
              ) : (
                <p className="pc-next pc-dim">No match this week. A good week to train hard, or to rest.</p>
              )}
              <div className="pc-plan">
                {plan.map((s, i) => (
                  <label key={i} className="pc-slot">
                    <span>Session {i + 1}</span>
                    <select
                      className="k-input"
                      value={s}
                      onChange={(e) => {
                        const n = plan.slice();
                        n[i] = e.target.value;
                        savePlan(n, intensity);
                      }}
                    >
                      {sessionOpts.map(([id, se]) => (
                        <option key={id} value={id}>
                          {se.label}
                          {se.cost ? " (" + money(se.cost) + ")" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="pc-seg pc-intensity" role="group" aria-label="Intensity">
                {state.training.intensities.map((x) => (
                  <button type="button" key={x} className={clsx(intensity === x && "is-on")} onClick={() => savePlan(plan, x)}>
                    {x}
                  </button>
                ))}
              </div>
              <p className="pc-note">Hard weeks grow you faster and tire you more. Train tired and the risk of an injury climbs fast. Recovery and rest bring the fatigue down.</p>
              <div className="pc-go-row">
                {state.seasonOver ? (
                  <button type="button" className="k-btn k-btn-primary pc-go" disabled={busy} onClick={() => run(() => careerApi.season(saved))}>
                    Start next season
                  </button>
                ) : (
                  <>
                    {canPlayLive && (
                      <button
                        type="button"
                        className="k-btn k-btn-primary pc-go"
                        disabled={busy || !!pendingEv}
                        onClick={playLive}
                        title="Play the match yourself, in control of only your own footballer"
                      >
                        Play the match
                      </button>
                    )}
                    <button type="button" className={clsx("k-btn pc-go", canPlayLive ? "k-btn-glass" : "k-btn-primary")} disabled={busy} onClick={() => week(1)}>
                      {busy ? "Playing" : canPlayLive ? "Sim the week" : "Play the week"}
                    </button>
                    <button type="button" className="k-btn k-btn-glass" disabled={busy} onClick={() => week(8)} title="Plays on until something needs you">
                      Sim to the next event
                    </button>
                  </>
                )}
              </div>
              {err && <p className="pc-bad">{err}</p>}
              {reports.length > 0 && (
                <ul className="pc-reports">
                  {reports.slice(0, 6).map((r, i) => (
                    <li key={i}>
                      {r.tease && (
                        <span className="pc-teaser">
                          <b>Something is brewing</b>
                          {r.tease}
                        </span>
                      )}
                      <span className="pc-dim">{r.week.replace(/^Season [0-9-]+, /, "")}</span>
                      {r.match ? (
                        r.match.mins ? (
                          <span>
                            {r.match.comp}: {r.match.gf}-{r.match.ga} v {r.match.opp}, {r.match.live ? "played live" : r.match.role === "start" ? "started" : "off the bench"}
                            {r.match.g ? ", " + r.match.g + " goal" + (r.match.g > 1 ? "s" : "") : ""}
                            {r.match.a ? ", " + r.match.a + " assist" + (r.match.a > 1 ? "s" : "") : ""}
                            <b className={clsx("pc-rate", (r.match.rating || 0) >= 7.5 && "is-good", (r.match.rating || 0) < 6 && "is-bad")}>{r.match.rating?.toFixed(1)}</b>
                          </span>
                        ) : (
                          <span className="pc-dim">
                            {r.match.comp} v {r.match.opp}: {r.match.role === "injured" ? "injured" : "did not play"}
                          </span>
                        )
                      ) : (
                        <span className="pc-dim">Training week</span>
                      )}
                      {r.intl && (
                        <span className="pc-intl">
                          {r.intl.comp}: {r.intl.gf}-{r.intl.ga} v {r.intl.opp}
                          {r.intl.mins ? (r.intl.role === "start" ? ", started" : ", off the bench") : ", on the bench"}
                          {r.intl.g ? ", " + r.intl.g + " goal" + (r.intl.g > 1 ? "s" : "") : ""}
                          {r.intl.mins && r.intl.rating ? <b className="pc-rate">{r.intl.rating.toFixed(1)}</b> : null}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pc-panel pc-card-in">
              <h3 className="pc-h3">Attributes</h3>
              <div className="pc-attrs">
                {Object.entries(meta.attrs).map(([group, keys]) =>
                  group === "keeping" && state.person.pos !== "GK" ? null : (
                    <div key={group} className="pc-attr-group">
                      <h4>{group}</h4>
                      {keys.map((k) => {
                        const v = state.attrs[k] || 0;
                        const gain = state.lastGains[k] || 0;
                        return (
                          <div key={k} className="pc-attr">
                            <span>{meta.labels[k]}</span>
                            <i>
                              <b style={{ width: v + "%" }} className={clsx(v >= 75 && "is-hi", v < 45 && "is-lo")} />
                            </i>
                            <em>
                              {v}
                              {gain >= 0.05 && <sup>+{gain.toFixed(1)}</sup>}
                            </em>
                          </div>
                        );
                      })}
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="pc-panel pc-card-in">
              <h3 className="pc-h3">Season</h3>
              <div className="pc-stats">
                <div>
                  <b>{S.apps}</b>
                  <span>Apps</span>
                </div>
                <div>
                  <b>{S.g}</b>
                  <span>Goals</span>
                </div>
                <div>
                  <b>{S.a}</b>
                  <span>Assists</span>
                </div>
                <div>
                  <b>{avg}</b>
                  <span>Average</span>
                </div>
              </div>
              {state.stage !== "pro" && <h4 className="pc-h4">Scouts watching</h4>}
              {state.stage === "pro" ? null : state.scouts.length ? (
                <ul className="pc-scouts">
                  {state.scouts.map((s) => (
                    <li key={s.club}>
                      <span>{s.club}</span>
                      <i>
                        <b style={{ width: s.level + "%" }} />
                      </i>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pc-dim">Nobody yet. Good games in front of scouts change that.</p>
              )}
              <h4 className="pc-h4">Reputation</h4>
              <div className="pc-conds">
                <Bar label="Local" v={state.rep.local} />
                <Bar label="National" v={state.rep.national} />
                <Bar label="International" v={state.rep.international} />
              </div>
            </section>

            <section className="pc-panel pc-card-in pc-people">
              <h3 className="pc-h3">People</h3>
              <ul className="pc-folk">
                {state.people.family.map((f) => (
                  <li key={f.id}>
                    <span className="pc-avatar">{f.name.slice(0, 1)}</span>
                    <span>
                      <b>{f.name}</b>
                      <em>{f.role}</em>
                    </span>
                    <RelBar v={f.rel} />
                  </li>
                ))}
                <li>
                  <span className="pc-avatar">{state.people.friend.name.slice(0, 1)}</span>
                  <span>
                    <b>{state.people.friend.name}</b>
                    <em>Oldest friend</em>
                  </span>
                  <RelBar v={state.people.friend.rel} />
                </li>
                {state.people.best && (
                  <li>
                    <span className="pc-avatar">{state.people.best.name.slice(0, 1)}</span>
                    <span>
                      <b>{state.people.best.name}</b>
                      <em>Best mate in the squad</em>
                    </span>
                    <RelBar v={state.people.best.rel} />
                  </li>
                )}
              </ul>
              <div className="pc-conds">
                <Bar label="Dressing room" v={state.people.team} />
                <Bar label={state.stage === "pro" ? "Manager" : "Coach"} v={state.people.coach} />
                {state.people.agent !== null && <Bar label="Agent" v={state.people.agent} />}
              </div>
              <div className="pc-career-btns">
                <button type="button" className="k-btn k-btn-glass" disabled={busy || state.decisions.some((d) => d.kind === "agent")} onClick={() => run(() => careerApi.agent(saved, "find"))}>
                  {state.agent ? "Look for a new agent" : "Find an agent"}
                </button>
                {state.agent && (
                  <button type="button" className="k-btn k-btn-glass" disabled={busy} onClick={() => run(() => careerApi.agent(saved, "drop"))}>
                    Let {state.agent.name.split(" ")[0]} go
                  </button>
                )}
              </div>
              {state.people.log.length > 0 && (
                <>
                  <h4 className="pc-h4">Choices you made</h4>
                  <ul className="pc-ledger">
                    {state.people.log.slice(0, 4).map((l, i) => (
                      <li key={i}>
                        <span>{l.title}</span>
                        <b className="pc-dim">{l.choice}</b>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="pc-panel pc-card-in pc-career-panel">
              <h3 className="pc-h3">Career</h3>
              <div className="pc-stats">
                <div>
                  <b>{C.apps}</b>
                  <span>Games</span>
                </div>
                <div>
                  <b>{C.g}</b>
                  <span>Goals</span>
                </div>
                <div>
                  <b>{C.a}</b>
                  <span>Assists</span>
                </div>
                <div>
                  <b>{careerAvg}</b>
                  <span>Average</span>
                </div>
              </div>
              <h4 className="pc-h4">{state.person.nat}</h4>
              {caps.length ? (
                <>
                  <ul className="pc-caps">
                    {caps.map(([lvl, n]) => (
                      <li key={lvl} className={clsx(state.national.level === lvl && "is-now")}>
                        <b>{n}</b>
                        <span>
                          {LEVEL_LABEL[lvl] || lvl} cap{n === 1 ? "" : "s"}
                          {state.national.goals[lvl] ? ", " + state.national.goals[lvl] + " goal" + (state.national.goals[lvl] === 1 ? "" : "s") : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <ul className="pc-ledger">
                    {state.national.log.slice(0, 3).map((m, i) => (
                      <li key={i}>
                        <span>
                          {m.comp} v {m.opp}, {m.gf}-{m.ga}
                        </span>
                        <b>{m.mins ? (m.rating || 0).toFixed(1) : "Bench"}</b>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="pc-dim">No call up yet. National coaches pick players who play well week after week, at a good level.</p>
              )}
              <h4 className="pc-h4">Honours</h4>
              {state.trophies.length || state.awards.length ? (
                <ul className="pc-honours">
                  {state.trophies.map((t, i) => (
                    <li key={"t" + i}>
                      <span className="pc-cup" aria-hidden="true" />
                      {t.title}
                      <em>
                        {t.club}, season {t.s}
                      </em>
                    </li>
                  ))}
                  {state.awards.map((a, i) => (
                    <li key={"a" + i} className="is-award">
                      <span className="pc-cup" aria-hidden="true" />
                      {a.title}
                      <em>season {a.s}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pc-dim">Nothing in the cabinet yet.</p>
              )}
              {state.transfers.length > 0 && (
                <>
                  <h4 className="pc-h4">Moves</h4>
                  <ul className="pc-ledger">
                    {state.transfers
                      .slice()
                      .reverse()
                      .slice(0, 5)
                      .map((t, i) => (
                        <li key={i}>
                          <span>
                            {t.from ? t.from + " to " : ""}
                            {t.to}
                            <span className="pc-dim"> · season {t.s}</span>
                          </span>
                          <b>{t.kind === "loan" ? "Loan" : t.fee ? "£" + t.fee + "m" : t.kind === "first" ? "First deal" : "Free"}</b>
                        </li>
                      ))}
                  </ul>
                </>
              )}
              {state.stage === "pro" && (
                <div className="pc-career-btns">
                  {state.player.club && !state.requested && !state.loan && (
                    <button type="button" className="k-btn k-btn-glass" disabled={busy} onClick={() => run(() => careerApi.request(saved))} title="Tell the club you want to leave">
                      Ask for a transfer
                    </button>
                  )}
                  {state.canRetire &&
                    (confirmRetire ? (
                      <span className="pc-confirm">
                        Hang up the boots for good?
                        <button
                          type="button"
                          className="k-btn k-btn-primary"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => careerApi.retire(saved),
                              () => setConfirmRetire(false),
                            )
                          }
                        >
                          Yes, retire
                        </button>
                        <button type="button" className="k-btn k-btn-ghost" onClick={() => setConfirmRetire(false)}>
                          Not yet
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="k-btn k-btn-glass" onClick={() => setConfirmRetire(true)}>
                        Retire
                      </button>
                    ))}
                </div>
              )}
            </section>

            <section className="pc-panel pc-card-in">
              <h3 className="pc-h3">News</h3>
              <ul className="pc-news">
                {state.news.slice(0, 10).map((n, i) => (
                  <li key={i} className={"is-" + n.kind}>
                    {n.text}
                  </li>
                ))}
              </ul>
              <h4 className="pc-h4">Money</h4>
              <ul className="pc-ledger">
                {state.money.log.slice(0, 6).map((m, i) => (
                  <li key={i}>
                    <span>{m.text}</span>
                    <b className={m.amt < 0 ? "pc-bad" : ""}>{money(m.amt)}</b>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
      {picker && (
        <div className="pc-modal" role="dialog" aria-modal="true" aria-label={picker.title}>
          <div className="pc-modal-in">
            <h2 className="pc-h2">{picker.title}</h2>
            <div className="pc-choices">
              {picker.options.map((o) => {
                const a = o as Record<string, unknown>;
                const name = String(a.name || a.club || a.label || o.id);
                const blurb = String(a.blurb || (a.tier ? a.tier + ". First team chances " + a.firstTeamPath + " out of 10." : "") || "");
                const accepted = a.accepted === undefined ? true : !!a.accepted;
                return (
                  <button
                    type="button"
                    key={o.id}
                    className={clsx("pc-choice", !accepted && "is-off")}
                    disabled={busy || !accepted}
                    onClick={() =>
                      run(
                        () => careerApi.decide(saved, picker.id, o.id),
                        () => setPicker(null),
                      )
                    }
                  >
                    <b>{name}</b>
                    {a.area || a.city || a.agency ? <span className="pc-dim">{String(a.area || a.city || a.agency)}</span> : null}
                    {blurb && <span>{blurb}</span>}
                    {picker.kind === "school" && (
                      <span className="pc-choice-nums">
                        Coaching {String(a.coaching)} · Facilities {String(a.facilities)} · Competition {String(a.competition)} · Scouts {String(a.exposure)} · {money(Number(a.tuition))} a year
                      </span>
                    )}
                    {picker.kind === "college" && (
                      <span className="pc-choice-nums">
                        Reputation {String(a.reputation)} · Coaching {String(a.coaching)} · Facilities {String(a.facilities)} · Scouts {String(a.exposure)} · Competition {String(a.competition)} ·{" "}
                        {money(Number(a.cost))} a year
                        {!accepted && " · No place for you yet"}
                      </span>
                    )}
                    {picker.kind === "agent" && (
                      <span className="pc-choice-nums">
                        Contracts {String(a.negotiate)} · Europe {String(a.europe)} · Sponsors {String(a.sponsor)} · Care {String(a.care)} · Takes {Math.round(Number(a.fee) * 100)} percent
                      </span>
                    )}
                  </button>
                );
              })}
              {picker.kind === "agent" && (
                <button
                  type="button"
                  className="pc-choice"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => careerApi.decide(saved, picker.id, "none"),
                      () => setPicker(null),
                    )
                  }
                >
                  <b>No agent for now</b>
                  <span>Keep every penny, do every deal yourself.</span>
                </button>
              )}
            </div>
            <button type="button" className="k-btn k-btn-ghost" onClick={() => setPicker(null)}>
              Later
            </button>
          </div>
        </div>
      )}

      {offersOpen && (
        <div className="pc-modal" role="dialog" aria-modal="true" aria-label="Contract offers">
          <div className="pc-modal-in pc-offers">
            <h2 className="pc-h2">Offers on the table</h2>
            <div className="pc-offer-row">
              {state.offers.map((o: Offer) => (
                <article key={o.id} className={clsx("pc-offer", o.kind && "is-" + o.kind)}>
                  <p className="pc-offer-kind">
                    {OFFER_KIND[o.kind || "first"]}
                    {o.kind === "transfer" && o.fee ? ", £" + o.fee + "m fee agreed" : ""}
                    {o.kind === "loan" ? " until the summer" : ""}
                  </p>
                  <div className="pc-badge">{initials(o.club)}</div>
                  <h3>{o.club}</h3>
                  <p className="pc-dim">{o.league}</p>
                  <dl>
                    <dt>Wage</dt>
                    <dd>{money(o.wage, { week: true })}</dd>
                    <dt>Length</dt>
                    <dd>{o.kind === "loan" ? "Rest of the season" : o.years + " years"}</dd>
                    <dt>Squad role</dt>
                    <dd>{o.role}</dd>
                    <dt>Signing bonus</dt>
                    <dd>{money(o.signing)}</dd>
                    <dt>Appearance</dt>
                    <dd>{money(o.bonus.app)}</dd>
                    <dt>Goal</dt>
                    <dd>{money(o.bonus.goal)}</dd>
                    <dt>Assist</dt>
                    <dd>{money(o.bonus.assist)}</dd>
                    {o.bonus.cs > 0 && (
                      <>
                        <dt>Clean sheet</dt>
                        <dd>{money(o.bonus.cs)}</dd>
                      </>
                    )}
                    <dt>Release clause</dt>
                    <dd>{o.release ? money(o.release * 1e6) : "None"}</dd>
                  </dl>
                  <div className="pc-offer-btns">
                    <button type="button" className="k-btn k-btn-ghost" disabled={busy || o.negotiated >= 2 || o.kind === "loan"} onClick={() => run(() => careerApi.negotiate(saved, o.id))}>
                      {state.agent ? "Agent: push for more" : "Ask for more"}
                    </button>
                    <button
                      type="button"
                      className="k-btn k-btn-primary"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => careerApi.sign(saved, o.id),
                          () => setOffersOpen(false),
                        )
                      }
                    >
                      {o.kind === "loan" ? "Go on loan" : "Sign"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {err && <p className="pc-bad">{err}</p>}
            <button type="button" className="k-btn k-btn-ghost" onClick={() => setOffersOpen(false)}>
              Think about it
            </button>
          </div>
        </div>
      )}
      {eventOpen && pendingEv && (
        <EventCard
          ev={pendingEv}
          busy={busy}
          onPick={(choice) =>
            run(
              () => careerApi.event(saved, pendingEv.id, choice),
              (r) => {
                setEventOpen(false);
                if (r.note) setNote(r.note);
                const go = retry.current;
                retry.current = null;
                if (go && !r.note) go();
              },
            )
          }
          onClose={() => {
            setEventOpen(false);
            retry.current = null;
          }}
        />
      )}
      {note && (
        <div
          className="pc-modal"
          role="dialog"
          aria-modal="true"
          aria-label="What happened"
          onClick={() => {
            setNote("");
            const go = retry.current;
            retry.current = null;
            if (go) go();
          }}
        >
          <div className="pc-modal-in pc-note">
            <p>{note}</p>
            <button type="button" className="k-btn k-btn-primary">
              Carry on
            </button>
          </div>
        </div>
      )}
      {phoneApp && <Phone state={state} saved={saved} run={run} busy={busy} money={money} app={phoneApp} setApp={setPhoneApp} onClose={() => setPhoneApp(null)} />}
      {moment && moment[0] !== "firstContract" && !state.retired && <Moment k={moment[0]} m={moment[1]} state={state} quality={quality} onDone={() => run(() => careerApi.moment(saved, moment[0]))} />}
      {moment && moment[0] === "firstContract" && (
        <FirstContract
          club={moment[1].club || ""}
          wage={money(moment[1].wage || 0, { week: true })}
          years={moment[1].years || 0}
          role={moment[1].role || ""}
          name={state.person.first + " " + state.person.last}
          onDone={() => run(() => careerApi.moment(saved, moment[0]))}
        />
      )}
    </div>
  );
}

/** the first contract: the badge, the deal on the desk, the pen, then the line every kid dreams of */
function FirstContract({ club, wage, years, role, name, onDone }: { club: string; wage: string; years: number; role: string; name: string; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".fc-badge", {
        scale: 0.4,
        opacity: 0,
        rotate: -12,
        duration: 0.7,
      })
        .from(".fc-club", { y: 20, opacity: 0, duration: 0.5 }, "-=0.3")
        .from(".fc-paper", { y: 60, rotateX: 40, opacity: 0, duration: 0.7 }, "-=0.1")
        .from(".fc-line", { x: -18, opacity: 0, duration: 0.35, stagger: 0.12 }, "-=0.2")
        .from(".fc-sign", { strokeDashoffset: 420, duration: 1.1, ease: "power2.inOut" }, "+=0.2")
        .from(".fc-welcome", { y: 30, opacity: 0, scale: 0.92, duration: 0.6 }, "+=0.1")
        .from(".fc-done", { opacity: 0, duration: 0.3 });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div className="pc-moment" ref={ref} role="dialog" aria-modal="true" aria-label="First professional contract">
      <div className="fc-badge">
        {club
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 3)}
      </div>
      <p className="fc-club">{club}</p>
      <div className="fc-paper">
        <p className="fc-line">
          <span>Player</span>
          <b>{name}</b>
        </p>
        <p className="fc-line">
          <span>Wage</span>
          <b>{wage}</b>
        </p>
        <p className="fc-line">
          <span>Length</span>
          <b>{years} years</b>
        </p>
        <p className="fc-line">
          <span>Role</span>
          <b>{role}</b>
        </p>
        <svg className="fc-sig" viewBox="0 0 300 60" aria-hidden="true">
          <path
            className="fc-sign"
            d="M10 40 C 40 5, 60 55, 90 30 S 140 10, 160 38 S 210 52, 235 22 S 280 30, 292 26"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="420"
          />
        </svg>
      </div>
      <h2 className="fc-welcome">Welcome to professional football</h2>
      <button type="button" className="k-btn k-btn-primary fc-done" onClick={onDone}>
        Let&apos;s go
      </button>
    </div>
  );
}

function offerAlert(offers: Offer[]) {
  if (offers.every((o) => o.kind === "renewal")) return offers[0].club + " want to extend your contract";
  const loan = offers.find((o) => o.kind === "loan");
  if (offers.length === 1 && loan) return loan.club + " want you on loan";
  const bid = offers.find((o) => o.kind === "transfer");
  if (bid) return bid.club + " agreed a £" + bid.fee + "m fee. Personal terms are yours to settle";
  return offers.length + " club" + (offers.length > 1 ? "s want" : " wants") + " to sign you";
}

type MomentData = CareerState["moments"][string];
/** the big days: a card that lands like a broadcast graphic, one at a time, then gets out of the way */
function Moment({ k, m, state, quality, onDone }: { k: string; m: MomentData; state: CareerState; quality: number; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const copy = momentCopy(k, m, state);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".mo-flash", { scaleX: 0, duration: 0.5, ease: "power4.inOut" })
        .from(".mo-kicker", { y: 16, opacity: 0, duration: 0.4 }, "-=0.1")
        .from(".mo-title", { y: 40, opacity: 0, scale: 0.94, duration: 0.6 }, "-=0.2")
        .from(".mo-line", { opacity: 0, duration: 0.4 }, "-=0.2")
        .from(".mo-done", { opacity: 0, duration: 0.3 });
    }, ref);
    return () => ctx.revert();
  }, [k]);
  // the scene: him in the shirt of the day, turning slowly under the lights; a cup beside him for a first trophy
  const kit = k.startsWith("callup_") ? state.natKit : state.kit;
  return (
    <div className={"pc-moment pc-mo is-" + copy.tone} ref={ref} role="dialog" aria-modal="true" aria-label={copy.kicker}>
      <span className="mo-flash" aria-hidden="true" />
      <div className="mo-stage" aria-hidden="true">
        <Stage
          look={state.look}
          person={state.person}
          outfit={kitOutfit(kit)}
          view="hero"
          quality={Math.min(quality, 2)}
          accent={kit ? kit[0] : undefined}
          autoSpin={0.25}
          prop={k === "trophy" ? "trophy" : null}
          className="mo-stage-in"
        />
      </div>
      <div className="mo-copy">
        {copy.badge && <div className="fc-badge mo-badge">{copy.badge}</div>}
        <p className="mo-kicker">{copy.kicker}</p>
        <h2 className="mo-title">{copy.title}</h2>
        <p className="mo-line">{copy.line}</p>
        <button type="button" className="k-btn k-btn-primary mo-done" onClick={onDone}>
          Carry on
        </button>
      </div>
    </div>
  );
}

function momentCopy(k: string, m: MomentData, state: CareerState) {
  const name = state.person.first + " " + state.person.last;
  if (k === "debut")
    return {
      kicker: "Senior debut",
      title: m.club || "",
      line: name + " plays his first minutes as a professional, against " + m.opp + ". Nobody can take this day away.",
      badge: initials(m.club || ""),
      tone: "volt",
    };
  if (k === "firstGoal")
    return {
      kicker: "First professional goal",
      title: "Goal",
      line: "Against " + m.opp + ". The first one. The one you remember forever.",
      badge: "",
      tone: "volt",
    };
  if (k.startsWith("callup_"))
    return {
      kicker: "Called up",
      title: (m.nation || state.person.nat) + " " + (m.level || ""),
      line: "Your country's name on the front of the shirt. Mum has already told the whole street.",
      badge: "",
      tone: "gold",
    };
  if (k === "captain")
    return {
      kicker: "Captain",
      title: m.club || "",
      line: "The manager hands you the armband. The dressing room is yours to lead now.",
      badge: "C",
      tone: "gold",
    };
  if (k === "trophy")
    return {
      kicker: "Champions",
      title: m.title || "Trophy",
      line: "Your first winners medal, with " + m.club + ". Lift it high.",
      badge: "",
      tone: "gold",
    };
  if (k === "bigMove")
    return {
      kicker: "Done deal",
      title: m.club || "",
      line: "A £" + m.fee + "m move. New city, new shirt, the same dream.",
      badge: initials(m.club || ""),
      tone: "volt",
    };
  return { kicker: "Moment", title: k, line: "", badge: "", tone: "volt" };
}

/** the last whistle: the whole career on one card, then the same world from the dugout */
function Retired({ state, saved, money, quality }: { state: CareerState; saved: Saved; money: (n: number) => string; quality: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const r = state.retired!;
  const S = r.summary;
  const capsN = Object.values(S.caps || {}).reduce((a, b) => a + b, 0);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".rt-in > *", {
        y: 18,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power3.out",
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  const manage = async (club: string) => {
    setBusy(true);
    setErr("");
    try {
      const out = await careerApi.manage(saved, club);
      try {
        localStorage.setItem("fl_code", out.code);
        localStorage.setItem("fl_name", out.name);
      } catch {
        /* the code is shown on the Floodlights page too */
      }
      // Floodlights is served by the game server, not by this app, so a full page load is the way in
      window.location.assign(new URL("/floodlights/", window.location.origin).href);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not take the job.");
      setBusy(false);
    }
  };
  return (
    <section className="pc-retired" ref={ref} aria-label="Career summary">
      <div className="rt-stage" aria-hidden="true">
        <Stage
          look={state.look}
          person={state.person}
          outfit={kitOutfit(state.lastKit)}
          view="hero"
          quality={Math.min(quality, 2)}
          accent={state.lastKit ? state.lastKit[0] : undefined}
          autoSpin={0.15}
        />
      </div>
      <div className="rt-in">
        <p className="pc-kicker">The last whistle</p>
        <h2 className="rt-name">{S.name}</h2>
        <p className="pc-dim">
          Retired at {r.age}. {S.clubs.length ? S.clubs.join(", ") + "." : ""}
        </p>
        <div className="rt-nums">
          {[
            [S.matches, "Games"],
            [S.goals, "Goals"],
            [S.assists, "Assists"],
            [S.avg ? S.avg.toFixed(2) : "-", "Average"],
            [capsN, "Caps"],
            [S.highestRating, "Best rating"],
            [S.trophies.length, "Trophies"],
            [money(S.earnings), "Earned"],
          ].map(([v, l]) => (
            <div key={String(l)}>
              <b>{v}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
        {(S.trophies.length > 0 || S.awards.length > 0) && (
          <ul className="pc-honours">
            {S.trophies.map((t, i) => (
              <li key={"t" + i}>
                <span className="pc-cup" aria-hidden="true" />
                {t.title}
                <em>{t.club}</em>
              </li>
            ))}
            {S.awards.map((a, i) => (
              <li key={"a" + i} className="is-award">
                <span className="pc-cup" aria-hidden="true" />
                {a.title}
              </li>
            ))}
          </ul>
        )}
        <h3 className="pc-h3">Continue as Manager</h3>
        <p className="pc-dim">The same world, the same players you played with and against. Pick the club that wants you in the dugout.</p>
        <div className="rt-clubs">
          {state.managerOptions.map((club) => (
            <button type="button" key={club} className="k-btn k-btn-glass" disabled={busy} onClick={() => manage(club)}>
              {club}
            </button>
          ))}
        </div>
        {err && <p className="pc-bad">{err}</p>}
        <Link className="k-btn k-btn-glass rt-home" href="/">
          Back to the home page
        </Link>
      </div>
    </section>
  );
}

function RelBar({ v }: { v: number }) {
  const tone = v >= 70 ? "is-good" : v < 40 ? "is-bad" : v < 55 ? "is-warn" : "";
  return (
    <i className="pc-rel" title={"Relationship " + Math.round(v) + " out of 100"}>
      <b className={tone} style={{ width: Math.max(4, Math.min(100, v)) + "%" }} />
    </i>
  );
}

/** a life event: who it is about, what happened, and the choice; family and agent often want different things */
function EventCard({ ev, busy, onPick, onClose }: { ev: NonNullable<CareerState["people"]["pending"]>; busy: boolean; onPick: (choice: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".ev-in > *", { y: 16, opacity: 0, duration: 0.4, stagger: 0.06, ease: "power3.out" });
    }, ref);
    return () => ctx.revert();
  }, [ev.id]);
  const kicker = ev.kind === "family" ? "Family" : ev.kind === "team" ? "The dressing room" : ev.kind === "media" ? "The press" : ev.kind === "agent" ? "Your agent" : "Life";
  return (
    <div className="pc-modal" role="dialog" aria-modal="true" aria-label={ev.title} ref={ref}>
      <div className={"pc-modal-in pc-event is-" + ev.kind}>
        <div className="ev-in">
          <p className="pc-kicker">{kicker}</p>
          <h2 className="pc-h2">{ev.title}</h2>
          <p className="ev-text">{ev.text}</p>
          <div className="pc-choices">
            {ev.choices.map((c) => (
              <button type="button" key={c.id} className="pc-choice" disabled={busy} onClick={() => onPick(c.id)}>
                <b>{c.label}</b>
              </button>
            ))}
          </div>
          <button type="button" className="k-btn k-btn-ghost" onClick={onClose}>
            Think about it
          </button>
        </div>
      </div>
    </div>
  );
}
