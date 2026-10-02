/**
 * Letter scramble decode for every label, ported from the Stratum reference.
 * A label resolves left to right in 400ms with a short band of random letters
 * running ahead of the settled ones. Widths are pinned first so nothing reflows.
 */
const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DUR = 400;

type Label = HTMLElement & { _raf?: number; _t?: ReturnType<typeof setTimeout> };

export interface Decoder {
  reserve(): void;
  decode(el: HTMLElement | null, dur?: number): void;
  setText(el: HTMLElement | null, text: string): void;
  decodeIn(scope: Element | null, delay?: number, step?: number): void;
  boot(): void;
  destroy(): void;
}

export function createDecoder(root: HTMLElement, reduced: boolean): Decoder {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const labels = (): Label[] => Array.from(root.querySelectorAll<HTMLElement>(".t"));
  let dead = false;

  for (const el of labels()) if (!el.dataset.text) el.dataset.text = el.textContent || "";

  function reserve() {
    const all = labels();
    for (const el of all) {
      if (el._raf) settle(el);
      el.style.width = "";
    }
    const w = all.map((el) => el.getBoundingClientRect().width);
    all.forEach((el, i) => {
      if (w[i] > 0) el.style.width = Math.ceil(w[i] * 100) / 100 + "px";
    });
  }

  function settle(el: Label) {
    if (el._raf) {
      cancelAnimationFrame(el._raf);
      el._raf = 0;
    }
    if (el._t) {
      clearTimeout(el._t);
      el._t = undefined;
    }
    el.textContent = el.dataset.text || "";
  }

  function decode(target: HTMLElement | null, dur?: number) {
    if (!target || dead) return;
    const el = target as Label;
    const text = el.dataset.text || "";
    const n = text.length;
    settle(el);
    if (reduced || !n) return;
    const D = dur || DUR;
    const t0 = performance.now();
    let lastRoll = 0;
    const rand: string[] = new Array(n);
    const roll = () => {
      for (let i = 0; i < n; i++) rand[i] = CH.charAt((Math.random() * 26) | 0);
    };
    roll();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / D);
      const front = p * n;
      let out = "";
      if (now - lastRoll > 45) {
        roll();
        lastRoll = now;
      }
      for (let i = 0; i < n; i++) {
        const c = text.charAt(i);
        if (i < front) out += c;
        else if (i < front + 3.6) out += c === " " ? " " : rand[i];
        else break;
      }
      el.textContent = out;
      if (p < 1) el._raf = requestAnimationFrame(step);
      else settle(el);
    };
    el._raf = requestAnimationFrame(step);
    // if frames are throttled (background tab, low power) the label still resolves by itself
    el._t = setTimeout(() => settle(el), D + 500);
  }

  function setText(el: HTMLElement | null, text: string) {
    if (!el) return;
    el.dataset.text = text;
    el.style.width = "";
    el.textContent = text;
    const w = el.getBoundingClientRect().width;
    if (w > 0) el.style.width = Math.ceil(w * 100) / 100 + "px";
    decode(el);
  }

  function later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
  }

  function decodeIn(scope: Element | null, delay = 0, step = 55) {
    if (!scope) return;
    Array.from(scope.querySelectorAll<HTMLElement>(".t")).forEach((el, i) => later(() => decode(el), delay + i * step));
  }

  const onEnter = (e: Event) => {
    const host = (e.target as Element | null)?.closest?.("a, button");
    if (!host || !root.contains(host)) return;
    host.querySelectorAll<HTMLElement>(".t").forEach((el) => decode(el));
  };
  // pointerenter does not bubble, so listen in the capture phase on the root
  root.addEventListener("pointerenter", onEnter, true);

  let rt: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(reserve, 160);
  };
  window.addEventListener("resize", onResize);

  function boot() {
    reserve();
    // a late font swap changes the label widths, so measure again when fonts land
    try {
      document.fonts?.addEventListener?.("loadingdone", onResize);
    } catch {
      /* older browsers: the resize path still covers it */
    }
    later(reserve, 2700);
    if (reduced) return;
    // each label carries its own start time so the labels follow the entrance timeline
    for (const el of labels()) {
      const at = Number(el.dataset.at);
      if (Number.isFinite(at) && el.dataset.at !== undefined) later(() => decode(el), at);
    }
    // nothing may outlive the entrance: every label is force settled at the end
    later(() => labels().forEach(settle), 2600);
  }

  function destroy() {
    dead = true;
    root.removeEventListener("pointerenter", onEnter, true);
    window.removeEventListener("resize", onResize);
    try {
      document.fonts?.removeEventListener?.("loadingdone", onResize);
    } catch {
      /* nothing to remove */
    }
    clearTimeout(rt);
    timers.forEach(clearTimeout);
    timers.clear();
    labels().forEach(settle);
  }

  return { reserve, decode, setText, decodeIn, boot, destroy };
}
