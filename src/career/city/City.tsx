"use client";
/**
 * The city screen: the 3D city from above, and the places you walk into. Everything you do here goes to the
 * server (free time, money, followers) and comes back as the new career state. Drag to look around; in a place,
 * click the floor or use WASD to walk, E to use what you are standing next to, Esc to go back out.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import clsx from "clsx";
import { Sun, Moon, Cloud, CloudRain, CloudLightning, CloudFog, Snowflake } from "@phosphor-icons/react";
import CityScene, { PLACE_IDS, SPOTS, camStart, cityLight, homeTop, type CamCtl, type PlaceId } from "./CityScene";
import Interior, { type Hotspot, type WalkCtl } from "./Interior";
import { Environment, FrameGuard, DPR_CAP } from "../Stage";
import { OUTFITS } from "../body";
import { careerApi, type Saved } from "../api";
import type { CareerState } from "../types";

const PLACE_LABEL: Record<PlaceId, string> = { home: "Home", training: "Training ground", stadium: "Stadium", shops: "The shops", restaurant: "Restaurant", gym: "Gym", mall: "Mall" };
const WEATHER: Record<string, string> = { clear: "Clear", cloud: "Cloudy", rain: "Rain", storm: "Storm", snow: "Snow", fog: "Fog", haze: "Hazy" };

type Run = <T>(fn: () => Promise<T>, after?: (r: T) => void) => Promise<void>;
type Panel = { kind: "wardrobe" | "homes" | "trophies" | "garage" | "meals" | "store" | "cars" | "sessions" | "match"; brand?: string } | null;

/** the camera's lens, and a view offset so the middle of the picture sits in the space left of the side panel */
function CamSetup({ fov, far, panel }: { fov: number; far: number; panel: number }) {
  const size = useThree((s) => s.size);
  const get = useThree((s) => s.get);
  const fit = useCallback(() => {
    const cam = get().camera as THREE.PerspectiveCamera;
    const { width: W, height: H } = get().size;
    cam.fov = fov;
    cam.far = far;
    if (panel > 0 && W > panel * 2) {
      cam.aspect = (W + panel) / H;
      cam.setViewOffset(W + panel, H, panel, 0, W, H);
    } else {
      cam.aspect = W / H;
      cam.clearViewOffset();
    }
    cam.updateProjectionMatrix();
  }, [get, fov, far, panel]);
  useEffect(() => fit(), [fit, size.width, size.height]);
  // the canvas resizes the camera on its own; put the offset back if it did
  useFrame(() => {
    const cam = get().camera as THREE.PerspectiveCamera;
    const { width: W, height: H } = get().size;
    const want = panel > 0 && W > panel * 2 ? (W + panel) / H : W / H;
    if (Math.abs(cam.aspect - want) > 1e-3) fit();
  });
  return null;
}

export default function City({
  state,
  saved,
  quality,
  setQuality,
  money,
  run,
  busy,
  onPhone,
  onWeek,
}: {
  state: CareerState;
  saved: Saved;
  quality: number;
  setQuality: (q: number) => void;
  money: (n: number, o?: { week?: boolean }) => string;
  run: Run;
  busy: boolean;
  onPhone: (app: string) => void;
  onWeek: () => void;
}) {
  const life = state.life;
  const [place, setPlace] = useState<PlaceId | null>(null);
  const [hover, setHover] = useState<PlaceId | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const [fade, setFade] = useState(false);
  const labelEls = useRef(new Map<string, HTMLElement>());
  const cam = useRef<CamCtl>(camStart());
  const walk = useRef<WalkCtl>({ yaw: 0, zoom: 1, use: -1 });
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const light = useMemo(() => cityLight(life, state.round), [life, state.round]);
  // the side panel covers the right of the canvas on wide screens; the picture is centred in what is left
  const [panelW, setPanelW] = useState(0);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 901px)");
    const set = () => setPanelW(m.matches ? 354 : 0);
    set();
    m.addEventListener("change", set);
    return () => m.removeEventListener("change", set);
  }, []);
  const nextMatch = state.calendar.find((c) => c.match);

  const say = (text: string) => setToast({ text, n: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const act = (p: string, action: string, arg?: string) =>
    run(
      () => careerApi.act(saved, p, action, arg),
      (r) => say(r.text),
    );

  // ---------- in and out of places ----------
  const enter = (id: PlaceId) => {
    const s = SPOTS[id];
    const c = cam.current;
    c.drift = false;
    c.idle = 0;
    gsap.to(c, { tx: s.x, tz: s.z, ty: 2, dist: 34, pitch: 0.42, duration: 1.0, ease: "power3.inOut" });
    setTimeout(() => setFade(true), 650);
    setTimeout(() => {
      setPlace(id);
      setPanel(null);
      setNear(null);
      walk.current = { yaw: 0, zoom: 1, use: -1 };
      setFade(false);
    }, 1000);
  };
  const leave = useCallback(() => {
    setFade(true);
    setTimeout(() => {
      setPlace(null);
      setPanel(null);
      setNear(null);
      setHotspots([]);
      const c = cam.current;
      gsap.killTweensOf(c);
      Object.assign(c, { dist: 60 });
      const home = camStart();
      gsap.to(c, { tx: home.tx, tz: home.tz, ty: home.ty, dist: home.dist, pitch: home.pitch, duration: 1.4, ease: "power2.out", onComplete: () => void (c.drift = true) });
      setFade(false);
    }, 300);
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && place) {
        if (panel) setPanel(null);
        else leave();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [place, panel, leave]);

  // ---------- using things ----------
  const use = (id: string) => {
    if (!place) return;
    if (id.startsWith("store:")) return setPanel({ kind: "store", brand: id.slice(6) });
    const P: Record<string, Panel> = {
      wardrobe: { kind: "wardrobe" },
      laptop: { kind: "homes" },
      trophies: { kind: "trophies" },
      garage: { kind: "garage" },
      table: { kind: "meals" },
      showroom: { kind: "cars" },
      drills: { kind: "sessions" },
      pitch: { kind: "match" },
    };
    if (P[id]) return setPanel(P[id]);
    if (place === "home" && (id === "rest" || id === "unwind")) return act("home", id);
    if (place === "gym") return act("gym", id);
    if (place === "stadium" && id === "fans") return act("stadium", "fans");
  };
  const latestUse = useRef(use);
  useEffect(() => {
    latestUse.current = use;
  });
  const onUse = useCallback((id: string) => latestUse.current(id), []);
  const onNear = useCallback((id: string | null) => setNear(id), []);
  const onHotspots = useCallback((h: Hotspot[]) => setHotspots(h), []);

  const outfit = place === "training" || place === "gym" || place === "stadium" ? OUTFITS.training : OUTFITS.home;
  const nearSpot = hotspots.find((h) => h.id === near);
  const placeName =
    place === "gym"
      ? life.places.gym
      : place === "restaurant"
        ? life.places.restaurant
        : place === "mall"
          ? life.places.mall
          : place === "shops"
            ? life.places.shops
            : place === "home"
              ? life.home.label
              : place
                ? PLACE_LABEL[place]
                : "";
  const sub = (id: PlaceId) =>
    id === "home"
      ? life.home.label
      : id === "stadium"
        ? nextMatch?.match
          ? "Week " + nextMatch.week + " v " + nextMatch.match.opp
          : "Matchday"
        : id === "gym"
          ? life.places.gym
          : id === "restaurant"
            ? life.places.restaurant
            : id === "mall"
              ? life.places.mall
              : id === "shops"
                ? life.places.shops + ", cars"
                : state.team || "Extra sessions";
  const Wx = { clear: light.night > 0.6 ? Moon : Sun, cloud: Cloud, rain: CloudRain, storm: CloudLightning, snow: Snowflake, fog: CloudFog, haze: CloudFog }[life.weather.kind] || Sun;

  return (
    <div className="pc-city">
      <div
        className={clsx("pc-city-canvas", place ? "is-inside" : "is-city", hover && "is-hover")}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, yaw: place ? walk.current.yaw : cam.current.yaw, pitch: cam.current.pitch };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !(e.buttons & 1)) return;
          const dx = e.clientX - d.x,
            dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) < 4) return;
          if (place) walk.current.yaw = d.yaw - dx * 0.008;
          else {
            const c = cam.current;
            c.yaw = d.yaw - dx * 0.005;
            c.pitch = THREE.MathUtils.clamp(d.pitch + dy * 0.004, 0.22, 1.25);
            c.idle = 0;
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => {
          if (place) walk.current.zoom = THREE.MathUtils.clamp(walk.current.zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.6, 1.6);
          else {
            cam.current.dist = THREE.MathUtils.clamp(cam.current.dist * (e.deltaY > 0 ? 1.08 : 0.93), 50, 220);
            cam.current.idle = 0;
          }
        }}
      >
        <Canvas
          dpr={[1, DPR_CAP[quality]]}
          shadows={quality >= 2 ? { type: THREE.PCFShadowMap } : false}
          gl={{ antialias: quality >= 1, powerPreference: "high-performance" }}
          camera={{ position: [90, 90, 110], fov: 38, near: 0.1, far: 1200 }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <CamSetup fov={place ? 48 : 42} far={place ? 200 : 1200} panel={panelW} />
          <Environment intensity={place ? 0.55 : 0.3} />
          {place ? (
            <Interior place={place} state={state} quality={quality} night={light.night} outfit={outfit} ctl={walk} labelEls={labelEls} onNear={onNear} onUse={onUse} onHotspots={onHotspots} />
          ) : (
            <CityScene life={life} round={state.round} quality={quality} hover={hover} onHover={setHover} onPick={enter} labelEls={labelEls} ctl={cam} />
          )}
          <FrameGuard quality={quality} onSlow={setQuality} />
        </Canvas>
        <div className={clsx("pc-city-fade", fade && "is-on")} aria-hidden="true" />
        {/* name cards that follow the buildings, or the things to use in a place */}
        <div className="pc-city-labels">
          {!place &&
            PLACE_IDS.map((id) => (
              <button
                type="button"
                key={id}
                className={clsx("pc-place-tag", hover === id && "is-hover", id === "home" && "is-home")}
                ref={(el) => {
                  if (el) labelEls.current.set(id, el);
                  else labelEls.current.delete(id);
                }}
                onClick={() => enter(id)}
                onPointerEnter={() => setHover(id)}
                onPointerLeave={() => setHover(null)}
                data-top={id === "home" ? homeTop(life.home.tier) : SPOTS[id].top}
              >
                <b>{PLACE_LABEL[id]}</b>
                <span>{sub(id)}</span>
              </button>
            ))}
          {place &&
            hotspots.map((h, k) => (
              <button
                type="button"
                key={h.id}
                className={clsx("pc-spot-tag", near === h.id && "is-near")}
                ref={(el) => {
                  if (el) labelEls.current.set("hs:" + h.id, el);
                  else labelEls.current.delete("hs:" + h.id);
                }}
                onClick={() => (walk.current.use = k)}
              >
                {h.label}
              </button>
            ))}
        </div>
      </div>

      {/* the week, the weather, free time */}
      <div className="pc-city-hud">
        <p className="pc-kicker">{place ? PLACE_LABEL[place] : life.city}</p>
        <h2 className="pc-city-title">{place ? placeName : life.city}</h2>
        <div className="pc-city-chips">
          <span className="pc-chip" title={WEATHER[life.weather.kind]}>
            <Wx size={16} weight="bold" aria-hidden="true" />
            {WEATHER[life.weather.kind]}, {life.weather.temp}°C
          </span>
          <span className="pc-chip" title="Free time left this week">
            Free time
            <span className="pc-pips" aria-label={life.time + " of " + life.freeTime}>
              {Array.from({ length: life.freeTime }, (_, i) => (
                <i key={i} className={clsx(i < life.time && "is-on")} />
              ))}
            </span>
          </span>
          <span className="pc-chip">{money(state.money.cash)}</span>
        </div>
      </div>

      <div className="pc-city-side">
        {!place ? (
          <>
            <p className="pc-dim pc-city-hint">Drag to look around. Pick a place to go in. Time out costs free time; shopping does not.</p>
            <ul className="pc-place-list">
              {PLACE_IDS.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className={clsx("pc-place-row", hover === id && "is-hover")}
                    onClick={() => enter(id)}
                    onPointerEnter={() => setHover(id)}
                    onPointerLeave={() => setHover(null)}
                  >
                    <b>{PLACE_LABEL[id]}</b>
                    <span>{sub(id)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="k-btn k-btn-primary pc-city-week" disabled={busy || state.seasonOver} onClick={onWeek}>
              {busy ? "Playing" : "Play the week"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="k-btn pc-city-back" onClick={leave}>
              Back to the city
            </button>
            {!panel ? (
              <>
                <p className="pc-dim pc-city-hint">Click the floor or use WASD to walk. Walk up to a glowing ring and press E.</p>
                <ul className="pc-place-list">
                  {hotspots.map((h, k) => (
                    <li key={h.id}>
                      <button type="button" className={clsx("pc-place-row", near === h.id && "is-hover")} onClick={() => (walk.current.use = k)}>
                        <b>{h.label}</b>
                      </button>
                    </li>
                  ))}
                </ul>
                {life.done.length > 0 && (
                  <ul className="pc-done">
                    {life.done.slice(0, 3).map((d, i) => (
                      <li key={i}>{d.text}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <PlacePanel panel={panel} state={state} money={money} busy={busy} act={act} close={() => setPanel(null)} onPhone={onPhone} />
            )}
          </>
        )}
      </div>

      {place && nearSpot && !panel && (
        <button type="button" className="pc-city-prompt" onClick={() => use(nearSpot.id)}>
          <kbd>E</kbd>
          {nearSpot.label}
        </button>
      )}
      {toast && (
        <p key={toast.n} className="pc-city-toast" role="status">
          {toast.text}
        </p>
      )}
    </div>
  );
}

// ---------- what a place offers ----------
function PlacePanel({
  panel,
  state,
  money,
  busy,
  act,
  close,
  onPhone,
}: {
  panel: NonNullable<Panel>;
  state: CareerState;
  money: (n: number, o?: { week?: boolean }) => string;
  busy: boolean;
  act: (p: string, a: string, arg?: string) => Promise<void>;
  close: () => void;
  onPhone: (app: string) => void;
}) {
  const life = state.life;
  const Row = ({ title, note, price, cta, off, onClick, done }: { title: string; note?: string; price?: string; cta: string; off?: boolean; onClick: () => void; done?: boolean }) => (
    <li className={clsx("pc-buy", done && "is-done")}>
      <div>
        <b>{title}</b>
        {note && <span>{note}</span>}
      </div>
      {price && <em>{price}</em>}
      <button type="button" className={clsx("k-btn k-btn-sm", !done && "k-btn-primary")} disabled={busy || off} onClick={onClick}>
        {cta}
      </button>
    </li>
  );
  let title = "";
  let body: React.ReactNode = null;
  if (panel.kind === "wardrobe") {
    title = "Wardrobe";
    const wearables = life.items.filter((i) => i.owned && i.look);
    body = wearables.length ? (
      <ul className="pc-buys">
        {wearables.map((i) => (
          <Row key={i.id} title={i.label} note={i.brand} cta={i.wearing ? "Take off" : "Wear"} done={i.wearing} onClick={() => act("home", "wear", i.id)} />
        ))}
      </ul>
    ) : (
      <p className="pc-dim">Watches, chains and earrings you buy at the shops hang here. Whatever you wear shows on you everywhere, the pitch too.</p>
    );
  } else if (panel.kind === "homes") {
    title = "Homes and money";
    body = (
      <>
        <p className="pc-dim">
          Now: {life.home.label} in {life.home.city}
          {life.home.mode === "rent" ? ", " + money(life.home.rent, { week: true }) : life.home.mode === "own" ? ", yours" : ""}. Living costs about {money(life.weeklyCost, { week: true })}.
        </p>
        <ul className="pc-buys">
          {life.homes
            .filter((h) => h.id !== "family" || state.life.city === state.life.hometown)
            .map((h) => {
              const here = life.home.id === h.id;
              const owned = life.owned.some((o) => o.id === h.id && o.city === life.city);
              if (h.id === "family")
                return <Row key={h.id} title={h.label} note={h.note} cta={here ? "You live here" : "Move back"} done={here} off={here} onClick={() => act("home", "move", "family:rent")} />;
              return (
                <li key={h.id} className={clsx("pc-buy", here && "is-done")}>
                  <div>
                    <b>{h.label}</b>
                    <span>{h.note}</span>
                  </div>
                  <em>
                    {h.rent ? money(h.rent, { week: true }) : ""}
                    {h.buy ? (h.rent ? " or " : "") + money(h.buy) : ""}
                  </em>
                  <span className="pc-buy-btns">
                    {h.rent > 0 && (
                      <button type="button" className="k-btn k-btn-sm" disabled={busy || here || !h.canRent} onClick={() => act("home", "move", h.id + ":rent")}>
                        Rent
                      </button>
                    )}
                    {h.buy > 0 && (
                      <button type="button" className="k-btn k-btn-primary k-btn-sm" disabled={busy || (here && owned) || (!owned && !h.canBuy)} onClick={() => act("home", "move", h.id + ":buy")}>
                        {owned ? "Move in" : "Buy"}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
        </ul>
        {life.owned.length > 0 && (
          <>
            <h4 className="pc-h4">Homes you own</h4>
            <ul className="pc-buys">
              {life.owned.map((o, i) => (
                <Row key={i} title={o.label + ", " + o.city} note={"Bought for " + money(o.price || o.buy)} cta="Sell" onClick={() => act("home", "sell", o.id)} />
              ))}
            </ul>
          </>
        )}
        <button type="button" className="k-btn" onClick={() => onPhone("bank")}>
          Open the bank
        </button>
      </>
    );
  } else if (panel.kind === "trophies") {
    title = "Trophy cabinet";
    body =
      state.trophies.length + state.awards.length ? (
        <ul className="pc-honours">
          {state.trophies.map((t, i) => (
            <li key={"t" + i}>
              <span className="pc-cup" aria-hidden="true" />
              {t.title}
              <em>{t.club}</em>
            </li>
          ))}
          {state.awards.map((a, i) => (
            <li key={"a" + i} className="is-award">
              <span className="pc-cup" aria-hidden="true" />
              {a.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pc-dim">Empty shelves, for now. Every one of them is waiting for something.</p>
      );
  } else if (panel.kind === "garage") {
    title = "Your cars";
    const mine = life.cars.filter((c) => c.owned);
    body = mine.length ? (
      <ul className="pc-buys">
        {mine.map((c) => (
          <Row
            key={c.id}
            title={c.brand + " " + c.model}
            note={money(c.upkeep, { week: true }) + " to run"}
            cta={life.car?.id === c.id ? "Driving it" : "Drive this one"}
            done={life.car?.id === c.id}
            off={life.car?.id === c.id}
            onClick={() => act("home", "drive", c.id)}
          />
        ))}
      </ul>
    ) : (
      <p className="pc-dim">No cars yet. The showroom is at the shops.</p>
    );
  } else if (panel.kind === "meals") {
    title = "The menu";
    body = (
      <ul className="pc-buys">
        {life.meals.map((m) => (
          <Row key={m.id} title={m.label} note={m.note} price={money(m.price)} cta="Order" off={life.time < 1 || state.money.cash < m.price} onClick={() => act("restaurant", m.id)} />
        ))}
      </ul>
    );
  } else if (panel.kind === "store") {
    const brands = panel.brand === "Halcyon" ? ["Halcyon", "Maison Orrè"] : [panel.brand];
    title = panel.brand || "Shop";
    const items = life.items.filter((i) => brands.includes(i.brand));
    body = (
      <ul className="pc-buys">
        {items.map((i) => (
          <Row
            key={i.id}
            title={i.label}
            note={i.look ? "Shows on you in 3D" : i.perk === "unwind" ? "Unlocks game nights at home" : undefined}
            price={money(i.price)}
            cta={i.owned ? "Yours" : "Buy"}
            done={i.owned}
            off={i.owned || state.money.cash < i.price}
            onClick={() => act(i.shop, "buy", i.id)}
          />
        ))}
      </ul>
    );
  } else if (panel.kind === "cars") {
    title = "Car showroom";
    body = (
      <ul className="pc-buys">
        {life.cars.map((c) => (
          <Row
            key={c.id}
            title={c.brand + " " + c.model}
            note={c.body === "scooter" ? "Fine from fifteen" : "Running costs " + money(c.upkeep, { week: true })}
            price={money(c.price)}
            cta={c.owned ? "Yours" : "Buy"}
            done={c.owned}
            off={c.owned || !c.canBuy}
            onClick={() => act("shops", "car", c.id)}
          />
        ))}
      </ul>
    );
  } else if (panel.kind === "sessions") {
    title = "Extra session";
    body = (
      <ul className="pc-buys">
        {Object.entries(state.training.sessions)
          .filter(([id]) => id !== "rest")
          .map(([id, s]) => (
            <Row key={id} title={s.label} note={s.grows ? "Works on " + s.grows.length + " attributes" : "Feel better"} cta="Do it" off={state.life.time < 1} onClick={() => act("training", id)} />
          ))}
      </ul>
    );
  } else {
    title = "Coming up";
    body = (
      <ul className="pc-ledger">
        {state.calendar.slice(0, 6).map((c) => (
          <li key={c.week}>
            <span>
              Week {c.week}
              {c.intl ? ", international window" : ""}
            </span>
            <b>{c.match ? (c.match.home === false ? "at " : "v ") + c.match.opp : "No match"}</b>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="pc-place-panel">
      <div className="pc-place-panel-head">
        <h3 className="pc-h3">{title}</h3>
        <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={close}>
          Close
        </button>
      </div>
      {body}
    </div>
  );
}
