// @vitest-environment jsdom
/**
 * Landing page checks: the welcome headline, both game cards with their links and colour modes, the intro
 * timeline (skip, Esc, the short version for a second visit), the calm version for reduced motion, and the
 * wording rules. The 3D backdrop never mounts here because jsdom has no WebGL, which is also the fallback
 * path real visitors on weak devices get.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import Landing, { SEEN_KEY } from "@/landing/Landing";
import { GAMES, ORDER, other } from "@/landing/games";
import { STARS_A, STARS_B } from "@/landing/starfield";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type TL = { progress(): number; time(): number; labels: Record<string, number> };
let host: HTMLDivElement;
let root: Root;

/** reduce = true: the visitor asked for reduced motion */
function mount({ reduce = false, seen = false } = {}) {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("no-preference") ? !reduce : q.includes(": reduce") ? reduce : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.fetch = vi.fn(() => Promise.reject(new Error("no network in tests"))) as unknown as typeof fetch;
  localStorage.clear();
  sessionStorage.clear();
  if (seen) sessionStorage.setItem(SEEN_KEY, "seen");
  delete (window as unknown as { __bamIntroTL?: TL }).__bamIntroTL;
  // jsdom has no canvas: answer "no WebGL" quietly, like a device that cannot do 3D
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Landing />));
}
const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(host.querySelectorAll<T>(sel));
const tl = () => (window as unknown as { __bamIntroTL?: TL }).__bamIntroTL;
const phase = () => $(".bam").getAttribute("data-phase");

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.head.querySelectorAll("link[data-bam-warm]").forEach((l) => l.remove());
});

describe("landing page content", () => {
  it("has one headline that reads Welcome to Be-A-Manager, drawn letter by letter", () => {
    mount({ reduce: true });
    const h1 = $$("h1");
    expect(h1).toHaveLength(1);
    expect(h1[0].querySelector(".sr-only")!.textContent).toBe("Welcome to Be-A-Manager");
    expect($$(".bam-brand .ch").map((c) => c.textContent).join("")).toBe("BE-A-MANAGER");
    // the big welcome word in the intro layer has the same letters, each with a white and a colour layer
    expect($$(".bam-big .L .w").map((c) => c.textContent).join("")).toBe("BE-A-MANAGER");
    expect($$(".bam-big .L .c")).toHaveLength(12);
    expect($(".bam-welcome").textContent).toBe("WELCOME TO");
  });

  it("has a card for each game with its enter button, both always in the page", () => {
    mount({ reduce: true });
    expect($$(".bam-card")).toHaveLength(2);
    expect($('[data-enter="floodlights"]').getAttribute("href")).toBe("/floodlights/");
    expect($('[data-enter="frontoffice"]').getAttribute("href")).toBe("/front-office");
    expect($('[data-enter="floodlights"]').textContent).toBe("ENTER FLOODLIGHTS");
    expect($('[data-enter="frontoffice"]').textContent).toBe("ENTER GAME NIGHT");
    for (const id of ORDER) {
      const btn = $(`[data-enter="${id}"]`);
      expect(btn.classList.contains("k-btn-glow")).toBe(true);
      expect(btn.classList.contains("bam-glowbtn")).toBe(true);
      // the whole card is clickable through one stretched link that goes to the same place
      expect($(`.bam-card[data-game="${id}"] .bam-hit`).getAttribute("href")).toBe(GAMES[id].href);
      expect($(`.bam-card[data-game="${id}"] .bam-hit`).getAttribute("tabindex")).toBe("-1");
    }
    // the top bar links to both games too
    const hrefs = $$<HTMLAnchorElement>(".bam-nav a").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/floodlights/", "/front-office"]);
  });

  it("gives each game its colour mode from the shared kit: pitch for Floodlights, court for Game Night", () => {
    mount({ reduce: true });
    expect($('.bam-card[data-game="floodlights"]').getAttribute("data-kmode")).toBe("pitch");
    expect($('.bam-card[data-game="frontoffice"]').getAttribute("data-kmode")).toBe("court");
    expect(GAMES.floodlights.mode).toBe("pitch");
    expect(GAMES.frontoffice.mode).toBe("court");
  });

  it("shows a ball with each title: a football for Floodlights, a basketball for Game Night", () => {
    mount({ reduce: true });
    expect($$('.bam-card[data-game="floodlights"] .bam-ball svg')).toHaveLength(1);
    expect($$('.bam-card[data-game="floodlights"] .bam-streak')).toHaveLength(1);
    expect($$('.bam-card[data-game="frontoffice"] .bam-ball svg')).toHaveLength(1);
    expect($$('.bam-card[data-game="frontoffice"] .bam-shock')).toHaveLength(1);
    expect($('.bam-card[data-game="floodlights"] .bam-title .sr-only').textContent).toBe("Floodlights");
    expect($('.bam-card[data-game="frontoffice"] .bam-title .sr-only').textContent).toBe("Game Night");
  });

  it("uses Game Night as the site level name, and Front Office only for the game inside it", () => {
    mount({ reduce: true });
    const text = host.textContent!.toUpperCase();
    expect(text).not.toContain("ENTER FRONT OFFICE");
    expect(text).not.toContain("BASKETBALL GM");
    expect(host.textContent!.match(/Front Office/gi)).toHaveLength(1);
    expect($(".bam-inside").textContent).toContain("The matches play out on their own.");
    expect($(".bam-inside").textContent).toContain("play the season yourself in 5v5.");
    expect(other("floodlights")).toBe("frontoffice");
  });

  it("has short punchy copy, chips, the stats and the credit line", () => {
    mount({ reduce: true });
    for (const id of ORDER) expect($$(`.bam-card[data-game="${id}"] .bam-chips .k-chip`)).toHaveLength(3);
    expect($(".bam-lede").textContent).toBe("Two games. Pick one and run the whole show.");
    expect($$(".bam-lede em")).toHaveLength(1);
    expect($(".bam-stats").textContent).toContain("320 clubs");
    expect($(".bam-stats").textContent).toContain("15 leagues");
    expect($(".bam-credit").textContent).toBe("By Avir & Ayanssh");
  });

  it("draws the frame, the floodlights and the starfield", () => {
    mount({ reduce: true });
    expect($$(".bam-frame > .ln")).toHaveLength(4);
    expect($$(".bam-frame > .cn")).toHaveLength(4);
    expect($$(".bam-beam")).toHaveLength(2);
    expect($$(".bam-lamps i")).toHaveLength(12);
    expect($$(".bam-stars i")).toHaveLength(2);
    expect(STARS_A.split("rgba").length - 1).toBe(150);
    expect(STARS_B.split("rgba").length - 1).toBe(18);
  });

  it("uses no em dashes or en dashes anywhere it renders or in its source", () => {
    mount({ reduce: true });
    const bad = new RegExp("[" + String.fromCharCode(8211, 8212) + "]");
    expect(host.innerHTML).not.toMatch(bad);
    for (const f of ["Landing.tsx", "Backdrop3D.tsx", "Balls.tsx", "landing.css", "games.ts", "starfield.ts"]) {
      expect(fs.readFileSync(path.join(__dirname, "..", "src", "landing", f), "utf8"), f).not.toMatch(bad);
    }
    expect(fs.readFileSync(path.join(__dirname, "..", "src", "app", "page.tsx"), "utf8")).not.toMatch(bad);
  });
});

describe("the intro", () => {
  it("builds one timeline with the lights, the welcome flight and the two card moments, under 3.5 seconds", () => {
    mount();
    const t = tl();
    expect(t).toBeTruthy();
    expect(phase()).toBe("intro");
    expect(Object.keys(t!.labels)).toEqual(expect.arrayContaining(["lights", "fly", "cards"]));
    expect((t as unknown as { duration(): number }).duration()).toBeLessThan(3.5);
    // the skip button shows from the first frame, and the links work while the intro plays
    expect($<HTMLButtonElement>(".bam-skip").hidden).toBe(false);
    expect($(".bam-intro").style.pointerEvents).not.toBe("auto");
  });

  it("skip jumps straight to the end and remembers the visit for this tab", () => {
    mount();
    act(() => $<HTMLButtonElement>(".bam-skip").click());
    expect(tl()!.progress()).toBe(1);
    expect(phase()).toBe("done");
    expect($<HTMLButtonElement>(".bam-skip").hidden).toBe(true);
    expect($(".bam-intro").style.display).toBe("none");
    for (const card of $$(".bam-card")) expect(card.style.opacity).toBe("1");
    expect($(".bam-brand").style.opacity).toBe("1");
    expect(sessionStorage.getItem(SEEN_KEY)).toBe("seen");
    // the replay button appears once the intro is over
    expect($$(".bam-mini").map((b) => b.textContent)).toContain("Replay intro");
  });

  it("Esc skips the intro too", () => {
    mount();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(tl()!.progress()).toBe(1);
    expect(phase()).toBe("done");
  });

  it("a second visit in the same tab plays only the quick card moments", () => {
    mount({ seen: true });
    const t = tl()!;
    expect(t.time()).toBeGreaterThanOrEqual(t.labels.cards);
    expect($(".bam-intro").style.display).toBe("none");
  });

  it("hides the pieces still to come, so nothing shows its end state before the intro gets to it", () => {
    mount();
    expect($('.bam-card[data-game="frontoffice"]').style.opacity).toBe("0");
    expect($(".bam-foot").style.opacity).toBe("0");
  });
});

describe("reduced motion", () => {
  it("gets the calm page at once: no timeline, no intro layer, nothing hidden, no skip, no replay", () => {
    mount({ reduce: true });
    expect(tl()).toBeUndefined();
    expect(phase()).toBe("done");
    expect($<HTMLButtonElement>(".bam-skip").hidden).toBe(true);
    expect($(".bam-intro").style.display).not.toBe("flex");
    for (const el of $$(".bam-card, .bam-brand, .bam-foot")) expect(el.style.opacity).toBe("");
    expect($$(".bam-mini").map((b) => b.textContent)).not.toContain("Replay intro");
  });

  it("never mounts the 3D backdrop when the device has no WebGL", async () => {
    mount({ reduce: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    expect($(".bam").getAttribute("data-3d")).toBe("off");
    expect($$(".bam-canvas")).toHaveLength(0);
  });
});

describe("first paint guard", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "src", "app", "page.tsx"), "utf8");
  it("hides the intro pieces before the first paint, skips it for reduced motion and lifts itself if scripts fail", () => {
    expect(page).toContain("prefers-reduced-motion: reduce");
    expect(page).toContain('s.id="bam-prehide"');
    expect(page).toContain("4500");
    expect(page).toContain("bam:intro");
    expect(page).toContain("dangerouslySetInnerHTML={{ __html: PREHIDE }}");
  });
});
