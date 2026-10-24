/**
 * Keys and mouse to the engine's Input. Physical keys (KeyboardEvent.code) so the layout of letters does not move
 * the controls. A press is queued the moment it happens and handed to the very next fight step, so a punch starts
 * on the next frame whatever the frame rate; held keys (feet, the body modifier) are read as they are.
 *
 *   W A S D       footwork             Shift       a burst of speed
 *   J  K          jab, cross           U  I        lead hook, rear hook
 *   N  M          lead uppercut, rear uppercut   hold L (or ;)  to the body
 *   Q  E          slip left, right     Space       duck          F   lean back (a roll in the Philly shell)
 *   1  2  3       high guard, Philly shell, normal block          Tab  next guard
 *   T             switch stance        G           clinch
 *   mouse         look; left click jab, right click cross; looking down sends punches to the body
 *   Esc  P        pause                down: Space, J or a click on the beat, A and D for balance
 */
import type { Evade, Guard, Input, PunchKind } from "../engine/types";
import { blankInput } from "../engine/fight";

export const KEYMAP: { code: string; label: string; act: string }[] = [
  { code: "KeyW", label: "W", act: "moveF" },
  { code: "KeyS", label: "S", act: "moveB" },
  { code: "KeyA", label: "A", act: "moveL" },
  { code: "KeyD", label: "D", act: "moveR" },
  { code: "KeyJ", label: "J", act: "jab" },
  { code: "KeyK", label: "K", act: "cross" },
  { code: "KeyU", label: "U", act: "lhook" },
  { code: "KeyI", label: "I", act: "rhook" },
  { code: "KeyN", label: "N", act: "lupper" },
  { code: "KeyM", label: "M", act: "rupper" },
  { code: "KeyL", label: "L", act: "body" },
  { code: "Semicolon", label: ";", act: "body" },
  { code: "KeyQ", label: "Q", act: "slipL" },
  { code: "KeyE", label: "E", act: "slipR" },
  { code: "Space", label: "Space", act: "duck" },
  { code: "KeyF", label: "F", act: "back" },
  { code: "Digit1", label: "1", act: "high" },
  { code: "Digit2", label: "2", act: "philly" },
  { code: "Digit3", label: "3", act: "normal" },
  { code: "Tab", label: "Tab", act: "cycle" },
  { code: "KeyT", label: "T", act: "stance" },
  { code: "KeyG", label: "G", act: "clinch" },
  { code: "ShiftLeft", label: "Shift", act: "sprint" },
  { code: "ShiftRight", label: "Shift", act: "sprint" },
  { code: "ArrowUp", label: "Up", act: "moveF" },
  { code: "ArrowDown", label: "Down", act: "moveB" },
  { code: "ArrowLeft", label: "Left", act: "moveL" },
  { code: "ArrowRight", label: "Right", act: "moveR" },
];
const ACT = new Map(KEYMAP.map(k => [k.code, k.act]));
const PUNCHES = new Set(["jab", "cross", "lhook", "rhook", "lupper", "rupper"]);
const GUARDS: Guard[] = ["high", "philly", "normal"];

export class Controls {
  private held = new Set<string>();
  private queue: { act: string; body: boolean }[] = [];
  private enabled = false;
  private lookX = 0;
  private lookY = 0;
  private lastMove = 0;
  private sens = 1;
  /** the guard the person last asked for, for Tab */
  guard: Guard = "normal";
  onPause: (() => void) | null = null;
  onAny: (() => void) | null = null;
  private el: HTMLElement | null = null;

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener("keydown", this.down, { capture: true });
    window.addEventListener("keyup", this.up, { capture: true });
    window.addEventListener("blur", this.blur);
    el.addEventListener("mousedown", this.mouse);
    el.addEventListener("contextmenu", this.noMenu);
    window.addEventListener("mousemove", this.move, { passive: true });
  }
  detach() {
    window.removeEventListener("keydown", this.down, { capture: true });
    window.removeEventListener("keyup", this.up, { capture: true });
    window.removeEventListener("blur", this.blur);
    window.removeEventListener("mousemove", this.move);
    this.el?.removeEventListener("mousedown", this.mouse);
    this.el?.removeEventListener("contextmenu", this.noMenu);
    this.el = null;
  }
  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.held.clear();
      this.queue.length = 0;
    }
  }
  setSensitivity(s: number) {
    this.sens = s;
  }
  /** clear everything held or waiting (after a pause, a screen change, a refresh) */
  reset() {
    this.held.clear();
    this.queue.length = 0;
    this.lookX = this.lookY = 0;
  }

  private bodyHeld() {
    return this.held.has("KeyL") || this.held.has("Semicolon");
  }

  private down = (e: KeyboardEvent) => {
    if (e.code === "Escape" || e.code === "KeyP") {
      if (!e.repeat) this.onPause?.();
      if (this.enabled) e.preventDefault();
      return;
    }
    if (!this.enabled) return;
    // typing into a field never fights
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
    const act = ACT.get(e.code);
    if (!act) return;
    // no page scrolling, no focus moving with Tab, no find on the slash
    e.preventDefault();
    this.onAny?.();
    if (e.repeat) return;
    this.held.add(e.code);
    if (!act.startsWith("move") && act !== "body") this.queue.push({ act, body: this.bodyHeld() });
  };
  private up = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };
  private blur = () => {
    this.held.clear();
  };
  private mouse = (e: MouseEvent) => {
    if (!this.enabled) return;
    this.onAny?.();
    if (e.button === 0) this.queue.push({ act: "jab", body: this.bodyHeld() });
    if (e.button === 2) this.queue.push({ act: "cross", body: this.bodyHeld() });
    this.queue.push({ act: "tap", body: false });
  };
  private noMenu = (e: Event) => e.preventDefault();
  private move = (e: MouseEvent) => {
    if (!this.enabled) return;
    // the look follows the mouse and springs back to the middle when it stops
    this.lookX = Math.max(-1, Math.min(1, this.lookX + (e.movementX || 0) * 0.004 * this.sens));
    this.lookY = Math.max(-1, Math.min(1, this.lookY - (e.movementY || 0) * 0.004 * this.sens));
    this.lastMove = performance.now();
  };

  /** the input for one fight step: everything held, and at most one queued press of each kind */
  next(out: Input = blankInput(), dt = 1 / 60): Input {
    Object.assign(out, blankInput());
    if (!this.enabled) return out;
    const h = this.held;
    out.mf = (h.has("KeyW") || h.has("ArrowUp") ? 1 : 0) - (h.has("KeyS") || h.has("ArrowDown") ? 1 : 0);
    out.ms = (h.has("KeyD") || h.has("ArrowRight") ? 1 : 0) - (h.has("KeyA") || h.has("ArrowLeft") ? 1 : 0);
    out.sprint = false;
    // the look eases back to the middle after a moment without moving the mouse
    if (performance.now() - this.lastMove > 350) {
      const k = Math.exp(-dt * 2.2);
      this.lookX *= k;
      this.lookY *= k;
    }
    out.aimX = this.lookX;
    out.aimY = this.lookY;
    // one press of each kind per step; the rest wait for the next step
    const used = new Set<string>();
    const keep: { act: string; body: boolean }[] = [];
    for (const q of this.queue) {
      const kind = PUNCHES.has(q.act) ? "punch" : q.act === "slipL" || q.act === "slipR" || q.act === "duck" || q.act === "back" ? "evade" : q.act;
      if (used.has(kind)) {
        keep.push(q);
        continue;
      }
      used.add(kind);
      if (kind === "punch") {
        out.punch = q.act as PunchKind;
        out.body = q.body;
        out.tap = true;
      } else if (kind === "evade") {
        out.evade = q.act as Evade;
        if (q.act === "duck") out.tap = true;
      } else if (q.act === "high" || q.act === "philly" || q.act === "normal") {
        out.guard = q.act;
        this.guard = q.act;
      } else if (q.act === "cycle") {
        this.guard = GUARDS[(GUARDS.indexOf(this.guard) + 1) % 3];
        out.guard = this.guard;
      } else if (q.act === "stance") out.stance = true;
      else if (q.act === "clinch") out.clinch = true;
      else if (q.act === "sprint") out.sprint = true;
      else if (q.act === "tap") out.tap = true;
    }
    this.queue = keep.slice(-6);
    return out;
  }
}
