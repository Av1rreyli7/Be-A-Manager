"use client";
/**
 * The fight HUD, in the site's language: a scorebug across the top (your bars, the round and the clock, his
 * bars), your guard, stance and range at the foot, the controls strip above everything (full at the bell, faint
 * once you are fighting, full again on pause), short call outs for the big moments, the knockdown count with the
 * get up mini game, and on Low and Medium the hurt vision drawn by the page (High and Ultra draw it in 3D).
 * Numbers are written straight into the page every frame; React only builds it.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import gsap from "gsap";
import type { FightEvent, FightState, FighterDef, Guard } from "../engine/types";
import { PUNCH_NAME, rangeOf } from "../engine/rules";
import type { World } from "../view/world";
import { GFX } from "../view/gfx";
import { shortName } from "./fighters";

export interface HudApi {
  frame(w: World): void;
  event(e: FightEvent, st: FightState): void;
  say(text: string, tone?: "good" | "bad" | "info"): void;
  /** the person pressed something: the strip fades after a moment */
  active(): void;
}

const GUARDS: { id: Guard; name: string; key: string }[] = [
  { id: "high", name: "High guard", key: "1" },
  { id: "philly", name: "Philly shell", key: "2" },
  { id: "normal", name: "Normal block", key: "3" },
];
const STRIP: [string, string][] = [
  ["W A S D", "Move"],
  ["J", "Jab"],
  ["K", "Cross"],
  ["U I", "Hooks"],
  ["N M", "Uppercuts"],
  ["Hold L", "To the body"],
  ["Q E", "Slip"],
  ["Space", "Duck"],
  ["F", "Lean back"],
  ["1 2 3", "Guard"],
  ["T", "Stance"],
  ["G", "Clinch"],
  ["Shift", "Burst"],
  ["Esc", "Pause"],
];
const clock = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
};

const Hud = forwardRef<HudApi, { st: FightState; me: FighterDef; them: FighterDef; quality: number; strip: boolean; hidden: boolean }>(function Hud({ st, me, them, quality, strip, hidden }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const els = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    els.current[k] = el;
  };
  const last = useRef<Record<string, string | number>>({});
  const stripT = useRef(0);
  const sayQ = useRef<HTMLDivElement>(null);
  const cheap = !GFX[quality]?.post;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  const put = (k: string, v: string | number, how: "text" | "w" | "o" = "text") => {
    const el = els.current[k];
    if (!el || last.current[k] === v) return;
    last.current[k] = v;
    if (how === "text") el.textContent = String(v);
    else if (how === "w") el.style.transform = `scaleX(${Math.max(0, Math.min(1, Number(v)))})`;
    else el.style.opacity = String(v);
  };

  const say = (text: string, tone: "good" | "bad" | "info" = "info") => {
    const host = sayQ.current;
    if (!host) return;
    const el = document.createElement("div");
    el.className = "pf-say " + tone;
    el.textContent = text;
    host.appendChild(el);
    while (host.children.length > 3) host.firstElementChild?.remove();
    gsap.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.22, ease: "power3.out" });
    gsap.to(el, { opacity: 0, y: -6, duration: 0.4, delay: 1.6, ease: "power2.in", onComplete: () => el.remove() });
  };

  useImperativeHandle(ref, () => ({
    frame(w: World) {
      const s = w.st;
      const [a, b] = s.f;
      put("aHead", a.headHP / 100, "w");
      put("aBody", a.bodyHP / 100, "w");
      put("aStam", a.stamina / 100, "w");
      put("aMax", a.maxStam / 100, "w");
      put("bHead", b.headHP / 100, "w");
      put("bBody", b.bodyHP / 100, "w");
      put("bStam", b.stamina / 100, "w");
      put("bMax", b.maxStam / 100, "w");
      put("round", s.round);
      put("clock", clock(s.clock));
      put("guard", a.guard);
      for (const g of GUARDS) {
        const el = els.current["g-" + g.id];
        if (el && el.dataset.on !== String(a.guard === g.id)) el.dataset.on = String(a.guard === g.id);
      }
      put("stance", a.stance === "orthodox" ? "Orthodox" : "Southpaw");
      // range: where you stand against your own jab
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      const R = rangeOf(me.reachIn);
      const r = d > R + 0.1 ? "Out of range" : d > R * 0.8 ? "Jab range" : d > R * 0.5 ? "Hook range" : "Inside";
      put("range", r);
      const rEl = els.current.rangeDot;
      if (rEl) rEl.dataset.r = r === "Out of range" ? "out" : r === "Jab range" ? "long" : r === "Hook range" ? "mid" : "in";
      // the strip: full at the bell and in a pause, faint once the fight is going
      stripT.current += 1 / 60;
      const fighting = s.phase === "fight" && !w.paused;
      put("strip", hiddenRef.current ? 0 : !fighting ? 1 : stripT.current < 4 ? 1 : 0.22, "o");
      // the page's own hurt vision on Low and Medium
      if (cheap) {
        const hurt = Math.max(0, (70 - a.headHP) / 70) * 0.7 + (a.rocked > 0 ? 0.25 : 0) + (a.stamina < 35 ? ((35 - a.stamina) / 35) * (0.5 + 0.5 * Math.sin(w.time * 3.2)) * 0.15 : 0);
        put("vig", Math.min(0.95, hurt).toFixed(2), "o");
        put("red", Math.min(0.6, w.hurtFlash * 0.4).toFixed(2), "o");
      }
      put("slow", w.slowT > 0 ? 1 : 0, "o");
      // the knockdown count and the get up
      const kd = s.kd;
      const kdEl = els.current.kd;
      if (kdEl) {
        const show = s.phase === "kd" && !!kd;
        if (kdEl.dataset.show !== String(show)) kdEl.dataset.show = String(show);
        if (show && kd) {
          put("kdCount", kd.count > 0 ? kd.count : "");
          const mine = kd.who === 0;
          put("kdWho", mine ? "You are down" : `${them.name} is down`);
          const g = s.f[0].getup;
          const nm = shortName(them.name);
          let help = mine ? "" : kd.stage === "count" ? "Go to the neutral corner" : kd.stage === "rising" ? `${nm} is getting up` : `The referee checks ${nm}`;
          if (mine && g) {
            if (g.stage === "rhythm") help = "Tap Space or J on the beat to get up";
            else if (g.stage === "rising") help = "Getting up";
            else if (g.stage === "balance") help = "Steady yourself: keep it in the middle with A and D";
            else help = "The referee checks you";
          }
          put("kdHelp", help);
          const game = els.current.game;
          if (game) {
            const stage = mine && g ? g.stage : "none";
            if (game.dataset.stage !== stage) game.dataset.stage = stage;
            if (mine && g && g.stage === "rhythm") {
              // the ring closes on the target circle on each beat
              const k = (kd.t - g.first) / g.beat;
              const ph = k < 0 ? 1 : 1 - (k - Math.floor(k));
              const pulse = els.current.pulse;
              if (pulse) pulse.style.transform = `scale(${(1 + ph * 1.6).toFixed(3)})`;
              put("need", `${g.hits} / ${g.need}`);
            }
            if (mine && g && g.stage === "balance") {
              const nd = els.current.needle;
              if (nd) nd.style.transform = `translateX(${(g.needle * 50).toFixed(1)}%)`;
              put("held", Math.min(1, g.held), "w");
            }
          }
        }
      }
    },
    event(e: FightEvent, s: FightState) {
      const mine = e.who === 0;
      switch (e.type) {
        case "perfect":
          if (mine) say(e.tag === "roll" ? "Rolled it. Counter now" : "Slipped it. Counter now", "good");
          break;
        case "hit":
          if (mine && e.tag === "counter" && (e.dmg ?? 0) > 4) say("Counter " + PUNCH_NAME[e.kind!].toLowerCase(), "good");
          break;
        case "rocked":
          say(mine ? "You are rocked. Cover up or hold on (G)" : `${them.name} is rocked`, mine ? "bad" : "good");
          break;
        case "cut":
          say(mine ? `You are cut over the ${e.n === 0 ? "left" : "right"} eye` : `${them.name} is cut over the ${e.n === 0 ? "left" : "right"} eye`, mine ? "bad" : "good");
          break;
        case "warn":
          say(mine ? "The referee warns you for holding" : `${them.name} is warned for holding`, mine ? "bad" : "info");
          break;
        case "deduct":
          say(mine ? "A point taken away for holding" : `${them.name} loses a point for holding`, mine ? "bad" : "good");
          break;
        case "clinch":
          if (e.tag === "fail" && mine) say(`${them.name} got out of the clinch`, "info");
          break;
        case "stance":
          if (mine) say(e.tag === "orthodox" ? "Orthodox" : "Southpaw", "info");
          break;
        case "kd":
          say(mine ? "Down!" : `${them.name} is down!`, mine ? "bad" : "good");
          break;
        case "resume":
          say("Box!", "info");
          break;
        case "bell":
          if (e.text === "start") stripT.current = 0;
          if (e.text === "end") say("End of round " + s.round, "info");
          break;
      }
    },
    say,
    active() {
      // nothing to do: the strip fades on its own clock after the bell
    },
  }));

  useEffect(() => {
    last.current = {};
  }, [quality]);

  const nameOf = (f: FighterDef) => shortName(f.name);
  return (
    <div ref={root} className="pf-hud" data-hidden={hidden ? "1" : "0"} data-strip={strip ? "1" : "0"}>
      {cheap && (
        <>
          <div ref={reg("vig")} className="pf-vig" style={{ opacity: 0 }} aria-hidden />
          <div ref={reg("red")} className="pf-red" style={{ opacity: 0 }} aria-hidden />
        </>
      )}
      <div ref={reg("slow")} className="pf-slowfx" style={{ opacity: 0 }} aria-hidden />
      {strip && (
        <div ref={reg("strip")} className="pf-strip" aria-label="Controls">
          {STRIP.map(([k, l]) => (
            <span key={k} className="pf-chip">
              <kbd>{k}</kbd>
              <span className="lbl">{l}</span>
            </span>
          ))}
        </div>
      )}
      <div className="pf-bug" role="group" aria-label="Score bug">
        <div className="pf-side a">
          <div className="pf-name">
            <b>{nameOf(me)}</b>
            <span>You</span>
          </div>
          <Bars refs={reg} p="a" />
        </div>
        <div className="pf-mid">
          <span className="pf-rd">
            Round <b ref={reg("round")}>{st.round}</b>
            <span className="of">/{st.cfg.rounds}</span>
          </span>
          <b className="pf-clock" ref={reg("clock")}>
            {clock(st.clock)}
          </b>
        </div>
        <div className="pf-side b">
          <div className="pf-name">
            <b>{nameOf(them)}</b>
            <span>{them.nick || them.country}</span>
          </div>
          <Bars refs={reg} p="b" />
        </div>
      </div>
      <div className="pf-foot">
        <div className="pf-guards" aria-label="Guard">
          {GUARDS.map(g => (
            <span key={g.id} ref={reg("g-" + g.id)} className="pf-guard" data-on={String(st.f[0].guard === g.id)}>
              <kbd>{g.key}</kbd>
              {g.name}
            </span>
          ))}
        </div>
        <div className="pf-meta">
          <span ref={reg("stance")}>{st.f[0].stance === "orthodox" ? "Orthodox" : "Southpaw"}</span>
          <span className="pf-rangeind">
            <i ref={reg("rangeDot")} data-r="out" />
            <span ref={reg("range")}>Out of range</span>
          </span>
        </div>
      </div>
      <div ref={sayQ} className="pf-says" aria-live="polite" />
      <div ref={reg("kd")} className="pf-kd" data-show="false" aria-live="assertive">
        <p ref={reg("kdWho")} className="pf-kd-who" />
        <b ref={reg("kdCount")} className="pf-kd-n" />
        <p ref={reg("kdHelp")} className="pf-kd-help" />
        <div ref={reg("game")} className="pf-game" data-stage="none">
          <div className="pf-beat">
            <i className="target" />
            <i ref={reg("pulse")} className="pulse" />
            <b ref={reg("need")} className="need" />
          </div>
          <div className="pf-balance">
            <i className="zone" />
            <i ref={reg("needle")} className="needle" />
            <span className="held">
              <i ref={reg("held")} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

function Bars({ refs, p }: { refs: (k: string) => (el: HTMLElement | null) => void; p: "a" | "b" }) {
  return (
    <div className="pf-bars">
      <span className="pf-bar-row head">
        <span className="lab">Head</span>
        <span className="track">
          <i ref={refs(p + "Head")} />
        </span>
      </span>
      <span className="pf-bar-row body">
        <span className="lab">Body</span>
        <span className="track">
          <i ref={refs(p + "Body")} />
        </span>
      </span>
      <span className="pf-bar-row stam">
        <span className="lab">Stamina</span>
        <span className="track">
          <em ref={refs(p + "Max")} />
          <i ref={refs(p + "Stam")} />
        </span>
      </span>
    </div>
  );
}

export default Hud;
