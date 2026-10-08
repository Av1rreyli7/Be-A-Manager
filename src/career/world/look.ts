/**
 * Looking round, the way a third person game does it. A click on the view captures the mouse (pointer lock) and
 * moving it turns the camera round him; a two finger glide on a trackpad turns it too. A mouse wheel and a pinch
 * are a gentle zoom that never fights the look, and a pinch never zooms the page. Esc frees the mouse. Dragging
 * still turns the camera, for touch screens and before the mouse is captured. One controller serves the street,
 * the rooms and the car: the screen hands it what to turn.
 */
export interface LookHandlers {
  /** turn: dx right, dy down, in screen pixels (the camera turns the way the mouse moves) */
  look: (dx: number, dy: number) => void;
  /** zoom by a factor: above 1 further out, below 1 closer in */
  zoom: (f: number) => void;
}
export interface LookCtl {
  dispose: () => void;
  locked: () => boolean;
  /** milliseconds since the mouse was last freed (Esc freeing the mouse is not Esc leaving a place) */
  sinceUnlock: () => number;
  release: () => void;
}

/** is this wheel event a trackpad glide (true) or a mouse wheel (false) */
export function isTrackpad(e: { deltaMode: number; deltaX: number; deltaY: number; wheelDeltaY?: number }) {
  // lines or pages: a mouse wheel (Firefox reports wheels this way)
  if (e.deltaMode !== 0) return false;
  // sideways movement only comes from a trackpad (or a tilt wheel, which is fine to treat the same)
  if (e.deltaX !== 0) return true;
  // Chrome and Safari: a wheel notch is a whole multiple of 120 in the old units
  const w = e.wheelDeltaY;
  if (typeof w === "number" && w !== 0 && Math.abs(w) % 120 === 0 && Math.abs(e.deltaY) >= 50) return false;
  // big round jumps are notches; small or fractional steps are a glide
  return Math.abs(e.deltaY) < 50 || !Number.isInteger(e.deltaY);
}

const NO_LOOK = "button, a, input, select, textarea, label, [data-nolook]";

export function attachLook(el: HTMLElement, h: LookHandlers): LookCtl {
  const doc = el.ownerDocument;
  let drag: { id: number; x: number; y: number; moved: number; touch: boolean } | null = null;
  let unlockAt = -1e9;
  const locked = () => doc.pointerLockElement === el;
  const free = () => {
    if (locked() && typeof doc.exitPointerLock === "function") doc.exitPointerLock();
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement | null)?.closest?.(NO_LOOK)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, touch: e.pointerType === "touch" };
  };
  const move = (e: PointerEvent) => {
    if (locked()) {
      if (e.movementX || e.movementY) h.look(e.movementX, e.movementY);
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    h.look(dx, dy);
  };
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const click = drag.moved < 6 && !drag.touch;
    drag = null;
    // a click on the view (not a drag) captures the mouse for looking round
    if (click && !locked() && el.requestPointerLock) {
      try {
        const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {
        /* a browser without pointer lock keeps dragging */
      }
    }
  };
  const wheel = (e: WheelEvent) => {
    // the world owns the wheel: no page scroll, no page zoom
    e.preventDefault();
    if (e.ctrlKey) {
      // a trackpad pinch arrives as a wheel with ctrl held: a gentle zoom
      h.zoom(Math.exp(Math.max(-0.25, Math.min(0.25, e.deltaY * 0.01))));
      return;
    }
    if (isTrackpad(e as WheelEvent & { wheelDeltaY?: number })) {
      // a two finger glide turns the camera; fingers move the view the way a mouse would
      h.look(-e.deltaX * 1.1, -e.deltaY * 1.1);
      return;
    }
    h.zoom(e.deltaY > 0 ? 1.06 : 1 / 1.06);
  };
  // Safari's pinch comes as gesture events
  let lastScale = 1;
  const gStart = (e: Event) => {
    e.preventDefault();
    lastScale = 1;
  };
  const gChange = (e: Event) => {
    e.preventDefault();
    const s = (e as Event & { scale?: number }).scale || 1;
    h.zoom(Math.max(0.85, Math.min(1.15, lastScale / s)));
    lastScale = s;
  };
  const lockChange = () => {
    if (!locked()) unlockAt = performance.now();
  };
  // a pinch anywhere over the world (the HUD too) must not zoom the page
  const guardEl = (el.closest(".pc-world") as HTMLElement | null) || el;
  const guard = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };
  el.addEventListener("pointerdown", down);
  doc.addEventListener("pointermove", move);
  doc.addEventListener("pointerup", up);
  doc.addEventListener("pointercancel", up);
  el.addEventListener("wheel", wheel, { passive: false });
  guardEl.addEventListener("wheel", guard, { passive: false });
  el.addEventListener("gesturestart", gStart as EventListener, { passive: false } as AddEventListenerOptions);
  el.addEventListener("gesturechange", gChange as EventListener, { passive: false } as AddEventListenerOptions);
  doc.addEventListener("pointerlockchange", lockChange);
  return {
    dispose() {
      el.removeEventListener("pointerdown", down);
      doc.removeEventListener("pointermove", move);
      doc.removeEventListener("pointerup", up);
      doc.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      guardEl.removeEventListener("wheel", guard);
      el.removeEventListener("gesturestart", gStart as EventListener);
      el.removeEventListener("gesturechange", gChange as EventListener);
      doc.removeEventListener("pointerlockchange", lockChange);
      free();
    },
    locked,
    sinceUnlock: () => performance.now() - unlockAt,
    release: free,
  };
}
