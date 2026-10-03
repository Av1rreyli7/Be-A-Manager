"use client";
/**
 * The site motion kit for React screens (landing and Game Night). The same file Floodlights and Hardwood
 * Legends load as a plain script (public/kit-motion.js), wired to the npm gsap here, so every surface shares
 * one timing language. Transform and opacity only, under half a second, never blocks input, and reduced
 * motion gets the end state at once.
 */
import { useLayoutEffect, useEffect, type RefObject, type DependencyList } from "react";
import gsap from "gsap";
import * as kitNs from "../../public/kit-motion.js";

type Targets = Element | Element[] | NodeListOf<Element> | string | null | undefined;
type Opts = Record<string, unknown>;
export interface KitMotion {
  reduced(): boolean;
  rise(t: Targets, o?: Opts): gsap.core.Tween | null;
  cascade(t: Targets, o?: Opts): gsap.core.Timeline | null;
  enter(root: Element | null, o?: Opts): gsap.core.Timeline | null;
  count(el: Element | null, to: number, o?: { from?: number; duration?: number; format?: (v: number) => string }): gsap.core.Tween | null;
  pop(el: Element | null, o?: Opts): gsap.core.Tween | null;
  pulse(el: Element | null, o?: Opts): gsap.core.Tween | null;
  slideIn(el: Element | null, o?: Opts): gsap.core.Tween | null;
  tabIndicator(bar: HTMLElement | null, active: HTMLElement | null, o?: Opts): void;
  celebrate(el: HTMLElement | null, o?: Opts): gsap.core.Timeline | null;
  sparks(host: HTMLElement | null, o?: { count?: number; colors?: string[] }): gsap.core.Timeline | null;
  press(el: Element | null): gsap.core.Tween | null;
}

type Factory = (g: typeof gsap) => KitMotion;
// the shared file is a plain script with a CommonJS export; bundlers hand it over in different shapes
const ns = kitNs as unknown as { default?: { createKitMotion?: Factory }; createKitMotion?: Factory };
const create: Factory =
  ns.default?.createKitMotion ?? ns.createKitMotion ?? (globalThis as unknown as { createKitMotion: Factory }).createKitMotion;
export const km: KitMotion = create(gsap);

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Animates a screen in when it mounts (and when deps change): [data-km=head], [data-km=block], [data-km=rows] > *. */
export function useScreenEnter(ref: RefObject<HTMLElement | null>, deps: DependencyList = []) {
  useIso(() => {
    const tl = km.enter(ref.current);
    return () => { tl?.progress(1).kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * A whole Game Night screen settles in: the page title rises, top level panels settle one after another,
 * then table rows and marked lists cascade. Works on any screen without per screen markup; screens can
 * still mark things with data-km="head|block|rows". Every stagger is capped so the screen is in within
 * about half a second however long it is.
 */
export function enterScreen(root: HTMLElement | null) {
  if (!root) return null;
  const heads = Array.from(root.querySelectorAll<HTMLElement>("[data-km=head]"));
  const rowSet = new Set<Element>(root.querySelectorAll("[data-km=rows] > *, tbody > tr"));
  const all = Array.from(root.querySelectorAll<HTMLElement>("[data-km=block], .panel")).filter((el) => !rowSet.has(el) && !heads.includes(el));
  // only the outermost panels move; a panel inside a moving panel rides along
  const blocks = all.filter((el) => !all.some((o) => o !== el && o.contains(el))).slice(0, 14);
  const rows = Array.from(rowSet).filter((r) => (r as HTMLElement).offsetParent !== null).slice(0, 60);
  if (km.reduced()) return null;
  const tl = gsap.timeline();
  if (heads.length) tl.add(km.rise(heads, { y: 14, stagger: 0.05, duration: 0.36 })!, 0);
  if (blocks.length) tl.add(km.cascade(blocks, { y: 12, each: 0.04 })!, 0.05);
  if (rows.length) tl.add(km.cascade(rows, { y: 6 })!, 0.12);
  return tl;
}

/** Runs enterScreen on mount and whenever key changes (the route). */
export function useEnterScreen(ref: RefObject<HTMLElement | null>, key: unknown) {
  useIso(() => {
    const tl = enterScreen(ref.current);
    return () => {
      tl?.progress(1).kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
