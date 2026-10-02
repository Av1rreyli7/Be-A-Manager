// @vitest-environment jsdom
/**
 * Landing page checks: the title, both game links, the credit line, and the featured game
 * switcher (copy and labels swap together, nothing is added to or removed from the DOM).
 * The 3D backdrop never mounts here because jsdom has no WebGL, which is also the
 * fallback path real visitors on weak devices get.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import Landing from "@/landing/Landing";
import { GAMES, ORDER, other } from "@/landing/games";
import { createDecoder } from "@/landing/decode";
import { STARS_A, STARS_B } from "@/landing/starfield";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Landing />));
}
const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(host.querySelectorAll<T>(sel));
const click = (el: Element) => act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const featured = () => $(".bam").getAttribute("data-featured");
const onVariant = () => $$(".bam-variant").filter((v) => v.classList.contains("is-on"));

beforeEach(() => {
  // reduced motion keeps the decode labels still, so the text is the same on every run
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  globalThis.fetch = vi.fn(() => Promise.reject(new Error("no network in tests"))) as unknown as typeof fetch;
  localStorage.clear();
  // jsdom has no canvas: answer "no WebGL" quietly, like a device that cannot do 3D
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  mount();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.head.querySelectorAll("link[data-bam-warm]").forEach((l) => l.remove());
});

describe("landing page content", () => {
  it("has the Be-A-Manager title as the one big headline", () => {
    const h1 = $$("h1");
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe("Be-A-Manager");
  });

  it("links to both games", () => {
    const hrefs = $$<HTMLAnchorElement>("a").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/floodlights/");
    expect(hrefs).toContain("/front-office");
    // each game has its own enter button, always in the DOM
    expect($('[data-enter="floodlights"]').getAttribute("href")).toBe("/floodlights/");
    expect($('[data-enter="frontoffice"]').getAttribute("href")).toBe("/front-office");
    expect($('[data-enter="floodlights"]').textContent).toBe("ENTER FLOODLIGHTS");
    expect($('[data-enter="frontoffice"]').textContent).toBe("ENTER FRONT OFFICE");
    expect($('[data-enter="floodlights"]').classList.contains("bam-glowbtn")).toBe(true);
  });

  it("shows the credit line", () => {
    expect($(".bam-credit").textContent).toBe("By Avir & Ayanssh");
  });

  it("has the badge, the supporting line with one serif accent word, and three stats", () => {
    expect($(".bam-badge").textContent).toBe("Two games. One site.");
    expect($$(".bam-lede em")).toHaveLength(1);
    expect($(".bam-lede").textContent).toContain("run the whole show");
    expect($$(".bam-stat")).toHaveLength(3);
    expect($(".bam-stats").textContent).toContain("clubs in the world");
    expect($(".bam-stats").textContent).toContain("Two managers, one site");
  });

  it("draws the frame and the starfield", () => {
    expect($$(".bam-frame > .ln")).toHaveLength(4);
    expect($$(".bam-frame > .cn")).toHaveLength(4);
    expect($$(".bam-stars i")).toHaveLength(2);
    expect(STARS_A.split("rgba").length - 1).toBe(150);
    expect(STARS_B.split("rgba").length - 1).toBe(18);
  });

  it("uses no em dashes or en dashes anywhere it renders", () => {
    expect(host.innerHTML).not.toMatch(new RegExp("[" + String.fromCharCode(8211, 8212) + "]"));
    for (const f of ["Landing.tsx", "Backdrop3D.tsx", "landing.css", "games.ts", "decode.ts", "starfield.ts"]) {
      expect(fs.readFileSync(path.join(__dirname, "..", "src", "landing", f), "utf8"), f).not.toMatch(new RegExp("[" + String.fromCharCode(8211, 8212) + "]"));
    }
  });

  it("settles every entrance element even though animations never run here", async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    const appear = $$(".appear");
    expect(appear.length).toBeGreaterThan(20);
    expect(appear.every((el) => el.classList.contains("is-in"))).toBe(true);
  });
});

describe("featured game switcher", () => {
  it("starts with Floodlights featured", () => {
    expect(featured()).toBe("floodlights");
    expect(onVariant()).toHaveLength(1);
    expect(onVariant()[0].getAttribute("data-game")).toBe("floodlights");
    expect($(".bam-rail li.on").textContent).toBe("FLOODLIGHTS");
    expect($(".bam-glow.is-on").classList.contains("is-floodlights")).toBe(true);
  });

  it("keeps both games in the DOM as siblings at all times", () => {
    expect($$(".bam-variant")).toHaveLength(2);
    expect($$(".bam-glow")).toHaveLength(2);
    expect($$(".bam-rail button")).toHaveLength(2);
  });

  it("has no side preview card, the rail is the switcher", () => {
    expect(host.querySelector(".bam-side")).toBeNull();
    expect(host.querySelector(".bam-mock")).toBeNull();
    expect(host.querySelector(".bam-side-cap")).toBeNull();
    expect(host.querySelectorAll("img")).toHaveLength(0);
    expect(host.textContent).not.toContain("ALSO HERE");
    expect($$(".bam-rail button").map((b) => b.textContent)).toEqual(["FLOODLIGHTS", "FRONT OFFICE"]);
  });

  it("swaps the copy and the labels together when the featured game changes", () => {
    const before = host.querySelectorAll("*").length;
    click($('.bam-rail button[data-game="frontoffice"]'));

    expect(featured()).toBe("frontoffice");
    const on = onVariant();
    expect(on).toHaveLength(1);
    expect(on[0].getAttribute("data-game")).toBe("frontoffice");
    // headline, supporting text and label of the featured block
    expect(on[0].querySelector(".bam-title")!.textContent).toBe(GAMES.frontoffice.name);
    expect(on[0].querySelector(".bam-blurb")!.textContent).toBe(GAMES.frontoffice.blurb);
    expect(on[0].querySelector(".bam-kind")!.textContent).toBe("BASKETBALL GM");
    expect(on[0].getAttribute("aria-hidden")).toBe("false");
    // the old game is hidden from readers and from the keyboard
    const off = $('.bam-variant[data-game="floodlights"]');
    expect(off.getAttribute("aria-hidden")).toBe("true");
    expect(off.hasAttribute("inert")).toBe(true);
    // rail and backdrop follow
    expect($(".bam-rail li.on").textContent).toBe("FRONT OFFICE");
    expect($('.bam-rail button[data-game="frontoffice"]').getAttribute("aria-pressed")).toBe("true");
    expect($(".bam-glow.is-on").classList.contains("is-frontoffice")).toBe(true);
    // zero flash: only classes changed, the elements are the same
    expect(host.querySelectorAll("*").length).toBe(before);
  });

  it("is fully reversible from every control", () => {
    click($('.bam-variant.is-on [data-see="frontoffice"]'));
    expect(featured()).toBe("frontoffice");
    click($('.bam-variant.is-on [data-see="floodlights"]'));
    expect(featured()).toBe("floodlights");
    click($('.bam-rail button[data-game="frontoffice"]'));
    expect(featured()).toBe("frontoffice");
    click($('.bam-rail button[data-game="floodlights"]'));
    expect(featured()).toBe("floodlights");
    click($('.bam-rail button[data-game="floodlights"]'));
    expect(featured()).toBe("floodlights");
    expect($(".bam-rail li.on").textContent).toBe("FLOODLIGHTS");
  });

  it("warms the other game on intent, before the click", () => {
    expect(document.head.querySelector('link[data-bam-warm="frontoffice"]')).toBeNull();
    act(() => {
      $('.bam-rail button[data-game="frontoffice"]').dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    const link = document.head.querySelector<HTMLLinkElement>('link[data-bam-warm="frontoffice"]');
    expect(link?.rel).toBe("prefetch");
    expect(link?.getAttribute("href")).toBe("/front-office");
    expect(featured()).toBe("floodlights");
  });
});

describe("3D backdrop fallback", () => {
  it("stays on the still backdrop when the device cannot do 3D", async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect($(".bam").getAttribute("data-3d")).toBe("off");
    expect(host.querySelector("canvas")).toBeNull();
    expect($(".bam-3d").textContent).toBe("3D OFF");
    expect($(".bam-3d").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("game data and decode labels", () => {
  it("describes exactly two games in simple words", () => {
    expect(ORDER).toEqual(["floodlights", "frontoffice"]);
    expect(other("floodlights")).toBe("frontoffice");
    expect(other("frontoffice")).toBe("floodlights");
    for (const id of ORDER) {
      expect(GAMES[id].blurb.split(" ").length).toBeLessThanOrEqual(26);
      expect(JSON.stringify(GAMES[id])).not.toMatch(new RegExp("[" + String.fromCharCode(8211, 8212) + "]"));
    }
  });

  it("a decode label always ends on its real text", () => {
    vi.useFakeTimers();
    try {
      const box = document.createElement("div");
      box.innerHTML = '<a href="#"><span class="t">ENTER FLOODLIGHTS</span></a>';
      document.body.appendChild(box);
      const d = createDecoder(box, false);
      const el = box.querySelector<HTMLElement>(".t")!;
      d.decode(el);
      vi.advanceTimersByTime(60);
      expect(el.textContent!.length).toBeLessThanOrEqual("ENTER FLOODLIGHTS".length);
      vi.advanceTimersByTime(1500);
      expect(el.textContent).toBe("ENTER FLOODLIGHTS");
      d.setText(el, "3D OFF");
      vi.advanceTimersByTime(1500);
      expect(el.textContent).toBe("3D OFF");
      d.destroy();
      box.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});
