// @vitest-environment jsdom
// The free roam camera: looking round comes from the mouse (once the view is clicked) or a trackpad glide; the
// wheel and a pinch are only a gentle zoom, and a pinch never zooms the page.
import { describe, it, expect, vi } from "vitest";
import { attachLook, isTrackpad } from "../src/career/world/look";

function setup() {
  const world = document.createElement("div");
  world.className = "pc-world";
  const el = document.createElement("div");
  world.appendChild(el);
  document.body.appendChild(world);
  const look = vi.fn();
  const zoom = vi.fn();
  const L = attachLook(el, { look, zoom });
  return { world, el, look, zoom, L };
}
function wheel(target: HTMLElement, o: { deltaX?: number; deltaY?: number; deltaMode?: number; ctrlKey?: boolean; wheelDeltaY?: number }) {
  const e = new WheelEvent("wheel", { deltaX: o.deltaX || 0, deltaY: o.deltaY || 0, deltaMode: o.deltaMode || 0, ctrlKey: !!o.ctrlKey, bubbles: true, cancelable: true });
  if (o.wheelDeltaY !== undefined) Object.defineProperty(e, "wheelDeltaY", { value: o.wheelDeltaY });
  target.dispatchEvent(e);
  return e;
}
function pointer(target: EventTarget, type: string, o: { x?: number; y?: number; mx?: number; my?: number; id?: number; kind?: string; button?: number }) {
  const e = new MouseEvent(type, { clientX: o.x || 0, clientY: o.y || 0, button: o.button || 0, bubbles: true, cancelable: true });
  Object.defineProperty(e, "pointerId", { value: o.id ?? 1 });
  Object.defineProperty(e, "pointerType", { value: o.kind || "mouse" });
  Object.defineProperty(e, "movementX", { value: o.mx || 0 });
  Object.defineProperty(e, "movementY", { value: o.my || 0 });
  target.dispatchEvent(e);
  return e;
}

describe("trackpad or mouse wheel", () => {
  it("a glide (small, fractional or sideways steps) is a trackpad", () => {
    expect(isTrackpad({ deltaMode: 0, deltaX: 0, deltaY: 4 })).toBe(true);
    expect(isTrackpad({ deltaMode: 0, deltaX: 0, deltaY: 12.5 })).toBe(true);
    expect(isTrackpad({ deltaMode: 0, deltaX: 3, deltaY: 0 })).toBe(true);
    expect(isTrackpad({ deltaMode: 0, deltaX: 0, deltaY: 6, wheelDeltaY: -18 })).toBe(true);
  });
  it("a wheel notch (lines, or a big round step in multiples of 120) is a mouse wheel", () => {
    expect(isTrackpad({ deltaMode: 1, deltaX: 0, deltaY: 3 })).toBe(false);
    expect(isTrackpad({ deltaMode: 0, deltaX: 0, deltaY: 100, wheelDeltaY: -120 })).toBe(false);
    expect(isTrackpad({ deltaMode: 0, deltaX: 0, deltaY: 200 })).toBe(false);
  });
});

describe("looking round", () => {
  it("a trackpad glide turns the camera and never zooms", () => {
    const { el, look, zoom, L } = setup();
    const e = wheel(el, { deltaX: 10, deltaY: -4 });
    expect(look).toHaveBeenCalledTimes(1);
    expect(zoom).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
    // fingers moving right turn the view right, like the mouse (natural scrolling sends negative x)
    wheel(el, { deltaX: -8, deltaY: 0 });
    expect(look.mock.calls[1][0]).toBeGreaterThan(0);
    L.dispose();
  });
  it("a mouse wheel is a gentle zoom", () => {
    const { el, look, zoom, L } = setup();
    wheel(el, { deltaY: 3, deltaMode: 1 });
    expect(zoom).toHaveBeenCalledTimes(1);
    expect(look).not.toHaveBeenCalled();
    const f = zoom.mock.calls[0][0];
    expect(f).toBeGreaterThan(1);
    expect(f).toBeLessThan(1.1);
    L.dispose();
  });
  it("a pinch (ctrl wheel) zooms gently and the page never zooms, even over the HUD", () => {
    const { world, el, zoom, L } = setup();
    const e = wheel(el, { deltaY: -6, ctrlKey: true });
    expect(zoom).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    expect(zoom.mock.calls[0][0]).toBeLessThan(1);
    const hud = document.createElement("div");
    world.appendChild(hud);
    const e2 = wheel(hud, { deltaY: -6, ctrlKey: true });
    expect(e2.defaultPrevented).toBe(true);
    L.dispose();
  });
  it("a click on the view captures the mouse; then moving the mouse turns the camera", () => {
    const { el, look, L } = setup();
    let locked: Element | null = null;
    Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => locked });
    const req = vi.fn(() => {
      locked = el;
    });
    (el as unknown as { requestPointerLock: () => void }).requestPointerLock = req;
    pointer(el, "pointerdown", { x: 100, y: 100 });
    pointer(document, "pointerup", { x: 101, y: 100 });
    expect(req).toHaveBeenCalledTimes(1);
    expect(L.locked()).toBe(true);
    pointer(document, "pointermove", { mx: 14, my: -3 });
    expect(look).toHaveBeenLastCalledWith(14, -3);
    L.dispose();
    locked = null;
  });
  it("dragging still turns the camera (touch screens, or before the mouse is captured), and a drag never captures", () => {
    const { el, look, L } = setup();
    const req = vi.fn();
    (el as unknown as { requestPointerLock: () => void }).requestPointerLock = req;
    pointer(el, "pointerdown", { x: 100, y: 100, kind: "touch" });
    pointer(document, "pointermove", { x: 130, y: 110, kind: "touch" });
    pointer(document, "pointerup", { x: 130, y: 110, kind: "touch" });
    expect(look).toHaveBeenCalledWith(30, 10);
    expect(req).not.toHaveBeenCalled();
    pointer(el, "pointerdown", { x: 50, y: 50 });
    pointer(document, "pointermove", { x: 90, y: 50 });
    pointer(document, "pointerup", { x: 90, y: 50 });
    expect(req).not.toHaveBeenCalled();
    L.dispose();
  });
  it("buttons and labels on top of the view do not start a look", () => {
    const { el, look, L } = setup();
    const b = document.createElement("button");
    el.appendChild(b);
    pointer(b, "pointerdown", { x: 10, y: 10 });
    pointer(document, "pointermove", { x: 60, y: 10 });
    expect(look).not.toHaveBeenCalled();
    L.dispose();
  });
});
