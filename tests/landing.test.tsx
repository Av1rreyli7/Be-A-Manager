// @vitest-environment jsdom
/**
 * Landing page checks: the welcome headline, both games (title, one line, glass enter button), the intro
 * timeline (skip, Esc, the short version for a second visit), the calm version for reduced motion, and the
 * wording rules. The landing has no 3D scene: the lights, the aurora and the two balls carry it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import Landing, { SEEN_KEY } from "@/landing/Landing";
import { GAMES, ORDER } from "@/landing/games";
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
      // the shared glass button from the kit, tinted by the card's colour mode
      expect(btn.classList.contains("k-btn")).toBe(true);
      expect(btn.classList.contains("k-btn-primary")).toBe(true);
      expect(btn.classList.contains("k-btn-glow")).toBe(false);
      expect(btn.querySelector(".bam-btnflash")).toBeNull();
      // the whole card is clickable through one stretched link that goes to the same place
      expect($(`.bam-card[data-game="${id}"] .bam-hit`).getAttribute("href")).toBe(GAMES[id].href);
      expect($(`.bam-card[data-game="${id}"] .bam-hit`).getAttribute("tabindex")).toBe("-1");
    }
    // no other ways in to read: the top bar is only the logo (and the skip button while the intro plays)
    expect($$(".bam-nav, .bam-pill")).toHaveLength(0);
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

  it("says almost nothing: each game is its title, one short line and the enter button", () => {
    mount({ reduce: true });
    expect($('.bam-card[data-game="floodlights"] .bam-line').textContent).toBe("Run a football club with your mates.");
    expect($('.bam-card[data-game="frontoffice"] .bam-line').textContent).toBe("Run the team, or play it yourself.");
    for (const id of ORDER) {
      const card = $(`.bam-card[data-game="${id}"]`);
      expect($$(`.bam-card[data-game="${id}"] p`)).toHaveLength(1);
      // the readable name, the animated letters, the line and the button: nothing else
      expect(card.textContent).toBe(GAMES[id].name + GAMES[id].name.toUpperCase() + GAMES[id].line + GAMES[id].enter);
      expect(GAMES[id].line.split(" ").length).toBeLessThanOrEqual(8);
    }
    // everything else is gone: no lede, kind labels, blurbs, chips, stats, footer, toggles or credit
    for (const gone of [".bam-lede", ".bam-kind", ".bam-blurb", ".bam-inside", ".bam-chips", ".k-chip", ".bam-foot", ".bam-stats", ".bam-mini", ".bam-credit", ".bam-card-bg"]) {
      expect($$(gone), gone).toHaveLength(0);
    }
    // every readable word on the page (the animated letter layers are aria-hidden copies of the same words)
    const clone = host.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[aria-hidden="true"], [hidden], style').forEach((n) => n.remove());
    expect(clone.textContent).toBe(
      "BAM" + "Welcome to Be-A-Manager" + ORDER.map((id) => GAMES[id].name + GAMES[id].line + GAMES[id].enter).join(""),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
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
    for (const f of ["Landing.tsx", "Balls.tsx", "landing.css", "games.ts", "starfield.ts"]) {
      expect(fs.readFileSync(path.join(__dirname, "..", "src", "landing", f), "utf8"), f).not.toMatch(bad);
    }
    expect(fs.readFileSync(path.join(__dirname, "..", "src", "app", "page.tsx"), "utf8")).not.toMatch(bad);
  });
});

describe("the intro", () => {
  it("builds one timeline with the lights, the welcome flight and the two card moments, under 3.2 seconds", () => {
    mount();
    const t = tl();
    expect(t).toBeTruthy();
    expect(phase()).toBe("intro");
    expect(Object.keys(t!.labels)).toEqual(expect.arrayContaining(["lights", "fly", "cards"]));
    expect((t as unknown as { duration(): number }).duration()).toBeLessThan(3.2);
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
    expect($('.bam-card[data-game="frontoffice"] .bam-enter').style.opacity).toBe("0");
  });
});

describe("reduced motion", () => {
  it("gets the calm page at once: no timeline, no intro layer, nothing hidden, no skip", () => {
    mount({ reduce: true });
    expect(tl()).toBeUndefined();
    expect(phase()).toBe("done");
    expect($<HTMLButtonElement>(".bam-skip").hidden).toBe(true);
    expect($(".bam-intro").style.display).not.toBe("flex");
    for (const el of $$(".bam-card, .bam-brand, .bam-line, .bam-enter")) expect(el.style.opacity).toBe("");
  });

  it("has no 3D scene: the page is light, the floodlights and the aurora carry the look", async () => {
    mount({ reduce: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    expect($$(".bam-canvas, canvas")).toHaveLength(0);
    expect($(".bam").hasAttribute("data-3d")).toBe(false);
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
