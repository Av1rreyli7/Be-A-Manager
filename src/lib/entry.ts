"use client";
/**
 * The entry page motion, the same as the Floodlights entry: each small caps label (.k-dec) resolves left to
 * right in 400ms behind a short band of random letters, and the three big numbers count up as the row settles.
 * Widths are pinned first so a scramble never moves anything. Nothing runs with reduced motion.
 */
import { useEffect, type RefObject } from "react";
import { km } from "@/lib/motion";

const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Label = HTMLElement & { _raf?: number; _t?: ReturnType<typeof setTimeout> };

export function useKitEntry(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const RM = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const labels = [...host.querySelectorAll<Label>(".k-dec")];
    labels.forEach((el) => (el.dataset.text = el.dataset.text ?? el.textContent ?? ""));
    const reserve = () => {
      labels.forEach((el) => (el.style.width = ""));
      const w = labels.map((el) => el.getBoundingClientRect().width);
      labels.forEach((el, i) => {
        if (w[i] > 0) el.style.width = Math.ceil(w[i] * 100) / 100 + "px";
      });
    };
    const settle = (el: Label) => {
      if (el._raf) cancelAnimationFrame(el._raf);
      if (el._t) clearTimeout(el._t);
      el._raf = 0;
      el._t = undefined;
      el.textContent = el.dataset.text ?? "";
    };
    const decode = (el: Label) => {
      const text = el.dataset.text ?? "";
      const n = text.length;
      settle(el);
      if (RM || !n) return;
      const t0 = performance.now();
      let lastRoll = 0;
      const rand: string[] = new Array(n);
      const roll = () => {
        for (let i = 0; i < n; i++) rand[i] = CH.charAt((Math.random() * 26) | 0);
      };
      roll();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 400);
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
      el._t = setTimeout(() => settle(el), 900);
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    let alive = true;
    const boot = () => {
      if (!alive) return;
      reserve();
      if (RM) return;
      host.querySelectorAll<HTMLElement>(".k-stats dd").forEach((dd, i) => {
        const v = parseFloat((dd.textContent ?? "").replace(/,/g, ""));
        if (!isFinite(v)) return;
        timers.push(setTimeout(() => km.count(dd, v, { from: 0, duration: 1.1, format: (x: number) => Math.round(x).toLocaleString("en-GB") }), 620 + i * 90));
      });
      labels.forEach((el, i) => timers.push(setTimeout(() => decode(el), 420 + i * 70)));
      timers.push(
        setTimeout(() => {
          labels.forEach(settle);
          reserve();
        }, 2600),
      );
    };
    const enter = (e: Event) => {
      const t = (e.currentTarget as HTMLElement).querySelector<Label>(".k-dec");
      if (t) decode(t);
    };
    const links = [...host.querySelectorAll<HTMLElement>("a")];
    links.forEach((a) => a.addEventListener("pointerenter", enter));
    if (document.fonts?.ready) void document.fonts.ready.then(boot);
    else boot();
    let rt: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(reserve, 160);
    };
    addEventListener("resize", onResize);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      clearTimeout(rt);
      labels.forEach(settle);
      links.forEach((a) => a.removeEventListener("pointerenter", enter));
      removeEventListener("resize", onResize);
    };
  }, [root]);
}
