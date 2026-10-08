"use client";
/**
 * The card for whatever he stands at inside a place: the jacket on the rail, the car on the turntable, the
 * coffee on the counter, the bed, the dance floor. Its name, the brand, the price, whether it is his already or
 * on him, why it is locked, and one main button (E does the same). It calls act() and shows what came back for
 * a moment. Buying your first Rolex gets its own card.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { CareerState, CatalogCar, CatalogItem, WorldPlace } from "../types";

type Money = (n: number, o?: { week?: boolean }) => string;
type Act = (place: string, action: string, arg?: string) => Promise<unknown>;
interface Btn {
  label: string;
  run: () => void;
  off?: boolean;
}
interface Card {
  kicker: string;
  title: string;
  sub?: string;
  price?: string;
  per?: string;
  swatch?: string;
  tags: { t: string; tone?: "good" | "acc" | "warn" | "bad" }[];
  lock?: string;
  main?: Btn;
  second?: Btn & { confirm?: string };
  list?: {
    id: string;
    title: string;
    note?: string;
    on: boolean;
    run: () => void;
  }[];
  facts?: [string, string][];
}
interface Moment {
  id: string;
  title: string;
  text: string;
  item?: string;
  price?: number;
}

const CAT: Record<string, string> = {
  top: "Top",
  bottom: "Bottoms",
  shoes: "Trainers",
  outer: "Outerwear",
  watch: "Watch",
  jewellery: "Jewellery",
  boots: "Football boots",
  tech: "Tech",
  bag: "Bag",
};
const BODY: Record<string, string> = {
  scooter: "Scooter",
  bike: "Superbike",
  hatch: "Hatchback",
  saloon: "Saloon",
  coupe: "Coupe",
  sports: "Sports car",
  suv: "SUV",
  hyper: "Hypercar",
  van: "Van",
};
const WEARABLE = ["top", "bottom", "shoes", "outer", "bag", "boots"];
const BIG_WATCH = 5000;

export default function ShopHud({
  place,
  state,
  near,
  busy,
  money,
  act,
  onLeave,
}: {
  place: WorldPlace | null;
  state: CareerState;
  near: string | null;
  busy: boolean;
  money: Money;
  /** careerApi.act through the screen's runner; it may resolve with the reply's text */
  act: Act;
  /** the way out ({}), into the garage or back ({ to: place id }), or out in a car ({ drive: car id }) */
  onLeave: (o: { drive?: string; to?: string }) => void;
}) {
  const life = state.life;
  const cat = life.catalog;
  const [flash, setFlash] = useState<{ text: string; n: number } | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  // moments already there when he walked in are not news
  const [seenMoments] = useState(() => new Set((life.moments || []).map((m) => m.id)));

  // act, then show what came back: the reply's text, and a moment card if the reply brought a new one
  // (the first Rolex); if the server sent none for a first big watch, one of our own
  const run = useCallback(
    async (p: string, action: string, arg?: string, firstBig?: CatalogItem) => {
      setSure(null);
      const r = await act(p, action, arg);
      const reply = r && typeof r === "object" ? (r as { text?: unknown; state?: CareerState }) : null;
      const text = typeof r === "string" ? r : reply?.text ? String(reply.text) : "";
      if (text) setFlash({ text, n: Date.now() });
      const after = reply?.state?.life;
      if (!after) return;
      const fresh = (after.moments || []).find((m) => !seenMoments.has(m.id) && !(m as { seen?: boolean }).seen);
      for (const m of after.moments || []) seenMoments.add(m.id);
      if (fresh) {
        const m = fresh as unknown as Moment;
        setMoment({
          id: m.id,
          title: m.title,
          text: m.text,
          item: m.item,
          price: m.price,
        });
      } else if (firstBig && after.catalog?.items.find((i) => i.id === firstBig.id)?.owned) {
        setMoment({
          id: "",
          title: /rolex/i.test(firstBig.brand) ? "Your first Rolex" : "Your first serious watch",
          text: "The " + firstBig.label + ". Heavy, cold, ticking. The first thing you ever bought that will outlive you.",
          item: firstBig.id,
          price: firstBig.price,
        });
      }
    },
    [act, seenMoments],
  );
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3600);
    return () => clearTimeout(t);
  }, [flash]);

  const card = useMemo<Card | null>(() => {
    if (!near || state.social?.dating?.scene) return null;
    const cash = state.money.cash;
    const age = state.player.age;
    const short = (price: number) => (cash < price ? "Not enough money. You have " + money(cash) + "." : "");
    const noTime = life.time < 1 ? "No free time left this week." : "";
    const wk = (
      life as unknown as {
        week?: {
          cafe: number;
          market: number;
          treat: boolean;
          checkup: boolean;
          limits: { cafe: number; market: number };
        };
      }
    ).week;
    const [kind, ...rest] = near.split(":");
    const arg = rest.join(":");
    const partner = state.social?.dating?.partner || null;
    const pid = place?.id || "";
    const homeId = pid.replace(/\/garage$/, "");
    // ---------- things for sale ----------
    if (kind === "item") {
      const it = cat?.items.find((i) => i.id === arg) || oldItem(state, arg);
      if (!it) return null;
      const wearable = !!it.look || !!it.outfit || WEARABLE.includes(it.cat);
      const lock = it.owned ? "" : it.lockReason || (!it.canBuy ? short(it.price) || "Not sold here." : "");
      const firstBig = it.cat === "watch" && it.price >= BIG_WATCH && !cat?.items.some((i) => i.cat === "watch" && i.owned && i.price >= BIG_WATCH) ? it : undefined;
      return {
        kicker: it.brand + " · " + (CAT[it.cat] || it.cat),
        title: it.label,
        price: money(it.price),
        swatch: it.colour,
        tags: [
          ...(it.owned ? [{ t: "Yours", tone: "good" as const }] : []),
          ...(it.wearing ? [{ t: "Wearing", tone: "acc" as const }] : []),
          ...(wearable && !it.owned ? [{ t: "Shows on you" }] : []),
        ],
        lock,
        main: !it.owned
          ? {
              label: "Buy",
              off: !it.canBuy,
              run: () => run(it.store || pid, "buy", it.id, firstBig),
            }
          : wearable
            ? {
                label: it.wearing ? "Take it off" : "Wear it",
                run: () => run("home", "wear", it.id),
              }
            : undefined,
        // a present for the one he is with (Q, then Q again to be sure)
        second: partner && state.money.cash >= it.price ? { label: "Buy it for " + partner.first, confirm: "Buy for " + partner.first + ": " + money(it.price), run: () => run(it.store || pid, "gift", it.id) } : undefined,
      };
    }
    if (kind === "car" || kind === "drive") {
      const c = cat?.cars.find((x) => x.id === arg) || oldCar(state, arg);
      if (!c) return null;
      const ext = c as CatalogCar & {
        daily?: boolean;
        sellFor?: number;
        minAge?: number;
      };
      const facts: [string, string][] = [
        ["Top speed", Math.round(c.feel.top * 3.6) + " km/h"],
        ["0 to 100", (27.8 / Math.max(0.5, c.feel.accel)).toFixed(1) + " s"],
        ["To run", money(c.upkeep, { week: true })],
      ];
      if (kind === "drive") {
        return {
          kicker: "Your garage · " + (BODY[c.body] || c.body),
          title: c.brand + " " + c.model,
          swatch: c.colour,
          tags: ext.daily ? [{ t: "Your daily", tone: "acc" }] : [],
          facts,
          main: { label: "Drive it out", run: () => onLeave({ drive: c.id }) },
          second: ext.sellFor
            ? {
                label: "Sell",
                confirm: "Sell for " + money(ext.sellFor),
                run: () => run("garage", "sell", c.id),
              }
            : undefined,
        };
      }
      const young = age < (ext.minAge || (c.body === "scooter" ? 16 : 18));
      const lock = c.owned ? "" : c.lockReason || (young ? "You are not old enough to drive that yet." : !c.canBuy ? short(c.price) || "Not for sale here." : "");
      return {
        kicker: c.brand + " · " + (BODY[c.body] || c.body),
        title: c.brand + " " + c.model,
        price: money(c.price),
        swatch: c.colour,
        tags: c.owned ? [{ t: "In your garage", tone: "good" }] : [],
        facts,
        lock,
        main: c.owned
          ? undefined
          : {
              label: "Buy it",
              off: !c.canBuy,
              run: () => run(c.dealer || pid, "car", c.id),
            },
      };
    }
    if (kind === "grocery") {
      const g = cat?.groceries.find((x) => x.id === arg);
      if (!g) return null;
      const full = wk && wk.market >= wk.limits.market ? "Your fridge is full for this week." : "";
      return {
        kicker: g.aisle,
        title: g.label,
        sub: g.note,
        price: money(g.price),
        swatch: g.colour,
        tags: [],
        lock: full || short(g.price),
        main: {
          label: "Buy",
          off: !!(full || short(g.price)),
          run: () => run("supermarket", "buy", g.id),
        },
      };
    }
    if (kind === "menu" || kind === "night") {
      const k = place?.kind;
      const menu = k === "club" ? cat?.menus.club : k === "restaurant" ? cat?.menus.restaurant : k === "clinic" ? cat?.menus.clinic : cat?.menus.cafe;
      const id = kind === "night" ? "night" : arg;
      const m = menu?.find((x) => x.id === id) || (k === "restaurant" ? life.meals.find((x) => x.id === id) : undefined);
      if (!m) return null;
      if (k === "club") {
        const min = place?.minAge ?? 18;
        const lock = age < min ? "The bouncer checks your ID. Over " + min + "s only. You are " + age + "." : noTime || short(m.price);
        return {
          kicker: (place?.name || "The club") + (id === "vip" ? " · VIP" : ""),
          title: m.label,
          sub: m.note,
          price: money(m.price),
          tags: [{ t: "Takes a free night", tone: "warn" }],
          lock,
          main: {
            label: id === "vip" ? "Book the table" : "Night out",
            off: !!lock,
            run: () => run("club", "night", id),
          },
        };
      }
      const timed = (m as { time?: number }).time ? true : k === "restaurant";
      const capped = k === "cafe" && wk && wk.cafe >= wk.limits.cafe ? "Five coffees this week is plenty. The nutritionist is watching." : "";
      const lock = (timed ? noTime : "") || capped || short(m.price);
      return {
        kicker: place?.name || "Menu",
        title: m.label,
        sub: m.note,
        price: money(m.price),
        tags: timed ? [{ t: "Takes a free evening", tone: "warn" }] : [],
        lock,
        main: {
          label: "Order",
          off: !!lock,
          run: () => run(k === "restaurant" ? "restaurant" : pid, "order", m.id),
        },
      };
    }
    // ---------- the clinic ----------
    if (kind === "treat" || kind === "checkup") {
      const m = cat?.menus.clinic.find((x) => x.id === kind);
      const inj = state.cond.inj;
      const price = m?.price ?? (kind === "treat" ? 450 : 180);
      let lock = "";
      if (kind === "treat") lock = !inj ? "Nothing to treat. The doctor says you are fit." : wk?.treat ? "The specialist saw you this week already. Come back next week." : short(price);
      else lock = inj ? "Get the injury treated first." : wk?.checkup ? "You had a full check up this week." : short(price);
      return {
        kicker: place?.name || "Clinic",
        title: m?.label || (kind === "treat" ? "Treatment" : "Check up"),
        sub: kind === "treat" && inj ? inj.name + ", " + inj.weeks + (inj.weeks === 1 ? " week" : " weeks") + " to go. " + (m?.note || "") : m?.note,
        price: money(price),
        tags: inj ? [{ t: "Injured", tone: "bad" }] : [{ t: "Fit", tone: "good" }],
        lock,
        main: {
          label: kind === "treat" ? "Get treated" : "Book the check up",
          off: !!lock,
          run: () => run("clinic", kind),
        },
      };
    }
    // ---------- homes ----------
    if (kind === "buy-home" || kind === "rent-home") {
      const h = life.homes.find((x) => x.id === place?.homeId);
      if (!h) return null;
      const owned = life.owned.some((o) => o.id === h.id && o.city === life.city);
      if (kind === "buy-home") {
        const lock = owned ? "" : age < 17 ? "Mum and Dad say: not until you are seventeen." : !h.buy ? "This one is only to rent." : !h.canBuy ? short(h.buy) || "Not for sale right now." : "";
        return {
          kicker: place?.name || h.label,
          title: owned ? "Move back in" : "Buy this home",
          sub: h.note,
          price: h.buy ? money(h.buy) : undefined,
          tags: owned ? [{ t: "Yours", tone: "good" }] : [],
          facts: [["Upkeep", money(h.upkeep, { week: true })]],
          lock,
          main: {
            label: owned ? "Move in" : "Buy this home",
            off: !!lock,
            run: () => run(homeId, "buy"),
          },
        };
      }
      const lock = age < 17 ? "Mum and Dad say: not until you are seventeen." : !h.rent ? "Not for rent." : !h.canRent ? "The agent will not rent it to you on your wage." : "";
      return {
        kicker: place?.name || h.label,
        title: "Rent it",
        sub: h.note,
        price: h.rent ? money(h.rent) : undefined,
        per: "a week",
        tags: [],
        lock,
        main: { label: "Rent it", off: !!lock, run: () => run(homeId, "rent") },
      };
    }
    if (kind === "wardrobe") {
      const mine = (cat?.items || []).filter((i) => i.owned && (i.look || i.outfit || WEARABLE.includes(i.cat)));
      const old = life.items.filter((i) => i.owned && i.look && !mine.some((m) => m.id === i.id));
      const list = [...mine, ...old].map((i) => ({
        id: i.id,
        title: i.label,
        note: i.brand,
        on: i.wearing,
        run: () => run("home", "wear", i.id),
      }));
      return {
        kicker: "Wardrobe",
        title: list.length ? "What to wear" : "Empty hangers",
        sub: list.length ? "Whatever you wear shows on you in the city, and the watch and the chain on the pitch too." : "Clothes, watches and chains you buy in the city hang here.",
        tags: [],
        list,
      };
    }
    if (kind === "rest")
      return {
        kicker: "Home",
        title: "Feet up",
        sub: "Rest for an evening. The legs feel fresher.",
        tags: [{ t: "Takes a free evening", tone: "warn" }],
        lock: noTime,
        main: { label: "Rest", off: !!noTime, run: () => run("home", "rest") },
      };
    if (kind === "unwind")
      return {
        kicker: "Home",
        title: "Play some games",
        sub: "A few hours online with the lads.",
        tags: [{ t: "Takes a free evening", tone: "warn" }],
        lock: noTime,
        main: {
          label: "Play",
          off: !!noTime,
          run: () => run("home", "unwind"),
        },
      };
    if (kind === "trophies") {
      const list = [
        ...state.trophies.map((t, i) => ({
          id: "t" + i,
          title: t.title,
          note: t.club,
        })),
        ...state.awards.map((a, i) => ({
          id: "a" + i,
          title: a.title,
          note: "Season " + a.s,
        })),
      ];
      return {
        kicker: "Trophy shelf",
        title: list.length ? list.length + (list.length === 1 ? " on the shelf" : " on the shelf") : "Empty, for now",
        sub: list.length
          ? list
              .slice(0, 4)
              .map((x) => x.title)
              .join(", ")
          : "Every one of these shelves is waiting for something.",
        tags: [],
      };
    }
    // ---------- the schools, colleges and clubs: their grounds and the rooms inside ----------
    const campusBase = pid.split("/")[0];
    const isCampusPlace = !!place?.inst && (place.kind === "school" || place.kind === "college" || place.kind === "training");
    const mineHere = !!place?.inst?.mine;
    const notMine = place?.kind === "training" ? "This is not your club." : "This is not your " + (place?.kind === "college" ? "college" : "school") + ".";
    if (kind === "session") {
      const s = state.training.sessions[arg];
      if (!s) return null;
      const lock = isCampusPlace && !mineHere ? notMine : state.cond.inj && arg !== "recovery" ? "The physio says recovery work only." : noTime;
      return {
        kicker: place?.name || "Training",
        title: s.label,
        sub: s.grows ? "Works on " + s.grows.join(", ") + "." : "Feel better.",
        tags: [{ t: "Takes a free evening", tone: "warn" }],
        lock,
        main: { label: "Do it", off: !!lock, run: () => run(isCampusPlace ? campusBase : "training", arg) },
      };
    }
    if (kind === "enter" && isCampusPlace) {
      const names: Record<string, [string, string]> = {
        corridor: [place!.kind === "college" ? "The lecture block" : "The classrooms", "Corridors, lockers, notice boards."],
        canteen: [place!.kind === "college" ? "The student cafe" : place!.kind === "training" ? "The canteen" : "The canteen", "Lunch, and everyone in one room."],
        classroom: [place!.kind === "college" ? "Lecture room 2" : "Class 2", "Your seat is the free one in the middle."],
        gym: ["The gym", "Racks, treadmills and the fitness coach's board."],
        changing: ["The dressing room", "Your shirt is on its peg."],
        physio: ["Physio and recovery", "Tables, ice baths and the cryo chamber."],
      };
      const [title, sub2] = names[arg] || [arg, ""];
      return { kicker: place!.name.split(", ")[0], title, sub: sub2, tags: [], main: { label: "Go in", run: () => onLeave({ to: campusBase + "/" + arg }) } };
    }
    if (kind === "back" && isCampusPlace)
      return {
        kicker: place!.name.split(", ")[0],
        title: arg === "corridor" ? "Back to the corridor" : "Back outside",
        tags: [],
        main: { label: "Go", run: () => onLeave({ to: arg ? campusBase + "/" + arg : campusBase }) },
      };
    if ((kind === "class" || kind === "canteen" || kind === "physio" || kind === "clubgym" || kind === "changing") && isCampusPlace) {
      const C2: Record<string, { title: string; sub: string; time: boolean; label: string; action: string }> = {
        class: { title: place!.kind === "college" ? "The lecture" : "The lesson", sub: "Two a week at most. Mum likes this one.", time: true, label: "Take part", action: "class" },
        canteen: { title: place!.kind === "training" ? "Team lunch" : "Lunch", sub: "Once a week. Good for the mood, better for the squad.", time: false, label: "Eat", action: "canteen" },
        physio: { title: "The physio", sub: "Fatigue down a lot. Now and then a week off an injury.", time: true, label: "Get on the table", action: "physio" },
        clubgym: { title: "Gym session", sub: "Strength, stamina and pace work with the fitness coach.", time: true, label: "Train", action: "gym" },
        changing: { title: "The dressing room", sub: "Time with the squad and your best mate.", time: false, label: "Sit down", action: "changing" },
      };
      const c2 = C2[kind];
      const lock = !mineHere ? notMine : c2.time ? noTime : "";
      return {
        kicker: place!.name.split(", ")[0],
        title: c2.title,
        sub: c2.sub,
        tags: c2.time ? [{ t: "Takes a free evening", tone: "warn" }] : [],
        lock,
        main: { label: c2.label, off: !!lock, run: () => run(campusBase, c2.action) },
      };
    }
    if (kind === "mycar" && isCampusPlace) {
      const car = state.life.car;
      return { kicker: place!.name, title: car ? car.brand + " " + car.model : "Your car", sub: "In its bay with the rest of the squad's.", tags: [{ t: "Yours", tone: "good" }] };
    }
    if (kind === "gym") {
      const g = life.gym.find((x) => x.id === arg);
      if (!g) return null;
      const lock = state.cond.inj && arg !== "spa" ? "The physio says no gym until the injury heals." : noTime || short(g.price);
      return {
        kicker: place?.name || "Gym",
        title: g.label,
        price: g.price ? money(g.price) : "Free",
        tags: [{ t: "Takes a free evening", tone: "warn" }],
        lock,
        main: { label: "Train", off: !!lock, run: () => run("gym", arg) },
      };
    }
    if (kind === "fans")
      return {
        kicker: place?.name || "Stadium",
        title: "Meet the fans",
        sub: "Selfies and signatures by the tunnel.",
        tags: [{ t: "Takes a free evening", tone: "warn" }],
        lock: noTime,
        main: {
          label: "Go and say hello",
          off: !!noTime,
          run: () => run("stadium", "fans"),
        },
      };
    // ---------- an engagement ring ----------
    if (kind === "ring") {
      const d = state.social?.dating;
      const ring = d?.rings?.find((x) => x.id === arg);
      if (!ring) return null;
      const pt = d?.partner;
      const lock = d?.ring ? "You already have a ring in your pocket: the " + d.ring.label.toLowerCase() + "." : !pt ? "For when there is someone." : pt.stage === "engaged" || pt.stage === "married" ? pt.first + " already wears yours." : pt.stage !== "serious" ? "Not yet. It has to be serious with " + pt.first + " first." : short(ring.price);
      return {
        kicker: ring.brand + " · Engagement ring",
        title: ring.label,
        price: money(ring.price),
        sub: ring.note + (pt && pt.stage === "serious" ? " Then pick the moment: the end of a good date, somewhere special." : ""),
        tags: pt && pt.stage === "serious" ? [{ t: "For " + pt.first, tone: "acc" }] : [],
        lock,
        main: { label: "Buy the ring", off: !!lock, run: () => run("watches", "ring", ring.id) },
      };
    }
    // ---------- people: classmates, teammates ----------
    if (kind === "talk") {
      if (state.social?.talk) return null;
      const p = (state.social?.present?.[pid] || []).find((x) => x.id === arg);
      if (!p) return null;
      const fr = state.social?.friends.find((f) => f.id === arg);
      const dt = p.kind === "date" ? [state.social?.dating?.partner, ...(state.social?.dating?.contacts || [])].find((x) => x && x.id === p.id) : null;
      const tags: Card["tags"] = dt ? [{ t: dt.stageWord, tone: "good" }] : fr ? [{ t: fr.level, tone: "good" }] : [{ t: p.kind === "date" && p.rel !== null ? "You have met" : "Not met yet" }];
      if (fr?.num || dt) tags.push({ t: "Has your number", tone: "acc" });
      return {
        kicker: p.role,
        title: p.kind === "date" && p.age ? p.name + ", " + p.age : p.name,
        sub: p.trait + ". Into " + p.likes.join(" and ") + ".",
        tags,
        main: { label: "Talk", run: () => run(pid, "talk", arg) },
        second: fr && fr.rel >= 40 && !fr.hung ? { label: "Hang out", confirm: "Hang out: takes a free evening", run: () => run(pid, "hang", arg) } : undefined,
      };
    }
    // ---------- ways out ----------
    if (kind === "door")
      return {
        kicker: place?.name || "",
        title: "Way out",
        sub: "Back to the street.",
        tags: [],
        main: { label: "Leave", run: () => onLeave({}) },
      };
    if (kind === "garage") {
      const n = (life.garage || []).length;
      return {
        kicker: place?.name || "Home",
        title: "The garage",
        sub: n ? n + (n === 1 ? " car" : " cars") + " waiting." : "Nothing parked yet.",
        tags: [],
        main: {
          label: "Go to the garage",
          run: () => onLeave({ to: homeId + "/garage" }),
        },
      };
    }
    if (kind === "house")
      return {
        kicker: "Garage",
        title: "Back into the house",
        tags: [],
        main: { label: "Go in", run: () => onLeave({ to: homeId }) },
      };
    return null;
  }, [near, state, life, cat, place, money, run, onLeave]);

  // E does the main button; Q the second one (once to ask, again to be sure), so the card works with the mouse
  // captured for looking round
  const main = card?.main;
  const second = card?.second;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "q" && second && !busy && !moment) {
        if (sure === near) second.run();
        else setSure(near);
        return;
      }
      if (key !== "e") return;
      if (moment) return setMoment(null);
      if (main && !main.off && !busy) main.run();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [main, second, busy, moment, sure, near]);

  // a chat in progress: 1, 2 and 3 pick what he says, Esc says goodbye
  const talk = state.social?.talk || null;
  const talkOpts = useMemo(() => (talk ? (talk.said ? talk.follow : talk.choices) : []), [talk]);
  const sayIt = useCallback((id: string) => run(talk?.place || place?.id || "", "say", id), [run, talk, place]);
  useEffect(() => {
    if (!talk) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!busy) sayIt("bye");
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= talkOpts.length && !busy && !e.repeat) sayIt(talkOpts[n - 1].id);
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [talk, talkOpts, busy, sayIt]);

  const closeMoment = () => {
    if (moment?.id) act("moments", "seen", moment.id);
    setMoment(null);
  };

  return (
    <>
      <div className="pc-shop" aria-live="polite">
        {card && (
          <div key={near || ""} className={clsx("pc-shop-card k-panel", card.lock && "is-locked")}>
            <div className="pc-shop-head">
              {card.swatch && <span className="pc-shop-swatch" style={{ background: card.swatch }} aria-hidden="true" />}
              <div className="pc-shop-name">
                <p className="k-label">{card.kicker}</p>
                <h3 className="pc-shop-title">{card.title}</h3>
              </div>
              {card.price && (
                <p className="pc-shop-price">
                  {card.price}
                  {card.per && <span> {card.per}</span>}
                </p>
              )}
            </div>
            {card.sub && <p className="pc-shop-sub">{card.sub}</p>}
            {card.facts && (
              <dl className="pc-shop-facts">
                {card.facts.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {card.tags.length > 0 && (
              <div className="pc-shop-tags">
                {card.tags.map((t) => (
                  <span key={t.t} className={clsx("k-tag", t.tone && "k-" + t.tone)}>
                    {t.t}
                  </span>
                ))}
              </div>
            )}
            {card.list && card.list.length > 0 && (
              <ul className="pc-shop-list">
                {card.list.map((r) => (
                  <li key={r.id}>
                    <span>
                      <b>{r.title}</b>
                      {r.note && <em>{r.note}</em>}
                    </span>
                    <button type="button" className={clsx("k-btn k-btn-sm", r.on && "k-on")} disabled={busy} onClick={r.run}>
                      {r.on ? "Take off" : "Wear"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {card.lock && <p className="pc-shop-lock">{card.lock}</p>}
            {(card.main || card.second) && (
              <div className="pc-shop-acts">
                {card.main && (
                  <button type="button" className="k-btn k-btn-primary" disabled={busy || card.main.off} onClick={card.main.run}>
                    <kbd aria-hidden="true">E</kbd>
                    {card.main.label}
                  </button>
                )}
                {card.second &&
                  (sure === near ? (
                    <button type="button" className="k-btn k-btn-danger k-btn-sm" disabled={busy} onClick={card.second.run}>
                      <kbd aria-hidden="true">Q</kbd>
                      {card.second.confirm || card.second.label}
                    </button>
                  ) : (
                    <button type="button" className="k-btn k-btn-ghost k-btn-sm" disabled={busy} onClick={() => setSure(near)}>
                      <kbd aria-hidden="true">Q</kbd>
                      {card.second.label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
        {talk && (
          <div className="pc-talk k-panel" role="dialog" aria-label={"Talking to " + talk.name}>
            <p className="k-label">{talk.role}</p>
            <h3 className="pc-shop-title">{talk.name}</h3>
            <p className="pc-talk-line">{talk.line}</p>
            {talk.said && <p className="pc-talk-me">{talk.said}</p>}
            {talk.result && <p className="pc-talk-result">{talk.result}</p>}
            {talk.said && talk.level && (
              <p className="pc-talk-rel">
                <span className="k-tag k-good">{talk.level}</span>
                <span className="pc-talk-bar" aria-hidden="true">
                  <i style={{ width: (talk.rel ?? 0) + "%" }} />
                </span>
              </p>
            )}
            <div className="pc-talk-opts">
              {talkOpts.map((o, i) => (
                <button key={o.id} type="button" className={clsx("k-btn k-btn-sm", i === 0 && !talk.said && "k-btn-primary")} disabled={busy} onClick={() => sayIt(o.id)}>
                  <kbd aria-hidden="true">{i + 1}</kbd>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {flash && (
          <p key={flash.n} className="pc-shop-flash" role="status">
            {flash.text}
          </p>
        )}
      </div>
      {moment && (
        <div className="pc-shop-moment" role="dialog" aria-modal="true" aria-label={moment.title} onClick={closeMoment}>
          <div className="pc-shop-moment-card k-panel" onClick={(e) => e.stopPropagation()}>
            <span className="pc-shop-moment-ring" aria-hidden="true" />
            <p className="k-label">A moment</p>
            <h2>{moment.title}</h2>
            <p>{moment.text}</p>
            {moment.price ? <p className="pc-shop-moment-price">{money(moment.price)}</p> : null}
            <button type="button" className="k-btn k-btn-primary" onClick={closeMoment} ref={(b) => b?.focus({ preventScroll: true })}>
              On the wrist
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** an item from the old list (an old save, or the old shops) in the catalog's shape */
function oldItem(st: CareerState, id: string): CatalogItem | null {
  const i = st.life.items.find((x) => x.id === id);
  if (!i) return null;
  return {
    id: i.id,
    store: i.shop,
    brand: i.brand,
    cat: i.look?.watch ? "watch" : i.look ? "jewellery" : "tech",
    label: i.label,
    price: i.price,
    mood: i.mood,
    flash: i.flash,
    look: i.look,
    colour: "#888888",
    owned: i.owned,
    wearing: i.wearing,
    canBuy: !i.owned && st.money.cash >= i.price,
  };
}
function oldCar(st: CareerState, id: string): CatalogCar | null {
  const c = st.life.cars.find((x) => x.id === id);
  if (!c) return null;
  return {
    id: c.id,
    dealer: "shops",
    brand: c.brand,
    model: c.model,
    price: c.price,
    upkeep: c.upkeep,
    flash: c.flash,
    colour: c.colour,
    body: c.body,
    feel: { top: 50, accel: 3, grip: 0.8, mass: 1400 },
    owned: !!c.owned,
    canBuy: !!c.canBuy,
  };
}
