"use client";
/**
 * The moments around the fighting: the announcer and the introductions over the ring walk, the round card before
 * the bell, the corner between rounds, the result, and the pause menu. Each is the kit's language (panels with
 * cut corners, Chakra Petch numbers, the accent line) laid over the 3D scene.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import clsx from "clsx";
import type { FightState, FighterDef, RoundStats } from "../engine/types";
import { totals } from "../engine/scoring";
import type { World } from "../view/world";
import { GFX } from "../view/gfx";
import { KEYMAP } from "../view/input";
import { recordOf, recordText, type Settings } from "../save";
import { announcer, coachLine } from "./coach";
import { shortName } from "./fighters";

/** Space, Enter or a click moves on */
function useContinue(on: () => void, enabled = true) {
  const cb = useRef(on);
  cb.current = on;
  useEffect(() => {
    if (!enabled) return;
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        cb.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [enabled]);
}

// ------------------------------------------------------------------ the introductions

export function Intro({ st, world, onDone }: { st: FightState; world: World; onDone: () => void }) {
  const lines = useMemo(() => announcer(st), [st]);
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useContinue(finish);
  // the lines follow the camera: the walk, the blue corner, the red corner, the middle
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = world.introT;
      const n = t < 2.6 ? 0 : t < 5.5 ? 1 : t < 10.4 ? 2 : t < 13.5 ? 3 : 4;
      setI(x => (x === n ? x : n));
      if (t > 16) finish();
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const tl = gsap.timeline();
    tl.fromTo(el.querySelectorAll(".pf-call, .pf-namecard > *"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.08 });
    return () => {
      tl.kill();
    };
  }, [i]);
  const line = lines[i];
  return (
    <div className="pf-intro" ref={box}>
      <button className="k-btn k-btn-ghost k-btn-sm pf-skip" data-pf="skip" onClick={finish}>
        Skip <kbd>Space</kbd>
      </button>
      <div className="pf-lower" key={i}>
        {line.card && (
          <div className={clsx("pf-namecard", line.card.corner)}>
            <span className="pf-corner-tag">{line.card.corner === "red" ? "Red corner" : "Blue corner"}</span>
            {line.card.nick && <span className="pf-nick">&ldquo;{line.card.nick}&rdquo;</span>}
            <b className="pf-bigname">{line.card.name}</b>
            <span className="pf-line">{line.card.line}</span>
          </div>
        )}
        <p className="pf-call">{line.text}</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the round card

export function RoundCard({ st, onDone, paused }: { st: FightState; onDone: () => void; paused: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const go = () => {
    if (done.current || paused) return;
    done.current = true;
    onDone();
  };
  useContinue(go, !paused);
  useEffect(() => {
    const node = el.current;
    if (!node || paused) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tl = gsap.timeline({ onComplete: go });
    if (reduce) tl.to({}, { duration: 1.4 });
    else {
      tl.fromTo(node.querySelector(".pf-rc-bar"), { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "expo.out" });
      tl.fromTo(node.querySelectorAll(".pf-rc-k, .pf-rc-n, .pf-rc-of"), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: "expo.out", stagger: 0.06 }, 0.1);
      tl.fromTo(node.querySelector(".pf-rc-n"), { scale: 1.25 }, { scale: 1, duration: 0.6, ease: "power3.out" }, 0.1);
      tl.to(node, { opacity: 0, duration: 0.3, ease: "power2.in" }, 1.5);
    }
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
  const last = st.round === st.cfg.rounds;
  return (
    <div className="pf-roundcard" ref={el} data-pf="roundcard" aria-live="assertive">
      <div className="pf-rc-in">
        <span className="pf-rc-mask">
          <span className="pf-rc-k">{last ? "Final round" : "Round"}</span>
        </span>
        <span className="pf-rc-mask">
          <b className="pf-rc-n">{st.round}</b>
        </span>
        <span className="pf-rc-mask">
          <span className="pf-rc-of">of {st.cfg.rounds}</span>
        </span>
        <i className="pf-rc-bar" />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the corner

function statRows(a: RoundStats, b: RoundStats): [string, string, string][] {
  const pct = (x: number, y: number) => (y ? Math.round((x / y) * 100) + "%" : "0%");
  return [
    ["Punches landed", `${a.landed} of ${a.thrown}`, `${b.landed} of ${b.thrown}`],
    ["Accuracy", pct(a.landed, a.thrown), pct(b.landed, b.thrown)],
    ["Jabs landed", `${a.jabsLanded} of ${a.jabsThrown}`, `${b.jabsLanded} of ${b.jabsThrown}`],
    ["Power punches landed", `${a.powerLanded} of ${a.powerThrown}`, `${b.powerLanded} of ${b.powerThrown}`],
    ["To the head", String(a.headLanded), String(b.headLanded)],
    ["To the body", String(a.bodyLanded), String(b.bodyLanded)],
    ["Knockdowns", String(b.kd), String(a.kd)],
  ];
}

export function Corner({ st, world, onDone, paused }: { st: FightState; world: World; onDone: () => void; paused: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const go = () => {
    if (done.current || paused) return;
    done.current = true;
    onDone();
  };
  useContinue(go, !paused);
  const line = useMemo(() => coachLine(st), [st]);
  const [typed, setTyped] = useState("");
  const r = st.rounds.length;
  const last = st.rounds[r - 1];
  const rec = st.recover?.[0];
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const tl = gsap.timeline();
    tl.fromTo(node.querySelectorAll(".pf-cpanel"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.08 });
    // the recovery: the bars fill back up from where the round left them
    node.querySelectorAll<HTMLElement>(".pf-rec i").forEach(i => {
      const from = Number(i.dataset.from), to = Number(i.dataset.to);
      tl.fromTo(i, { scaleX: from / 100 }, { scaleX: to / 100, duration: 1.2, ease: "power2.out" }, 0.4);
    });
    let k = 0;
    const iv = setInterval(() => {
      k += 2;
      setTyped(line.slice(0, k));
      if (k >= line.length) clearInterval(iv);
    }, 22);
    return () => {
      tl.kill();
      clearInterval(iv);
    };
  }, [line]);
  void world;
  if (!last) return null;
  const [a, b] = last;
  const cardsSoFar = st.cards.map(c => totals(c));
  return (
    <div className="pf-corner" ref={el} data-pf="corner">
      <div className="pf-corner-grid">
        <section className="k-panel pf-cpanel">
          <h2 className="k-panel-title">Round {r}</h2>
          <table className="k-table pf-ctable">
            <thead>
              <tr>
                <th />
                <th className="k-num">{shortName(st.defs[0].name)}</th>
                <th className="k-num">{shortName(st.defs[1].name)}</th>
              </tr>
            </thead>
            <tbody>
              {statRows(a, b).map(([l, x, y]) => (
                <tr key={l}>
                  <td>{l}</td>
                  <td className="k-num">{x}</td>
                  <td className="k-num">{y}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rec && (
            <div className="pf-rec" aria-label="What the corner got back">
              <span>
                Head <i data-from={rec.head[0].toFixed(0)} data-to={rec.head[1].toFixed(0)} />
              </span>
              <span>
                Body <i data-from={rec.body[0].toFixed(0)} data-to={rec.body[1].toFixed(0)} />
              </span>
              <span>
                Stamina <i data-from={rec.stam[0].toFixed(0)} data-to={rec.stam[1].toFixed(0)} />
              </span>
            </div>
          )}
        </section>
        <section className="k-panel pf-cpanel">
          <h2 className="k-panel-title">The judges</h2>
          <table className="k-table pf-ctable">
            <thead>
              <tr>
                <th>Judge</th>
                <th className="k-num">Round {r}</th>
                <th className="k-num">So far</th>
              </tr>
            </thead>
            <tbody>
              {st.judges.map((j, k) => {
                const c = st.cards[k][r - 1];
                return (
                  <tr key={j.name}>
                    <td>{j.name}</td>
                    <td className="k-num">
                      {c[0]} to {c[1]}
                    </td>
                    <td className="k-num">
                      {cardsSoFar[k][0]} to {cardsSoFar[k][1]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="pf-note">Scores read you first. Ten to the winner of each round, nine to the loser, a point off for every knockdown.</p>
        </section>
      </div>
      <div className="pf-coach pf-cpanel">
        <span className="pf-coach-who">Your trainer</span>
        <p aria-label={line}>{typed}</p>
        <button className="k-btn k-btn-primary" data-pf="continue" onClick={go}>
          Round {r + 1} <kbd>Space</kbd>
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the result

export function Result({ st, me, them, meRef, onRematch, onExit }: { st: FightState; me: FighterDef; them: FighterDef; meRef: string; onRematch: () => void; onExit: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const r = st.result!;
  const won = r.winner === 0, drew = r.winner === null;
  const head = drew ? "Draw" : won ? "You win" : "You lose";
  const method = r.method === "KO" ? "Knockout" : r.method === "TKO" ? "Technical knockout" : r.detail;
  const winnerName = drew ? "" : r.winner === 0 ? me.name : them.name;
  const rec = recordOf(meRef);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const tl = gsap.timeline();
    tl.fromTo(node.querySelector(".pf-res-head"), { opacity: 0, y: 24, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "expo.out" });
    tl.fromTo(node.querySelectorAll(".pf-res-panel"), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.08 }, 0.3);
    return () => {
      tl.kill();
    };
  }, []);
  const fa = st.f[0].fs, fb = st.f[1].fs;
  const pct = (x: number, y: number) => (y ? Math.round((x / y) * 100) + "%" : "0%");
  const rows: [string, string, string][] = [
    ["Punches landed", `${fa.landed} of ${fa.thrown}`, `${fb.landed} of ${fb.thrown}`],
    ["Accuracy", pct(fa.landed, fa.thrown), pct(fb.landed, fb.thrown)],
    ["Jabs", `${fa.jabsLanded} of ${fa.jabsThrown}`, `${fb.jabsLanded} of ${fb.jabsThrown}`],
    ["Power punches", `${fa.powerLanded} of ${fa.powerThrown}`, `${fb.powerLanded} of ${fb.powerThrown}`],
    ["Head and body", `${fa.headLanded} and ${fa.bodyLanded}`, `${fb.headLanded} and ${fb.bodyLanded}`],
    ["Knockdowns scored", String(fb.kd), String(fa.kd)],
    ["Punches slipped or blocked", String(fa.evaded + fa.blocked), String(fb.evaded + fb.blocked)],
  ];
  const rounds = st.rounds.length;
  return (
    <div className="pf-result" ref={el} data-pf="result">
      <header className={clsx("pf-res-head", won ? "won" : drew ? "drew" : "lost")}>
        <b>{head}</b>
        <span className="pf-res-how">
          {method}
          {r.method === "KO" || r.method === "TKO" ? `, round ${r.round} at ${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, "0")}` : ""}
          {winnerName && (r.method === "KO" || r.method === "TKO") ? ` for ${winnerName}` : ""}
        </span>
        <span className="pf-res-sub">{r.method === "TKO" ? r.how.replace(/^TKO, /, "") : ""}</span>
      </header>
      <div className="pf-res-grid">
        <section className="k-panel pf-res-panel">
          <h2 className="k-panel-title">Scorecards</h2>
          {rounds === 0 ? (
            <p className="pf-note">It ended before a round was scored.</p>
          ) : (
            <div className="pf-cards-scroll">
              <table className="k-table pf-cards" data-pf="cards">
                <thead>
                  <tr>
                    <th>Judge</th>
                    {st.rounds.map((_, k) => (
                      <th key={k} className="k-num">
                        {k + 1}
                      </th>
                    ))}
                    <th className="k-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {st.judges.map((j, k) => {
                    const t = totals(st.cards[k]);
                    return (
                      <tr key={j.name}>
                        <td>{j.name}</td>
                        {st.cards[k].map((c, n) => (
                          <td key={n} className={clsx("k-num", c[0] > c[1] ? "pf-w" : c[1] > c[0] ? "pf-l" : "")}>
                            {c[0]}
                            <span className="pf-dim">-</span>
                            {c[1]}
                          </td>
                        ))}
                        <td className="k-num">
                          <b>
                            {t[0]} to {t[1]}
                          </b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="pf-note">You first. {r.method === "KO" || r.method === "TKO" ? "The cards stop at the last full round." : ""}</p>
        </section>
        <section className="k-panel pf-res-panel">
          <h2 className="k-panel-title">The numbers</h2>
          <table className="k-table pf-ctable">
            <thead>
              <tr>
                <th />
                <th className="k-num">{shortName(me.name)}</th>
                <th className="k-num">{shortName(them.name)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([l, x, y]) => (
                <tr key={l}>
                  <td>{l}</td>
                  <td className="k-num">{x}</td>
                  <td className="k-num">{y}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pf-note">
            Your record as {me.name}: {recordText(rec)}
          </p>
        </section>
      </div>
      <div className="pf-res-act">
        <button className="k-btn k-btn-primary" data-pf="rematch" onClick={onRematch}>
          Rematch
        </button>
        <button className="k-btn" data-pf="newfight" onClick={onExit}>
          New fight
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the pause menu

export function Pause(props: { settings: Settings; quality: number; onResume: () => void; onQuality: (q: number) => void; onSettings: (s: Partial<Settings>) => void; onQuit: () => void }) {
  const [tab, setTab] = useState<"menu" | "controls" | "settings">("menu");
  const [armQuit, setArmQuit] = useState(false);
  const s = props.settings;
  return (
    <div className="k-scrim pf-pause" data-pf="pause">
      <div className="k-modal pf-pause-card" role="dialog" aria-modal="true" aria-label="Paused">
        <h2 className="k-modal-title">Paused</h2>
        <div className="pf-seg pf-pause-tabs">
          {(["menu", "controls", "settings"] as const).map(t => (
            <button key={t} className={clsx("k-btn k-btn-sm", tab === t && "k-on")} onClick={() => setTab(t)}>
              {t === "menu" ? "Fight" : t === "controls" ? "Controls" : "Graphics and sound"}
            </button>
          ))}
        </div>
        {tab === "menu" && (
          <div className="pf-pause-menu">
            <button className="k-btn k-btn-primary" data-pf="unpause" onClick={props.onResume} autoFocus>
              Back to the fight <kbd>Esc</kbd>
            </button>
            <button className={clsx("k-btn", armQuit ? "k-btn-danger" : "k-btn-ghost")} data-pf="quit" onClick={() => (armQuit ? props.onQuit() : setArmQuit(true))}>
              {armQuit ? "Sure? Leave without a result" : "Leave the fight"}
            </button>
          </div>
        )}
        {tab === "controls" && (
          <div className="pf-keys">
            {KEYMAP.filter((k, i, a) => a.findIndex(x => x.act === k.act) === i && !k.code.startsWith("Arrow")).map(k => (
              <span key={k.code} className="pf-key">
                <kbd>{k.label}</kbd>
                {ACT_TEXT[k.act] ?? k.act}
              </span>
            ))}
            <span className="pf-key">
              <kbd>Mouse</kbd>Look; left click jab, right click cross; look down for the body
            </span>
            <span className="pf-key">
              <kbd>Down</kbd>Space, J or a click on the beat; A and D to steady yourself
            </span>
          </div>
        )}
        {tab === "settings" && <SettingsPanel settings={s} quality={props.quality} onQuality={props.onQuality} onSettings={props.onSettings} />}
      </div>
    </div>
  );
}

/** graphics, sound, mouse look and the strip: in the pause menu and on the entry page */
export function SettingsPanel({ settings: s, quality, onQuality, onSettings }: { settings: Settings; quality: number; onQuality: (q: number) => void; onSettings: (s: Partial<Settings>) => void }) {
  return (
    <div className="pf-settings-tab">
      <span className="k-label">Graphics</span>
      <div className="pf-seg">
        {GFX.map((g, i) => (
          <button key={g.name} className={clsx("k-btn k-btn-sm", quality === i && "k-on")} data-pf={"gfx-" + i} onClick={() => onQuality(i)}>
            {g.name}
          </button>
        ))}
      </div>
      <p className="pf-note">{GFX[quality].note}</p>
      <label className="pf-check">
        <input type="checkbox" className="k-check" checked={s.auto} onChange={e => onSettings({ auto: e.target.checked })} />
        Lower the graphics by itself if frames run slow
      </label>
      <label className="pf-check">
        <input type="checkbox" className="k-check" checked={s.sound} onChange={e => onSettings({ sound: e.target.checked })} />
        Sound
      </label>
      <label className="k-label" htmlFor="pfVol">
        Volume
      </label>
      <input id="pfVol" type="range" className="pf-range" min={0} max={100} value={Math.round(s.volume * 100)} onChange={e => onSettings({ volume: Number(e.target.value) / 100 })} />
      <label className="k-label" htmlFor="pfLook">
        Mouse look
      </label>
      <input id="pfLook" type="range" className="pf-range" min={50} max={150} value={Math.round(s.look * 100)} onChange={e => onSettings({ look: Number(e.target.value) / 100 })} />
      <label className="pf-check">
        <input type="checkbox" className="k-check" checked={s.strip} onChange={e => onSettings({ strip: e.target.checked })} />
        Show the controls strip in the fight
      </label>
    </div>
  );
}

const ACT_TEXT: Record<string, string> = {
  moveF: "Step in",
  moveB: "Step back",
  moveL: "Circle left",
  moveR: "Circle right",
  back: "Lean back (a shoulder roll in the Philly shell)",
  jab: "Jab",
  cross: "Cross",
  lhook: "Lead hook",
  rhook: "Rear hook",
  lupper: "Lead uppercut",
  rupper: "Rear uppercut",
  body: "Hold for body shots",
  slipL: "Slip left",
  slipR: "Slip right",
  duck: "Duck",
  high: "High guard",
  philly: "Philly shell",
  normal: "Normal block",
  cycle: "Next guard",
  stance: "Switch stance",
  clinch: "Clinch",
  sprint: "Burst of speed",
};
