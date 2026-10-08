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
    if (!near) return null;
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
    if (kind === "session") {
      const s = state.training.sessions[arg];
      if (!s) return null;
      const lock = state.cond.inj && arg !== "recovery" ? "The physio says recovery work only." : noTime;
      return {
        kicker: place?.name || "Training",
        title: s.label,
        sub: s.grows ? "Works on " + s.grows.join(", ") + "." : "Feel better.",
        tags: [{ t: "Takes a free evening", tone: "warn" }],
        lock,
        main: { label: "Do it", off: !!lock, run: () => run("training", arg) },
      };
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

  // E does the main button
  const main = card?.main;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key.toLowerCase() !== "e" || e.repeat) return;
      if (moment) return setMoment(null);
      if (main && !main.off && !busy) main.run();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [main, busy, moment]);

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
                      {card.second.confirm || card.second.label}
                    </button>
                  ) : (
                    <button type="button" className="k-btn k-btn-ghost k-btn-sm" disabled={busy} onClick={() => setSure(near)}>
                      {card.second.label}
                    </button>
                  ))}
              </div>
            )}
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
